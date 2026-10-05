'use client';

import { useState, useCallback } from 'react';
import { useMonadWallet } from './useMonadWallet';
import {
  FormattedDeal,
  TransactionState,
  fetchDeal,
  fetchNextDealId,
  fetchUserDeals,
  createDeal,
  createAndFundDeal,
  fundDeal,
  cancelDeal,
  submitWork,
  approveAndRelease,
  refundBuyer,
  claimExpiredRefund,
  raiseDispute,
  resolveDispute,
  WriteTxResult,
  getExplorerTxUrl,
  SETTLEX_ESCROW_ADDRESS,
} from '../contracts';

export function useSettleXContract() {
  const wallet = useMonadWallet();

  // Transaction execution state
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  const [activeDeal, setActiveDeal] = useState<FormattedDeal | null>(null);
  const [isLoadingDeal, setIsLoadingDeal] = useState(false);
  const [nextDealId, setNextDealId] = useState<number | null>(null);

  // Read: Load deal by ID
  const loadDeal = useCallback(async (dealId: number) => {
    setIsLoadingDeal(true);
    try {
      const deal = await fetchDeal(dealId);
      setActiveDeal(deal);
      return deal;
    } catch (err) {
      console.error('Failed to load deal:', err);
      setActiveDeal(null);
      throw err;
    } finally {
      setIsLoadingDeal(false);
    }
  }, []);

  // Read: Refresh nextDealId
  const refreshNextDealId = useCallback(async () => {
    try {
      const nextId = await fetchNextDealId();
      setNextDealId(Number(nextId));
      return Number(nextId);
    } catch (err) {
      console.error('Failed to fetch nextDealId:', err);
      return null;
    }
  }, []);

  // Read: Load all deals for user
  const loadUserDeals = useCallback(async (address: `0x${string}`) => {
    try {
      const dealIds = await fetchUserDeals(address);
      return dealIds.map((id) => Number(id));
    } catch (err) {
      console.error('Failed to fetch user deals:', err);
      return [];
    }
  }, []);

  // Helper to wrap write calls with network validation & state updates
  const executeGuardedWrite = async (
    actionName: string,
    writeFn: (onPending: (hash: `0x${string}`) => void) => Promise<WriteTxResult>
  ): Promise<WriteTxResult> => {
    // 1. Enforce network & wallet readiness
    const isReady = await wallet.ensureMonadNetwork();
    if (!isReady) {
      return {
        success: false,
        error: 'Monad Testnet (Chain ID 10143) is required to execute transactions.',
      };
    }

    // 2. Set submitting state (awaiting wallet signature)
    setTxState({ status: 'submitting' });

    // 3. Execute write (transitions to pending once hash is received)
    const result = await writeFn((hash) => {
      setTxState({ status: 'pending', hash });
    });

    // 4. Update status post-execution
    if (result.success && result.hash) {
      setTxState({
        status: 'confirmed',
        hash: result.hash,
      });
      wallet.refreshBalance();
      refreshNextDealId();
      if (activeDeal) {
        loadDeal(activeDeal.dealId);
      }
    } else {
      setTxState({
        status: 'error',
        hash: result.hash,
        errorMessage: result.error || 'Transaction failed',
      });
    }

    return result;
  };

  // Exposed Write Helpers
  const handleCreateDeal = (
    seller: `0x${string}`,
    amountWei: bigint,
    deadlineUnix: bigint,
    arbiter?: `0x${string}`,
    metadataUri?: string
  ) =>
    executeGuardedWrite('createDeal', (onPending) =>
      createDeal(seller, amountWei, deadlineUnix, arbiter, metadataUri, onPending)
    );

  const handleCreateAndFundDeal = (
    seller: `0x${string}`,
    amountWei: bigint,
    deadlineUnix: bigint,
    arbiter?: `0x${string}`,
    metadataUri?: string
  ) =>
    executeGuardedWrite('createAndFundDeal', (onPending) =>
      createAndFundDeal(seller, amountWei, deadlineUnix, arbiter, metadataUri, onPending)
    );

  const handleFundDeal = (dealId: number, amountWei: bigint) =>
    executeGuardedWrite('fundDeal', (onPending) =>
      fundDeal(dealId, amountWei, onPending)
    );

  const handleCancelDeal = (dealId: number) =>
    executeGuardedWrite('cancelDeal', (onPending) =>
      cancelDeal(dealId, onPending)
    );

  const handleSubmitWork = (dealId: number, submissionUri: string) =>
    executeGuardedWrite('submitWork', (onPending) =>
      submitWork(dealId, submissionUri, onPending)
    );

  const handleApproveAndRelease = (dealId: number) =>
    executeGuardedWrite('approveAndRelease', (onPending) =>
      approveAndRelease(dealId, onPending)
    );

  const handleRefundBuyer = (dealId: number) =>
    executeGuardedWrite('refundBuyer', (onPending) =>
      refundBuyer(dealId, onPending)
    );

  const handleClaimExpiredRefund = (dealId: number) =>
    executeGuardedWrite('claimExpiredRefund', (onPending) =>
      claimExpiredRefund(dealId, onPending)
    );

  const handleRaiseDispute = (dealId: number, reason: string) =>
    executeGuardedWrite('raiseDispute', (onPending) =>
      raiseDispute(dealId, reason, onPending)
    );

  const handleResolveDispute = (
    dealId: number,
    buyerAmountWei: bigint,
    sellerAmountWei: bigint
  ) =>
    executeGuardedWrite('resolveDispute', (onPending) =>
      resolveDispute(dealId, buyerAmountWei, sellerAmountWei, onPending)
    );

  const resetTxState = () => setTxState({ status: 'idle' });

  return {
    contractAddress: SETTLEX_ESCROW_ADDRESS,
    wallet,
    txState,
    activeDeal,
    nextDealId,
    isLoadingDeal,
    resetTxState,
    loadDeal,
    refreshNextDealId,
    loadUserDeals,
    createDeal: handleCreateDeal,
    createAndFundDeal: handleCreateAndFundDeal,
    fundDeal: handleFundDeal,
    cancelDeal: handleCancelDeal,
    submitWork: handleSubmitWork,
    approveAndRelease: handleApproveAndRelease,
    refundBuyer: handleRefundBuyer,
    claimExpiredRefund: handleClaimExpiredRefund,
    raiseDispute: handleRaiseDispute,
    resolveDispute: handleResolveDispute,
    getExplorerTxUrl,
  };
}
