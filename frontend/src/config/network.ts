/**
 * Monad Testnet Official Network Configuration Parameters
 */
export const MONAD_TESTNET_CHAIN_ID_DECIMAL = 10143;
export const MONAD_TESTNET_CHAIN_ID_HEX = '0x279f';

export interface AddEthereumChainParameter {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const MONAD_TESTNET_PARAMS: AddEthereumChainParameter = {
  chainId: MONAD_TESTNET_CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadscan.com'],
};
