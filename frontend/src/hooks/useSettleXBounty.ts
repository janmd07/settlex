'use client';

import { useState, useCallback, useEffect } from 'react';
import { parseEther } from 'viem';
import { useMonadWallet } from './useMonadWallet';
import {
  FormattedBounty,
  FormattedSubmission,
  BountyRole,
  BountyState,
  TransactionState,
  PaymentActivityItem,
  PaymentSummary,
  SettlementTxDetails,
  fetchBounty,
  fetchBountySubmissions,
  fetchNextBountyId,
  fetchAllBounties,
  fetchUserBounties,
  fetchClaimableReward,
  fetchHasSubmitted,
  fetchSettlementTxHash,
  fetchWalletPaymentSummary,
  fetchWalletPaymentActivity,
  recordSettlementTx,
  getCachedSettlementTx,
  createBounty,
  submitBountyWork,
  closeBountySubmissions,
  selectBountyWinner,
  escalateBountyToDispute,
  resolveBountyDispute,
  claimExpiredBountyRefund,
  claimBountyReward,
  WriteTxResult,
  getExplorerTxUrl,
  SETTLEX_BOUNTY_ADDRESS,
  CreateBountyParams,
  SubmitWorkParams,
} from '../contracts';

export function useSettleXBounty() {
  const wallet = useMonadWallet();

  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  const [activeBounty, setActiveBounty] = useState<FormattedBounty | null>(null);
  const [submissions, setSubmissions] = useState<FormattedSubmission[]>([]);
  const [allBounties, setAllBounties] = useState<FormattedBounty[]>([]);
  const [isLoadingAllBounties, setIsLoadingAllBounties] = useState(false);
  const [isLoadingBounty, setIsLoadingBounty] = useState(false);
  const [nextBountyId, setNextBountyId] = useState<number | null>(null);
  const [claimableReward, setClaimableReward] = useState<bigint>(BigInt(0));
  const [userHasSubmitted, setUserHasSubmitted] = useState<boolean>(false);
  const [activeSettlementTx, setActiveSettlementTx] = useState<SettlementTxDetails | null>(null);
  const [isLoadingSettlementTx, setIsLoadingSettlementTx] = useState<boolean>(false);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentActivity, setPaymentActivity] = useState<PaymentActivityItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);

  // Role detection for the active connected wallet
  const userAddressLower = wallet.account?.toLowerCase();
  const isCreator = Boolean(
    userAddressLower && activeBounty && activeBounty.creator.toLowerCase() === userAddressLower
  );
  const isDisputeResolver = Boolean(
    userAddressLower &&
      activeBounty &&
      activeBounty.disputeResolver !== '0x0000000000000000000000000000000000000000' &&
      activeBounty.disputeResolver.toLowerCase() === userAddressLower
  );
  const isContributor = Boolean(userHasSubmitted);

  let currentRole: BountyRole = 'Observer';
  if (isCreator) currentRole = 'Creator';
  else if (isDisputeResolver) currentRole = 'DisputeResolver';
  else if (isContributor) currentRole = 'Contributor';

  // Read: Load full bounty details and its submissions
  const loadBounty = useCallback(
    async (bountyId: number) => {
      setIsLoadingBounty(true);
      try {
        const bounty = await fetchBounty(bountyId);
        setActiveBounty(bounty);

        const subs = await fetchBountySubmissions(bountyId);
        setSubmissions(subs);

        if (wallet.account) {
          const hasSub = await fetchHasSubmitted(bountyId, wallet.account as `0x${string}`);
          setUserHasSubmitted(hasSub);

          const claimable = await fetchClaimableReward(wallet.account as `0x${string}`);
          setClaimableReward(claimable);
        }

        if (bounty.state === BountyState.Settled || bounty.state === BountyState.Refunded) {
          setIsLoadingSettlementTx(true);
          fetchSettlementTxHash(bounty.bountyId, bounty.state, bounty.settledAtTimestamp)
            .then((tx) => setActiveSettlementTx(tx))
            .catch((err) => console.warn('Failed to resolve settlement tx:', err))
            .finally(() => setIsLoadingSettlementTx(false));
        } else {
          setActiveSettlementTx(null);
        }

        return bounty;
      } catch (err) {
        console.error('Failed to load bounty:', err);
        setActiveBounty(null);
        setSubmissions([]);
        setActiveSettlementTx(null);
        throw err;
      } finally {
        setIsLoadingBounty(false);
      }
    },
    [wallet.account]
  );

  // Read: Resolve settlement transaction for a bounty
  const resolveBountySettlementTx = useCallback(
    async (bountyId: number, state?: BountyState, settledAt?: number) => {
      setIsLoadingSettlementTx(true);
      try {
        const details = await fetchSettlementTxHash(bountyId, state, settledAt);
        if (activeBounty && activeBounty.bountyId === bountyId) {
          setActiveSettlementTx(details);
        }
        return details;
      } catch (err) {
        console.warn(`Failed to resolve settlement tx for bounty #${bountyId}:`, err);
        return null;
      } finally {
        setIsLoadingSettlementTx(false);
      }
    },
    [activeBounty]
  );

  // Read: Load user payment summary and activity ledger
  const loadPaymentData = useCallback(async () => {
    if (!wallet.account) {
      setPaymentSummary(null);
      setPaymentActivity([]);
      return { summary: null, activity: [] };
    }
    setIsLoadingPayments(true);
    try {
      const userAddr = wallet.account as `0x${string}`;
      const [summary, activity] = await Promise.all([
        fetchWalletPaymentSummary(userAddr),
        fetchWalletPaymentActivity(userAddr),
      ]);
      setPaymentSummary(summary);
      setPaymentActivity(activity);
      return { summary, activity };
    } catch (err) {
      console.error('Failed to load wallet payment data:', err);
      return { summary: null, activity: [] };
    } finally {
      setIsLoadingPayments(false);
    }
  }, [wallet.account]);

  // Read: Refresh nextBountyId
  const refreshNextBountyId = useCallback(async () => {
    try {
      const nextId = await fetchNextBountyId();
      setNextBountyId(Number(nextId));
      return Number(nextId);
    } catch (err) {
      console.error('Failed to fetch nextBountyId:', err);
      return null;
    }
  }, []);

  // Read: Refresh claimable rewards for connected wallet
  const refreshClaimableReward = useCallback(async () => {
    if (!wallet.account) {
      setClaimableReward(BigInt(0));
      return BigInt(0);
    }
    try {
      const reward = await fetchClaimableReward(wallet.account as `0x${string}`);
      setClaimableReward(reward);
      return reward;
    } catch (err) {
      console.error('Failed to fetch claimable reward:', err);
      return BigInt(0);
    }
  }, [wallet.account]);

  // Read: Load all discoverable bounties sequentially from 1 to nextBountyId - 1
  const loadAllBounties = useCallback(async () => {
    setIsLoadingAllBounties(true);
    try {
      const list = await fetchAllBounties();
      setAllBounties(list);
      return list;
    } catch (err) {
      console.error('Failed to load all bounties:', err);
      return [];
    } finally {
      setIsLoadingAllBounties(false);
    }
  }, []);

  // Read: Load user bounties
  const loadUserBounties = useCallback(async (address: `0x${string}`) => {
    try {
      const ids = await fetchUserBounties(address);
      return ids.map((id) => Number(id));
    } catch (err) {
      console.error('Failed to load user bounties:', err);
      return [];
    }
  }, []);

  // Guarded execution wrapper
  const executeGuardedWrite = async (
    actionName: string,
    writeFn: (onPending: (hash: `0x${string}`) => void) => Promise<WriteTxResult>
  ): Promise<WriteTxResult> => {
    const isReady = await wallet.ensureMonadNetwork();
    if (!isReady) {
      return {
        success: false,
        error: 'Monad Testnet (Chain ID 10143) is required to execute transactions.',
      };
    }

    setTxState({ status: 'submitting' });

    const result = await writeFn((hash) => {
      setTxState({ status: 'pending', hash });
    });

    if (result.success && result.hash) {
      setTxState({
        status: 'confirmed',
        hash: result.hash,
      });

      // Automatically reload active bounty and all bounties
      setTimeout(() => {
        loadAllBounties().catch(console.error);
        if (activeBounty) {
          loadBounty(activeBounty.bountyId).catch(console.error);
          refreshClaimableReward().catch(console.error);
        }
      }, 1500);
    } else {
      setTxState({
        status: 'error',
        hash: result.hash,
        errorMessage: result.error || `${actionName} failed`,
      });
    }

    return result;
  };

  // Actions
  const handleCreateBounty = async (params: CreateBountyParams): Promise<WriteTxResult> => {
    const rewardWei = parseEther(params.rewardMon);
    return executeGuardedWrite('Create Bounty', (onPending) =>
      createBounty(
        params.taskTitle,
        params.taskMetadataUri,
        params.acceptanceCriteria,
        params.maxSubmissions,
        params.durationSeconds,
        params.disputeResolverAddress,
        rewardWei,
        onPending
      )
    );
  };

  const handleSubmitWork = async (params: SubmitWorkParams): Promise<WriteTxResult> => {
    return executeGuardedWrite('Submit Work', (onPending) =>
      submitBountyWork(params.bountyId, params.proofUri, params.notes, onPending)
    );
  };

  const handleCloseSubmissions = async (bountyId: number): Promise<WriteTxResult> => {
    return executeGuardedWrite('Close Submissions', (onPending) =>
      closeBountySubmissions(bountyId, onPending)
    );
  };

  const handleSelectWinner = async (
    bountyId: number,
    winnerSubmissionId: number
  ): Promise<WriteTxResult> => {
    const res = await executeGuardedWrite('Select Winner', (onPending) =>
      selectBountyWinner(bountyId, winnerSubmissionId, onPending)
    );
    if (res.success && res.hash) {
      const winnerSub = submissions.find((s) => s.submissionId === winnerSubmissionId);
      const details: SettlementTxDetails = {
        bountyId,
        txHash: res.hash,
        blockNumber: res.receipt?.blockNumber || 0n,
        explorerUrl: getExplorerTxUrl(res.hash),
        timestamp: Math.floor(Date.now() / 1000),
        eventType: 'WinnerSelected',
        winnerAddress: winnerSub?.contributor,
      };
      recordSettlementTx(details);
      setActiveSettlementTx(details);
    }
    return res;
  };

  const handleEscalateToDispute = async (bountyId: number): Promise<WriteTxResult> => {
    return executeGuardedWrite('Escalate to Dispute', (onPending) =>
      escalateBountyToDispute(bountyId, onPending)
    );
  };

  const handleResolveDispute = async (
    bountyId: number,
    winnerSubmissionId: number
  ): Promise<WriteTxResult> => {
    const res = await executeGuardedWrite('Resolve Dispute', (onPending) =>
      resolveBountyDispute(bountyId, winnerSubmissionId, onPending)
    );
    if (res.success && res.hash) {
      const winnerSub = submissions.find((s) => s.submissionId === winnerSubmissionId);
      const details: SettlementTxDetails = {
        bountyId,
        txHash: res.hash,
        blockNumber: res.receipt?.blockNumber || 0n,
        explorerUrl: getExplorerTxUrl(res.hash),
        timestamp: Math.floor(Date.now() / 1000),
        eventType: 'DisputeResolved',
        winnerAddress: winnerSub?.contributor,
      };
      recordSettlementTx(details);
      setActiveSettlementTx(details);
    }
    return res;
  };

  const handleClaimRefund = async (bountyId: number): Promise<WriteTxResult> => {
    const res = await executeGuardedWrite('Claim Expired Refund', (onPending) =>
      claimExpiredBountyRefund(bountyId, onPending)
    );
    if (res.success && res.hash) {
      const details: SettlementTxDetails = {
        bountyId,
        txHash: res.hash,
        blockNumber: res.receipt?.blockNumber || 0n,
        explorerUrl: getExplorerTxUrl(res.hash),
        timestamp: Math.floor(Date.now() / 1000),
        eventType: 'BountyRefunded',
      };
      recordSettlementTx(details);
      setActiveSettlementTx(details);
    }
    return res;
  };

  const handleClaimReward = async (): Promise<WriteTxResult> => {
    return executeGuardedWrite('Claim Pending Reward', (onPending) =>
      claimBountyReward(onPending)
    );
  };

  const resetTxState = () => {
    setTxState({ status: 'idle' });
  };

  // Re-check role when wallet changes
  useEffect(() => {
    if (activeBounty && wallet.account) {
      fetchHasSubmitted(activeBounty.bountyId, wallet.account as `0x${string}`)
        .then(setUserHasSubmitted)
        .catch(console.error);

      fetchClaimableReward(wallet.account as `0x${string}`)
        .then(setClaimableReward)
        .catch(console.error);
    }
  }, [activeBounty, wallet.account]);

  return {
    contractAddress: SETTLEX_BOUNTY_ADDRESS,
    isBountyDeployed: SETTLEX_BOUNTY_ADDRESS !== '0x0000000000000000000000000000000000000000',
    activeBounty,
    submissions,
    allBounties,
    isLoadingAllBounties,
    isLoadingBounty,
    nextBountyId,
    txState,
    currentRole,
    isCreator,
    isContributor,
    isDisputeResolver,
    isArbiter: isDisputeResolver,
    userHasSubmitted,
    claimableReward,
    activeSettlementTx,
    isLoadingSettlementTx,
    paymentSummary,
    paymentActivity,
    isLoadingPayments,
    loadPaymentData,
    resolveBountySettlementTx,
    loadBounty,
    loadAllBounties,
    refreshNextBountyId,
    refreshClaimableReward,
    loadUserBounties,
    handleCreateBounty,
    handleSubmitWork,
    handleCloseSubmissions,
    handleSelectWinner,
    handleEscalateToDispute,
    handleResolveDispute,
    handleClaimRefund,
    handleClaimReward,
    resetTxState,
  };
}
