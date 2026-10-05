import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
} from 'viem';
import {
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
} from '../config/contract';

/**
 * Viem Chain definition for Monad Testnet
 */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [MONAD_TESTNET_RPC_URL],
    },
    public: {
      http: [MONAD_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monadscan',
      url: MONAD_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
});

/**
 * Global Public Client for direct READ operations against Monad Testnet RPC.
 * Works independently of wallet connection status.
 */
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_TESTNET_RPC_URL),
});

/**
 * Creates a Wallet Client connected to the user's browser provider (window.ethereum).
 */
export function getWalletClient(account?: `0x${string}`) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No EVM wallet detected. Please install MetaMask, Rabby, or Phantom.');
  }

  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: custom(window.ethereum),
  });
}
