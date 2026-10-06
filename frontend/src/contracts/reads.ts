import { decodeEventLog, formatEther, pad, toHex } from 'viem';
import { SETTLEX_BOUNTY_ADDRESS, SETTLEX_ESCROW_ADDRESS, getExplorerTxUrl } from '../config/contract';
import { SETTLEX_ESCROW_ABI } from './abi';
import { SETTLEX_BOUNTY_ABI } from './bountyAbi';
import { publicClient } from './client';
import {
  BOUNTY_STATE_DESCRIPTIONS,
  BOUNTY_STATE_LABELS,
  BountyState,
  DEAL_STATE_LABELS,
  DealState,
  FormattedBounty,
  FormattedDeal,
  FormattedSubmission,
  PaymentActivityItem,
  PaymentSummary,
  SettlementTxDetails,
  RawBounty,
  RawDeal,
  RawSubmission,
  CreatorBountyClassification,
  CreatorTab,
  CreatorBountyCategory,
} from './types';

/**
 * Formats a raw deal struct returned by the contract into a clean UI-ready representation.
 */
export function formatDeal(raw: RawDeal): FormattedDeal {
  const stateEnum = raw.state in DealState ? (raw.state as DealState) : DealState.None;
  const deadlineMs = Number(raw.deadline) * 1000;
  const createdAtMs = Number(raw.createdAt) * 1000;
  const fundedAtMs = Number(raw.fundedAt) * 1000;
  const settledAtMs = Number(raw.settledAt) * 1000;

  return {
    dealId: Number(raw.dealId),
    buyer: raw.buyer,
    seller: raw.seller,
    arbiter: raw.arbiter,
    amountMon: formatEther(raw.amount),
    amountWei: raw.amount,
    deadlineTimestamp: Number(raw.deadline),
    deadlineDate: deadlineMs > 0 ? new Date(deadlineMs).toLocaleString() : 'N/A',
    state: stateEnum,
    stateLabel: DEAL_STATE_LABELS[stateEnum] || 'Unknown',
    createdAtTimestamp: Number(raw.createdAt),
    createdAtDate: createdAtMs > 0 ? new Date(createdAtMs).toLocaleString() : 'N/A',
    fundedAtTimestamp: Number(raw.fundedAt),
    fundedAtDate: fundedAtMs > 0 ? new Date(fundedAtMs).toLocaleString() : null,
    settledAtTimestamp: Number(raw.settledAt),
    settledAtDate: settledAtMs > 0 ? new Date(settledAtMs).toLocaleString() : null,
    metadataUri: raw.metadataUri,
  };
}

/**
 * Reads the next available dealId from the contract.
 */
export async function fetchNextDealId(): Promise<bigint> {
  const result = await publicClient.readContract({
    address: SETTLEX_ESCROW_ADDRESS,
    abi: SETTLEX_ESCROW_ABI,
    functionName: 'nextDealId',
  });
  return result as bigint;
}

/**
 * Reads full deal details by dealId using getDeal.
 */
export async function fetchDeal(dealId: bigint | number): Promise<FormattedDeal> {
  const raw = await publicClient.readContract({
    address: SETTLEX_ESCROW_ADDRESS,
    abi: SETTLEX_ESCROW_ABI,
    functionName: 'getDeal',
    args: [BigInt(dealId)],
  });

  return formatDeal(raw as RawDeal);
}

/**
 * Reads all deal IDs associated with an address using getUserDeals.
 */
export async function fetchUserDeals(userAddress: `0x${string}`): Promise<bigint[]> {
  const deals = await publicClient.readContract({
    address: SETTLEX_ESCROW_ADDRESS,
    abi: SETTLEX_ESCROW_ABI,
    functionName: 'getUserDeals',
    args: [userAddress],
  });
  return deals as bigint[];
}

/**
 * Reads total number of deals associated with an address using getUserDealCount.
 */
export async function fetchUserDealCount(userAddress: `0x${string}`): Promise<bigint> {
  const count = await publicClient.readContract({
    address: SETTLEX_ESCROW_ADDRESS,
    abi: SETTLEX_ESCROW_ABI,
    functionName: 'getUserDealCount',
    args: [userAddress],
  });
  return count as bigint;
}

/* ==========================================================================
   SettleX V2: Permissionless Onchain Work Bounty Reads & Formatters
   ========================================================================== */

/**
 * Formats a raw bounty struct returned by the contract into a clean UI-ready representation.
 */
export function formatBounty(raw: RawBounty): FormattedBounty {
  const stateEnum = raw.state in BountyState ? (raw.state as BountyState) : BountyState.None;
  const now = Math.floor(Date.now() / 1000);
  const subDeadline = Number(raw.submissionDeadline);
  const revDeadline = Number(raw.reviewDeadline);
  const subCount = Number(raw.submissionCount);
  const maxSubs = Number(raw.maxSubmissions);

  // 80/20 preview math in ether
  const totalMonWei = raw.rewardAmount;
  const winnerWei = (totalMonWei * BigInt(80)) / BigInt(100);
  const participationWei = totalMonWei - winnerWei;

  // Parse taskMetadataUri for title & acceptance criteria if structured
  let taskTitle = `Bounty #${raw.bountyId}`;
  let taskMetadataUri = raw.taskMetadataUri;
  let acceptanceCriteria = 'Pass all automated tests and meet deliverable specifications.';

  try {
    if (raw.taskMetadataUri.startsWith('{')) {
      const parsed = JSON.parse(raw.taskMetadataUri);
      if (parsed.title) taskTitle = parsed.title;
      if (parsed.description) taskMetadataUri = parsed.description;
      if (parsed.criteria) acceptanceCriteria = parsed.criteria;
    }
  } catch {}

  return {
    bountyId: Number(raw.bountyId),
    creator: raw.creator,
    disputeResolver: raw.disputeResolver,
    rewardMon: formatEther(raw.rewardAmount),
    rewardWei: raw.rewardAmount,
    winnerMon: formatEther(winnerWei),
    participationPoolMon: formatEther(participationWei),
    maxSubmissions: maxSubs,
    submissionCount: subCount,
    slotsRemaining: Math.max(0, maxSubs - subCount),
    submissionDeadlineTimestamp: subDeadline,
    submissionDeadlineDate: subDeadline > 0 ? new Date(subDeadline * 1000).toLocaleString() : 'N/A',
    isSubmissionExpired: subDeadline > 0 && now >= subDeadline,
    reviewDeadlineTimestamp: revDeadline,
    reviewDeadlineDate: revDeadline > 0 ? new Date(revDeadline * 1000).toLocaleString() : 'N/A',
    isReviewExpired: revDeadline > 0 && now >= revDeadline,
    state: stateEnum,
    stateLabel: BOUNTY_STATE_LABELS[stateEnum] || 'Unknown',
    stateDescription: BOUNTY_STATE_DESCRIPTIONS[stateEnum] || '',
    winnerSubmissionId: Number(raw.winnerSubmissionId),
    taskTitle,
    taskMetadataUri,
    acceptanceCriteria,
    createdAtTimestamp: 0,
    createdAtDate: 'Onchain',
    settledAtTimestamp: Number(raw.settledAt),
    settledAtDate: Number(raw.settledAt) > 0 ? new Date(Number(raw.settledAt) * 1000).toLocaleString() : null,
  };
}

/**
 * Formats a raw submission struct into a clean UI representation.
 */
export function formatSubmission(raw: RawSubmission): FormattedSubmission {
  const submittedAtMs = Number(raw.submittedAt) * 1000;
  let proofUri = raw.submissionUri;
  let notes = '';

  if (raw.submissionUri.includes(' | Notes: ')) {
    const parts = raw.submissionUri.split(' | Notes: ');
    proofUri = parts[0];
    notes = parts[1] || '';
  }

  return {
    submissionId: Number(raw.submissionId),
    contributor: raw.contributor,
    proofUri,
    notes,
    submittedAtTimestamp: Number(raw.submittedAt),
    submittedAtDate: submittedAtMs > 0 ? new Date(submittedAtMs).toLocaleString() : 'N/A',
  };
}

/**
 * Reads next available bounty ID.
 */
export async function fetchNextBountyId(): Promise<bigint> {
  const result = await publicClient.readContract({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'nextBountyId',
  });
  return result as bigint;
}

/**
 * Reads full bounty details by bountyId.
 */
export async function fetchBounty(bountyId: bigint | number): Promise<FormattedBounty> {
  const raw = await publicClient.readContract({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBounty',
    args: [BigInt(bountyId)],
  });
  return formatBounty(raw as RawBounty);
}

/**
 * Reads all submissions for a bounty.
 */
export async function fetchBountySubmissions(bountyId: bigint | number): Promise<FormattedSubmission[]> {
  const rawSubs = await publicClient.readContract({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBountySubmissions',
    args: [BigInt(bountyId)],
  });
  return (rawSubs as readonly RawSubmission[]).map(formatSubmission);
}

/**
 * Reads all bounty IDs created by or contributed to by an address.
 */
export async function fetchUserBounties(userAddress: `0x${string}`): Promise<bigint[]> {
  const [created, contributed] = await Promise.all([
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserCreatedBounties',
      args: [userAddress],
    }),
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserContributedBounties',
      args: [userAddress],
    }),
  ]);
  const merged = Array.from(
    new Set([...(created as bigint[]), ...(contributed as bigint[])])
  );
  return merged;
}

/**
 * Reads any pending claimable rewards for a user (pull payment fallback).
 */
export async function fetchClaimableReward(userAddress: `0x${string}`): Promise<bigint> {
  const amount = await publicClient.readContract({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'claimableRewards',
    args: [userAddress],
  });
  return amount as bigint;
}

/**
 * Checks if a specific contributor has already submitted to a bounty.
 */
export async function fetchHasSubmitted(bountyId: bigint | number, contributor: `0x${string}`): Promise<boolean> {
  const submitted = await publicClient.readContract({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'hasSubmitted',
    args: [BigInt(bountyId), contributor],
  });
  return submitted as boolean;
}

/**
 * Reads all bounties from 1 up to nextBountyId - 1 using batched Multicall3 reads.
 * Falls back to individual calls if multicall encounters an unexpected issue.
 */
export async function fetchAllBounties(): Promise<FormattedBounty[]> {
  try {
    const nextIdBig = await fetchNextBountyId();
    const nextId = Number(nextIdBig);
    if (nextId <= 1) {
      return [];
    }

    const ids = Array.from({ length: nextId - 1 }, (_, i) => i + 1);
    const bounties: FormattedBounty[] = [];

    // Attempt batched Multicall3 read first
    try {
      const bountyCalls = ids.map((id) => ({
        address: SETTLEX_BOUNTY_ADDRESS,
        abi: SETTLEX_BOUNTY_ABI,
        functionName: 'getBounty',
        args: [BigInt(id)],
      }));

      const results = await publicClient.multicall({
        contracts: bountyCalls,
      });

      const settledWithWinner: FormattedBounty[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'success' && res.result) {
          const formatted = formatBounty(res.result as unknown as RawBounty);
          bounties.push(formatted);
          if (formatted.state === BountyState.Settled && formatted.winnerSubmissionId > 0) {
            settledWithWinner.push(formatted);
          }
        } else if (res.status === 'failure') {
          console.warn(`Multicall item for bounty ID ${ids[i]} failed:`, res.error);
        }
      }

      // If any settled bounties have winners, fetch winner contributor address
      if (settledWithWinner.length > 0) {
        try {
          const subCalls = settledWithWinner.map((b) => ({
            address: SETTLEX_BOUNTY_ADDRESS,
            abi: SETTLEX_BOUNTY_ABI,
            functionName: 'getBountySubmissions',
            args: [BigInt(b.bountyId)],
          }));

          const subResults = await publicClient.multicall({
            contracts: subCalls,
          });

          subResults.forEach((subRes, idx) => {
            if (subRes.status === 'success' && Array.isArray(subRes.result)) {
              const rawSubs = subRes.result as unknown as readonly RawSubmission[];
              const subs = rawSubs.map(formatSubmission);
              const targetBounty = settledWithWinner[idx];
              const winner = subs.find((s) => s.submissionId === targetBounty.winnerSubmissionId);
              if (winner) {
                targetBounty.winnerAddress = winner.contributor;
              }
            }
          });
        } catch (subErr) {
          console.warn('Failed to batch fetch submissions for settled bounties:', subErr);
        }
      }

      return bounties;
    } catch (multicallErr) {
      console.warn('Multicall3 batch read failed, falling back to sequential reads:', multicallErr);
    }

    // Fallback: Individual reads with Promise.allSettled
    const fallbackResults = await Promise.allSettled(
      ids.map(async (id) => {
        const bounty = await fetchBounty(id);
        if (bounty.state === BountyState.Settled && bounty.winnerSubmissionId > 0) {
          try {
            const subs = await fetchBountySubmissions(id);
            const winner = subs.find((s) => s.submissionId === bounty.winnerSubmissionId);
            if (winner) {
              bounty.winnerAddress = winner.contributor;
            }
          } catch {}
        }
        return bounty;
      })
    );

    for (const res of fallbackResults) {
      if (res.status === 'fulfilled') {
        bounties.push(res.value);
      } else {
        console.warn('Failed to load a bounty during fallback:', res.reason);
      }
    }

    return bounties;
  } catch (err) {
    console.error('Failed to fetch all bounties:', err);
    return [];
  }
}

/**
 * Reads all bounty IDs created by an address using getUserCreatedBounties,
 * then fetches bounty details and submissions using batched Multicall3.
 * Canonical onchain data source for the Creator workspace.
 */
export async function fetchCreatorBounties(userAddress: `0x${string}`): Promise<FormattedBounty[]> {
  try {
    const createdIdsRaw = await publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserCreatedBounties',
      args: [userAddress],
    });

    const ids = Array.from(new Set((createdIdsRaw as bigint[]).map(Number)));
    if (ids.length === 0) {
      return [];
    }

    // Sort newest first by bounty ID
    ids.sort((a, b) => b - a);

    const bounties: FormattedBounty[] = [];

    // Multicall batch reads
    try {
      const bountyCalls = ids.map((id) => ({
        address: SETTLEX_BOUNTY_ADDRESS,
        abi: SETTLEX_BOUNTY_ABI,
        functionName: 'getBounty',
        args: [BigInt(id)],
      }));

      const subCalls = ids.map((id) => ({
        address: SETTLEX_BOUNTY_ADDRESS,
        abi: SETTLEX_BOUNTY_ABI,
        functionName: 'getBountySubmissions',
        args: [BigInt(id)],
      }));

      const [bountyResults, subResults] = await Promise.all([
        publicClient.multicall({ contracts: bountyCalls }),
        publicClient.multicall({ contracts: subCalls }),
      ]);

      for (let i = 0; i < ids.length; i++) {
        const bRes = bountyResults[i];
        if (bRes.status === 'success' && bRes.result) {
          const formatted = formatBounty(bRes.result as unknown as RawBounty);

          // Attach submissions & winner address if available
          const sRes = subResults[i];
          if (sRes && sRes.status === 'success' && Array.isArray(sRes.result)) {
            const rawSubs = sRes.result as unknown as readonly RawSubmission[];
            const subs = rawSubs.map(formatSubmission);
            if (formatted.state === BountyState.Settled && formatted.winnerSubmissionId > 0) {
              const winner = subs.find((s) => s.submissionId === formatted.winnerSubmissionId);
              if (winner) {
                formatted.winnerAddress = winner.contributor;
              }
            }
          }

          bounties.push(formatted);
        } else if (bRes.status === 'failure') {
          console.warn(`Multicall item for creator bounty #${ids[i]} failed:`, bRes.error);
        }
      }

      return bounties;
    } catch (multicallErr) {
      console.warn('Multicall3 batch read failed for creator bounties, falling back:', multicallErr);
    }

    // Fallback: Individual reads with Promise.allSettled
    const fallbackResults = await Promise.allSettled(
      ids.map(async (id) => {
        const bounty = await fetchBounty(id);
        try {
          const subs = await fetchBountySubmissions(id);
          if (bounty.state === BountyState.Settled && bounty.winnerSubmissionId > 0) {
            const winner = subs.find((s) => s.submissionId === bounty.winnerSubmissionId);
            if (winner) {
              bounty.winnerAddress = winner.contributor;
            }
          }
        } catch {}
        return bounty;
      })
    );

    for (const res of fallbackResults) {
      if (res.status === 'fulfilled') {
        bounties.push(res.value);
      }
    }

    return bounties;
  } catch (err) {
    console.error('Failed to fetch creator bounties:', err);
    return [];
  }
}

/**
 * Classifies a creator bounty into a review/action category based on onchain state and deadlines.
 * Strictly respects the V2 lifecycle:
 * - Settled -> Completed
 * - Refunded -> Refunded
 * - DisputeReview / (Reviewing with review window expired) -> Dispute Review
 * - Submissions closed + valid submissions exist + active review window -> Needs Review
 * - Open + accepting submissions -> Active
 * - Open + deadline passed + 0 submissions -> Refund Available (Refunded category)
 */
export function classifyCreatorBounty(
  bounty: FormattedBounty,
  currentTime: number = Math.floor(Date.now() / 1000)
): CreatorBountyClassification {
  const subCount = bounty.submissionCount;
  const maxSubs = bounty.maxSubmissions;
  const subDeadline = bounty.submissionDeadlineTimestamp;
  const revDeadline = bounty.reviewDeadlineTimestamp;

  // 1. Completed / Settled
  if (bounty.state === BountyState.Settled) {
    return {
      category: 'completed',
      statusLabel: 'Settled',
      isNeedsReview: false,
      isActive: false,
      isCompleted: true,
      isRefunded: false,
      isDisputeReview: false,
      canReview: false,
      reviewDeadlineRemainingSeconds: null,
      submissionDeadlineRemainingSeconds: null,
    };
  }

  // 2. Refunded
  if (bounty.state === BountyState.Refunded) {
    return {
      category: 'refunded',
      statusLabel: 'Refunded',
      isNeedsReview: false,
      isActive: false,
      isCompleted: false,
      isRefunded: true,
      isDisputeReview: false,
      canReview: false,
      reviewDeadlineRemainingSeconds: null,
      submissionDeadlineRemainingSeconds: null,
    };
  }

  // 3. Dispute Review (Creator missed 24h review or contract in DisputeReview state)
  const isReviewExpired = revDeadline > 0 && currentTime > revDeadline;
  if (bounty.state === BountyState.DisputeReview || (bounty.state === BountyState.Reviewing && isReviewExpired)) {
    return {
      category: 'dispute-review',
      statusLabel: 'Dispute Review',
      isNeedsReview: false,
      isActive: false,
      isCompleted: false,
      isRefunded: false,
      isDisputeReview: true,
      canReview: false,
      reviewDeadlineRemainingSeconds: null,
      submissionDeadlineRemainingSeconds: null,
    };
  }

  // Check if submissions are closed (capacity reached, deadline passed, or Reviewing state)
  const capacityFull = maxSubs > 0 && subCount >= maxSubs;
  const subDeadlinePassed = subDeadline > 0 && currentTime >= subDeadline;
  const submissionsClosed = capacityFull || subDeadlinePassed || bounty.state === BountyState.Reviewing;

  // 4. Needs Review (Highest Priority)
  // - Has valid submissions
  // - Submissions no longer accepted
  // - Not settled, not refunded, not dispute review
  // - Creator review window still active
  if (subCount > 0 && submissionsClosed) {
    const revRemaining = revDeadline > 0 ? Math.max(0, revDeadline - currentTime) : null;
    return {
      category: 'needs-review',
      statusLabel: 'Ready for Review',
      isNeedsReview: true,
      isActive: false,
      isCompleted: false,
      isRefunded: false,
      isDisputeReview: false,
      canReview: true,
      reviewDeadlineRemainingSeconds: revRemaining,
      submissionDeadlineRemainingSeconds: null,
    };
  }

  // 5. Active / Accepting Submissions
  // - State is Open
  // - subCount < maxSubs
  // - subDeadline not passed
  if (bounty.state === BountyState.Open && !subDeadlinePassed && !capacityFull) {
    const subRemaining = subDeadline > 0 ? Math.max(0, subDeadline - currentTime) : null;
    return {
      category: 'active',
      statusLabel: 'Accepting Submissions',
      isNeedsReview: false,
      isActive: true,
      isCompleted: false,
      isRefunded: false,
      isDisputeReview: false,
      canReview: false,
      reviewDeadlineRemainingSeconds: null,
      submissionDeadlineRemainingSeconds: subRemaining,
    };
  }

  // 6. Submissions deadline passed with 0 submissions -> Eligible for refund
  if (subCount === 0 && subDeadlinePassed) {
    return {
      category: 'refunded',
      statusLabel: 'Refund Available',
      isNeedsReview: false,
      isActive: false,
      isCompleted: false,
      isRefunded: true,
      isDisputeReview: false,
      canReview: false,
      reviewDeadlineRemainingSeconds: null,
      submissionDeadlineRemainingSeconds: null,
    };
  }

  // Fallback
  return {
    category: 'active',
    statusLabel: bounty.stateLabel || 'Active',
    isNeedsReview: false,
    isActive: true,
    isCompleted: false,
    isRefunded: false,
    isDisputeReview: false,
    canReview: false,
    reviewDeadlineRemainingSeconds: null,
    submissionDeadlineRemainingSeconds: null,
  };
}

/* ==========================================================================
   SettleX V2: Payment Activity & Settlement Transaction Reads
   ========================================================================== */

/**
 * In-memory cache for resolved onchain settlement transactions.
 * Maps bountyId => SettlementTxDetails.
 */
const settlementTxCache = new Map<number, SettlementTxDetails>();

/**
 * Map tracking in-flight transaction hash resolution promises to prevent redundant duplicate RPC calls.
 */
const inFlightResolutions = new Map<number, Promise<SettlementTxDetails | null>>();

/**
 * Manually records or pre-caches a settlement transaction (e.g. immediately from in-session writes).
 */
export function recordSettlementTx(details: SettlementTxDetails): void {
  settlementTxCache.set(details.bountyId, details);
}

/**
 * Reads cached settlement transaction details if already resolved.
 */
export function getCachedSettlementTx(bountyId: number): SettlementTxDetails | undefined {
  return settlementTxCache.get(bountyId);
}

/**
 * Known deployment block for SettleXBounty contract on Monad Testnet (0x9e58...fF7).
 */
const SETTLEX_BOUNTY_DEPLOYMENT_BLOCK = 68129171n;

/**
 * Resolves the real on-chain settlement or refund transaction hash for a bounty.
 *
 * Algorithm:
 * 1. Checks memory cache for instantaneous response.
 * 2. Deduplicates concurrent calls via inFlightResolutions.
 * 3. Inspects bounty state and `settledAt` block timestamp.
 * 4. Uses an efficient binary search over block timestamps to locate the target block (~15 calls).
 * 5. Queries logs across a narrow ±15 block window (30 blocks total, well below Monad's 100-block limit).
 * 6. Decodes the event (WinnerSelected, DisputeResolved, BountyRefunded) and extracts `log.transactionHash`.
 * 7. Caches and returns the real on-chain transaction details.
 */
export async function fetchSettlementTxHash(
  bountyId: number | bigint,
  bountyState?: BountyState,
  settledAtTimestamp?: number
): Promise<SettlementTxDetails | null> {
  const numId = Number(bountyId);

  // 1. Check in-memory cache
  if (settlementTxCache.has(numId)) {
    return settlementTxCache.get(numId)!;
  }

  // 2. Check if a resolution is already in-flight for this bounty
  if (inFlightResolutions.has(numId)) {
    return inFlightResolutions.get(numId)!;
  }

  const resolutionPromise = (async () => {
    try {
      let state = bountyState;
      let settledAt = settledAtTimestamp;

      // If state or timestamp was not passed, read bounty directly
      if (state === undefined || settledAt === undefined) {
        const bounty = await fetchBounty(numId);
        state = bounty.state;
        settledAt = bounty.settledAtTimestamp;
      }

      // Only settled or refunded bounties have a settlement transaction
      if (state !== BountyState.Settled && state !== BountyState.Refunded) {
        return null;
      }

      if (!settledAt || settledAt <= 0) {
        return null;
      }

      const targetTimestamp = BigInt(settledAt);
      const latestBlockNumber = await publicClient.getBlockNumber();

      // Binary search over block timestamps to find the block containing targetTimestamp
      let low = SETTLEX_BOUNTY_DEPLOYMENT_BLOCK;
      let high = latestBlockNumber;
      let candidateBlock = low;

      while (low <= high) {
        const mid = (low + high) / 2n;
        const block = await publicClient.getBlock({ blockNumber: mid });

        if (block.timestamp < targetTimestamp) {
          low = mid + 1n;
          candidateBlock = mid;
        } else if (block.timestamp > targetTimestamp) {
          high = mid - 1n;
        } else {
          candidateBlock = mid;
          break;
        }
      }

      // Narrow ±15 block window (30 blocks total, well within Monad Testnet's 100-block limit)
      const fromBlock = candidateBlock > 15n ? candidateBlock - 15n : 0n;
      const toBlock = candidateBlock + 15n > latestBlockNumber ? latestBlockNumber : candidateBlock + 15n;

      const hexBountyId = pad(toHex(BigInt(numId)), { size: 32 });

      const logs = await (publicClient.getLogs as any)({
        address: SETTLEX_BOUNTY_ADDRESS,
        topics: [null, hexBountyId],
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: SETTLEX_BOUNTY_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (
            decoded.eventName === 'WinnerSelected' ||
            decoded.eventName === 'DisputeResolved' ||
            decoded.eventName === 'BountyRefunded'
          ) {
            const args = decoded.args as any;
            const details: SettlementTxDetails = {
              bountyId: numId,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              explorerUrl: getExplorerTxUrl(log.transactionHash),
              timestamp: settledAt,
              eventType: decoded.eventName as any,
              winnerAddress: args.winner,
              winnerPayoutWei: args.winnerPayout,
              participantPoolPayoutWei: args.participantPoolPayout,
            };

            settlementTxCache.set(numId, details);
            return details;
          }
        } catch {
          // Log not part of standard ABI or irrelevant event, continue
        }
      }

      return null;
    } catch (err) {
      console.warn(`Failed to resolve settlement tx hash for Bounty #${numId}:`, err);
      return null;
    } finally {
      inFlightResolutions.delete(numId);
    }
  })();

  inFlightResolutions.set(numId, resolutionPromise);
  return resolutionPromise;
}

/**
 * Computes exact financial summary data for a connected wallet using on-chain Multicall reads.
 */
export async function fetchWalletPaymentSummary(userAddress: `0x${string}`): Promise<PaymentSummary> {
  const [createdIdsRaw, contributedIdsRaw, claimableWeiRaw] = await Promise.all([
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserCreatedBounties',
      args: [userAddress],
    }),
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserContributedBounties',
      args: [userAddress],
    }),
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'claimableRewards',
      args: [userAddress],
    }),
  ]);

  const createdIds = (createdIdsRaw as bigint[]).map(Number);
  const contributedIds = Array.from(new Set((contributedIdsRaw as bigint[]).map(Number)));
  const allIds = Array.from(new Set([...createdIds, ...contributedIds]));

  // Multicall batch reads for bounties and submissions
  const bountyCalls = allIds.map((id) => ({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBounty',
    args: [BigInt(id)],
  }));

  const subCalls = contributedIds.map((id) => ({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBountySubmissions',
    args: [BigInt(id)],
  }));

  const [bountyResults, subResults] = await Promise.all([
    bountyCalls.length > 0
      ? publicClient.multicall({ contracts: bountyCalls })
      : Promise.resolve([]),
    subCalls.length > 0
      ? publicClient.multicall({ contracts: subCalls })
      : Promise.resolve([]),
  ]);

  const bountyMap = new Map<number, FormattedBounty>();
  bountyResults.forEach((res, idx) => {
    if (res.status === 'success' && res.result) {
      bountyMap.set(allIds[idx], formatBounty(res.result as unknown as RawBounty));
    }
  });

  const subsMap = new Map<number, FormattedSubmission[]>();
  subResults.forEach((res, idx) => {
    if (res.status === 'success' && Array.isArray(res.result)) {
      subsMap.set(
        contributedIds[idx],
        (res.result as unknown as readonly RawSubmission[]).map(formatSubmission)
      );
    }
  });

  // Calculate Creator metrics using exact BigInt math
  let totalFundedWei = 0n;
  let totalPaidWei = 0n;
  let totalRefundedWei = 0n;

  for (const id of createdIds) {
    const b = bountyMap.get(id);
    if (!b) continue;

    totalFundedWei += b.rewardWei;

    if (b.state === BountyState.Settled) {
      if (b.submissionCount === 1) {
        // Special case: Exactly 1 submission. Winner gets 80%, unused 20% pool refunded to Creator
        const winnerPayout = (b.rewardWei * 80n) / 100n;
        const poolRefund = b.rewardWei - winnerPayout;
        totalPaidWei += winnerPayout;
        totalRefundedWei += poolRefund;
      } else if (b.submissionCount > 1) {
        // Multi-submission: 80% + dust to winner, remainder of 20% pool to other contributors
        totalPaidWei += b.rewardWei;
      }
    } else if (b.state === BountyState.Refunded) {
      // 100% expired refund
      totalRefundedWei += b.rewardWei;
    }
  }

  // Calculate Contributor metrics using exact BigInt math
  let winnerRewardsWei = 0n;
  let participationRewardsWei = 0n;
  const userLower = userAddress.toLowerCase();

  for (const id of contributedIds) {
    const b = bountyMap.get(id);
    const subs = subsMap.get(id) || [];
    if (!b || b.state !== BountyState.Settled) continue;

    const mySub = subs.find((s) => s.contributor.toLowerCase() === userLower);
    if (!mySub) continue;

    const isWinner = b.winnerSubmissionId > 0 && mySub.submissionId === b.winnerSubmissionId;

    if (isWinner) {
      const winner80 = (b.rewardWei * 80n) / 100n;
      const pool20 = b.rewardWei - winner80;
      if (b.submissionCount === 1) {
        winnerRewardsWei += winner80;
      } else {
        const otherCount = BigInt(b.submissionCount - 1);
        const dust = pool20 % otherCount;
        winnerRewardsWei += winner80 + dust;
      }
    } else if (b.submissionCount > 1) {
      const winner80 = (b.rewardWei * 80n) / 100n;
      const pool20 = b.rewardWei - winner80;
      const otherCount = BigInt(b.submissionCount - 1);
      const perContributor = pool20 / otherCount;
      participationRewardsWei += perContributor;
    }
  }

  const totalEarnedWei = winnerRewardsWei + participationRewardsWei;
  const pendingClaimable = claimableWeiRaw as bigint;

  return {
    creator: {
      totalFundedWei,
      totalFundedMon: formatEther(totalFundedWei),
      totalPaidWei,
      totalPaidMon: formatEther(totalPaidWei),
      totalRefundedWei,
      totalRefundedMon: formatEther(totalRefundedWei),
    },
    contributor: {
      totalEarnedWei,
      totalEarnedMon: formatEther(totalEarnedWei),
      winnerRewardsWei,
      winnerRewardsMon: formatEther(winnerRewardsWei),
      participationRewardsWei,
      participationRewardsMon: formatEther(participationRewardsWei),
      pendingClaimableWei: pendingClaimable,
      pendingClaimableMon: formatEther(pendingClaimable),
    },
  };
}

/**
 * Builds chronological wallet payment activity ledger items from live contract state and events.
 */
export async function fetchWalletPaymentActivity(
  userAddress: `0x${string}`
): Promise<PaymentActivityItem[]> {
  const [createdIdsRaw, contributedIdsRaw, claimableWeiRaw] = await Promise.all([
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserCreatedBounties',
      args: [userAddress],
    }),
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'getUserContributedBounties',
      args: [userAddress],
    }),
    publicClient.readContract({
      address: SETTLEX_BOUNTY_ADDRESS,
      abi: SETTLEX_BOUNTY_ABI,
      functionName: 'claimableRewards',
      args: [userAddress],
    }),
  ]);

  const createdIds = (createdIdsRaw as bigint[]).map(Number);
  const contributedIds = Array.from(new Set((contributedIdsRaw as bigint[]).map(Number)));
  const allIds = Array.from(new Set([...createdIds, ...contributedIds]));

  if (allIds.length === 0 && (claimableWeiRaw as bigint) === 0n) {
    return [];
  }

  // Multicall batch reads
  const bountyCalls = allIds.map((id) => ({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBounty',
    args: [BigInt(id)],
  }));

  const subCalls = allIds.map((id) => ({
    address: SETTLEX_BOUNTY_ADDRESS,
    abi: SETTLEX_BOUNTY_ABI,
    functionName: 'getBountySubmissions',
    args: [BigInt(id)],
  }));

  const [bountyResults, subResults] = await Promise.all([
    bountyCalls.length > 0
      ? publicClient.multicall({ contracts: bountyCalls })
      : Promise.resolve([]),
    subCalls.length > 0
      ? publicClient.multicall({ contracts: subCalls })
      : Promise.resolve([]),
  ]);

  const bountyMap = new Map<number, FormattedBounty>();
  bountyResults.forEach((res, idx) => {
    if (res.status === 'success' && res.result) {
      bountyMap.set(allIds[idx], formatBounty(res.result as unknown as RawBounty));
    }
  });

  const subsMap = new Map<number, FormattedSubmission[]>();
  subResults.forEach((res, idx) => {
    if (res.status === 'success' && Array.isArray(res.result)) {
      subsMap.set(
        allIds[idx],
        (res.result as unknown as readonly RawSubmission[]).map(formatSubmission)
      );
    }
  });

  const items: PaymentActivityItem[] = [];
  const userLower = userAddress.toLowerCase();

  // 1. Process Creator activity
  for (const id of createdIds) {
    const b = bountyMap.get(id);
    if (!b) continue;

    const subs = subsMap.get(id) || [];
    const winnerSub = subs.find((s) => s.submissionId === b.winnerSubmissionId);
    const winnerAddress = winnerSub?.contributor || b.winnerAddress;

    // A. Creator Funding Deposit
    items.push({
      id: `funded-${b.bountyId}`,
      bountyId: b.bountyId,
      bountyTitle: b.taskTitle,
      type: 'CREATOR_FUNDED',
      typeLabel: 'Bounty Escrow Funded',
      direction: 'OUTGOING',
      amountWei: b.rewardWei,
      amountMon: b.rewardMon,
      counterparty: SETTLEX_BOUNTY_ADDRESS,
      counterpartyRole: 'Escrow Lock',
      timestamp: b.submissionDeadlineTimestamp > 0 ? b.submissionDeadlineTimestamp : Math.floor(Date.now() / 1000),
      dateFormatted: b.submissionDeadlineDate,
      status: 'Confirmed',
      notes: `Funded ${b.rewardMon} MON for Bounty #${b.bountyId}`,
    });

    // B. Settled Bounty Payouts
    if (b.state === BountyState.Settled) {
      const winner80 = (b.rewardWei * 80n) / 100n;
      const pool20 = b.rewardWei - winner80;
      const cachedTx = settlementTxCache.get(b.bountyId);
      const txHash = cachedTx?.txHash;
      const explorerUrl = cachedTx?.explorerUrl || (txHash ? getExplorerTxUrl(txHash) : undefined);

      if (b.submissionCount === 1) {
        // Winner payout (80%)
        items.push({
          id: `winner-payout-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'WINNER_PAYOUT',
          typeLabel: 'Winner Reward Disbursed',
          direction: 'OUTGOING',
          amountWei: winner80,
          amountMon: formatEther(winner80),
          counterparty: winnerAddress,
          counterpartyRole: 'Winning Contributor',
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          notes: `Paid 80% to Winner #${b.winnerSubmissionId}`,
        });

        // 20% Unused pool returned to creator
        items.push({
          id: `refund-partial-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'CREATOR_REFUND_PARTIAL',
          typeLabel: 'Unused 20% Pool Refunded',
          direction: 'INCOMING',
          amountWei: pool20,
          amountMon: formatEther(pool20),
          counterparty: SETTLEX_BOUNTY_ADDRESS,
          counterpartyRole: 'Contract Escrow',
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          notes: 'Returned to Creator (Single Valid Submission)',
        });
      } else if (b.submissionCount > 1) {
        const others = BigInt(b.submissionCount - 1);
        const dust = pool20 % others;
        const finalWinnerPayout = winner80 + dust;
        const participantPoolDisbursed = pool20 - dust;

        // Winner Payout (80% + dust)
        items.push({
          id: `winner-payout-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'WINNER_PAYOUT',
          typeLabel: 'Winner Reward Disbursed',
          direction: 'OUTGOING',
          amountWei: finalWinnerPayout,
          amountMon: formatEther(finalWinnerPayout),
          counterparty: winnerAddress,
          counterpartyRole: 'Winning Contributor',
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          notes: `Paid 80% (+ division dust) to Winner #${b.winnerSubmissionId}`,
        });

        // Participant Pool (20%)
        items.push({
          id: `pool-payout-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'PARTICIPATION_PAYOUT',
          typeLabel: 'Participation Pool Disbursed',
          direction: 'OUTGOING',
          amountWei: participantPoolDisbursed,
          amountMon: formatEther(participantPoolDisbursed),
          counterpartyRole: `${b.submissionCount - 1} Non-Winning Contributors`,
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          notes: `Shared equally across ${b.submissionCount - 1} eligible contributors`,
        });
      }
    } else if (b.state === BountyState.Refunded) {
      // 100% Expired Refund
      const cachedTx = settlementTxCache.get(b.bountyId);
      const txHash = cachedTx?.txHash;
      const explorerUrl = cachedTx?.explorerUrl || (txHash ? getExplorerTxUrl(txHash) : undefined);

      items.push({
        id: `refund-full-${b.bountyId}`,
        bountyId: b.bountyId,
        bountyTitle: b.taskTitle,
        type: 'CREATOR_REFUND_FULL',
        typeLabel: '100% Expired Bounty Refund',
        direction: 'INCOMING',
        amountWei: b.rewardWei,
        amountMon: b.rewardMon,
        counterparty: SETTLEX_BOUNTY_ADDRESS,
        counterpartyRole: 'Contract Escrow',
        timestamp: b.settledAtTimestamp,
        dateFormatted: b.settledAtDate || 'Refunded',
        txHash,
        explorerUrl,
        status: 'Confirmed',
        notes: 'Full deposit reclaimed (0 submissions received)',
      });
    }
  }

  // 2. Process Contributor activity
  for (const id of contributedIds) {
    const b = bountyMap.get(id);
    const subs = subsMap.get(id) || [];
    if (!b) continue;

    const mySub = subs.find((s) => s.contributor.toLowerCase() === userLower);
    if (!mySub) continue;

    if (b.state === BountyState.Settled) {
      const isWinner = b.winnerSubmissionId > 0 && mySub.submissionId === b.winnerSubmissionId;
      const cachedTx = settlementTxCache.get(b.bountyId);
      const txHash = cachedTx?.txHash;
      const explorerUrl = cachedTx?.explorerUrl || (txHash ? getExplorerTxUrl(txHash) : undefined);
      const winner80 = (b.rewardWei * 80n) / 100n;
      const pool20 = b.rewardWei - winner80;

      if (isWinner) {
        let finalWinnerPayout = winner80;
        if (b.submissionCount > 1) {
          const others = BigInt(b.submissionCount - 1);
          finalWinnerPayout = winner80 + (pool20 % others);
        }

        items.push({
          id: `winner-received-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'WINNER_PAYOUT',
          typeLabel: 'Winner Reward Received',
          direction: 'INCOMING',
          amountWei: finalWinnerPayout,
          amountMon: formatEther(finalWinnerPayout),
          counterparty: b.creator,
          counterpartyRole: 'Bounty Creator',
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          isWinner: true,
          notes: `Submission #${mySub.submissionId} selected as winner (80% payout)`,
        });
      } else if (b.submissionCount > 1) {
        const others = BigInt(b.submissionCount - 1);
        const perContributor = pool20 / others;

        items.push({
          id: `participant-received-${b.bountyId}`,
          bountyId: b.bountyId,
          bountyTitle: b.taskTitle,
          type: 'PARTICIPATION_PAYOUT',
          typeLabel: 'Participation Reward Received',
          direction: 'INCOMING',
          amountWei: perContributor,
          amountMon: formatEther(perContributor),
          counterparty: b.creator,
          counterpartyRole: 'Bounty Creator',
          timestamp: b.settledAtTimestamp,
          dateFormatted: b.settledAtDate || 'Settled',
          txHash,
          explorerUrl,
          status: 'Confirmed',
          isWinner: false,
          notes: `Equal share of 20% participation pool for submission #${mySub.submissionId}`,
        });
      }
    }
  }

  // 3. Fallback Claimable Pending Balance
  const claimableWei = claimableWeiRaw as bigint;
  if (claimableWei > 0n) {
    items.push({
      id: `claimable-${userLower}`,
      bountyId: 0,
      bountyTitle: 'Fallback Escrow Balance',
      type: 'CLAIMABLE_WITHDRAWAL',
      typeLabel: 'Pending Pull-Claim Balance',
      direction: 'INCOMING',
      amountWei: claimableWei,
      amountMon: formatEther(claimableWei),
      counterparty: SETTLEX_BOUNTY_ADDRESS,
      counterpartyRole: 'Contract Escrow',
      timestamp: Math.floor(Date.now() / 1000),
      dateFormatted: 'Available Now',
      status: 'Pending',
      notes: 'Native transfer was credited to fallback mapping. Use Claim Reward to withdraw.',
    });
  }

  // Sort descending by timestamp
  items.sort((a, b) => b.timestamp - a.timestamp);

  // Trigger non-blocking background resolution for any settled items without a cached txHash
  const settledIdsWithoutHash = Array.from(
    new Set(
      items
        .filter((item) => !item.txHash && item.bountyId > 0)
        .map((item) => item.bountyId)
    )
  );

  if (settledIdsWithoutHash.length > 0) {
    // Resolve up to 5 at a time without bursting the RPC
    Promise.allSettled(
      settledIdsWithoutHash.slice(0, 5).map((id) => {
        const b = bountyMap.get(id);
        return fetchSettlementTxHash(id, b?.state, b?.settledAtTimestamp);
      })
    ).catch(console.error);
  }

  return items;
}

