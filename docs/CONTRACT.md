# SettleX Smart Contract Documentation

## 1. Contract Purpose

`SettleXEscrow` (`contracts/src/SettleXEscrow.sol`) is a trustless onchain escrow smart contract designed for freelancer/client transactions, milestone service engagements, and peer-to-peer (P2P) agreements on **Monad Testnet**.

The contract eliminates counterparty risk by holding native MON funds securely in escrow. Funds are locked at deal creation/funding and can only be disbursed, refunded, or divided through strictly validated state machine transitions, role authorizations, and pre-agreed conditions. The contract contains no owner drain functions, backdoors, or centralized custodians.

---

## 2. State Machine

The contract enforces an explicit, deterministic 8-state lifecycle:

```
                          [ Created ]
                         /           \
           (cancelDeal) /             \ (fundDeal / createAndFundDeal)
                       v               v
                [ Cancelled ]      [ Funded ] <------------------------+
                  (Terminal)       /        \                          |
                                  /          \ (submitWork)            |
                                 /            v                        |
                                /        [ Submitted ]                 |
            (approveAndRelease)/          /      \                     |
                              v          v        v (raiseDispute)     |
                         [ Settled ]    /     [ Disputed ]             |
                          (Terminal)   /           |                   |
                                      /            | (resolveDispute)  |
                  (refundBuyer /     /             +---------+---------+
               claimExpiredRefund)  /                        |
                                   v                         v
                              [ Refunded ]              [ Settled ] / [ Refunded ]
                               (Terminal)                      (Terminal)
```

### State Definitions

| State | Enum Value | Description |
|---|---|---|
| `None` | `0` | Uninitialized / nonexistent deal. |
| `Created` | `1` | Terms defined by Buyer; awaiting native MON deposit. |
| `Funded` | `2` | Escrow funded by Buyer with exact native MON; funds safely locked. |
| `Submitted` | `3` | Seller delivered work and submitted deliverable URI/note. |
| `Disputed` | `4` | Disagreement raised by Buyer or Seller; operations paused pending resolution. |
| `Settled` | `5` | Terminal: 100% of escrow disbursed to Seller (or majority via dispute resolution). |
| `Refunded` | `6` | Terminal: 100% of escrow refunded to Buyer (or majority via dispute resolution). |
| `Cancelled` | `7` | Terminal: Deal aborted before any deposit occurred (by Buyer or Seller). |

---

## 3. Functions Specification

### Core State Transitions

1. **`createDeal`**
   - **Signature**: `createDeal(address seller, uint256 amount, uint256 deadline, address arbiter, string calldata metadataUri) external returns (uint256 dealId)`
   - **Role**: `buyer = msg.sender`
   - **Preconditions**:
     - `seller != address(0)`
     - `seller != msg.sender`
     - `amount > 0`
     - `deadline > block.timestamp`
     - If `arbiter != address(0)`: `arbiter != msg.sender` and `arbiter != seller`
   - **Effects**: Assigns `nextDealId++`, registers deal in `deals`, indexes into `userDeals`, emits `DealCreated`.

2. **`createAndFundDeal`**
   - **Signature**: `createAndFundDeal(address seller, uint256 amount, uint256 deadline, address arbiter, string calldata metadataUri) external payable returns (uint256 dealId)`
   - **Role**: `buyer = msg.sender`
   - **Preconditions**: Same as `createDeal`, plus `msg.value == amount`.
   - **Effects**: Atomically creates and funds deal to `Funded` state. Emits `DealCreated` and `DealFunded`.

3. **`fundDeal`**
   - **Signature**: `fundDeal(uint256 dealId) external payable`
   - **Role**: `deal.buyer` only
   - **Preconditions**: `deal.state == Created`, `block.timestamp < deal.deadline`, `msg.value == deal.amount`.
   - **Effects**: Transitions state to `Funded`, records `fundedAt = block.timestamp`, emits `DealFunded`.

4. **`cancelDeal`**
   - **Signature**: `cancelDeal(uint256 dealId) external`
   - **Role**: `deal.buyer` or `deal.seller`
   - **Preconditions**: `deal.state == Created`.
   - **Effects**: Transitions state to `Cancelled`, records `settledAt`, emits `DealCancelled`.

5. **`submitWork`**
   - **Signature**: `submitWork(uint256 dealId, string calldata submissionUri) external`
   - **Role**: `deal.seller` only
   - **Preconditions**: `deal.state == Funded`, `block.timestamp <= deal.deadline`.
   - **Effects**: Transitions state to `Submitted`, emits `WorkSubmitted`.

6. **`approveAndRelease`**
   - **Signature**: `approveAndRelease(uint256 dealId) external`
   - **Role**: `deal.buyer` only
   - **Preconditions**: `deal.state == Funded || deal.state == Submitted`.
   - **Effects**: Sets state to `Settled`, records `settledAt`, emits `DealSettled`, transfers 100% of `deal.amount` to `seller` via safe low-level call.

7. **`refundBuyer`**
   - **Signature**: `refundBuyer(uint256 dealId) external`
   - **Role**: `deal.seller` only (voluntary concession)
   - **Preconditions**: `deal.state == Funded || deal.state == Submitted`.
   - **Effects**: Sets state to `Refunded`, records `settledAt`, emits `DealRefunded`, transfers 100% of `deal.amount` to `buyer` via safe low-level call.

8. **`claimExpiredRefund`**
   - **Signature**: `claimExpiredRefund(uint256 dealId) external`
   - **Role**: `deal.buyer` only
   - **Preconditions**: `deal.state == Funded`, `block.timestamp >= deal.deadline`.
   - **Effects**: Sets state to `Refunded`, records `settledAt`, emits `DealRefunded`, transfers 100% of `deal.amount` to `buyer` via safe low-level call.

9. **`raiseDispute`**
   - **Signature**: `raiseDispute(uint256 dealId, string calldata reason) external`
   - **Role**: `deal.buyer` or `deal.seller`
   - **Preconditions**: `deal.state == Funded || deal.state == Submitted`.
   - **Effects**: Sets state to `Disputed`, emits `DisputeRaised`.

10. **`resolveDispute`**
    - **Signature**: `resolveDispute(uint256 dealId, uint256 buyerAmount, uint256 sellerAmount) external`
    - **Role**: `deal.arbiter` only (`arbiter != address(0)`)
    - **Preconditions**: `deal.state == Disputed`, `buyerAmount + sellerAmount == deal.amount`.
    - **Effects**: Sets state to `Settled` (if `sellerAmount >= buyerAmount`) or `Refunded`, records `settledAt`, emits `DisputeResolved`, transfers split amounts to buyer and seller atomically.

### View Functions

- `getDeal(uint256 dealId) external view returns (Deal memory)`: Returns deal data.
- `getUserDeals(address user) external view returns (uint256[] memory)`: Returns all deal IDs for user.
- `getUserDealCount(address user) external view returns (uint256)`: Returns total count of user deals.

---

## 4. Events Specification

All major state actions emit indexed events for real-time frontend and subgraph tracking:

```solidity
event DealCreated(uint256 indexed dealId, address indexed buyer, address indexed seller, uint256 amount, uint256 deadline, address arbiter, string metadataUri);
event DealFunded(uint256 indexed dealId, address indexed buyer, uint256 amount, uint256 fundedAt);
event WorkSubmitted(uint256 indexed dealId, address indexed seller, string submissionUri, uint256 submittedAt);
event DealSettled(uint256 indexed dealId, address indexed seller, uint256 amount, uint256 settledAt);
event DealRefunded(uint256 indexed dealId, address indexed buyer, uint256 amount, uint256 refundedAt);
event DealCancelled(uint256 indexed dealId, address indexed cancelledBy, uint256 cancelledAt);
event DisputeRaised(uint256 indexed dealId, address indexed raisedBy, string reason);
event DisputeResolved(uint256 indexed dealId, address indexed arbiter, uint256 buyerAmount, uint256 sellerAmount);
```

---

## 5. Security Model

1. **Checks-Effects-Interactions (CEI)**:
   In all transfer operations (`approveAndRelease`, `refundBuyer`, `claimExpiredRefund`, `resolveDispute`), deal state is set to terminal (`Settled` or `Refunded`) and timestamps are recorded **before** any external low-level transfer (`.call{value: ...}("")`).
2. **Reentrancy Protection**:
   All state-modifying external transfer functions apply OpenZeppelin's `nonReentrant` modifier from `ReentrancyGuard`.
3. **No Emergency Backdoor / Drain Function**:
   There is no contract owner, admin drain, or emergency pause backdoor. Escrow funds can only be released to the buyer and seller according to the deterministic state machine rules.
4. **Accidental Trapping Prevention**:
   Direct transfers of native MON to the contract address without calling `fundDeal` or `createAndFundDeal` are explicitly rejected by `receive()` and `fallback()` functions reverting with `DirectDepositNotAllowed()`.
5. **Double-Spend & Double-Action Prevention**:
   All terminal states (`Settled`, `Refunded`, `Cancelled`) permanently prohibit further state transitions or withdrawals. Attempting any second release or refund reverts with `InvalidDealState`.
6. **Robust Safe Low-Level Calls**:
   Transfers use `.call{value: amount}("")` checking boolean success to support smart contract wallets (multisigs, ERC-4337 account abstraction) on Monad without gas-stipend limits.

---

## 6. Test Coverage

Comprehensive Foundry tests are implemented under `contracts/test/SettleXEscrow.t.sol`.

| Metric | Result |
|---|---|
| **Total Tests** | 42 |
| **Passed** | 42 |
| **Failed** | 0 |
| **Function Coverage** | 100.00% (17/17) |
| **Statement Coverage** | 95.88% (163/170) |
| **Line Coverage** | 95.51% (149/156) |
| **Branch Coverage** | 81.58% (31/38) |

### Test Suites Covered
- **Happy Path**: Full lifecycle (create, fund, submit work, approve, direct release, atomic create-and-fund).
- **Refunds**: Seller voluntary refund from Funded and Submitted states, Buyer expired refund after deadline, and rejection before deadline.
- **Cancellations**: Cancellation of unfunded deals by Buyer and Seller, and rejection of cancellation once funded.
- **Disputes**: Raise dispute by Buyer or Seller, unauthorized resolution failure, valid split resolution, 100% full buyer/seller resolutions, invalid split sum rejection, and non-disputed resolution rejection.
- **Security & Validations**: Zero address, zero amount, buyer-is-seller, invalid deadline, invalid arbiter, incorrect payment amounts, deadline expiration during funding/submission, double-release, double-refund, reentrancy attacks, direct deposits, and fallback rejection.

---

## 7. Known MVP Limitations

1. **Single Payment Asset**:
   MVP supports native MON only (`msg.value`). Multi-asset support (ERC20 tokens like USDT/USDC) is deferred to future protocol iterations to maintain simplicity and eliminate token compatibility edge cases (rebasing, fee-on-transfer).
2. **Single Deliverable / No Partial Milestones**:
   The MVP operates as a single lump-sum escrow. Multi-milestone partial release flows will be implemented in subsequent roadmap phases.
3. **Designated Arbiter Requirement for Disputes**:
   In this MVP, dispute resolution requires an explicit designated arbiter assigned at deal creation. If no arbiter is assigned (`arbiter == address(0)`), neither party can unilaterally resolve the dispute; funds remain safely locked until a future mutual mechanism or mediation is added.
4. **No Automated Expiry Forfeiture for Submitted Work**:
   If a seller submits work and the buyer becomes unresponsive, the seller must raise a dispute to seek resolution through the arbiter. There is no automated timeout auto-approval in the MVP.
