/**
 * Centralized SettleXEscrow Contract Configuration on Monad Testnet
 */
export const SETTLEX_ESCROW_ADDRESS = '0x764e9e46e8595D80E7C2000e446CeF2B6848B2Ac' as const;

/**
 * SettleX V2 Bounty Contract Configuration on Monad Testnet
 * Preserves default placeholder until contract is deployed to testnet.
 */
export const SETTLEX_BOUNTY_ADDRESS = (process.env.NEXT_PUBLIC_SETTLEX_BOUNTY_ADDRESS ||
  '0x9e5807B3470AF8E5a316FEa847fd87EdB2DCFfF7') as `0x${string}`;

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC_URL = 'https://testnet-rpc.monad.xyz';
export const MONAD_TESTNET_EXPLORER_URL = 'https://testnet.monadscan.com';
export const MONAD_TESTNET_ALT_EXPLORER_URL = 'https://testnet.monadexplorer.com';

export function getExplorerTxUrl(txHash: string): string {
  return `${MONAD_TESTNET_EXPLORER_URL}/tx/${txHash}`;
}

export function getAltExplorerTxUrl(txHash: string): string {
  return `${MONAD_TESTNET_ALT_EXPLORER_URL}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${MONAD_TESTNET_EXPLORER_URL}/address/${address}`;
}

export function getAltExplorerAddressUrl(address: string): string {
  return `${MONAD_TESTNET_ALT_EXPLORER_URL}/address/${address}`;
}
