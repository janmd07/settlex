# SettleX Architecture

## Overview
**SettleX** is a trustless onchain escrow application designed for freelancer/client engagements and peer-to-peer (P2P) agreements.

By locking funds into smart contracts and releasing them based on cryptographic approvals, verifiable milestone completions, or dispute resolution mechanisms, SettleX eliminates counterparty risk without centralized intermediaries.

## Target Environment
- **Current Target Network**: Monad Testnet
- **Chain ID**: 10143
- **Currency**: MON (Testnet native token) / Testnet ERC20 tokens
- **Mainnet Status**: Mainnet deployment has **NOT** been decided yet. All contracts, scripts, and frontends are explicitly targeting Monad Testnet during development and hackathon evaluation.

## System Components

```
+-------------------------------------------------------------+
|                      SettleX Platform                       |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
       v                                             v
+-------------------------------+         +---------------------+
|        Next.js Frontend       |         |   Foundry Workspace |
|  - Next.js (App Router, TS)   |         |  - Solidity 0.8.24  |
|  - Modern Web UI              |         |  - Unit & Fuzz Tests|
|  - Wallet Connection          |         |  - Deploy Scripts   |
|  - Escrow Dashboard           |         +----------+----------+
+---------------+---------------+                    |
                |                                    |
                +-----------------+------------------+
                                  |
                                  v
                   +-----------------------------+
                   |        Monad Testnet        |
                   |  - High throughput EVM      |
                   |  - Fast finality            |
                   |  - Low transaction fees     |
                   +-----------------------------+
```

### 1. Smart Contracts (`/contracts`)
- **Escrow Core Engine** (to be built in Phase 2): Manages state transitions, funds lockup, milestone releases, and refunds.
- **Dispute Resolution / Arbiter logic**: Structured resolution pathways without relying on centralized custody.
- **Foundry Toolchain**: Native testing with `forge test` and deployment via `forge script`.

### 2. Frontend (`/frontend`)
- **Next.js with TypeScript**: React App Router foundation.
- **Web3 Integration**: EVM wallet integration configured for Monad Testnet.
- **Client & Freelancer Portals**: Interface to create deals, review terms, deposit funds into escrow, and request/approve disbursements.

### 3. Documentation (`/docs`)
- Architecture specifications: [ESCROW_ARCHITECTURE.md](file:///d:/SettleX/docs/ESCROW_ARCHITECTURE.md)
- Sequence diagrams & lifecycle documentation: [ESCROW_FLOW.md](file:///d:/SettleX/docs/ESCROW_FLOW.md)
