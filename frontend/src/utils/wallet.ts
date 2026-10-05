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

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: 'eip6963:announceProvider';
  detail: EIP6963ProviderDetail;
}

export interface WalletOption {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  isInstalled: boolean;
  installUrl: string;
  provider?: any;
}

const ACTIVE_WALLET_STORAGE_KEY = 'settlex_active_wallet_id';
const ACTIVE_WALLET_NAME_KEY = 'settlex_active_wallet_name';

let activeEthereumProvider: any = null;
let activeWalletId: string | null = null;
let activeWalletName: string | null = null;

/**
 * Sets the active EVM provider (e.g. when selected in the wallet modal).
 */
export function setActiveEthereumProvider(provider: any, walletName?: string, walletId?: string) {
  activeEthereumProvider = provider;
  if (walletId) {
    activeWalletId = walletId;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_WALLET_STORAGE_KEY, walletId);
      } catch {
        // ignore
      }
    }
  }
  if (walletName) {
    activeWalletName = walletName;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_WALLET_NAME_KEY, walletName);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Clears the active EVM provider reference and stored metadata on disconnect.
 */
export function clearActiveEthereumProvider() {
  activeEthereumProvider = null;
  activeWalletId = null;
  activeWalletName = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_WALLET_NAME_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Gets the display name of the currently connected wallet.
 */
export function getActiveWalletName(): string | null {
  if (activeWalletName) return activeWalletName;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(ACTIVE_WALLET_NAME_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Checks if an EVM-compatible wallet provider is present in the browser.
 * Returns the currently active selected provider if set, otherwise window.ethereum.
 */
export function getEthereumProvider(): any {
  if (activeEthereumProvider) {
    return activeEthereumProvider;
  }
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
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
 * Dynamically detects installed wallets via EIP-6963 and legacy window injection.
 * Primary targets: MetaMask, Phantom, Rabby, OKX Wallet.
 * Does NOT falsely report uninstalled wallets as installed.
 */
export function detectWallets(eip6963Providers: EIP6963ProviderDetail[]): WalletOption[] {
  if (typeof window === 'undefined') {
    return [
      { id: 'metamask', name: 'MetaMask', rdns: 'io.metamask', isInstalled: false, installUrl: 'https://metamask.io/download/' },
      { id: 'phantom', name: 'Phantom', rdns: 'app.phantom', isInstalled: false, installUrl: 'https://phantom.app/download' },
      { id: 'rabby', name: 'Rabby Wallet', rdns: 'io.rabby', isInstalled: false, installUrl: 'https://rabby.io/' },
      { id: 'okx', name: 'OKX Wallet', rdns: 'com.okex.wallet', isInstalled: false, installUrl: 'https://www.okx.com/web3' },
    ];
  }

  const win = window as any;
  const eth = win.ethereum;
  const legacyProviders: any[] = Array.isArray(eth?.providers) ? eth.providers : [];

  const findEip6963 = (predicate: (detail: EIP6963ProviderDetail) => boolean) =>
    eip6963Providers.find(predicate);

  // 1. Rabby
  const eipRabby = findEip6963(
    (d) => d.info.rdns === 'io.rabby' || d.info.name.toLowerCase().includes('rabby')
  );
  const legacyRabby =
    win.rabby ||
    legacyProviders.find((p) => p.isRabby) ||
    (eth?.isRabby ? eth : null);
  const rabbyProvider = eipRabby?.provider || legacyRabby || null;
  const isRabbyInstalled = !!rabbyProvider;

  // 2. Phantom
  const eipPhantom = findEip6963(
    (d) => d.info.rdns === 'app.phantom' || d.info.name.toLowerCase().includes('phantom')
  );
  const legacyPhantom =
    win.phantom?.ethereum ||
    legacyProviders.find((p) => p.isPhantom) ||
    (eth?.isPhantom ? eth : null);
  const phantomProvider = eipPhantom?.provider || legacyPhantom || null;
  const isPhantomInstalled = !!phantomProvider;

  // 3. OKX Wallet
  const eipOkx = findEip6963(
    (d) =>
      d.info.rdns === 'com.okex.wallet' ||
      d.info.rdns === 'com.okx.wallet' ||
      d.info.name.toLowerCase().includes('okx')
  );
  const legacyOkx =
    win.okxwallet ||
    legacyProviders.find((p) => p.isOkxWallet || p.isOKExWallet) ||
    (eth?.isOkxWallet || eth?.isOKExWallet ? eth : null);
  const okxProvider = eipOkx?.provider || legacyOkx || null;
  const isOkxInstalled = !!okxProvider;

  // 4. MetaMask
  // Note: Rabby and Phantom may set isMetaMask: true for legacy compatibility.
  // Ensure we do not falsely label Rabby/Phantom as MetaMask unless it's genuinely MetaMask.
  const eipMetaMask = findEip6963(
    (d) =>
      d.info.rdns === 'io.metamask' ||
      (d.info.name.toLowerCase().includes('metamask') && !d.info.name.toLowerCase().includes('rabby'))
  );
  const legacyMetaMask =
    legacyProviders.find(
      (p) =>
        p.isMetaMask &&
        !p.isRabby &&
        !p.isPhantom &&
        !p.isOkxWallet &&
        !p.isOKExWallet
    ) ||
    (eth?.isMetaMask &&
    !eth?.isRabby &&
    !eth?.isPhantom &&
    !eth?.isOkxWallet &&
    !eth?.isOKExWallet
      ? eth
      : null);
  const metaMaskProvider = eipMetaMask?.provider || legacyMetaMask || null;
  const isMetaMaskInstalled = !!metaMaskProvider;

  const primaryWallets: WalletOption[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      rdns: 'io.metamask',
      icon: eipMetaMask?.info.icon,
      isInstalled: isMetaMaskInstalled,
      installUrl: 'https://metamask.io/download/',
      provider: metaMaskProvider,
    },
    {
      id: 'phantom',
      name: 'Phantom',
      rdns: 'app.phantom',
      icon: eipPhantom?.info.icon,
      isInstalled: isPhantomInstalled,
      installUrl: 'https://phantom.app/download',
      provider: phantomProvider,
    },
    {
      id: 'rabby',
      name: 'Rabby Wallet',
      rdns: 'io.rabby',
      icon: eipRabby?.info.icon,
      isInstalled: isRabbyInstalled,
      installUrl: 'https://rabby.io/',
      provider: rabbyProvider,
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      rdns: 'com.okex.wallet',
      icon: eipOkx?.info.icon,
      isInstalled: isOkxInstalled,
      installUrl: 'https://www.okx.com/web3',
      provider: okxProvider,
    },
  ];

  // Also include any other discovered EIP-6963 wallets (e.g. Coinbase, Brave, Zerion)
  const knownRdns = ['io.metamask', 'app.phantom', 'io.rabby', 'com.okex.wallet', 'com.okx.wallet'];
  const otherEip6963 = eip6963Providers.filter(
    (d) =>
      !knownRdns.includes(d.info.rdns) &&
      !primaryWallets.some((w) => w.name.toLowerCase() === d.info.name.toLowerCase())
  );

  const otherWallets: WalletOption[] = otherEip6963.map((d) => ({
    id: d.info.rdns || d.info.uuid,
    name: d.info.name,
    rdns: d.info.rdns,
    icon: d.info.icon,
    isInstalled: true,
    installUrl: '',
    provider: d.provider,
  }));

  return [...primaryWallets, ...otherWallets];
}

/**
 * Requests the wallet to switch to Monad Testnet (or add it if not configured).
 * The wallet prompt is presented to the user for explicit confirmation.
 * Returns result status detailing success or rejection.
 */
export async function requestSwitchOrAddMonadTestnet(targetProvider?: any): Promise<NetworkSwitchResult> {
  const provider = targetProvider || getEthereumProvider();
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
