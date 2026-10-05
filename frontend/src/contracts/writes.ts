import {
  BaseError,
  ContractFunctionRevertedError,
  TransactionReceipt,
  UserRejectedRequestError,
} from 'viem';
import {
  MONAD_TESTNET_CHAIN_ID,
  SETTLEX_BOUNTY_ADDRESS,
  SETTLEX_ESCROW_ADDRESS,
  getExplorerTxUrl,
} from '../config/contract';
import { SETTLEX_ESCROW_ABI } from './abi';
import { SETTLEX_BOUNTY_ABI } from './bountyAbi';
import { getWalletClient, publicClient } from './client';

export interface WriteTxResult {
  success: boolean;
  hash?: `0x${string}`;
  explorerUrl?: string;
  receipt?: TransactionReceipt;
  error?: string;
  userRejected?: boolean;
}

/**
 * Validates that an active wallet is connected and operating on Monad Testnet (Chain ID 10143).
 */
async function getValidatedAccount(): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();

  if (!account) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }

  const chainId = await walletClient.getChainId();
  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new Error(
      `Wallet is on chain ID ${chainId}. Monad Testnet (Chain ID ${MONAD_TESTNET_CHAIN_ID}) is required.`
    );
  }

  return account;
}

/**
 * Parses contract errors into user-friendly error messages.
 */
export function parseContractError(err: unknown): { message: string; userRejected: boolean } {
  if (err instanceof UserRejectedRequestError) {
    return {
      message: 'Transaction signature was rejected in your wallet.',
      userRejected: true,
    };
  }

  if (err instanceof BaseError) {
    const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName || revertError.shortMessage;
      return {
        message: `Transaction reverted by contract: ${errorName}`,
        userRejected: false,
      };
    }
    return {
      message: err.shortMessage || err.message,
      userRejected: false,
    };
  }

  const fallback = err instanceof Error ? err.message : String(err);
  if (fallback.includes('4001') || fallback.toLowerCase().includes('user rejected')) {
    return {
      message: 'Transaction signature was rejected in your wallet.',
      userRejected: true,
    };
  }

  return {
    message: fallback,
    userRejected: false,
  };
}

/**
 * Common execution wrapper that sends transaction, waits for receipt, and returns structured result.
 */
async function executeContractWrite(
  functionName: any,
  args: any[],
  value?: bigint,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  try {
    const account = await getValidatedAccount();
    const walletClient = getWalletClient(account);

    // Send transaction
    const hash = await (walletClient.writeContract as any)({
      address: SETTLEX_ESCROW_ADDRESS,
      abi: SETTLEX_ESCROW_ABI,
      functionName,
      args,
      account,
      value,
    });

    if (onPending) {
      onPending(hash);
    }

    // Wait for onchain receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'reverted') {
      return {
        success: false,
        hash,
        explorerUrl: getExplorerTxUrl(hash),
        receipt,
        error: 'Transaction was mined but reverted onchain.',
        userRejected: false,
      };
    }

    return {
      success: true,
      hash,
      explorerUrl: getExplorerTxUrl(hash),
      receipt,
      userRejected: false,
    };
  } catch (err) {
    const parsed = parseContractError(err);
    return {
      success: false,
      error: parsed.message,
      userRejected: parsed.userRejected,
    };
  }
}

// =============================================================================
// CONTRACT WRITE FUNCTIONS
// =============================================================================

/**
 * 1. createDeal
 * Buyer initiates an unfunded escrow deal.
 */
export async function createDeal(
  seller: `0x${string}`,
  amountWei: bigint,
  deadlineUnix: bigint,
  arbiter: `0x${string}` = '0x0000000000000000000000000000000000000000',
  metadataUri: string = '',
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'createDeal',
    [seller, amountWei, deadlineUnix, arbiter, metadataUri],
    undefined,
    onPending
  );
}

/**
 * 2. createAndFundDeal
 * Buyer atomically creates and funds an escrow deal with native MON.
 */
export async function createAndFundDeal(
  seller: `0x${string}`,
  amountWei: bigint,
  deadlineUnix: bigint,
  arbiter: `0x${string}` = '0x0000000000000000000000000000000000000000',
  metadataUri: string = '',
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'createAndFundDeal',
    [seller, amountWei, deadlineUnix, arbiter, metadataUri],
    amountWei,
    onPending
  );
}

/**
 * 3. fundDeal
 * Buyer deposits exact native MON into a Created deal before deadline.
 */
export async function fundDeal(
  dealId: bigint | number,
  amountWei: bigint,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'fundDeal',
    [BigInt(dealId)],
    amountWei,
    onPending
  );
}

/**
 * 4. cancelDeal
 * Buyer or Seller cancels an unfunded deal.
 */
export async function cancelDeal(
  dealId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite('cancelDeal', [BigInt(dealId)], undefined, onPending);
}

/**
 * 5. submitWork
 * Seller marks work as submitted and records deliverable proof URI.
 */
export async function submitWork(
  dealId: bigint | number,
  submissionUri: string,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'submitWork',
    [BigInt(dealId), submissionUri],
    undefined,
    onPending
  );
}

/**
 * 6. approveAndRelease
 * Buyer approves deliverable and releases 100% of escrow to Seller.
 */
export async function approveAndRelease(
  dealId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite('approveAndRelease', [BigInt(dealId)], undefined, onPending);
}

/**
 * 7. refundBuyer
 * Seller voluntarily forfeits escrow and refunds 100% to Buyer.
 */
export async function refundBuyer(
  dealId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite('refundBuyer', [BigInt(dealId)], undefined, onPending);
}

/**
 * 8. claimExpiredRefund
 * Buyer claims 100% refund when deadline has expired without delivery.
 */
export async function claimExpiredRefund(
  dealId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite('claimExpiredRefund', [BigInt(dealId)], undefined, onPending);
}

/**
 * 9. raiseDispute
 * Buyer or Seller escalates active escrow into Disputed state.
 */
export async function raiseDispute(
  dealId: bigint | number,
  reason: string,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'raiseDispute',
    [BigInt(dealId), reason],
    undefined,
    onPending
  );
}

/**
 * 10. resolveDispute
 * Designated Arbiter resolves dispute by dividing funds between Buyer and Seller.
 */
export async function resolveDispute(
  dealId: bigint | number,
  buyerAmountWei: bigint,
  sellerAmountWei: bigint,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeContractWrite(
    'resolveDispute',
    [BigInt(dealId), buyerAmountWei, sellerAmountWei],
    undefined,
    onPending
  );
}

/* ==========================================================================
   SettleX V2: Permissionless Onchain Work Bounty Writes
   ========================================================================== */

/**
 * Common execution wrapper for SettleX V2 Bounty contract transactions.
 */
async function executeBountyWrite(
  functionName: any,
  args: any[],
  value?: bigint,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  try {
    const account = await getValidatedAccount();
    const walletClient = getWalletClient(account);

    const hash = await (walletClient.writeContract as any)({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName,
      args,
      account,
      value,
    });

    if (onPending) {
      onPending(hash);
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'reverted') {
      return {
        success: false,
        hash,
        explorerUrl: getExplorerTxUrl(hash),
        receipt,
        error: 'Transaction was mined but reverted onchain.',
        userRejected: false,
      };
    }

    return {
      success: true,
      hash,
      explorerUrl: getExplorerTxUrl(hash),
      receipt,
      userRejected: false,
    };
  } catch (err) {
    const parsed = parseContractError(err);
    return {
      success: false,
      error: parsed.message,
      userRejected: parsed.userRejected,
    };
  }
}

/**
 * Creator creates and funds a permissionless work bounty with native MON.
 */
export async function createBounty(
  taskTitle: string,
  taskMetadataUri: string,
  acceptanceCriteria: string,
  maxSubmissions: number,
  durationSeconds: number,
  disputeResolver: `0x${string}` = '0x0000000000000000000000000000000000000000',
  rewardWei: bigint,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  const nowUnix = BigInt(Math.floor(Date.now() / 1000));
  const submissionDeadline = nowUnix + BigInt(durationSeconds);
  const metadataPayload = JSON.stringify({
    title: taskTitle,
    description: taskMetadataUri,
    criteria: acceptanceCriteria,
  });

  return executeBountyWrite(
    'createBounty',
    [
      submissionDeadline,
      maxSubmissions,
      disputeResolver,
      metadataPayload,
    ],
    rewardWei,
    onPending
  );
}

/**
 * Contributor submits proof of work to an Open bounty.
 */
export async function submitBountyWork(
  bountyId: bigint | number,
  proofUri: string,
  notes: string = '',
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  const payload = notes ? `${proofUri} | Notes: ${notes}` : proofUri;
  return executeBountyWrite(
    'submitWork',
    [BigInt(bountyId), payload],
    undefined,
    onPending
  );
}

/**
 * Anyone can close submissions once the submission deadline has elapsed.
 */
export async function closeBountySubmissions(
  bountyId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'closeSubmissions',
    [BigInt(bountyId)],
    undefined,
    onPending
  );
}

/**
 * Creator selects exactly ONE Winner during the active 24-hour review window.
 */
export async function selectBountyWinner(
  bountyId: bigint | number,
  winnerSubmissionId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'selectWinner',
    [BigInt(bountyId), BigInt(winnerSubmissionId)],
    undefined,
    onPending
  );
}

/**
 * Anyone can escalate the bounty to DisputeReview if Creator missed the 24-hour review window.
 */
export async function escalateBountyToDispute(
  bountyId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'escalateToDispute',
    [BigInt(bountyId)],
    undefined,
    onPending
  );
}

/**
 * Designated Arbiter selects the winning submission during DisputeReview.
 */
export async function resolveBountyDispute(
  bountyId: bigint | number,
  winnerSubmissionId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'resolveDispute',
    [BigInt(bountyId), BigInt(winnerSubmissionId)],
    undefined,
    onPending
  );
}

/**
 * Creator reclaims 100% of reward if submission deadline passed with 0 submissions.
 */
export async function claimExpiredBountyRefund(
  bountyId: bigint | number,
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'claimExpiredBountyRefund',
    [BigInt(bountyId)],
    undefined,
    onPending
  );
}

/**
 * Pull-payment fallback: User claims any queued reward allocations.
 */
export async function claimBountyReward(
  onPending?: (hash: `0x${string}`) => void
): Promise<WriteTxResult> {
  return executeBountyWrite(
    'claimReward',
    [],
    undefined,
    onPending
  );
}
