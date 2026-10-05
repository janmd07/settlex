// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SettleXBounty
 * @notice Permissionless Onchain Work Bounties protocol on Monad Testnet.
 * @dev Replaces traditional bilateral escrow with an open, competitive bounty model.
 *      Creators lock native MON rewards upfront and define immutable Acceptance Criteria.
 *      Contributors submit work permissionlessly (1 to 10 slots).
 *      Creator has a strict 24-hour Review Window to select exactly ONE Winner.
 *      Payouts: 80% to Winner, 20% shared equally among other valid Contributors.
 *      No "Reject All" action exists.
 *      If Creator misses the 24h review deadline, the bounty transitions to DisputeReview.
 */
contract SettleXBounty is ReentrancyGuard {
    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum BountyState {
        None,            // 0: Non-existent
        Open,            // 1: Accepting contributor submissions
        Reviewing,       // 2: Submissions closed; 24h creator review active
        DisputeReview,   // 3: 24h review expired without winner selection
        Settled,         // 4: Terminal: winner selected and rewards disbursed
        Refunded         // 5: Terminal: deadline passed with 0 submissions; creator refunded
    }

    struct Submission {
        uint256 submissionId;        // 1-based sequential index within bounty (1..maxSubmissions)
        address contributor;         // Contributor wallet address
        string submissionUri;        // Deliverable proof, repo link, or IPFS URI
        uint256 submittedAt;         // Block timestamp when submitted
    }

    struct Bounty {
        uint256 bountyId;            // Unique incrementing identifier
        address creator;             // Creator wallet address
        uint256 rewardAmount;        // Total native MON reward locked (in wei)
        uint8 maxSubmissions;        // Capacity limit chosen by creator (1 to 10)
        uint8 submissionCount;       // Number of valid submissions received
        uint256 submissionDeadline;  // Timestamp when submissions close
        uint256 reviewDeadline;      // Timestamp when Creator 24h review window expires
        uint256 settledAt;           // Timestamp when settled or refunded
        BountyState state;           // Current lifecycle state
        uint256 winnerSubmissionId;  // Submission ID of the chosen winner (0 if none)
        address disputeResolver;     // Designated dispute resolver (arbiter or Decentralized Jury module)
        string taskMetadataUri;      // Immutable reference to task, description & acceptance criteria
    }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    uint256 public constant REVIEW_PERIOD = 24 hours;
    uint8 public constant MIN_SUBMISSIONS = 1;
    uint8 public constant MAX_SUBMISSIONS_LIMIT = 10;
    uint256 public constant WINNER_PERCENTAGE = 80;
    uint256 public constant PARTICIPANT_POOL_PERCENTAGE = 20;

    // =========================================================================
    // STORAGE
    // =========================================================================

    /// @notice Auto-incrementing identifier for bounties, starting at 1.
    uint256 public nextBountyId = 1;

    /// @notice Primary storage mapping from bountyId to Bounty struct.
    mapping(uint256 => Bounty) public bounties;

    /// @notice Mapping from bountyId => submissionId (1-based) => Submission struct.
    mapping(uint256 => mapping(uint256 => Submission)) public bountySubmissions;

    /// @notice Tracks whether a contributor address has already submitted to a given bounty.
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    /// @notice Indexed list of bounties created by an address.
    mapping(address => uint256[]) private _creatorBounties;

    /// @notice Indexed list of bounties to which an address has submitted work.
    mapping(address => uint256[]) private _contributorBounties;

    /// @notice Pull-claim fallback mapping in case a direct native MON transfer to a recipient reverts.
    mapping(address => uint256) public claimableRewards;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 rewardAmount,
        uint8 maxSubmissions,
        uint256 submissionDeadline,
        address disputeResolver,
        string taskMetadataUri
    );

    event WorkSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed contributor,
        string submissionUri,
        uint256 submittedAt
    );

    event SubmissionsClosed(
        uint256 indexed bountyId,
        uint8 totalSubmissions,
        uint256 reviewDeadline,
        string reason
    );

    event WinnerSelected(
        uint256 indexed bountyId,
        uint256 indexed winnerSubmissionId,
        address indexed winner,
        uint256 winnerPayout,
        uint256 participantPoolPayout
    );

    event ParticipantRewarded(
        uint256 indexed bountyId,
        address indexed contributor,
        uint256 amount
    );

    event BountySettled(uint256 indexed bountyId, uint256 settledAt);

    event BountyDisputed(uint256 indexed bountyId, uint256 disputeTimestamp);

    event DisputeResolved(
        uint256 indexed bountyId,
        address indexed resolver,
        uint256 indexed winnerSubmissionId,
        address winner,
        uint256 winnerPayout,
        uint256 participantPoolPayout
    );

    event BountyRefunded(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 amount
    );

    event TransferFallbackCredited(
        address indexed recipient,
        uint256 amount
    );

    event RewardClaimed(
        address indexed recipient,
        uint256 amount
    );

    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    error InvalidMaxSubmissions(uint8 provided, uint8 minAllowed, uint8 maxAllowed);
    error InvalidSubmissionDeadline(uint256 provided, uint256 current);
    error ZeroReward();
    error EmptyMetadataUri();
    error CreatorCannotBeDisputeResolver();
    error BountyDoesNotExist(uint256 bountyId);
    error InvalidBountyState(uint256 bountyId, BountyState currentState);
    error Unauthorized(address caller, string expectedRole);
    error CreatorCannotSubmit();
    error AlreadySubmitted(uint256 bountyId, address contributor);
    error EmptySubmissionUri();
    error SubmissionCapacityReached(uint256 bountyId, uint8 maxSubmissions);
    error SubmissionDeadlinePassed(uint256 bountyId, uint256 deadline);
    error SubmissionsStillOpen(uint256 bountyId);
    error ReviewDeadlinePassed(uint256 bountyId, uint256 reviewDeadline);
    error ReviewDeadlineNotPassed(uint256 bountyId, uint256 reviewDeadline);
    error InvalidWinnerSubmissionId(uint256 bountyId, uint256 submissionId);
    error SubmissionsExistCannotRefund(uint256 bountyId, uint8 submissionCount);
    error SubmissionDeadlineNotPassed(uint256 bountyId, uint256 deadline);
    error NoDisputeResolverConfigured(uint256 bountyId);
    error NoClaimableRewards();
    error TransferFailed(address recipient, uint256 amount);
    error DirectDepositNotAllowed();

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Creator publishes a new bounty and locks the full native MON reward upfront.
     * @param submissionDeadline Unix timestamp when contributor submission closes.
     * @param maxSubmissions Maximum number of submissions accepted (1 to 10).
     * @param disputeResolver Optional designated dispute resolution authority (address(0) if none).
     * @param taskMetadataUri Immutable reference to task title, description, and Acceptance Criteria.
     * @return bountyId Unique incrementing identifier assigned to this bounty.
     */
    function createBounty(
        uint256 submissionDeadline,
        uint8 maxSubmissions,
        address disputeResolver,
        string calldata taskMetadataUri
    ) external payable nonReentrant returns (uint256 bountyId) {
        if (maxSubmissions < MIN_SUBMISSIONS || maxSubmissions > MAX_SUBMISSIONS_LIMIT) {
            revert InvalidMaxSubmissions(maxSubmissions, MIN_SUBMISSIONS, MAX_SUBMISSIONS_LIMIT);
        }
        if (submissionDeadline <= block.timestamp) {
            revert InvalidSubmissionDeadline(submissionDeadline, block.timestamp);
        }
        if (msg.value == 0) {
            revert ZeroReward();
        }
        if (bytes(taskMetadataUri).length == 0) {
            revert EmptyMetadataUri();
        }
        if (disputeResolver != address(0) && disputeResolver == msg.sender) {
            revert CreatorCannotBeDisputeResolver();
        }

        bountyId = nextBountyId++;

        Bounty storage bounty = bounties[bountyId];
        bounty.bountyId = bountyId;
        bounty.creator = msg.sender;
        bounty.rewardAmount = msg.value;
        bounty.maxSubmissions = maxSubmissions;
        bounty.submissionDeadline = submissionDeadline;
        bounty.disputeResolver = disputeResolver;
        bounty.state = BountyState.Open;
        bounty.taskMetadataUri = taskMetadataUri;

        _creatorBounties[msg.sender].push(bountyId);

        emit BountyCreated(
            bountyId,
            msg.sender,
            msg.value,
            maxSubmissions,
            submissionDeadline,
            disputeResolver,
            taskMetadataUri
        );
    }

    /**
     * @notice Contributor permissionlessly submits deliverable proof for an open bounty.
     * @dev Does not require any deposit from contributor.
     *      Quality is judged later against the immutable Acceptance Criteria.
     *      Automatically closes submissions and starts the 24-hour review window if capacity is reached.
     * @param bountyId Identifier of the bounty.
     * @param submissionUri Deliverable repository link, IPFS proof URI, or documentation reference.
     * @return submissionId 1-based sequential submission identifier within this bounty.
     */
    function submitWork(
        uint256 bountyId,
        string calldata submissionUri
    ) external nonReentrant returns (uint256 submissionId) {
        Bounty storage bounty = _getValidBounty(bountyId);

        if (bounty.state != BountyState.Open) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (block.timestamp >= bounty.submissionDeadline) {
            revert SubmissionDeadlinePassed(bountyId, bounty.submissionDeadline);
        }
        if (msg.sender == bounty.creator) {
            revert CreatorCannotSubmit();
        }
        if (hasSubmitted[bountyId][msg.sender]) {
            revert AlreadySubmitted(bountyId, msg.sender);
        }
        if (bytes(submissionUri).length == 0) {
            revert EmptySubmissionUri();
        }
        if (bounty.submissionCount >= bounty.maxSubmissions) {
            revert SubmissionCapacityReached(bountyId, bounty.maxSubmissions);
        }

        // Record submission
        hasSubmitted[bountyId][msg.sender] = true;
        bounty.submissionCount++;
        submissionId = bounty.submissionCount;

        bountySubmissions[bountyId][submissionId] = Submission({
            submissionId: submissionId,
            contributor: msg.sender,
            submissionUri: submissionUri,
            submittedAt: block.timestamp
        });

        _contributorBounties[msg.sender].push(bountyId);

        emit WorkSubmitted(bountyId, submissionId, msg.sender, submissionUri, block.timestamp);

        // Auto-close submissions if capacity reached
        if (bounty.submissionCount == bounty.maxSubmissions) {
            bounty.state = BountyState.Reviewing;
            bounty.reviewDeadline = block.timestamp + REVIEW_PERIOD;

            emit SubmissionsClosed(
                bountyId,
                bounty.submissionCount,
                bounty.reviewDeadline,
                "CAPACITY_REACHED"
            );
        }
    }

    /**
     * @notice Closes submissions once the submission deadline has passed.
     * @dev Permissionless keeper/crank function.
     *      If at least one submission exists, initiates the 24-hour Creator Review Window.
     * @param bountyId Identifier of the bounty.
     */
    function closeSubmissions(uint256 bountyId) external {
        Bounty storage bounty = _getValidBounty(bountyId);

        if (bounty.state != BountyState.Open) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (block.timestamp < bounty.submissionDeadline) {
            revert SubmissionsStillOpen(bountyId);
        }

        if (bounty.submissionCount > 0) {
            bounty.state = BountyState.Reviewing;
            bounty.reviewDeadline = block.timestamp + REVIEW_PERIOD;

            emit SubmissionsClosed(
                bountyId,
                bounty.submissionCount,
                bounty.reviewDeadline,
                "DEADLINE_PASSED"
            );
        }
    }

    /**
     * @notice Creator evaluates submissions against Acceptance Criteria and selects exactly ONE Winner.
     * @dev Must be called during the active 24-hour review period.
     *      There is NO "Reject All" button.
     *      Payout: 80% to Winner, 20% shared equally among remaining valid Contributors.
     *      If exactly 1 submission exists, Winner receives 80% and the unused 20% pool is refunded to Creator.
     * @param bountyId Identifier of the bounty.
     * @param winnerSubmissionId The 1-based submission ID chosen as winner.
     */
    function selectWinner(
        uint256 bountyId,
        uint256 winnerSubmissionId
    ) external nonReentrant {
        Bounty storage bounty = _getValidBounty(bountyId);

        // Allow lazy transition from Open if deadline has passed with submissions
        if (bounty.state == BountyState.Open && block.timestamp >= bounty.submissionDeadline && bounty.submissionCount > 0) {
            bounty.state = BountyState.Reviewing;
            bounty.reviewDeadline = block.timestamp + REVIEW_PERIOD;
            emit SubmissionsClosed(bountyId, bounty.submissionCount, bounty.reviewDeadline, "DEADLINE_PASSED");
        }

        if (bounty.state != BountyState.Reviewing) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (msg.sender != bounty.creator) {
            revert Unauthorized(msg.sender, "creator");
        }
        if (block.timestamp > bounty.reviewDeadline) {
            revert ReviewDeadlinePassed(bountyId, bounty.reviewDeadline);
        }
        if (winnerSubmissionId == 0 || winnerSubmissionId > bounty.submissionCount) {
            revert InvalidWinnerSubmissionId(bountyId, winnerSubmissionId);
        }

        _distributeBountyRewards(bounty, winnerSubmissionId, false);
    }

    /**
     * @notice Escalates an inactive bounty to DisputeReview if Creator failed to select a winner within 24h.
     * @dev Permissionless: callable by anyone once the 24-hour review window has elapsed without resolution.
     * @param bountyId Identifier of the bounty.
     */
    function escalateToDispute(uint256 bountyId) external {
        Bounty storage bounty = _getValidBounty(bountyId);

        // Allow lazy transition from Open if deadline passed
        if (bounty.state == BountyState.Open && block.timestamp >= bounty.submissionDeadline && bounty.submissionCount > 0) {
            bounty.state = BountyState.Reviewing;
            bounty.reviewDeadline = block.timestamp + REVIEW_PERIOD;
            emit SubmissionsClosed(bountyId, bounty.submissionCount, bounty.reviewDeadline, "DEADLINE_PASSED");
        }

        if (bounty.state != BountyState.Reviewing) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (block.timestamp <= bounty.reviewDeadline) {
            revert ReviewDeadlineNotPassed(bountyId, bounty.reviewDeadline);
        }

        bounty.state = BountyState.DisputeReview;

        emit BountyDisputed(bountyId, block.timestamp);
    }

    /**
     * @notice Resolves a disputed bounty by selecting exactly ONE Winner.
     * @dev Callable exclusively by the configured disputeResolver (e.g. designated Arbiter or Decentralized Jury module).
     *      Evaluates deliverables against the immutable Acceptance Criteria.
     *      Follows identical 80/20 distribution rules. Resolver CANNOT alter reward amount, criteria, or deadlines.
     * @param bountyId Identifier of the disputed bounty.
     * @param winnerSubmissionId The 1-based submission ID chosen as winner by the dispute resolver.
     */
    function resolveDispute(
        uint256 bountyId,
        uint256 winnerSubmissionId
    ) external nonReentrant {
        Bounty storage bounty = _getValidBounty(bountyId);

        if (bounty.state != BountyState.DisputeReview) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (bounty.disputeResolver == address(0)) {
            revert NoDisputeResolverConfigured(bountyId);
        }
        if (msg.sender != bounty.disputeResolver) {
            revert Unauthorized(msg.sender, "disputeResolver");
        }
        if (winnerSubmissionId == 0 || winnerSubmissionId > bounty.submissionCount) {
            revert InvalidWinnerSubmissionId(bountyId, winnerSubmissionId);
        }

        _distributeBountyRewards(bounty, winnerSubmissionId, true);
    }

    /**
     * @notice Creator reclaims 100% of reward if the submission deadline passed with ZERO submissions.
     * @dev If even 1 valid submission exists, refund is permanently blocked.
     * @param bountyId Identifier of the bounty.
     */
    function claimExpiredBountyRefund(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _getValidBounty(bountyId);

        if (msg.sender != bounty.creator) {
            revert Unauthorized(msg.sender, "creator");
        }
        if (bounty.state != BountyState.Open) {
            revert InvalidBountyState(bountyId, bounty.state);
        }
        if (block.timestamp < bounty.submissionDeadline) {
            revert SubmissionDeadlineNotPassed(bountyId, bounty.submissionDeadline);
        }
        if (bounty.submissionCount > 0) {
            revert SubmissionsExistCannotRefund(bountyId, bounty.submissionCount);
        }

        uint256 refundAmount = bounty.rewardAmount;
        address creatorRecipient = bounty.creator;

        // Effects
        bounty.state = BountyState.Refunded;
        bounty.settledAt = block.timestamp;

        emit BountyRefunded(bountyId, creatorRecipient, refundAmount);

        // Interactions (with safe fallback)
        _safeTransferNative(creatorRecipient, refundAmount);
    }

    /**
     * @notice Pull-claim withdrawal for any user whose push transfer encountered a revert.
     * @dev Guarantees no native MON is ever stranded even if a recipient wallet is a reverting contract.
     */
    function claimReward() external nonReentrant {
        uint256 amount = claimableRewards[msg.sender];
        if (amount == 0) {
            revert NoClaimableRewards();
        }

        claimableRewards[msg.sender] = 0;

        emit RewardClaimed(msg.sender, amount);

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) {
            revert TransferFailed(msg.sender, amount);
        }
    }

    // =========================================================================
    // VIEW / GETTER FUNCTIONS
    // =========================================================================

    /**
     * @notice Returns the full Bounty struct for a given bountyId.
     */
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _getValidBounty(bountyId);
    }

    /**
     * @notice Returns a single submission for a bounty.
     */
    function getSubmission(uint256 bountyId, uint256 submissionId) external view returns (Submission memory) {
        _getValidBounty(bountyId);
        return bountySubmissions[bountyId][submissionId];
    }

    /**
     * @notice Returns all submissions received for a bounty.
     */
    function getBountySubmissions(uint256 bountyId) external view returns (Submission[] memory) {
        Bounty storage bounty = _getValidBounty(bountyId);
        uint8 count = bounty.submissionCount;
        Submission[] memory subs = new Submission[](count);
        for (uint256 i = 1; i <= count; i++) {
            subs[i - 1] = bountySubmissions[bountyId][i];
        }
        return subs;
    }

    /**
     * @notice Returns remaining submission capacity for a bounty.
     */
    function getRemainingSlots(uint256 bountyId) external view returns (uint8) {
        Bounty storage bounty = _getValidBounty(bountyId);
        if (bounty.state != BountyState.Open || block.timestamp >= bounty.submissionDeadline) {
            return 0;
        }
        return bounty.maxSubmissions - bounty.submissionCount;
    }

    /**
     * @notice Returns all bounty IDs created by an address.
     */
    function getUserCreatedBounties(address user) external view returns (uint256[] memory) {
        return _creatorBounties[user];
    }

    /**
     * @notice Returns all bounty IDs to which an address has submitted work.
     */
    function getUserContributedBounties(address user) external view returns (uint256[] memory) {
        return _contributorBounties[user];
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @dev Core settlement logic implementing the 80% Winner / 20% Participation Pool distribution.
     */
    function _distributeBountyRewards(
        Bounty storage bounty,
        uint256 winnerSubmissionId,
        bool isDispute
    ) internal {
        uint256 total = bounty.rewardAmount;
        uint256 winnerReward = (total * WINNER_PERCENTAGE) / 100;
        uint256 pool = total - winnerReward; // Exactly 20%

        uint256 bountyId = bounty.bountyId;
        uint8 count = bounty.submissionCount;

        // Effects (CEI)
        bounty.state = BountyState.Settled;
        bounty.winnerSubmissionId = winnerSubmissionId;
        bounty.settledAt = block.timestamp;

        address winnerAddress = bountySubmissions[bountyId][winnerSubmissionId].contributor;

        if (isDispute) {
            emit DisputeResolved(bountyId, msg.sender, winnerSubmissionId, winnerAddress, winnerReward, pool);
        } else {
            emit WinnerSelected(bountyId, winnerSubmissionId, winnerAddress, winnerReward, pool);
        }

        emit BountySettled(bountyId, block.timestamp);

        // Interactions
        if (count == 1) {
            // Special Case: Exactly 1 valid submission.
            // Winner receives 80%.
            // The unused 20% participation pool is returned to Creator.
            _safeTransferNative(winnerAddress, winnerReward);
            _safeTransferNative(bounty.creator, pool);
        } else {
            // General Case: 2 to 10 submissions.
            // Other valid non-winning contributors share 20% pool equally.
            uint256 otherCount = count - 1;
            uint256 perContributor = pool / otherCount;
            uint256 dust = pool % otherCount;

            // Winner receives 80% + any integer division dust so zero wei is stranded
            uint256 finalWinnerPayout = winnerReward + dust;

            // Emit all participant events prior to external transfers (strict CEI)
            for (uint256 i = 1; i <= count; i++) {
                if (i != winnerSubmissionId) {
                    emit ParticipantRewarded(bountyId, bountySubmissions[bountyId][i].contributor, perContributor);
                }
            }

            _safeTransferNative(winnerAddress, finalWinnerPayout);

            // Disburse equal share to each other contributor
            for (uint256 i = 1; i <= count; i++) {
                if (i != winnerSubmissionId) {
                    address participant = bountySubmissions[bountyId][i].contributor;
                    _safeTransferNative(participant, perContributor);
                }
            }
        }
    }

    /**
     * @dev Safe native transfer helper.
     *      If recipient call reverts, credits amount to claimableRewards mapping.
     *      This prevents a griefing/reverting contract from blocking the entire settlement.
     */
    function _safeTransferNative(address recipient, uint256 amount) internal {
        if (amount == 0) return;

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            claimableRewards[recipient] += amount;
            emit TransferFallbackCredited(recipient, amount);
        }
    }

    function _getValidBounty(uint256 bountyId) internal view returns (Bounty storage bounty) {
        bounty = bounties[bountyId];
        if (bounty.state == BountyState.None) {
            revert BountyDoesNotExist(bountyId);
        }
    }

    // =========================================================================
    // SAFETY FALLBACKS
    // =========================================================================

    receive() external payable {
        revert DirectDepositNotAllowed();
    }

    fallback() external payable {
        revert DirectDepositNotAllowed();
    }
}
