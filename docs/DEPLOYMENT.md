# SettleX Monad Testnet Deployment Guide

## 1. Network Information

SettleX smart contracts are developed and configured exclusively for the **Monad Testnet**.

| Parameter | Value |
|---|---|
| **Network Name** | Monad Testnet |
| **Chain ID** | `10143` |
| **Currency Symbol** | `MON` (18 decimals) |
| **Primary RPC URL** | `https://testnet-rpc.monad.xyz` |
| **Alternative RPC URL** | `https://rpc-testnet.monadinfra.com` |
| **Block Explorer (Monadscan)** | `https://testnet.monadscan.com` |
| **Block Explorer (MonadVision)** | `https://testnet.monadvision.com` |
| **Sourcify Verification Endpoint** | `https://sourcify-api-monad.blockvision.org/` |

---

## 2. Deployment Script Specification

- **Script Path**: [`contracts/script/DeploySettleXEscrow.s.sol`](file:///d:/SettleX/contracts/script/DeploySettleXEscrow.s.sol)
- **Target Contract**: [`contracts/src/SettleXEscrow.sol`](file:///d:/SettleX/contracts/src/SettleXEscrow.sol)
- **Solidity Version**: `0.8.24`
- **Constructor Arguments**: **None**. `SettleXEscrow` uses a parameterless constructor.

The deployment script inherits from Foundry's `Script` standard library. It does not hardcode private keys, addresses, or secrets. It supports both environment-variable-based private key broadcasting and Foundry's encrypted keystore mechanism.

---

## 3. Required Environment Variables

A template file [`.env.example`](file:///d:/SettleX/.env.example) is provided in the repository root.

| Variable | Required | Description | Example / Default |
|---|:---:|---|---|
| `MONAD_RPC_URL` | Yes | Monad Testnet JSON-RPC endpoint | `https://testnet-rpc.monad.xyz` |
| `MONAD_CHAIN_ID` | Yes | Target network chain ID | `10143` |
| `DEPLOYER_PRIVATE_KEY` | Optional* | 64-character hex private key for broadcasting | `""` (Empty by default) |
| `MONAD_EXPLORER_API_KEY` | Optional | API key for block explorer verification | `""` (Empty by default) |

*\*`DEPLOYER_PRIVATE_KEY` is optional if using Foundry's secure keystore (`cast wallet import`) with `--account`.*

---

## 4. Wallet Management & Security Considerations

1. **Strictly Prohibit Real Secrets in Repository**:
   - Never commit `.env`, private keys, or seed phrases.
   - The `.gitignore` is configured to ignore `.env`, `.env*.local`, `*.key`, and `*.secret`.
2. **Use Ephemeral Testnet Wallets**:
   - Use a dedicated testnet wallet that holds only testnet MON faucet tokens.
   - Never use a private key or mnemonic that holds mainnet assets.
3. **Recommended: Encrypted Keystore via `cast`**:
   Instead of keeping raw private keys in `.env`, import the key into an encrypted local keystore:
   ```bash
   cast wallet import settlex-deployer --interactive
   ```
   This prompts for the private key and encrypts it with a local password.

---

## 5. Deployment Commands (For Phase 4 Execution)

> [!IMPORTANT]
> Do NOT execute broadcast commands during Phase 4A. Deployment is restricted until Phase 4B approval.

### A. Dry-Run / Simulation (Read-Only, Safe)
Simulates execution against local EVM state without sending network transactions:
```bash
forge script contracts/script/DeploySettleXEscrow.s.sol
```

Or simulate against the Monad Testnet RPC without broadcasting:
```bash
forge script contracts/script/DeploySettleXEscrow.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz
```

### B. Onchain Broadcast (Authorized Phase 4B Only)

**Using Cast Keystore (Recommended)**:
```bash
forge script contracts/script/DeploySettleXEscrow.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --account settlex-deployer \
  --broadcast
```

**Using Environment Variable**:
```bash
forge script contracts/script/DeploySettleXEscrow.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast
```

---

## 6. Contract Verification Instructions

Once deployed in Phase 4B, verify the contract on Monad Testnet:

```bash
forge verify-contract \
  <DEPLOYED_CONTRACT_ADDRESS> \
  contracts/src/SettleXEscrow.sol:SettleXEscrow \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```
