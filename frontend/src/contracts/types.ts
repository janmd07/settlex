export enum DealState {
  None = 0,
  Created = 1,
  Funded = 2,
  Submitted = 3,
  Disputed = 4,
  Settled = 5,
  Refunded = 6,
  Cancelled = 7,
}

export const DEAL_STATE_LABELS: Record<DealState, string> = {
  [DealState.None]: 'None',
  [DealState.Created]: 'Created',
  [DealState.Funded]: 'Funded',
  [DealState.Submitted]: 'Submitted',
  [DealState.Disputed]: 'Disputed',
  [DealState.Settled]: 'Settled',
  [DealState.Refunded]: 'Refunded',
  [DealState.Cancelled]: 'Cancelled',
};

export const DEAL_STATE_DESCRIPTIONS: Record<DealState, string> = {
  [DealState.None]: 'Deal record does not exist.',
  [DealState.Created]: 'Terms created onchain, awaiting buyer escrow deposit.',
  [DealState.Funded]: 'Escrow funded; native MON securely locked in contract.',
  [DealState.Submitted]: 'Seller delivered work proof; awaiting buyer approval.',
  [DealState.Disputed]: 'Escrow paused in dispute; awaiting designated arbiter resolution.',
  [DealState.Settled]: 'Terminal state: Escrow successfully disbursed to seller.',
  [DealState.Refunded]: 'Terminal state: Escrow returned to buyer.',
  [DealState.Cancelled]: 'Terminal state: Deal cancelled before funds were deposited.',
};

export type UserDealRole = 'Buyer' | 'Seller' | 'Arbiter' | 'Observer';

export interface RawDeal {
  dealId: bigint;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  arbiter: `0x${string}`;
  amount: bigint;
  deadline: bigint;
  state: number;
  createdAt: bigint;
  fundedAt: bigint;
  settledAt: bigint;
  metadataUri: string;
}

export interface FormattedDeal {
  dealId: number;
  buyer: string;
  seller: string;
  arbiter: string;
  amountMon: string;
  amountWei: bigint;
  deadlineTimestamp: number;
  deadlineDate: string;
  state: DealState;
  stateLabel: string;
  createdAtTimestamp: number;
  createdAtDate: string;
  fundedAtTimestamp: number;
  fundedAtDate: string | null;
  settledAtTimestamp: number;
  settledAtDate: string | null;
  metadataUri: string;
}

export interface TransactionState {
  status: 'idle' | 'submitting' | 'pending' | 'confirmed' | 'error';
  hash?: `0x${string}`;
  errorMessage?: string;
}

/* ==========================================================================
   SettleX V2: Permissionless Onchain Work Bounty Types
   ========================================================================== */

export enum BountyState {
  None = 0,
  Open = 1,
  Reviewing = 2,
  DisputeReview = 3,
  Settled = 4,
  Refunded = 5,
}

export const BOUNTY_STATE_LABELS: Record<BountyState, string> = {
  [BountyState.None]: 'None',
  [BountyState.Open]: 'Open',
  [BountyState.Reviewing]: 'In Review',
  [BountyState.DisputeReview]: 'Dispute Review',
  [BountyState.Settled]: 'Settled',
  [BountyState.Refunded]: 'Refunded',
};

export const BOUNTY_STATE_DESCRIPTIONS: Record<BountyState, string> = {
  [BountyState.None]: 'Bounty record does not exist.',
  [BountyState.Open]: 'Accepting submissions. Any eligible Contributor can submit work.',
  [BountyState.Reviewing]: 'Submissions closed. 24-hour Creator review window active.',
  [BountyState.DisputeReview]: 'Review period expired. Designated Arbiter reviewing submissions.',
  [BountyState.Settled]: 'Bounty resolved: Winner paid 80%, other contributors shared 20%.',
  [BountyState.Refunded]: 'Deadline expired with 0 submissions: Creator claimed 100% refund.',
};

export type BountyRole = 'Creator' | 'Contributor' | 'DisputeResolver' | 'Observer';

export interface RawBounty {
  bountyId: bigint;
  creator: `0x${string}`;
  rewardAmount: bigint;
  maxSubmissions: number;
  submissionCount: number;
  submissionDeadline: bigint;
  reviewDeadline: bigint;
  settledAt: bigint;
  state: number;
  winnerSubmissionId: bigint;
  disputeResolver: `0x${string}`;
  taskMetadataUri: string;
}

export interface RawSubmission {
  submissionId: bigint;
  contributor: `0x${string}`;
  submissionUri: string;
  submittedAt: bigint;
}

export interface FormattedSubmission {
  submissionId: number;
  contributor: string;
  proofUri: string;
  notes: string;
  submittedAtTimestamp: number;
  submittedAtDate: string;
}

export interface FormattedBounty {
  bountyId: number;
  creator: string;
  disputeResolver: string;
  rewardMon: string;
  rewardWei: bigint;
  winnerMon: string;
  participationPoolMon: string;
  maxSubmissions: number;
  submissionCount: number;
  slotsRemaining: number;
  submissionDeadlineTimestamp: number;
  submissionDeadlineDate: string;
  isSubmissionExpired: boolean;
  reviewDeadlineTimestamp: number;
  reviewDeadlineDate: string;
  isReviewExpired: boolean;
  state: BountyState;
  stateLabel: string;
  stateDescription: string;
  winnerSubmissionId: number;
  winnerAddress?: string;
  taskTitle: string;
  taskMetadataUri: string;
  acceptanceCriteria: string;
  createdAtTimestamp: number;
  createdAtDate: string;
  settledAtTimestamp: number;
  settledAtDate: string | null;
}

export interface CreateBountyParams {
  taskTitle: string;
  taskMetadataUri: string;
  acceptanceCriteria: string;
  maxSubmissions: number;
  durationSeconds: number;
  disputeResolverAddress: `0x${string}`;
  rewardMon: string;
}

export interface SubmitWorkParams {
  bountyId: number;
  proofUri: string;
  notes: string;
}
