// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SettleXBounty} from "../src/SettleXBounty.sol";
import {IDisputeResolver} from "../src/interfaces/IDisputeResolver.sol";
import {ISettleXBounty} from "../src/interfaces/ISettleXBounty.sol";

/**
 * @dev Malicious contract that reverts when receiving native MON.
 *      Used to verify that a griefing contributor does not brick settlement for others.
 */
contract RevertingReceiver {
    receive() external payable {
        revert("I reject ETH");
    }
}

/**
 * @dev Malicious contract that attempts reentrancy during payout.
 */
contract ReentrantBountyAttacker {
    SettleXBounty public immutable bountyContract;
    uint256 public targetBountyId;
    bool public attacked;

    constructor(address payable _bounty) {
        bountyContract = SettleXBounty(_bounty);
    }

    function setTargetBounty(uint256 _bountyId) external {
        targetBountyId = _bountyId;
    }

    receive() external payable {
        if (!attacked && targetBountyId != 0) {
            attacked = true;
            // Attempt to reenter selectWinner or claimReward
            bountyContract.selectWinner(targetBountyId, 1);
        }
    }
}

/**
 * @notice Mock implementation of a 3-Juror Decentralized Jury module.
 * @dev Demonstrates future V3 compatibility where disputeResolver is a smart contract
 *      collecting juror votes against Acceptance Criteria and executing majority decision on SettleXBounty.
 */
contract MockDecentralizedJury is IDisputeResolver {
    address public immutable bountyContract;
    address[3] public jurors;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(uint256 => uint256)) public votesPerSubmission;
    mapping(uint256 => uint256) public totalVotes;
    mapping(uint256 => bool) public resolved;

    constructor(address _bountyContract, address j1, address j2, address j3) {
        bountyContract = _bountyContract;
        jurors[0] = j1;
        jurors[1] = j2;
        jurors[2] = j3;
    }

    function isAuthorizedResolver(uint256, address account) external view override returns (bool) {
        return (account == jurors[0] || account == jurors[1] || account == jurors[2]);
    }

    function getDisputeStatus(uint256 bountyId) external view override returns (string memory status, string memory detailsUri) {
        if (resolved[bountyId]) return ("Resolved", "ipfs://jury-majority-decision");
        return ("InVoting", "ipfs://jury-voting-active");
    }

    function castJurorVote(uint256 bountyId, uint256 candidateSubmissionId) external {
        require(!resolved[bountyId], "Already resolved");
        require(msg.sender == jurors[0] || msg.sender == jurors[1] || msg.sender == jurors[2], "Not approved juror");
        require(!hasVoted[bountyId][msg.sender], "Already voted");

        hasVoted[bountyId][msg.sender] = true;
        votesPerSubmission[bountyId][candidateSubmissionId]++;
        totalVotes[bountyId]++;

        // If candidate reaches 2 votes (majority of 3)
        if (votesPerSubmission[bountyId][candidateSubmissionId] >= 2) {
            resolved[bountyId] = true;
            emit DisputeFinalized(bountyId, candidateSubmissionId, "ipfs://jury-majority-2-of-3");
            ISettleXBounty(bountyContract).resolveDispute(bountyId, candidateSubmissionId);
        }
    }
}

/**
 * @title SettleXBountyTest
 * @notice Comprehensive Foundry test suite for SettleXBounty smart contract.
 */
contract SettleXBountyTest is Test {
    SettleXBounty public bountyHub;

    address public creator = makeAddr("creator");
    address public disputeResolver = makeAddr("disputeResolver");
    address public arbiter = disputeResolver; // Backwards reference for tests
    address public stranger = makeAddr("stranger");

    address[] public contributors;

    uint256 public constant DEFAULT_REWARD = 5 ether; // 5 MON
    uint256 public constant DEFAULT_DURATION = 3 days;
    string public constant DEFAULT_METADATA = "ipfs://bafybeibountyacceptancecriteria";

    uint256 public defaultDeadline;

    function setUp() public {
        bountyHub = new SettleXBounty();

        vm.deal(creator, 100 ether);
        vm.deal(arbiter, 10 ether);
        vm.deal(stranger, 10 ether);

        defaultDeadline = block.timestamp + DEFAULT_DURATION;

        // Setup 10 contributor addresses with gas funds
        for (uint256 i = 1; i <= 10; i++) {
            address c = makeAddr(string(abi.encodePacked("contributor", i)));
            contributors.push(c);
            vm.deal(c, 1 ether);
        }
    }

    // =========================================================================
    // 1–7. BOUNTY CREATION TESTS
    // =========================================================================

    function test_CreateBounty_MinSubmissions() public {
        vm.startPrank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            1, // Min allowed slots
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();

        assertEq(bountyId, 1);
        SettleXBounty.Bounty memory b = bountyHub.getBounty(1);
        assertEq(b.creator, creator);
        assertEq(b.rewardAmount, DEFAULT_REWARD);
        assertEq(b.maxSubmissions, 1);
        assertEq(b.disputeResolver, disputeResolver);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Open));
        assertEq(b.taskMetadataUri, DEFAULT_METADATA);
        assertEq(address(bountyHub).balance, DEFAULT_REWARD);
    }

    function test_CreateBounty_MaxSubmissions() public {
        vm.startPrank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            10, // Max allowed slots
            address(0),
            DEFAULT_METADATA
        );
        vm.stopPrank();

        assertEq(bountyId, 1);
        SettleXBounty.Bounty memory b = bountyHub.getBounty(1);
        assertEq(b.maxSubmissions, 10);
        assertEq(b.disputeResolver, address(0));
    }

    function test_Revert_CreateBounty_ZeroSubmissions() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidMaxSubmissions.selector, 0, 1, 10));
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            0,
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_ElevenSubmissions() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidMaxSubmissions.selector, 11, 1, 10));
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            11,
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_ZeroReward() public {
        vm.startPrank(creator);
        vm.expectRevert(SettleXBounty.ZeroReward.selector);
        bountyHub.createBounty{value: 0}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_PastDeadline() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidSubmissionDeadline.selector, block.timestamp - 1, block.timestamp));
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            block.timestamp - 1,
            5,
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_CurrentTimestampDeadline() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidSubmissionDeadline.selector, block.timestamp, block.timestamp));
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            block.timestamp,
            5,
            arbiter,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_EmptyMetadataUri() public {
        vm.startPrank(creator);
        vm.expectRevert(SettleXBounty.EmptyMetadataUri.selector);
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            ""
        );
        vm.stopPrank();
    }

    function test_Revert_CreateBounty_CreatorCannotBeDisputeResolver() public {
        vm.startPrank(creator);
        vm.expectRevert(SettleXBounty.CreatorCannotBeDisputeResolver.selector);
        bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            creator,
            DEFAULT_METADATA
        );
        vm.stopPrank();
    }

    // =========================================================================
    // 8–14. SUBMISSION RULES & CAPACITY TESTS
    // =========================================================================

    function test_SubmitWork_Success() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        address c1 = contributors[0];
        vm.prank(c1);
        uint256 subId = bountyHub.submitWork(bountyId, "ipfs://proof-c1");

        assertEq(subId, 1);
        SettleXBounty.Submission memory sub = bountyHub.getSubmission(bountyId, 1);
        assertEq(sub.submissionId, 1);
        assertEq(sub.contributor, c1);
        assertEq(sub.submissionUri, "ipfs://proof-c1");
        assertEq(sub.submittedAt, block.timestamp);

        assertEq(bountyHub.getRemainingSlots(bountyId), 2);
    }

    function test_Revert_CreatorCannotSubmit() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(creator);
        vm.expectRevert(SettleXBounty.CreatorCannotSubmit.selector);
        bountyHub.submitWork(bountyId, "ipfs://fake-proof");
    }

    function test_Revert_SameContributorCannotSubmitTwice() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        address c1 = contributors[0];
        vm.prank(c1);
        bountyHub.submitWork(bountyId, "ipfs://proof-1");

        vm.prank(c1);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.AlreadySubmitted.selector, bountyId, c1));
        bountyHub.submitWork(bountyId, "ipfs://proof-2");
    }

    function test_Revert_SubmitAfterDeadline() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        // Warp past deadline
        vm.warp(defaultDeadline + 1);

        address c1 = contributors[0];
        vm.prank(c1);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.SubmissionDeadlinePassed.selector, bountyId, defaultDeadline));
        bountyHub.submitWork(bountyId, "ipfs://late-proof");
    }

    function test_AutoTransition_WhenCapacityReachesMax() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        SettleXBounty.Bounty memory b1 = bountyHub.getBounty(bountyId);
        assertEq(uint256(b1.state), uint256(SettleXBounty.BountyState.Open));

        // 2nd submission reaches maxSubmissions (2)
        vm.prank(contributors[1]);
        bountyHub.submitWork(bountyId, "ipfs://sub-2");

        SettleXBounty.Bounty memory b2 = bountyHub.getBounty(bountyId);
        assertEq(uint256(b2.state), uint256(SettleXBounty.BountyState.Reviewing));
        assertEq(b2.reviewDeadline, block.timestamp + 24 hours);
        assertEq(bountyHub.getRemainingSlots(bountyId), 0);

        // 3rd submission must revert
        vm.prank(contributors[2]);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidBountyState.selector, bountyId, SettleXBounty.BountyState.Reviewing));
        bountyHub.submitWork(bountyId, "ipfs://sub-3");
    }

    function test_Transition_CloseSubmissions_AfterDeadline() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        // Warp past deadline
        vm.warp(defaultDeadline + 10);

        // Anyone calls closeSubmissions
        bountyHub.closeSubmissions(bountyId);

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Reviewing));
        assertEq(b.reviewDeadline, block.timestamp + 24 hours);
    }

    // =========================================================================
    // 15. ZERO-SUBMISSION REFUND
    // =========================================================================

    function test_ClaimExpiredBountyRefund_Success() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );

        // Warp past deadline with 0 submissions
        vm.warp(defaultDeadline + 1);

        uint256 creatorBalBefore = creator.balance;

        vm.prank(creator);
        bountyHub.claimExpiredBountyRefund(bountyId);

        assertEq(creator.balance, creatorBalBefore + DEFAULT_REWARD);
        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Refunded));
    }

    function test_Revert_ClaimExpiredRefund_BeforeDeadline() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.SubmissionDeadlineNotPassed.selector, bountyId, defaultDeadline));
        bountyHub.claimExpiredBountyRefund(bountyId);
    }

    function test_Revert_ClaimExpiredRefund_WhenSubmissionsExist() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://proof-1");

        // Warp past deadline
        vm.warp(defaultDeadline + 1);

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.SubmissionsExistCannotRefund.selector, bountyId, 1));
        bountyHub.claimExpiredBountyRefund(bountyId);
    }

    function test_Revert_ClaimExpiredRefund_Unauthorized() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            5,
            arbiter,
            DEFAULT_METADATA
        );

        vm.warp(defaultDeadline + 1);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.Unauthorized.selector, stranger, "creator"));
        bountyHub.claimExpiredBountyRefund(bountyId);
    }

    // =========================================================================
    // 16–25. WINNER SELECTION & 80/20 PAYOUT MATH TESTS
    // =========================================================================

    function test_SingleSubmission_80PercentToWinner_20PercentRefundedToCreator() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            1, // maxSubmissions = 1
            arbiter,
            DEFAULT_METADATA
        );

        address c1 = contributors[0];
        vm.prank(c1);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        // Auto transitioned to Reviewing
        uint256 c1BalBefore = c1.balance;
        uint256 creatorBalBefore = creator.balance;

        // Creator selects submission 1 as winner
        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        // Winner receives 80% (4 ether)
        assertEq(c1.balance, c1BalBefore + 4 ether);

        // Unused 20% pool (1 ether) returned to Creator
        assertEq(creator.balance, creatorBalBefore + 1 ether);

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Settled));
        assertEq(b.winnerSubmissionId, 1);
        assertEq(address(bountyHub).balance, 0);
    }

    function test_TwoContributors_80PercentWinner_20PercentOther() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        address c1 = contributors[0];
        address c2 = contributors[1];

        vm.prank(c1);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");
        vm.prank(c2);
        bountyHub.submitWork(bountyId, "ipfs://sub-2");

        uint256 c1Before = c1.balance;
        uint256 c2Before = c2.balance;

        // Creator selects c2 as winner
        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 2);

        // Winner (c2) gets 80% (4 ether)
        assertEq(c2.balance, c2Before + 4 ether);

        // Non-winner (c1) gets 20% (1 ether)
        assertEq(c1.balance, c1Before + 1 ether);

        assertEq(address(bountyHub).balance, 0);
    }

    function test_FourContributors_80PercentWinner_20PercentSplitThreeWaysWithDust() public {
        // 5 ether = 5_000_000_000_000_000_000 wei
        // 80% = 4 ether = 4_000_000_000_000_000_000 wei
        // 20% = 1 ether = 1_000_000_000_000_000_000 wei
        // 3 non-winners: 1 ether / 3 = 333_333_333_333_333_333 wei each
        // Dust = 1 ether % 3 = 1 wei
        // Winner gets: 4 ether + 1 wei
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            4,
            arbiter,
            DEFAULT_METADATA
        );

        for (uint256 i = 0; i < 4; i++) {
            vm.prank(contributors[i]);
            bountyHub.submitWork(bountyId, string(abi.encodePacked("ipfs://sub-", i)));
        }

        uint256 winnerBefore = contributors[0].balance;
        uint256 c1Before = contributors[1].balance;
        uint256 c2Before = contributors[2].balance;
        uint256 c3Before = contributors[3].balance;

        // Creator selects submission 1 as winner
        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        uint256 expectedPerParticipant = uint256(1 ether) / 3;
        uint256 expectedDust = uint256(1 ether) % 3; // 1 wei

        assertEq(contributors[0].balance, winnerBefore + 4 ether + expectedDust);
        assertEq(contributors[1].balance, c1Before + expectedPerParticipant);
        assertEq(contributors[2].balance, c2Before + expectedPerParticipant);
        assertEq(contributors[3].balance, c3Before + expectedPerParticipant);

        // Exact zero wei stranded
        assertEq(address(bountyHub).balance, 0);
    }

    function test_TenContributors_80PercentWinner_20PercentSplitNineWaysWithDust() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 10 ether}(
            defaultDeadline,
            10,
            arbiter,
            DEFAULT_METADATA
        );

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(contributors[i]);
            bountyHub.submitWork(bountyId, string(abi.encodePacked("ipfs://sub-", i)));
        }

        // Winner = 8 ether
        // Pool = 2 ether
        // 9 non-winners: 2 ether / 9 = 222_222_222_222_222_222 wei
        // Dust = 2 ether % 9 = 2 wei
        uint256 expectedPer = uint256(2 ether) / 9;
        uint256 expectedDust = uint256(2 ether) % 9;

        uint256 winnerBefore = contributors[4].balance; // Index 4 is submission 5

        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 5);

        assertEq(contributors[4].balance, winnerBefore + 8 ether + expectedDust);

        for (uint256 i = 0; i < 10; i++) {
            if (i != 4) {
                assertEq(contributors[i].balance, 1 ether + expectedPer);
            }
        }

        assertEq(address(bountyHub).balance, 0);
    }

    function test_Fuzz_PayoutExactSum(uint256 reward) public {
        vm.assume(reward >= 100 && reward <= 1000 ether);

        vm.deal(creator, reward);
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: reward}(
            defaultDeadline,
            6,
            arbiter,
            DEFAULT_METADATA
        );

        for (uint256 i = 0; i < 6; i++) {
            vm.prank(contributors[i]);
            bountyHub.submitWork(bountyId, "ipfs://sub");
        }

        uint256 initialBal = address(bountyHub).balance;
        assertEq(initialBal, reward);

        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 3);

        // Every single wei accounted for, zero contract balance remains
        assertEq(address(bountyHub).balance, 0);
    }

    function test_Revert_OnlyCreatorCanSelectWinner() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            1,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.Unauthorized.selector, stranger, "creator"));
        bountyHub.selectWinner(bountyId, 1);
    }

    function test_Revert_DoubleWinnerSelection() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");
        vm.prank(contributors[1]);
        bountyHub.submitWork(bountyId, "ipfs://sub-2");

        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        // Second attempt must fail because state is already Settled
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidBountyState.selector, bountyId, SettleXBounty.BountyState.Settled));
        bountyHub.selectWinner(bountyId, 2);
    }

    function test_Revert_CreatorCannotSelectWinnerAfter24Hours() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            1,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        uint256 reviewDeadline = b.reviewDeadline;

        // Warp past 24 hours
        vm.warp(reviewDeadline + 1);

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.ReviewDeadlinePassed.selector, bountyId, reviewDeadline));
        bountyHub.selectWinner(bountyId, 1);
    }

    // =========================================================================
    // 28–29. REENTRANCY & REVERTING RECEIVER FALLBACK TESTS
    // =========================================================================

    function test_RevertingReceiver_DoesNotBrickSettlement_CreditsPullClaim() public {
        RevertingReceiver badReceiver = new RevertingReceiver();

        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        // Contributor 1 is normal
        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        // Contributor 2 is the reverting receiver contract
        vm.prank(address(badReceiver));
        bountyHub.submitWork(bountyId, "ipfs://reverting-contract");

        uint256 c1Before = contributors[0].balance;

        // Creator selects c1 as winner; badReceiver receives 20% (1 ether)
        // badReceiver reverts on transfer, but settlement DOES NOT REVERT!
        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        // Winner got 80% (4 ether)
        assertEq(contributors[0].balance, c1Before + 4 ether);

        // Bounty successfully settled
        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Settled));

        // 1 ether was safely credited to claimableRewards for badReceiver
        assertEq(bountyHub.claimableRewards(address(badReceiver)), 1 ether);
        assertEq(address(bountyHub).balance, 1 ether);
    }

    function test_ClaimReward_Success() public {
        RevertingReceiver badReceiver = new RevertingReceiver();

        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        vm.prank(address(badReceiver));
        bountyHub.submitWork(bountyId, "ipfs://c2");

        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        assertEq(bountyHub.claimableRewards(address(badReceiver)), 1 ether);

        // If a normal user had fallback funds, they can call claimReward
        vm.deal(stranger, 0);
        // Simulate fallback credit to stranger
        vm.prank(stranger);
        vm.expectRevert(SettleXBounty.NoClaimableRewards.selector);
        bountyHub.claimReward();
    }

    function test_ReentrancyAttack_Reverts() public {
        ReentrantBountyAttacker attacker = new ReentrantBountyAttacker(payable(address(bountyHub)));

        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        attacker.setTargetBounty(bountyId);

        vm.prank(address(attacker));
        bountyHub.submitWork(bountyId, "ipfs://attacker");

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        // Creator selects attacker as winner
        // Attacker attempts reentrancy during native MON transfer
        // Because CEI pattern is used, state is already Settled, so reentrant call reverts with InvalidBountyState
        vm.prank(creator);
        bountyHub.selectWinner(bountyId, 1);

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(uint256(b.state), uint256(SettleXBounty.BountyState.Settled));
    }

    // =========================================================================
    // 30–34. DISPUTE REVIEW & ARBITER TESTS
    // =========================================================================

    function test_EscalateToDispute_After24Hours() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            1,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        uint256 reviewDeadline = b.reviewDeadline;

        // Warp past 24 hours
        vm.warp(reviewDeadline + 1);

        // Contributor or anyone escalates
        vm.prank(contributors[0]);
        bountyHub.escalateToDispute(bountyId);

        SettleXBounty.Bounty memory disputed = bountyHub.getBounty(bountyId);
        assertEq(uint256(disputed.state), uint256(SettleXBounty.BountyState.DisputeReview));
    }

    function test_Revert_EscalateToDispute_Before24Hours() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            1,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://sub-1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);

        // Attempt escalation before 24h
        vm.prank(contributors[0]);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.ReviewDeadlineNotPassed.selector, bountyId, b.reviewDeadline));
        bountyHub.escalateToDispute(bountyId);
    }

    function test_Arbiter_ResolveDispute_Success() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");
        vm.prank(contributors[1]);
        bountyHub.submitWork(bountyId, "ipfs://c2");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);

        // Escalate to dispute
        bountyHub.escalateToDispute(bountyId);

        uint256 c1Before = contributors[0].balance;
        uint256 c2Before = contributors[1].balance;

        // Arbiter resolves dispute selecting submission 2 as winner
        vm.prank(arbiter);
        bountyHub.resolveDispute(bountyId, 2);

        // Winner (c2) gets 80% (4 ether)
        assertEq(contributors[1].balance, c2Before + 4 ether);
        // Non-winner (c1) gets 20% (1 ether)
        assertEq(contributors[0].balance, c1Before + 1 ether);

        SettleXBounty.Bounty memory settledBounty = bountyHub.getBounty(bountyId);
        assertEq(uint256(settledBounty.state), uint256(SettleXBounty.BountyState.Settled));
        assertEq(settledBounty.winnerSubmissionId, 2);
    }

    function test_Revert_ResolveDispute_Unauthorized() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            1,
            disputeResolver,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);
        bountyHub.escalateToDispute(bountyId);

        // Stranger attempts resolveDispute
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.Unauthorized.selector, stranger, "disputeResolver"));
        bountyHub.resolveDispute(bountyId, 1);
    }

    function test_Revert_ResolveDispute_NoDisputeResolverConfigured() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            1,
            address(0), // No disputeResolver
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);
        bountyHub.escalateToDispute(bountyId);

        vm.prank(disputeResolver);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.NoDisputeResolverConfigured.selector, bountyId));
        bountyHub.resolveDispute(bountyId, 1);
    }

    function test_Revert_ResolveDispute_InvalidWinnerSubmissionId() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            1,
            disputeResolver,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);
        bountyHub.escalateToDispute(bountyId);

        // Submissions exist: 1 (count is 1). Attempting subId = 0 or subId = 2 must revert
        vm.startPrank(disputeResolver);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidWinnerSubmissionId.selector, bountyId, 0));
        bountyHub.resolveDispute(bountyId, 0);

        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidWinnerSubmissionId.selector, bountyId, 2));
        bountyHub.resolveDispute(bountyId, 2);
        vm.stopPrank();
    }

    function test_Revert_ResolveDispute_NotInDisputeReview() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            1,
            disputeResolver,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");

        // Still in Reviewing state (24h review not expired)
        vm.prank(disputeResolver);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidBountyState.selector, bountyId, SettleXBounty.BountyState.Reviewing));
        bountyHub.resolveDispute(bountyId, 1);
    }

    function test_Revert_ResolveDispute_CannotResolveTwice() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 5 ether}(
            defaultDeadline,
            2,
            disputeResolver,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");
        vm.prank(contributors[1]);
        bountyHub.submitWork(bountyId, "ipfs://c2");

        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);
        bountyHub.escalateToDispute(bountyId);

        // First resolution succeeds
        vm.prank(disputeResolver);
        bountyHub.resolveDispute(bountyId, 1);

        // Second resolution must revert because state is Settled
        vm.prank(disputeResolver);
        vm.expectRevert(abi.encodeWithSelector(SettleXBounty.InvalidBountyState.selector, bountyId, SettleXBounty.BountyState.Settled));
        bountyHub.resolveDispute(bountyId, 2);
    }

    function test_FutureDecentralizedJury_MajorityVoteResolvesBounty() public {
        // Setup 3 approved Jurors
        address juror1 = makeAddr("juror1");
        address juror2 = makeAddr("juror2");
        address juror3 = makeAddr("juror3");

        // Deploy MockDecentralizedJury module
        MockDecentralizedJury jury = new MockDecentralizedJury(
            address(bountyHub),
            juror1,
            juror2,
            juror3
        );

        // Creator sets the Decentralized Jury module as disputeResolver
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: 10 ether}(
            defaultDeadline,
            3,
            address(jury),
            DEFAULT_METADATA
        );

        // Contributors submit deliverables
        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://c1");
        vm.prank(contributors[1]);
        bountyHub.submitWork(bountyId, "ipfs://c2");
        vm.prank(contributors[2]);
        bountyHub.submitWork(bountyId, "ipfs://c3");

        // Creator goes inactive; 24-hour review period passes
        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        vm.warp(b.reviewDeadline + 1);
        bountyHub.escalateToDispute(bountyId);

        (string memory statusBefore, ) = jury.getDisputeStatus(bountyId);
        assertEq(statusBefore, "InVoting");

        uint256 c2Before = contributors[1].balance;
        uint256 c1Before = contributors[0].balance;
        uint256 c3Before = contributors[2].balance;

        // Juror 1 votes for Submission 2 (Contributor 2)
        vm.prank(juror1);
        jury.castJurorVote(bountyId, 2);

        // Total votes = 1, not yet resolved
        assertEq(jury.totalVotes(bountyId), 1);
        assertFalse(jury.resolved(bountyId));

        // Juror 2 also votes for Submission 2 (reaching 2/3 majority vote)
        vm.prank(juror2);
        jury.castJurorVote(bountyId, 2);

        // Jury auto-executes resolveDispute on SettleXBounty!
        assertTrue(jury.resolved(bountyId));
        (string memory statusAfter, ) = jury.getDisputeStatus(bountyId);
        assertEq(statusAfter, "Resolved");

        // Winner (Contributor 2) receives 80% (8 ether)
        assertEq(contributors[1].balance, c2Before + 8 ether);
        // Contributor 1 and Contributor 3 split 20% pool (1 ether each)
        assertEq(contributors[0].balance, c1Before + 1 ether);
        assertEq(contributors[2].balance, c3Before + 1 ether);

        // Bounty state is verified Settled
        SettleXBounty.Bounty memory settledBounty = bountyHub.getBounty(bountyId);
        assertEq(uint256(settledBounty.state), uint256(SettleXBounty.BountyState.Settled));
        assertEq(settledBounty.winnerSubmissionId, 2);
    }

    function test_AcceptanceCriteria_RemainsImmutable() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://proof");

        // Metadata URI is completely immutable; there are no update functions
        SettleXBounty.Bounty memory b = bountyHub.getBounty(bountyId);
        assertEq(b.taskMetadataUri, DEFAULT_METADATA);
    }

    function test_ViewHelpers() public {
        vm.prank(creator);
        uint256 bountyId = bountyHub.createBounty{value: DEFAULT_REWARD}(
            defaultDeadline,
            3,
            arbiter,
            DEFAULT_METADATA
        );

        vm.prank(contributors[0]);
        bountyHub.submitWork(bountyId, "ipfs://proof-1");

        SettleXBounty.Submission[] memory subs = bountyHub.getBountySubmissions(bountyId);
        assertEq(subs.length, 1);
        assertEq(subs[0].contributor, contributors[0]);

        uint256[] memory created = bountyHub.getUserCreatedBounties(creator);
        assertEq(created.length, 1);
        assertEq(created[0], bountyId);

        uint256[] memory contributed = bountyHub.getUserContributedBounties(contributors[0]);
        assertEq(contributed.length, 1);
        assertEq(contributed[0], bountyId);
    }

    function test_DirectNativeTransfer_Reverts() public {
        vm.expectRevert(SettleXBounty.DirectDepositNotAllowed.selector);
        (bool success, ) = address(bountyHub).call{value: 1 ether}("");
        assertTrue(success);
    }
}
