import {
  MONAD_TESTNET_CHAIN_ID_DECIMAL,
  MONAD_TESTNET_CHAIN_ID_HEX,
  MONAD_TESTNET_PARAMS,
} from '../config/network';

export interface WalletError extends Error {
  code?: number;
}

export interface NetworkSwitchResult {
  success: boolean;
  userRejected: boolean;
  message: string;
}

/**
 * Checks if an EVM-compatible wallet provider is present in the browser.
 */
export function getEthereumProvider() {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum;
  }
  return null;
}

/**
 * Parses chain ID from hex string, number, or unknown into decimal number.
 */
export function parseChainId(rawChainId: unknown): number | null {
  if (!rawChainId) return null;
  if (typeof rawChainId === 'number') return rawChainId;
  if (typeof rawChainId === 'string') {
    if (rawChainId.startsWith('0x') || rawChainId.startsWith('0X')) {
      return parseInt(rawChainId, 16);
    }
    const parsed = parseInt(rawChainId, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Requests the wallet to switch to Monad Testnet (or add it if not configured).
 * The wallet prompt is presented to the user for explicit confirmation.
 * Returns result status detailing success or rejection.
 */
export async function requestSwitchOrAddMonadTestnet(): Promise<NetworkSwitchResult> {
  const provider = getEthereumProvider();
  if (!provider) {
    return {
      success: false,
      userRejected: false,
      message: 'No EVM wallet detected. Please install MetaMask, Rabby, Phantom, or another Web3 wallet.',
    };
  }

  try {
    // 1. Attempt standard network switch via EIP-3326
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }],
    });

    return {
      success: true,
      userRejected: false,
      message: 'Successfully switched to Monad Testnet.',
    };
  } catch (switchError) {
    const error = switchError as WalletError;

    // User explicitly rejected the switch request
    if (error.code === 4001) {
      return {
        success: false,
        userRejected: true,
        message: 'Network switch was rejected in your wallet. Monad Testnet is required to continue.',
      };
    }

    // Error code 4902: Unrecognized chain (chain has not been added to wallet yet)
    // Some wallets (e.g. mobile or custom providers) may also return -32603 with 'Unrecognized chain'
    const isUnrecognizedChain =
      error.code === 4902 ||
      (typeof error.message === 'string' &&
        (error.message.toLowerCase().includes('unrecognized chain') ||
          error.message.toLowerCase().includes('wallet_addethereumchain')));

    if (isUnrecognizedChain) {
      try {
        // 2. Request wallet to add Monad Testnet via EIP-3085
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET_PARAMS],
        });

        // 3. Confirm that current chain is now Monad Testnet, or prompt switch
        const currentChainHex = await provider.request({ method: 'eth_chainId' });
        const currentChainId = parseChainId(currentChainHex);

        if (currentChainId !== MONAD_TESTNET_CHAIN_ID_DECIMAL) {
          // Some wallets add the network without auto-switching; request explicit switch
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }],
          });
        }

        return {
          success: true,
          userRejected: false,
          message: 'Monad Testnet added and selected in your wallet.',
        };
      } catch (addError) {
        const addErr = addError as WalletError;
        if (addErr.code === 4001) {
          return {
            success: false,
            userRejected: true,
            message: 'Adding Monad Testnet was rejected in your wallet. Monad Testnet is required to continue.',
          };
        }
        return {
          success: false,
          userRejected: false,
          message: `Failed to add Monad Testnet: ${addErr.message || 'Unknown wallet error'}`,
        };
      }
    }

    return {
      success: false,
      userRejected: false,
      message: `Failed to switch to Monad Testnet: ${error.message || 'Unknown wallet error'}`,
    };
  }
}
