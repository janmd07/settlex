# SettleX V2: Permissionless Onchain Work Bounty Protocol

> **"Work first. Payment guaranteed by code."**  
> Autonomous work bounties with immutable acceptance criteria, enforced submission caps, and 80/20 guaranteed reward splits on Monad Testnet.

---

## 1. What is SettleX V2?

SettleX V2 is a **permissionless onchain work bounty protocol** tailored for high-throughput EVM networks like **Monad**.

Unlike traditional bilateral escrows, SettleX V2 operates on a multi-contributor bounty paradigm:
- **Creator** locks native MON upfront, defines a task with **Immutable Acceptance Criteria**, specifies a hard submission capacity (**1–10 submissions**), and sets a submission deadline.
- **Contributors** discover tasks and permissionlessly submit deliverable proofs without upfront deposits, staking, or gatekeepers.
- When capacity is reached or the deadline elapses, submissions close and enter a strict **24-Hour Creator Review Period**.
- The Creator reviews submissions against the immutable criteria and selects **one Winner**.
- The protocol guarantees deterministic payout:
  - **80%** directly to the **Winner** (plus integer division dust).
  - **20%** distributed equally as **Participation Rewards** to all other valid non-winning Contributors.
- If only 1 submission exists, the Winner receives 80% and the unused 20% participation pool is refunded to the Creator.
- If the Creator misses the 24-hour review window, the bounty escalates to **Dispute Review** for resolution by an optional designated Arbiter.

---

## 2. Protocol Roles & Primitives

| Role / Term | Description |
| :--- | :--- |
| **Creator** | Sponsors the task and locks 100% of the native MON reward into the contract. |
| **Contributor** | Delivers work permissionlessly by providing deliverable proof before closure. |
| **Bounty** | The smart contract work unit containing criteria, limits, reward, and timestamps. |
| **Submission** | A Contributor's proof URI and notes registered onchain (at most 1 submission per Contributor). |
| **Winner** | The single Contributor selected to receive 80% of the reward. |
| **Participation Reward** | The 20% reward pool divided equally among all valid non-winning Contributors. |
| **Acceptance Criteria** | Immutable requirements set at creation time. Neither Creator nor Resolver can alter them. |
| **Review Period** | Strict 24-hour window from submission closure for the Creator to pick a Winner. |
| **Dispute Review** | Fallback state reached if the Creator misses the 24-hour review window. |
| **Dispute Resolver** | Designated authority (arbiter or future Decentralized Jury module) authorized to select a Winner during Dispute Review. |

---

## 3. Core Rules & Onchain Enforcement

1. **Submission Capacity (1–10)**:
   - Enforced directly in Solidity bytecode: `require(maxSubmissions >= 1 && maxSubmissions <= 10)`.
   - The $(N+1)$-th submission reverts.
2. **One Submission Per Contributor Address**:
   - Duplicate submissions from the same address revert with `AlreadySubmitted`.
3. **Creator Exclusion**:
   - The Creator wallet cannot submit work to their own bounty (`CreatorCannotSubmit`).
4. **No "Reject All"**:
   - Creators cannot cancel or refund bounties once valid submissions exist. The Creator action is strictly `selectWinner`.
5. **Exact Dust Accounting**:
   - Integer division remainder (`dust`) from the 20% pool is allocated to the Winner, guaranteeing zero wei remains stranded in the contract.
6. **Pull-Claim Fallback**:
   - If a recipient contract reverts on direct transfer, funds are safely credited to `claimableRewards` with a pull `claimReward()` mechanism, preventing griefing attacks from bricking bounty settlement.
7. **Future-Jury Ready Dispute Layer**:
   - Dispute resolution authority is completely isolated from the bounty contract. SettleX V2 uses a constrained dispute resolver, architected so a future Decentralized Jury (3/5/7 jurors, majority vote) can plug in without changing core escrow settlement logic.

---

## 4. Smart Contract Architecture

- **Bounty Contract**: [`contracts/src/SettleXBounty.sol`](contracts/src/SettleXBounty.sol)
- **Dispute Interfaces**: [`contracts/src/interfaces/IDisputeResolver.sol`](contracts/src/interfaces/IDisputeResolver.sol) & [`contracts/src/interfaces/ISettleXBounty.sol`](contracts/src/interfaces/ISettleXBounty.sol)
- **Deployment Script**: [`contracts/script/DeploySettleXBounty.s.sol`](contracts/script/DeploySettleXBounty.s.sol)
- **Foundry Test Suite**: [`contracts/test/SettleXBounty.t.sol`](contracts/test/SettleXBounty.t.sol)
  - **42 / 42 passing tests** covering:
    - 1–10 capacity enforcement (boundaries 0 and 11 rejected)
    - Zero reward and invalid deadline rejections
    - Single contributor submission and duplicate prevention
    - Creator submission prevention
    - 80/20 reward splits for 1, 2, 4, and 10 contributors
    - Integer division dust accounting
    - Reentrancy attack protection
    - Malicious reverting receiver pull-fallback
    - 24-hour timeout dispute escalation & resolver validation
    - Multi-juror Decentralized Jury contract majority-vote resolution
    - Zero-submission deadline refund
- **Documentation**: [`docs/BOUNTY_ARCHITECTURE.md`](docs/BOUNTY_ARCHITECTURE.md)

---

## 5. Deployment Guide (Monad Testnet)

### Prerequisites
- Foundry (`forge`, `cast`)
- Monad Testnet RPC: `https://testnet-rpc.monad.xyz`
- Chain ID: `10143`

### Deploy SettleXBounty Contract
```bash
cd contracts
source .env
forge script script/DeploySettleXBounty.s.sol:DeploySettleXBounty \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --verify
```

### Update Frontend Environment
Add the deployed address to `frontend/.env.local`:
```env
NEXT_PUBLIC_SETTLEX_BOUNTY_ADDRESS="<DEPLOYED_BOUNTY_CONTRACT_ADDRESS>"
NEXT_PUBLIC_MONAD_RPC_URL="https://testnet-rpc.monad.xyz"
NEXT_PUBLIC_CHAIN_ID=10143
```

---

## 6. Frontend Application

The Next.js web application (`frontend/`) provides an interactive interface for SettleX V2:
- **Explore & Review Bounties**: Inspect active bounties, check remaining submission slots (`X / Y`), view live countdowns, and read immutable acceptance criteria.
- **Create Bounty**: Define task title, specifications, immutable acceptance criteria, reward in MON, max submissions (1–10), and deadline, with live 80/20 preview calculations.
- **Submit Work Modal**: Contributor delivers proof of work and notes against the onchain criteria.
- **Creator Review Console**: 24-hour review window timer and "Select Winner" controls (with strictly no "Reject All" button).
- **Dispute Review Console**: Escalation triggers and Dispute Resolver interface.
- **Pull Claim Banner**: Withdraw pending participation rewards safely if a previous push failed.

---

## 7. Historical Reference: SettleX V1 Escrow

The original bilateral escrow implementation is preserved for historical auditability:
- **Contract**: [`contracts/src/SettleXEscrow.sol`](contracts/src/SettleXEscrow.sol)
- **Deployed Address**: [`0x764e9e46e8595D80E7C2000e446CeF2B6848B2Ac`](https://testnet.monadscan.com/address/0x764e9e46e8595D80E7C2000e446CeF2B6848B2Ac)
- **Tests**: **42 / 42 passing** (`contracts/test/SettleXEscrow.t.sol`)
- **Combined Test Total**: **84 / 84 passing Foundry tests** (42 SettleXBounty + 42 SettleXEscrow)
