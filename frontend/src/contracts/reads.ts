import { formatEther } from 'viem';
import { SETTLEX_BOUNTY_ADDRESS, SETTLEX_ESCROW_ADDRESS } from '../config/contract';
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
  RawBounty,
  RawDeal,
  RawSubmission,
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

