// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SettleXEscrow
 * @notice Trustless onchain escrow contract for freelancer/client and P2P deals on Monad Testnet.
 * @dev Implements a strict, deterministic state machine with Checks-Effects-Interactions and
 *      OpenZeppelin ReentrancyGuard. Native MON is the single payment asset for MVP.
 */
contract SettleXEscrow is ReentrancyGuard {
    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum DealState {
        None,        // 0: Deal does not exist
        Created,     // 1: Terms initialized, awaiting buyer funding
        Funded,      // 2: Escrow funded; funds locked securely in contract
        Submitted,   // 3: Seller delivered work; awaiting buyer review
        Disputed,    // 4: Conflict raised; escrow paused pending dispute resolution
        Settled,     // 5: Terminal: funds disbursed to Seller (or dispute payout)
        Refunded,    // 6: Terminal: funds returned to Buyer (or dispute refund)
        Cancelled    // 7: Terminal: deal aborted before any funds were locked
    }

    struct Deal {
        uint256 dealId;
        address buyer;
        address seller;
        address arbiter;
        uint256 amount;
        uint256 deadline;
        DealState state;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 settledAt;
        string metadataUri;
    }

    // =========================================================================
    // STORAGE
    // =========================================================================

    /// @notice Auto-incrementing identifier for deals, starting at 1.
    uint256 public nextDealId = 1;

    /// @notice Primary storage mapping from dealId to Deal struct.
    mapping(uint256 => Deal) public deals;

    /// @notice Indexed list of deal IDs associated with each user (buyer or seller).
    mapping(address => uint256[]) private _userDeals;

    // =========================================================================
    // EVENTS
    // =========================================================================

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

    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    error ZeroAddress(string parameterName);
    error ZeroAmount();
    error BuyerCannotBeSeller();
    error InvalidArbiter();
    error InvalidDeadline(uint256 provided, uint256 current);
    error DealDoesNotExist(uint256 dealId);
    error InvalidDealState(uint256 dealId, DealState currentState);
    error Unauthorized(address caller, string expectedRole);
    error IncorrectPayment(uint256 expected, uint256 actual);
    error DeadlinePassed();
    error DeadlineNotPassed();
    error InvalidSplit(uint256 totalGiven, uint256 requiredAmount);
    error TransferFailed(address recipient, uint256 amount);
    error DirectDepositNotAllowed();

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Buyer initiates a new escrow deal.
     * @param seller Address of the freelancer or counterparty.
     * @param amount Escrow amount in native MON wei.
     * @param deadline Unix timestamp by which work must be submitted.
     * @param arbiter Optional designated arbiter address (address(0) if none).
     * @param metadataUri URI or description of the deal scope and requirements.
     * @return dealId Unique incrementing identifier assigned to this deal.
     */
    function createDeal(
        address seller,
        uint256 amount,
        uint256 deadline,
        address arbiter,
        string calldata metadataUri
    ) external returns (uint256 dealId) {
        return _createDeal(seller, amount, deadline, arbiter, metadataUri);
    }

    /**
     * @notice Buyer creates and funds an escrow deal in a single atomic transaction.
     * @param seller Address of the freelancer or counterparty.
     * @param amount Escrow amount in native MON wei.
     * @param deadline Unix timestamp by which work must be submitted.
     * @param arbiter Optional designated arbiter address (address(0) if none).
     * @param metadataUri URI or description of the deal scope and requirements.
     * @return dealId Unique incrementing identifier assigned to this deal.
     */
    function createAndFundDeal(
        address seller,
        uint256 amount,
        uint256 deadline,
        address arbiter,
        string calldata metadataUri
    ) external payable nonReentrant returns (uint256 dealId) {
        if (msg.value != amount) {
            revert IncorrectPayment(amount, msg.value);
        }

        dealId = _createDeal(seller, amount, deadline, arbiter, metadataUri);

        Deal storage deal = deals[dealId];
        deal.state = DealState.Funded;
        deal.fundedAt = block.timestamp;

        emit DealFunded(dealId, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Buyer deposits native MON into a Created deal before deadline.
     * @param dealId Identifier of the deal to fund.
     */
    function fundDeal(uint256 dealId) external payable nonReentrant {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.buyer) {
            revert Unauthorized(msg.sender, "buyer");
        }
        if (deal.state != DealState.Created) {
            revert InvalidDealState(dealId, deal.state);
        }
        if (block.timestamp >= deal.deadline) {
            revert DeadlinePassed();
        }
        if (msg.value != deal.amount) {
            revert IncorrectPayment(deal.amount, msg.value);
        }

        deal.state = DealState.Funded;
        deal.fundedAt = block.timestamp;

        emit DealFunded(dealId, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Cancels an unfunded deal before any deposits occur.
     * @param dealId Identifier of the deal to cancel.
     */
    function cancelDeal(uint256 dealId) external {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.buyer && msg.sender != deal.seller) {
            revert Unauthorized(msg.sender, "buyer or seller");
        }
        if (deal.state != DealState.Created) {
            revert InvalidDealState(dealId, deal.state);
        }

        deal.state = DealState.Cancelled;
        deal.settledAt = block.timestamp;

        emit DealCancelled(dealId, msg.sender, block.timestamp);
    }

    /**
     * @notice Seller marks work as submitted and records deliverable proof.
     * @param dealId Identifier of the funded deal.
     * @param submissionUri Deliverable URI, repository link, or proof note.
     */
    function submitWork(uint256 dealId, string calldata submissionUri) external {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.seller) {
            revert Unauthorized(msg.sender, "seller");
        }
        if (deal.state != DealState.Funded) {
            revert InvalidDealState(dealId, deal.state);
        }
        if (block.timestamp > deal.deadline) {
            revert DeadlinePassed();
        }

        deal.state = DealState.Submitted;

        emit WorkSubmitted(dealId, msg.sender, submissionUri, block.timestamp);
    }

    /**
     * @notice Buyer approves deliverables and releases 100% of escrow funds to Seller.
     * @param dealId Identifier of the deal to approve.
     */
    function approveAndRelease(uint256 dealId) external nonReentrant {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.buyer) {
            revert Unauthorized(msg.sender, "buyer");
        }
        if (deal.state != DealState.Funded && deal.state != DealState.Submitted) {
            revert InvalidDealState(dealId, deal.state);
        }

        uint256 payoutAmount = deal.amount;
        address sellerRecipient = deal.seller;

        // Effects
        deal.state = DealState.Settled;
        deal.settledAt = block.timestamp;

        emit DealSettled(dealId, sellerRecipient, payoutAmount, block.timestamp);

        // Interactions
        (bool success, ) = sellerRecipient.call{value: payoutAmount}("");
        if (!success) {
            revert TransferFailed(sellerRecipient, payoutAmount);
        }
    }

    /**
     * @notice Seller voluntarily forfeits the deal and refunds 100% of escrow funds to Buyer.
     * @param dealId Identifier of the deal to refund.
     */
    function refundBuyer(uint256 dealId) external nonReentrant {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.seller) {
            revert Unauthorized(msg.sender, "seller");
        }
        if (deal.state != DealState.Funded && deal.state != DealState.Submitted) {
            revert InvalidDealState(dealId, deal.state);
        }

        uint256 refundAmount = deal.amount;
        address buyerRecipient = deal.buyer;

        // Effects
        deal.state = DealState.Refunded;
        deal.settledAt = block.timestamp;

        emit DealRefunded(dealId, buyerRecipient, refundAmount, block.timestamp);

        // Interactions
        (bool success, ) = buyerRecipient.call{value: refundAmount}("");
        if (!success) {
            revert TransferFailed(buyerRecipient, refundAmount);
        }
    }

    /**
     * @notice Buyer claims 100% refund if deadline has passed without seller submitting work.
     * @param dealId Identifier of the expired funded deal.
     */
    function claimExpiredRefund(uint256 dealId) external nonReentrant {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.buyer) {
            revert Unauthorized(msg.sender, "buyer");
        }
        if (deal.state != DealState.Funded) {
            revert InvalidDealState(dealId, deal.state);
        }
        if (block.timestamp < deal.deadline) {
            revert DeadlineNotPassed();
        }

        uint256 refundAmount = deal.amount;
        address buyerRecipient = deal.buyer;

        // Effects
        deal.state = DealState.Refunded;
        deal.settledAt = block.timestamp;

        emit DealRefunded(dealId, buyerRecipient, refundAmount, block.timestamp);

        // Interactions
        (bool success, ) = buyerRecipient.call{value: refundAmount}("");
        if (!success) {
            revert TransferFailed(buyerRecipient, refundAmount);
        }
    }

    /**
     * @notice Either Buyer or Seller escalates an active escrow to Disputed state.
     * @param dealId Identifier of the deal.
     * @param reason Description of the dispute reason.
     */
    function raiseDispute(uint256 dealId, string calldata reason) external {
        Deal storage deal = _getValidDeal(dealId);

        if (msg.sender != deal.buyer && msg.sender != deal.seller) {
            revert Unauthorized(msg.sender, "buyer or seller");
        }
        if (deal.state != DealState.Funded && deal.state != DealState.Submitted) {
            revert InvalidDealState(dealId, deal.state);
        }

        deal.state = DealState.Disputed;

        emit DisputeRaised(dealId, msg.sender, reason);
    }

    /**
     * @notice Designated Arbiter resolves a dispute by dividing funds between Buyer and Seller.
     * @param dealId Identifier of the disputed deal.
     * @param buyerAmount Amount of native MON wei refunded to Buyer.
     * @param sellerAmount Amount of native MON wei disbursed to Seller.
     */
    function resolveDispute(
        uint256 dealId,
        uint256 buyerAmount,
        uint256 sellerAmount
    ) external nonReentrant {
        Deal storage deal = _getValidDeal(dealId);

        if (deal.state != DealState.Disputed) {
            revert InvalidDealState(dealId, deal.state);
        }
        if (deal.arbiter == address(0) || msg.sender != deal.arbiter) {
            revert Unauthorized(msg.sender, "arbiter");
        }
        if (buyerAmount + sellerAmount != deal.amount) {
            revert InvalidSplit(buyerAmount + sellerAmount, deal.amount);
        }

        address buyerRecipient = deal.buyer;
        address sellerRecipient = deal.seller;

        // Determine final state: if seller receives equal or more, Settled; else Refunded
        DealState finalState = sellerAmount >= buyerAmount ? DealState.Settled : DealState.Refunded;

        // Effects
        deal.state = finalState;
        deal.settledAt = block.timestamp;

        emit DisputeResolved(dealId, msg.sender, buyerAmount, sellerAmount);

        // Interactions
        if (buyerAmount > 0) {
            (bool successB, ) = buyerRecipient.call{value: buyerAmount}("");
            if (!successB) {
                revert TransferFailed(buyerRecipient, buyerAmount);
            }
        }
        if (sellerAmount > 0) {
            (bool successS, ) = sellerRecipient.call{value: sellerAmount}("");
            if (!successS) {
                revert TransferFailed(sellerRecipient, sellerAmount);
            }
        }
    }

    // =========================================================================
    // VIEW / GETTER FUNCTIONS
    // =========================================================================

    /**
     * @notice Returns the full Deal struct for a given dealId.
     * @param dealId Identifier of the deal.
     */
    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _getValidDeal(dealId);
    }

    /**
     * @notice Returns all deal IDs associated with an address.
     * @param user Address of the user (buyer or seller).
     */
    function getUserDeals(address user) external view returns (uint256[] memory) {
        return _userDeals[user];
    }

    /**
     * @notice Returns the count of deals associated with an address.
     * @param user Address of the user.
     */
    function getUserDealCount(address user) external view returns (uint256) {
        return _userDeals[user].length;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    function _createDeal(
        address seller,
        uint256 amount,
        uint256 deadline,
        address arbiter,
        string calldata metadataUri
    ) internal returns (uint256 dealId) {
        if (seller == address(0)) {
            revert ZeroAddress("seller");
        }
        if (msg.sender == seller) {
            revert BuyerCannotBeSeller();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (deadline <= block.timestamp) {
            revert InvalidDeadline(deadline, block.timestamp);
        }
        if (arbiter != address(0)) {
            if (arbiter == msg.sender || arbiter == seller) {
                revert InvalidArbiter();
            }
        }

        dealId = nextDealId++;

        Deal storage deal = deals[dealId];
        deal.dealId = dealId;
        deal.buyer = msg.sender;
        deal.seller = seller;
        deal.arbiter = arbiter;
        deal.amount = amount;
        deal.deadline = deadline;
        deal.state = DealState.Created;
        deal.createdAt = block.timestamp;
        deal.metadataUri = metadataUri;

        _userDeals[msg.sender].push(dealId);
        _userDeals[seller].push(dealId);

        emit DealCreated(
            dealId,
            msg.sender,
            seller,
            amount,
            deadline,
            arbiter,
            metadataUri
        );
    }

    function _getValidDeal(uint256 dealId) internal view returns (Deal storage deal) {
        deal = deals[dealId];
        if (deal.state == DealState.None) {
            revert DealDoesNotExist(dealId);
        }
    }

    // =========================================================================
    // SAFETY FALLBACKS
    // =========================================================================

    /// @dev Prevents accidental native MON deposits outside of fundDeal / createAndFundDeal.
    receive() external payable {
        revert DirectDepositNotAllowed();
    }

    /// @dev Reverts any calls to undefined function signatures.
    fallback() external payable {
        revert DirectDepositNotAllowed();
    }
}
