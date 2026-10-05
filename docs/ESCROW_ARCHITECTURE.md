# SettleX Smart Contract Architecture Specification

## Document Information
- **Project**: SettleX — Trustless Onchain Escrow
- **Target Network**: Monad Testnet (`Chain ID: 10143`)
- **Version**: 1.0.0 (MVP Design Phase)
- **Status**: Approved Design — Pre-Implementation

---

## 1. Deal Lifecycle & State Machine

SettleX implements an explicit, deterministic state machine. Every deal moves through strictly enforced states with no ambiguous or unhandled transitions.

```
       +-----------------------------------------------------------+
       |                                                           |
       v                                                           |
  [ Created ] -------------( cancel by either )----------------> [ Cancelled ] (Terminal)
       |
       | (fund by Buyer)
       v
   [ Funded ] <---------------+
     |     |                  |
     |     | (submit work)    |
     |     v                  | (resolve dispute: mutual continue)
     |  [ Submitted ]         |
     |     |       |          |
     |     |       +----+     |
     |     |            |     |
     |     | (raise)    |     |
     |     v            v     |
     +--> [ Disputed ] -------+
             |
             | (resolve dispute: split or full)
             +--------------------+
             |                    |
             v                    v
        [ Settled ]          [ Refunded ]
        (Terminal)           (Terminal)

Direct Settlements:
- [Funded] or [Submitted] --(Buyer approves)-------------> [Settled]  (Terminal)
- [Funded] or [Submitted] --(Seller voluntary refund)-----> [Refunded] (Terminal)
- [Funded] + Deadline Passed --(Buyer claims expiry)------> [Refunded] (Terminal)
```

### State Enumeration
```solidity
enum DealState {
    None,        // 0: Deal does not exist
    Created,     // 1: Terms initialized, awaiting buyer funding
    Funded,      // 2: Escrow funded; funds locked securely in contract
    Submitted,   // 3: Seller delivered work/milestone; awaiting buyer review
    Disputed,    // 4: Conflict raised; escrow paused pending dispute resolution
    Settled,     // 5: Terminal: funds disbursed to Seller (or dispute payout)
    Refunded,    // 6: Terminal: funds returned to Buyer (or dispute refund)
    Cancelled    // 7: Terminal: deal aborted before any funds were locked
}
```

---

## 2. Deal Data Structure

The storage layout is optimized for EVM storage slot packing and deterministic access:

```solidity
struct Deal {
    uint256 dealId;           // Unique incrementing identifier
    address buyer;            // Client / depositor
    address seller;           // Freelancer / service provider
    address token;            // address(0) for native MON, or ERC20 contract address
    address arbiter;          // Optional designated arbiter; address(0) for mutual resolution
    uint256 amount;           // Total escrow amount (in wei or token base units)
    uint256 deadline;         // Unix timestamp when deal expires if not submitted
    DealState state;          // Current state enum
    uint256 createdAt;        // Timestamp when deal record was initialized
    uint256 fundedAt;         // Timestamp when funds were successfully locked
    uint256 settledAt;        // Timestamp when settlement, refund, or cancellation completed
    string metadataUri;       // IPFS hash, URI, or title describing deal scope & terms
}
```

### Storage Mapping
- `mapping(uint256 => Deal) public deals;`
- `uint256 public nextDealId = 1;`
- `mapping(address => uint256[]) public userDeals;` (Maintains indexed history for Buyer/Seller to power frontend queries).

---

## 3. Buyer Permissions

The Buyer (client/depositor) is restricted to the following authorized actions:
1. **Initiate Deal** (`createDeal` / `createAndFundDeal`): Specify seller, amount, token, deadline, arbiter, and terms.
2. **Fund Deal** (`fundDeal`): Lock native MON or ERC20 into a `Created` deal before the deadline.
3. **Approve & Release** (`approveAndRelease`): Voluntarily release 100% of the locked funds to the Seller when in `Funded` or `Submitted` state.
4. **Claim Expired Refund** (`claimExpiredRefund`): Reclaim 100% of funds if `state == Funded` and `block.timestamp >= deadline` (seller failed to deliver).
5. **Raise Dispute** (`raiseDispute`): Escalate to `Disputed` state if work is unsatisfactory or unresponsive.
6. **Cancel Unfunded Deal** (`cancelDeal`): Abort a `Created` deal before any money has been deposited.

---

## 4. Seller Permissions

The Seller (freelancer/counterparty) is restricted to the following authorized actions:
1. **Initiate Deal Proposal** (`createDeal`): Propose deal terms to a designated buyer address.
2. **Submit Deliverable** (`submitWork`): Signal deliverable completion and record proof/note, transitioning `Funded -> Submitted`.
3. **Voluntary Refund** (`refundBuyer`): Voluntarily forfeit escrow and return 100% of funds to the Buyer (e.g., if unable to finish).
4. **Raise Dispute** (`raiseDispute`): Escalate to `Disputed` state if the buyer refuses to approve valid completed work.
5. **Cancel Unfunded Deal** (`cancelDeal`): Abort an unfunded `Created` proposal before buyer deposit.

---

## 5. Funding Rules

1. **Denomination**:
   - **Native MON**: Identified when `deal.token == address(0)`. Caller must provide `msg.value == deal.amount`. Excess or deficit `msg.value` reverts immediately.
   - **ERC20 Tokens**: Identified when `deal.token != address(0)`. `msg.value` MUST be `0`. Uses `SafeERC20.safeTransferFrom(buyer, address(this), amount)`.
2. **Deadline Check**: `block.timestamp < deal.deadline`. Deals cannot be funded after their expiration.
3. **Purity Check**: A deal can only be funded if its current state is `Created`. A deal cannot be funded twice.
4. **Convenience Atomic Function**: `createAndFundDeal(...)` executes creation and funding in a single transaction, reducing gas and friction for buyers.

---

## 6. Release Rules

1. **Authorization**: Only `deal.buyer` can invoke standard release (`approveAndRelease`).
2. **State Guard**: Allowed only when `state == DealState.Funded` or `state == DealState.Submitted`.
3. **Checks-Effects-Interactions (CEI)**:
   - State updated to `DealState.Settled` **first**.
   - `settledAt` timestamp recorded.
   - Event `DealSettled(dealId, seller, amount)` emitted.
   - Fund transfer executed:
     - If Native MON: low-level call `(bool success, ) = seller.call{value: amount}("")`.
     - If ERC20: `IERC20(token).safeTransfer(seller, amount)`.
4. **Finality**: `Settled` is an irreversible terminal state.

---

## 7. Refund Rules

Refunds return funds back to the `buyer`. SettleX provides three distinct, secure refund paths:

1. **Seller Voluntary Refund (`refundBuyer`)**:
   - Authorized caller: `deal.seller` only.
   - Allowed states: `Funded` or `Submitted`.
   - Effect: State transitions to `Refunded`; 100% of funds transferred to `buyer`.
2. **Buyer Timeout / Expiry Refund (`claimExpiredRefund`)**:
   - Authorized caller: `deal.buyer` only.
   - State guard: `state == DealState.Funded` only (if `Submitted`, seller completed before deadline, requiring review or dispute).
   - Time guard: `block.timestamp >= deal.deadline`.
   - Effect: State transitions to `Refunded`; 100% of funds transferred to `buyer`.
3. **Dispute Resolution Refund / Split**:
   - Governed under the Dispute Resolution rules (Section 9).

---

## 8. Deadline & Expiry Behavior

- **Setting the Deadline**:
  - Validated at creation: `deadline > block.timestamp`.
  - Recommended minimum: `1 hours` into the future.
- **Unfunded Deals Past Deadline**:
  - Cannot be funded. Calling `fundDeal` reverts with `DeadlinePassed()`.
  - Can be formally marked `Cancelled` by either party via `cancelDeal`.
- **Funded Deals Reaching Deadline**:
  - If Seller **never submitted** (`state == Funded`): Buyer holds the unilateral right to withdraw 100% via `claimExpiredRefund()`.
  - If Seller **submitted work on time** (`state == Submitted`): The deal does **not** auto-refund, because the seller fulfilled the submission obligation before/at the deadline. The buyer must either approve or raise a dispute.

---

## 9. Dispute Mechanism Suitable for an MVP

To keep the MVP trustless, simple, and free from oracle or AI dependencies, SettleX employs a dual-mode dispute design:

### A. Designated Arbiter (Default if specified)
- When creating a deal, parties may mutually specify an `arbiter` address (e.g., trusted community member, multi-sig, or escrow admin).
- Either Buyer or Seller can invoke `raiseDispute(dealId, string reason)`.
- While in `Disputed` state:
  - Normal release and expiry refunds are frozen.
  - The designated `arbiter` can call `resolveDispute(dealId, buyerAmount, sellerAmount)`.
  - Constraint: `buyerAmount + sellerAmount == deal.amount`.
  - Funds are transferred atomically to buyer and seller according to the split.
  - If `sellerAmount > 0 && buyerAmount == 0`, final state is `Settled`. Otherwise, state is `Refunded` (or custom event logs full split breakdown).

### B. Mutual Direct Settlement (If Arbiter is `address(0)`)
- If no arbiter is chosen (`deal.arbiter == address(0)`), neither party can unilaterally drain funds.
- Either party can still break a deadlock:
  - Buyer can approve full release to seller at any time (`approveAndRelease`).
  - Seller can concede full refund to buyer at any time (`refundBuyer`).
  - Both parties can execute an agreed split via mutual signature or co-approval function (`resolveMutualDispute(dealId, buyerAmount, sellerAmount)`).

---

## 10. Authorization Matrix (State Transitions)

| Transition | From State | To State | Authorized Caller | Key Conditions |
|---|---|---|---|---|
| `createDeal` | `None` | `Created` | Any (`buyer` or `seller`) | `amount > 0`, `deadline > now`, `buyer != seller` |
| `createAndFundDeal` | `None` | `Funded` | `buyer` | Same as creation + valid payment attached |
| `cancelDeal` | `Created` | `Cancelled` | `buyer` or `seller` | Deal unfunded |
| `fundDeal` | `Created` | `Funded` | `buyer` | `now < deadline`, valid payment attached |
| `submitWork` | `Funded` | `Submitted` | `seller` | `now <= deadline` |
| `approveAndRelease` | `Funded` or `Submitted` | `Settled` | `buyer` | Full release to seller |
| `refundBuyer` | `Funded` or `Submitted` | `Refunded` | `seller` | Full refund to buyer |
| `claimExpiredRefund` | `Funded` | `Refunded` | `buyer` | `now >= deadline` |
| `raiseDispute` | `Funded` or `Submitted` | `Disputed` | `buyer` or `seller` | Valid active escrow |
| `resolveDispute` | `Disputed` | `Settled`/`Refunded` | `deal.arbiter` | `buyerSplit + sellerSplit == amount` |

---

## 11. Protection Against Double Release & Double Refund

1. **State Invariants**:
   - `Settled`, `Refunded`, and `Cancelled` are **terminal states**.
   - Every withdrawal function enforces:
     ```solidity
     if (deal.state != DealState.Funded && deal.state != DealState.Submitted) {
         revert InvalidDealState(dealId, deal.state);
     }
     ```
2. **Checks-Effects-Interactions (CEI)**:
   - Contract storage state is updated **prior** to external ether/ERC20 calls.
   - The deal amount is effectively zeroed out or marked terminal before any transfer.
3. **Explicit Zero Balance Post-Condition**:
   - Once a terminal state is reached, the deal record permanently blocks any second execution.

---

## 12. Reentrancy Protection Strategy

1. **Inherit OpenZeppelin `ReentrancyGuard`**:
   - All state-changing external transfer functions apply the `nonReentrant` modifier:
     - `fundDeal`
     - `createAndFundDeal`
     - `approveAndRelease`
     - `refundBuyer`
     - `claimExpiredRefund`
     - `resolveDispute`
2. **Strict CEI Compliance**:
   - Even in native MON low-level calls, state changes are written before `.call{value: ...}("")`.
3. **No External Callbacks in State Updates**:
   - No untrusted token hooks (`ERC777`, `ERC1363`) can alter escrow state mid-execution.

---

## 13. ERC20 Token Handling Strategy

1. **OpenZeppelin `SafeERC20`**:
   - Wraps standard `IERC20` calls (`safeTransfer`, `safeTransferFrom`) to handle non-standard return tokens (such as USDT that do not return a boolean).
2. **Fee-on-Transfer / Rebasing Token Protection**:
   - Escrow records the **actual balance increase**:
     ```solidity
     uint256 balanceBefore = IERC20(token).balanceOf(address(this));
     IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
     uint256 actualReceived = IERC20(token).balanceOf(address(this)) - balanceBefore;
     if (actualReceived < amount) revert FeeOnTransferNotSupported();
     ```
   - Prevents accounting insolvency if a deflationary token is used.
3. **Native vs. ERC20 Isolation**:
   - If `token == address(0)`: strict check `msg.value == amount`.
   - If `token != address(0)`: strict check `msg.value == 0`. Prevents accidental locking of native MON when paying via ERC20.

---

## 14. Zero-Address and Zero-Amount Validations

Every input is strictly checked upon initialization:
- `if (buyer == address(0)) revert ZeroAddress("buyer");`
- `if (seller == address(0)) revert ZeroAddress("seller");`
- `if (buyer == seller) revert BuyerCannotBeSeller();`
- `if (amount == 0) revert ZeroAmount();`
- `if (deadline <= block.timestamp) revert InvalidDeadline(deadline, block.timestamp);`
- If `arbiter != address(0)`:
  - `if (arbiter == buyer || arbiter == seller) revert InvalidArbiter();`

---

## 15. Invalid State Transition Protection

All state transitions use strict guards with descriptive custom errors:
- Attempting to fund an already funded or settled deal &rarr; `revert InvalidDealState(dealId, currentState)`
- Attempting to release a non-funded deal &rarr; `revert InvalidDealState(dealId, currentState)`
- Attempting to dispute an already settled deal &rarr; `revert InvalidDealState(dealId, currentState)`
- Caller not matching authorized role &rarr; `revert Unauthorized(msg.sender, expectedRole)`

---

## 16. Events for Frontend Real-Time Monitoring

The frontend relies on clean indexed events to track user deals and UI updates:

```solidity
event DealCreated(
    uint256 indexed dealId,
    address indexed buyer,
    address indexed seller,
    address token,
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
```

---

## 17. Custom Errors Specification

Custom errors optimize contract bytecode size and save gas compared to string reverts:

```solidity
error ZeroAddress(string parameterName);
error ZeroAmount();
error BuyerCannotBeSeller();
error InvalidArbiter();
error InvalidDeadline(uint256 provided, uint256 current);
error DealDoesNotExist(uint256 dealId);
error InvalidDealState(uint256 dealId, DealState currentState);
error Unauthorized(address caller, string expectedRole);
error IncorrectPayment(uint256 expected, uint256 actual);
error ERC20PaymentValueMustBeZero();
error DeadlinePassed();
error DeadlineNotPassed();
error InvalidSplit(uint256 totalGiven, uint256 requiredAmount);
error TransferFailed(address recipient, uint256 amount);
error FeeOnTransferNotSupported();
```

---

## 18. Security Considerations

1. **No External Owner/Admin Backdoor**:
   - The contract does NOT include an owner `drain()` or `emergencyWithdraw()` function that could allow arbitrary rug-pulls. Funds can only leave via the coded escrow paths.
2. **Safe Native Ether/MON Transfers**:
   - Uses `call{value: amount}("")` instead of deprecated `transfer()` or `send()` to prevent out-of-gas errors with smart contract wallets (e.g., account abstraction or multisigs on Monad).
   - Return value checked via custom error `TransferFailed`.
3. **Front-Running / Griefing Mitigation**:
   - Deal creation assigns an incremental `dealId` inside contract storage.
   - Callers cannot front-run or take over another party's `dealId`.
4. **Denial-of-Service (DoS) Resistance**:
   - Avoids unbounded loops. User queries index deals per address via lightweight ID arrays (`userDeals[user]`).
5. **No Dependence on Timestamps Beyond Coarse Expiry**:
   - Deadlines rely on `block.timestamp` strictly for hour/day expiration, immune to minor block timestamp drift.

---

## 19. Comprehensive Pre-Deployment Test Plan

Foundry tests must achieve >95% coverage across these test categories:

### A. Happy Paths
- `test_CreateDeal_Native`: Buyer creates deal with native MON.
- `test_CreateDeal_ERC20`: Buyer creates deal with standard ERC20 token.
- `test_CreateAndFundDeal_Native`: Single-transaction create and fund.
- `test_SubmitWork`: Seller marks work submitted.
- `test_ApproveAndRelease_Native`: Buyer approves; seller receives exact MON.
- `test_ApproveAndRelease_ERC20`: Buyer approves; seller receives exact ERC20 tokens.

### B. Safe Handling of Alternative Scenarios
- `test_SellerVoluntaryRefund`: Seller initiates full refund to buyer.
- `test_ExpiredDeal_BuyerRefund`: Buyer claims refund after deadline has passed.
- `test_ExpiredDeal_CannotRefundBeforeDeadline`: Reverts if buyer attempts expired refund early.
- `test_Dispute_ArbiterResolves_Split`: Arbiter splits 60/40 between parties.
- `test_CancelUnfundedDeal`: Buyer or seller can cancel before funding.

### C. Security & Attack Vectors
- `test_CannotDoubleRelease`: Second release reverts with `InvalidDealState`.
- `test_CannotDoubleRefund`: Second refund reverts with `InvalidDealState`.
- `test_Reentrancy_ApproveAndRelease`: Malicious seller fallback attempting reentrancy is blocked by CEI and `nonReentrant`.
- `test_Unauthorized_Release`: Non-buyer cannot release funds.
- `test_Unauthorized_Refund`: Non-seller cannot trigger voluntary refund.
- `test_Unauthorized_DisputeResolution`: Non-arbiter cannot resolve dispute.
- `test_ZeroAddressValidation`: Reverts if buyer, seller, or address is zero.
- `test_ZeroAmountValidation`: Reverts if amount is zero.
- `test_IncorrectMsgValue`: Reverts if native deposit != deal amount.

---

## 20. Future Extensibility (Milestones Roadmap)

Without overengineering the MVP, the contract architecture is designed so milestone escrows can be added naturally:

1. **Storage Decoupling**:
   - The base `Deal` struct tracks overall counterparty relationships, tokens, and arbiters.
   - In a milestone version, `Deal` can reference a `Milestone[]` array:
     ```solidity
     struct Milestone {
         uint256 amount;
         DealState state;
         string description;
     }
     ```
2. **Partial Release Pattern**:
   - `approveAndReleaseMilestone(uint256 dealId, uint256 milestoneIndex)` releases only the milestone amount and updates total disbursed balance without altering overall deal state until all milestones are settled.
3. **Backwards Compatibility**:
   - The MVP operates as a single-milestone escrow (100% allocation), ensuring zero redundant overhead while providing a direct migration path.
