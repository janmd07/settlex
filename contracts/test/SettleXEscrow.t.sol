// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SettleXEscrow} from "../src/SettleXEscrow.sol";

/**
 * @title ReentrantAttacker
 * @dev Helper contract that simulates a malicious seller attempting to reenter the escrow.
 */
contract ReentrantAttacker {
    SettleXEscrow public immutable escrow;
    uint256 public targetDealId;
    bool public attacked;

    constructor(address payable _escrow) {
        escrow = SettleXEscrow(_escrow);
    }

    function setTargetDeal(uint256 _dealId) external {
        targetDealId = _dealId;
    }

    receive() external payable {
        if (!attacked && targetDealId != 0) {
            attacked = true;
            // Attempt reentrancy by calling approveAndRelease or refundBuyer during payout
            escrow.approveAndRelease(targetDealId);
        }
    }
}

/**
 * @title SettleXEscrowTest
 * @notice Comprehensive test suite for SettleXEscrow smart contract covering:
 *         - Happy Paths
 *         - Refunds
 *         - Cancellations
 *         - Disputes
 *         - Security & Edge Cases
 */
contract SettleXEscrowTest is Test {
    SettleXEscrow public escrow;

    address public buyer;
    address public seller;
    address public arbiter;
    address public stranger;

    uint256 public constant DEAL_AMOUNT = 1 ether;
    uint256 public constant DEAL_DURATION = 3 days;
    string public constant METADATA_URI = "ipfs://bafybeiexampleterms";
    string public constant SUBMISSION_URI = "ipfs://bafybeiexamplework";

    uint256 public defaultDeadline;

    event DealCreated(
        uint256 indexed dealId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 deadline,
        address arbiter,
        string metadataUri
    );

    event DealFunded(
        uint256 indexed dealId,
        address indexed buyer,
        uint256 amount,
        uint256 fundedAt
    );

    event WorkSubmitted(
        uint256 indexed dealId,
        address indexed seller,
        string submissionUri,
        uint256 submittedAt
    );

    event DealSettled(
        uint256 indexed dealId,
        address indexed seller,
        uint256 amount,
        uint256 settledAt
    );

    event DealRefunded(
        uint256 indexed dealId,
        address indexed buyer,
        uint256 amount,
        uint256 refundedAt
    );

    event DealCancelled(
        uint256 indexed dealId,
        address indexed cancelledBy,
        uint256 cancelledAt
    );

    event DisputeRaised(
        uint256 indexed dealId,
        address indexed raisedBy,
        string reason
    );

    event DisputeResolved(
        uint256 indexed dealId,
        address indexed arbiter,
        uint256 buyerAmount,
        uint256 sellerAmount
    );

    function setUp() public {
        escrow = new SettleXEscrow();

        buyer = makeAddr("buyer");
        seller = makeAddr("seller");
        arbiter = makeAddr("arbiter");
        stranger = makeAddr("stranger");

        vm.deal(buyer, 100 ether);
        vm.deal(seller, 10 ether);
        vm.deal(stranger, 10 ether);

        defaultDeadline = block.timestamp + DEAL_DURATION;
    }

    // =========================================================================
    // HAPPY PATH TESTS
    // =========================================================================

    function test_HappyPath_CreateDeal() public {
        vm.startPrank(buyer);

        vm.expectEmit(true, true, true, false);
        emit DealCreated(
            1,
            buyer,
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );
        vm.stopPrank();

        assertEq(dealId, 1);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(deal.dealId, 1);
        assertEq(deal.buyer, buyer);
        assertEq(deal.seller, seller);
        assertEq(deal.arbiter, arbiter);
        assertEq(deal.amount, DEAL_AMOUNT);
        assertEq(deal.deadline, defaultDeadline);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Created));
        assertEq(deal.createdAt, block.timestamp);
        assertEq(deal.metadataUri, METADATA_URI);

        // Check user deal indexing
        uint256[] memory buyerDeals = escrow.getUserDeals(buyer);
        uint256[] memory sellerDeals = escrow.getUserDeals(seller);
        assertEq(buyerDeals.length, 1);
        assertEq(sellerDeals.length, 1);
        assertEq(buyerDeals[0], 1);
        assertEq(sellerDeals[0], 1);
        assertEq(escrow.getUserDealCount(buyer), 1);
    }

    function test_HappyPath_FundDeal() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DealFunded(dealId, buyer, DEAL_AMOUNT, block.timestamp);

        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Funded));
        assertEq(deal.fundedAt, block.timestamp);
        assertEq(address(escrow).balance, DEAL_AMOUNT);
    }

    function test_HappyPath_SubmitWork() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(seller);
        vm.expectEmit(true, true, false, true);
        emit WorkSubmitted(dealId, seller, SUBMISSION_URI, block.timestamp);

        escrow.submitWork(dealId, SUBMISSION_URI);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Submitted));
    }

    function test_HappyPath_ApproveAndRelease() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(seller);
        escrow.submitWork(dealId, SUBMISSION_URI);

        uint256 sellerBalBefore = seller.balance;

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DealSettled(dealId, seller, DEAL_AMOUNT, block.timestamp);

        escrow.approveAndRelease(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Settled));
        assertEq(deal.settledAt, block.timestamp);
        assertEq(seller.balance, sellerBalBefore + DEAL_AMOUNT);
        assertEq(address(escrow).balance, 0);
    }

    function test_HappyPath_ApproveDirectlyFromFundedState() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        uint256 sellerBalBefore = seller.balance;

        // Buyer approves without waiting for formal submitWork (allowed in architecture)
        vm.prank(buyer);
        escrow.approveAndRelease(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Settled));
        assertEq(seller.balance, sellerBalBefore + DEAL_AMOUNT);
    }

    function test_HappyPath_CreateAndFundDeal() public {
        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DealFunded(1, buyer, DEAL_AMOUNT, block.timestamp);

        uint256 dealId = escrow.createAndFundDeal{value: DEAL_AMOUNT}(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        assertEq(dealId, 1);
        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Funded));
        assertEq(address(escrow).balance, DEAL_AMOUNT);
    }

    // =========================================================================
    // REFUND TESTS
    // =========================================================================

    function test_Refund_SellerVoluntaryRefund_FromFunded() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        uint256 buyerBalBefore = buyer.balance;

        vm.prank(seller);
        vm.expectEmit(true, true, false, true);
        emit DealRefunded(dealId, buyer, DEAL_AMOUNT, block.timestamp);

        escrow.refundBuyer(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Refunded));
        assertEq(deal.settledAt, block.timestamp);
        assertEq(buyer.balance, buyerBalBefore + DEAL_AMOUNT);
        assertEq(address(escrow).balance, 0);
    }

    function test_Refund_SellerVoluntaryRefund_FromSubmitted() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(seller);
        escrow.submitWork(dealId, SUBMISSION_URI);

        uint256 buyerBalBefore = buyer.balance;

        vm.prank(seller);
        escrow.refundBuyer(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Refunded));
        assertEq(buyer.balance, buyerBalBefore + DEAL_AMOUNT);
    }

    function test_Refund_BuyerExpiredRefund() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Advance time to deadline
        vm.warp(defaultDeadline);

        uint256 buyerBalBefore = buyer.balance;

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DealRefunded(dealId, buyer, DEAL_AMOUNT, block.timestamp);

        escrow.claimExpiredRefund(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Refunded));
        assertEq(deal.settledAt, block.timestamp);
        assertEq(buyer.balance, buyerBalBefore + DEAL_AMOUNT);
    }

    function test_Refund_BeforeDeadlineMustFail() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Advance time to just before deadline
        vm.warp(defaultDeadline - 1);

        vm.prank(buyer);
        vm.expectRevert(SettleXEscrow.DeadlineNotPassed.selector);
        escrow.claimExpiredRefund(dealId);
    }

    // =========================================================================
    // CANCELLATION TESTS
    // =========================================================================

    function test_Cancellation_CancelUnfundedDeal_ByBuyer() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DealCancelled(dealId, buyer, block.timestamp);

        escrow.cancelDeal(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Cancelled));
        assertEq(deal.settledAt, block.timestamp);
    }

    function test_Cancellation_CancelUnfundedDeal_BySeller() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(seller);
        vm.expectEmit(true, true, false, true);
        emit DealCancelled(dealId, seller, block.timestamp);

        escrow.cancelDeal(dealId);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Cancelled));
    }

    function test_Cancellation_CannotCancelFundedDeal() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Funded
            )
        );
        escrow.cancelDeal(dealId);
    }

    // =========================================================================
    // DISPUTE TESTS
    // =========================================================================

    function test_Dispute_RaiseDispute_ByBuyer() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit DisputeRaised(dealId, buyer, "Work quality issue");

        escrow.raiseDispute(dealId, "Work quality issue");

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Disputed));
    }

    function test_Dispute_RaiseDispute_BySeller() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(seller);
        escrow.submitWork(dealId, SUBMISSION_URI);

        vm.prank(seller);
        vm.expectEmit(true, true, false, true);
        emit DisputeRaised(dealId, seller, "Client unresponsive");

        escrow.raiseDispute(dealId, "Client unresponsive");

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Disputed));
    }

    function test_Dispute_UnauthorizedResolutionMustFail() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "Conflict");

        // Stranger attempts to resolve
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "arbiter"
            )
        );
        escrow.resolveDispute(dealId, 0.5 ether, 0.5 ether);

        // Buyer attempts to resolve
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                buyer,
                "arbiter"
            )
        );
        escrow.resolveDispute(dealId, 0.5 ether, 0.5 ether);
    }

    function test_Dispute_ValidResolution_Split() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "Partial delivery disagreement");

        uint256 buyerBalBefore = buyer.balance;
        uint256 sellerBalBefore = seller.balance;

        uint256 buyerSplit = 0.4 ether;
        uint256 sellerSplit = 0.6 ether;

        vm.prank(arbiter);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(dealId, arbiter, buyerSplit, sellerSplit);

        escrow.resolveDispute(dealId, buyerSplit, sellerSplit);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Settled)); // seller >= buyer
        assertEq(buyer.balance, buyerBalBefore + buyerSplit);
        assertEq(seller.balance, sellerBalBefore + sellerSplit);
        assertEq(address(escrow).balance, 0);
    }

    function test_Dispute_ValidResolution_FullRefundToBuyer() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "No deliverable produced");

        uint256 buyerBalBefore = buyer.balance;

        vm.prank(arbiter);
        escrow.resolveDispute(dealId, DEAL_AMOUNT, 0);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Refunded));
        assertEq(buyer.balance, buyerBalBefore + DEAL_AMOUNT);
        assertEq(address(escrow).balance, 0);
    }

    function test_Dispute_InvalidSplitMustFail() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "Conflict");

        // Split total is 0.8 ether, but deal amount is 1 ether
        vm.prank(arbiter);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidSplit.selector,
                0.8 ether,
                DEAL_AMOUNT
            )
        );
        escrow.resolveDispute(dealId, 0.4 ether, 0.4 ether);

        // Split total exceeds deal amount (1.2 ether)
        vm.prank(arbiter);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidSplit.selector,
                1.2 ether,
                DEAL_AMOUNT
            )
        );
        escrow.resolveDispute(dealId, 0.6 ether, 0.6 ether);
    }

    // =========================================================================
    // SECURITY TESTS
    // =========================================================================

    function test_Security_UnauthorizedRelease() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Seller attempts to release to themselves
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                seller,
                "buyer"
            )
        );
        escrow.approveAndRelease(dealId);

        // Stranger attempts release
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "buyer"
            )
        );
        escrow.approveAndRelease(dealId);
    }

    function test_Security_UnauthorizedRefund() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Buyer attempts to voluntarily refund themselves before deadline
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                buyer,
                "seller"
            )
        );
        escrow.refundBuyer(dealId);

        // Stranger attempts voluntary refund
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "seller"
            )
        );
        escrow.refundBuyer(dealId);
    }

    function test_Security_UnauthorizedSubmission() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Buyer attempts to submit work
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                buyer,
                "seller"
            )
        );
        escrow.submitWork(dealId, SUBMISSION_URI);

        // Stranger attempts to submit work
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "seller"
            )
        );
        escrow.submitWork(dealId, SUBMISSION_URI);
    }

    function test_Security_UnauthorizedDisputeResolution() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            address(0), // No arbiter specified
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "No arbiter dispute");

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "arbiter"
            )
        );
        escrow.resolveDispute(dealId, 0.5 ether, 0.5 ether);
    }

    function test_Security_DoubleRelease() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // First release succeeds
        vm.prank(buyer);
        escrow.approveAndRelease(dealId);

        // Second release must revert
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Settled
            )
        );
        escrow.approveAndRelease(dealId);
    }

    function test_Security_DoubleRefund() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // First refund succeeds
        vm.prank(seller);
        escrow.refundBuyer(dealId);

        // Second refund must revert
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Refunded
            )
        );
        escrow.refundBuyer(dealId);
    }

    function test_Security_InvalidStateTransitions() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        // 1. Submit work on unfunded deal fails
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Created
            )
        );
        escrow.submitWork(dealId, SUBMISSION_URI);

        // 2. Approve and release on unfunded deal fails
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Created
            )
        );
        escrow.approveAndRelease(dealId);

        // 3. Voluntary refund on unfunded deal fails
        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Created
            )
        );
        escrow.refundBuyer(dealId);

        // 4. Raise dispute on unfunded deal fails
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Created
            )
        );
        escrow.raiseDispute(dealId, "Dispute created");

        // Fund deal
        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // 5. Fund already funded deal fails
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Funded
            )
        );
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // 6. Submit work then attempt claimExpiredRefund fails (must review or dispute)
        vm.prank(seller);
        escrow.submitWork(dealId, SUBMISSION_URI);

        vm.warp(defaultDeadline + 1);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Submitted
            )
        );
        escrow.claimExpiredRefund(dealId);

        // Settle deal
        vm.prank(buyer);
        escrow.approveAndRelease(dealId);

        // 7. Raise dispute on settled deal fails
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Settled
            )
        );
        escrow.raiseDispute(dealId, "Too late");
    }

    function test_Security_ZeroAddressValidation() public {
        vm.startPrank(buyer);

        // Seller zero address
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.ZeroAddress.selector,
                "seller"
            )
        );
        escrow.createDeal(
            address(0),
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.stopPrank();
    }

    function test_Security_BuyerCannotBeSeller() public {
        vm.startPrank(buyer);

        vm.expectRevert(SettleXEscrow.BuyerCannotBeSeller.selector);
        escrow.createDeal(
            buyer,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.stopPrank();
    }

    function test_Security_ZeroAmountValidation() public {
        vm.startPrank(buyer);

        vm.expectRevert(SettleXEscrow.ZeroAmount.selector);
        escrow.createDeal(
            seller,
            0,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.stopPrank();
    }

    function test_Security_InvalidDeadlineValidation() public {
        vm.startPrank(buyer);

        // Deadline in the past
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDeadline.selector,
                block.timestamp - 1,
                block.timestamp
            )
        );
        escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            block.timestamp - 1,
            arbiter,
            METADATA_URI
        );

        // Deadline equal to block.timestamp
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDeadline.selector,
                block.timestamp,
                block.timestamp
            )
        );
        escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            block.timestamp,
            arbiter,
            METADATA_URI
        );

        vm.stopPrank();
    }

    function test_Security_InvalidArbiterValidation() public {
        vm.startPrank(buyer);

        // Arbiter is buyer
        vm.expectRevert(SettleXEscrow.InvalidArbiter.selector);
        escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            buyer,
            METADATA_URI
        );

        // Arbiter is seller
        vm.expectRevert(SettleXEscrow.InvalidArbiter.selector);
        escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            seller,
            METADATA_URI
        );

        vm.stopPrank();
    }

    function test_Security_IncorrectPayment() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        // Underpayment
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.IncorrectPayment.selector,
                DEAL_AMOUNT,
                0.5 ether
            )
        );
        escrow.fundDeal{value: 0.5 ether}(dealId);

        // Overpayment
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.IncorrectPayment.selector,
                DEAL_AMOUNT,
                1.5 ether
            )
        );
        escrow.fundDeal{value: 1.5 ether}(dealId);
    }

    function test_Security_CannotFundAfterDeadline() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        // Warp time past deadline
        vm.warp(defaultDeadline);

        vm.prank(buyer);
        vm.expectRevert(SettleXEscrow.DeadlinePassed.selector);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);
    }

    function test_Security_CannotSubmitAfterDeadline() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Warp time past deadline
        vm.warp(defaultDeadline + 1);

        vm.prank(seller);
        vm.expectRevert(SettleXEscrow.DeadlinePassed.selector);
        escrow.submitWork(dealId, SUBMISSION_URI);
    }

    function test_Security_ReentrancyProtection() public {
        ReentrantAttacker attacker = new ReentrantAttacker(payable(address(escrow)));

        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            address(attacker),
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        attacker.setTargetDeal(dealId);

        // When buyer approves release, funds are transferred to attacker contract.
        // Attacker's receive() attempts to reenter approveAndRelease.
        // It should revert during the reentrant call (either due to ReentrancyGuard or InvalidDealState).
        // Since call is low-level, the transfer fails and the transaction reverts with TransferFailed!
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.TransferFailed.selector,
                address(attacker),
                DEAL_AMOUNT
            )
        );
        escrow.approveAndRelease(dealId);

        // Verify state remains Funded and funds are safe in escrow
        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Funded));
        assertEq(address(escrow).balance, DEAL_AMOUNT);
    }

    function test_Security_NonexistentDeal() public {
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.DealDoesNotExist.selector,
                999
            )
        );
        escrow.getDeal(999);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.DealDoesNotExist.selector,
                999
            )
        );
        escrow.fundDeal{value: 1 ether}(999);
    }

    function test_Security_DirectDepositBlocked() public {
        vm.prank(buyer);
        (bool success, ) = address(escrow).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_Security_FallbackBlocked() public {
        vm.prank(buyer);
        (bool success, ) = address(escrow).call{value: 0}(hex"deadbeef");
        assertFalse(success);
    }

    function test_Security_CreateAndFundDeal_IncorrectPayment() public {
        vm.startPrank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.IncorrectPayment.selector,
                DEAL_AMOUNT,
                0.5 ether
            )
        );
        escrow.createAndFundDeal{value: 0.5 ether}(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );
        vm.stopPrank();
    }

    function test_Security_CancelDeal_UnauthorizedCaller() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.Unauthorized.selector,
                stranger,
                "buyer or seller"
            )
        );
        escrow.cancelDeal(dealId);
    }

    function test_Dispute_ResolveDispute_NonDisputedStateFails() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        // Attempting to resolve when in Funded state
        vm.prank(arbiter);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettleXEscrow.InvalidDealState.selector,
                dealId,
                SettleXEscrow.DealState.Funded
            )
        );
        escrow.resolveDispute(dealId, 0.5 ether, 0.5 ether);
    }

    function test_Dispute_ValidResolution_FullPayoutToSeller() public {
        vm.prank(buyer);
        uint256 dealId = escrow.createDeal(
            seller,
            DEAL_AMOUNT,
            defaultDeadline,
            arbiter,
            METADATA_URI
        );

        vm.prank(buyer);
        escrow.fundDeal{value: DEAL_AMOUNT}(dealId);

        vm.prank(buyer);
        escrow.raiseDispute(dealId, "Deliverable contested");

        uint256 sellerBalBefore = seller.balance;

        vm.prank(arbiter);
        escrow.resolveDispute(dealId, 0, DEAL_AMOUNT);

        SettleXEscrow.Deal memory deal = escrow.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(SettleXEscrow.DealState.Settled));
        assertEq(seller.balance, sellerBalBefore + DEAL_AMOUNT);
        assertEq(address(escrow).balance, 0);
    }
}
