'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { formatEther } from 'viem';
import { publicClient } from '../contracts/client';
import {
  MONAD_TESTNET_CHAIN_ID_DECIMAL,
} from '../config/network';
import {
  getEthereumProvider,
  setActiveEthereumProvider,
  clearActiveEthereumProvider,
  getActiveWalletName,
  parseChainId,
  requestSwitchOrAddMonadTestnet,
  WalletError,
} from '../utils/wallet';

export interface WalletStatus {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface MonadWalletContextType {
  account: string | null;
  chainId: number | null;
  balanceMon: string | null;
  balanceWei: bigint | null;
  refreshBalance: (targetAccount?: string) => Promise<void>;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  isSwitching: boolean;
  status: WalletStatus | null;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  connectWallet: () => Promise<void>;
  connectWithProvider: (provider: any, walletName?: string, walletId?: string) => Promise<boolean>;
  connectedWalletName: string | null;
  switchToMonadTestnet: (targetProvider?: any) => Promise<boolean>;
  ensureMonadNetwork: () => Promise<boolean>;
  disconnectWallet: () => void;
  clearStatus: () => void;
}

const DISCONNECTED_STORAGE_KEY = 'settlex_wallet_manually_disconnected';

function useMonadWalletInternal(): MonadWalletContextType {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceMon, setBalanceMon] = useState<string | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(() => getActiveWalletName());

  const accountRef = useRef<string | null>(account);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const isConnected = !!account;
  const isCorrectNetwork = chainId === MONAD_TESTNET_CHAIN_ID_DECIMAL;

  // Refresh live native MON balance with stable reference
  const refreshBalance = useCallback(async (targetAccount?: string) => {
    const acc = targetAccount || accountRef.current;
    if (!acc) {
      setBalanceMon(null);
      setBalanceWei(null);
      return;
    }
    try {
      const bal = await publicClient.getBalance({ address: acc as `0x${string}` });
      setBalanceWei(bal);
      const formatted = formatEther(bal);
      const num = parseFloat(formatted);
      setBalanceMon(isNaN(num) ? formatted : num.toLocaleString(undefined, { maximumFractionDigits: 4 }));
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  }, []);

  // Sync state from provider (respects manual disconnect flag)
  const syncWalletState = useCallback(async () => {
    // If the user explicitly disconnected in SettleX, do not auto-connect via eth_accounts
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(DISCONNECTED_STORAGE_KEY) === 'true') {
          return;
        }
      } catch {
        // ignore storage error
      }
    }

    const provider = getEthereumProvider();
    if (!provider) return;

    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        refreshBalance(accounts[0]);
      } else {
        setAccount(null);
        setBalanceMon(null);
        setBalanceWei(null);
      }

      const currentChainHex = await provider.request({ method: 'eth_chainId' });
      const currentChainId = parseChainId(currentChainHex);
      setChainId(currentChainId);
    } catch (err) {
      console.error('Error syncing wallet state:', err);
    }
  }, [refreshBalance]);

  // Listen for account and network changes
  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) return;

    syncWalletState();

    const handleAccountsChanged = (accounts: unknown) => {
      const accList = accounts as string[];
      if (accList && accList.length > 0) {
        const isManuallyDisconnected =
          typeof window !== 'undefined' &&
          localStorage.getItem(DISCONNECTED_STORAGE_KEY) === 'true';

        // Only auto-adopt account if user did not manually disconnect in SettleX
        if (!isManuallyDisconnected) {
          setAccount(accList[0]);
          refreshBalance(accList[0]);
          setStatus({
            type: 'info',
            message: `Connected: ${accList[0].slice(0, 6)}...${accList[0].slice(-4)}`,
          });
        }
      } else {
        // Provider emitted [] (wallet locked or disconnected in browser extension)
        setAccount(null);
        setBalanceMon(null);
        setBalanceWei(null);
        setStatus({
          type: 'warning',
          message: 'Wallet disconnected.',
        });
      }
    };

    const handleChainChanged = (chainHex: unknown) => {
      const newChainId = parseChainId(chainHex);
      setChainId(newChainId);

      if (newChainId === MONAD_TESTNET_CHAIN_ID_DECIMAL) {
        setStatus({
          type: 'success',
          message: 'Connected to Monad Testnet (Chain ID 10143).',
        });
      } else {
        setStatus({
          type: 'warning',
          message: `Connected to Chain ID ${newChainId ?? 'unknown'}. Monad Testnet required.`,
        });
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [syncWalletState, refreshBalance]);

  const openConnectModal = useCallback(() => {
    setIsConnectModalOpen(true);
  }, []);

  const closeConnectModal = useCallback(() => {
    setIsConnectModalOpen(false);
  }, []);

  /**
   * Prompts the wallet to switch or add Monad Testnet.
   * Shows wallet confirmation UI and handles approval/rejection.
   */
  const switchToMonadTestnet = useCallback(async (targetProvider?: any): Promise<boolean> => {
    setIsSwitching(true);
    setStatus({
      type: 'info',
      message: 'Please approve the network switch/add request in your wallet...',
    });

    try {
      const result = await requestSwitchOrAddMonadTestnet(targetProvider);

      if (result.success) {
        await syncWalletState();
        setStatus({
          type: 'success',
          message: 'Successfully switched to Monad Testnet (Chain ID 10143).',
        });
        return true;
      } else {
        setStatus({
          type: result.userRejected ? 'warning' : 'error',
          message: result.message,
        });
        return false;
      }
    } finally {
      setIsSwitching(false);
    }
  }, [syncWalletState]);

  /**
   * Connects to a specific selected provider (from the wallet modal).
   */
  const connectWithProvider = useCallback(
    async (provider: any, walletName?: string, walletId?: string): Promise<boolean> => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(DISCONNECTED_STORAGE_KEY);
        } catch {
          // ignore storage error
        }
      }

      if (!provider) {
        setStatus({
          type: 'error',
          message: `Could not connect to ${walletName || 'wallet'}. Provider is not available.`,
        });
        return false;
      }

      setIsConnecting(true);
      setStatus({
        type: 'info',
        message: `Connecting ${walletName || 'wallet'}... Please approve in your wallet.`,
      });

      try {
        setActiveEthereumProvider(provider, walletName, walletId);
        if (walletName) {
          setConnectedWalletName(walletName);
        }

        const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
          refreshBalance(accounts[0]);

          const chainHex = await provider.request({ method: 'eth_chainId' });
          const currentChainId = parseChainId(chainHex);
          setChainId(currentChainId);

          if (currentChainId === MONAD_TESTNET_CHAIN_ID_DECIMAL) {
            setStatus({
              type: 'success',
              message: `Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)} via ${walletName || 'wallet'}.`,
            });
          } else {
            setStatus({
              type: 'warning',
              message: 'Wallet connected on another network. Prompting to switch to Monad Testnet...',
            });
            await switchToMonadTestnet(provider);
          }

          setIsConnectModalOpen(false);
          return true;
        }
        return false;
      } catch (err) {
        const error = err as WalletError;
        if (error.code === 4001) {
          setStatus({
            type: 'warning',
            message: `Connection request was rejected in ${walletName || 'your wallet'}.`,
          });
        } else {
          setStatus({
            type: 'error',
            message: `Connection failed: ${error.message || 'Unknown error'}`,
          });
        }
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [refreshBalance, switchToMonadTestnet]
  );

  /**
   * Default Connect action called by the Connect Wallet button.
   * Instead of immediately triggering MetaMask, opens the multi-wallet selection modal.
   */
  const connectWallet = useCallback(async () => {
    setIsConnectModalOpen(true);
  }, []);

  /**
   * Guard function: ensures that Monad Testnet is selected and confirmed
   * BEFORE executing any escrow transaction.
   * Halts transaction and displays clear reason if user rejects.
   */
  const ensureMonadNetwork = async (): Promise<boolean> => {
    const provider = getEthereumProvider();
    if (!provider) {
      setIsConnectModalOpen(true);
      setStatus({
        type: 'error',
        message: 'Wallet not detected. Monad Testnet wallet is required for escrow transactions.',
      });
      return false;
    }

    // If not connected, open wallet selection modal
    if (!account) {
      setIsConnectModalOpen(true);
      return false;
    }

    // Verify chain ID
    const chainHex = await provider.request({ method: 'eth_chainId' });
    const currentChainId = parseChainId(chainHex);

    if (currentChainId !== MONAD_TESTNET_CHAIN_ID_DECIMAL) {
      const switchSuccess = await switchToMonadTestnet(provider);
      if (!switchSuccess) {
        return false;
      }
    }

    // Final verification
    const confirmedChainHex = await provider.request({ method: 'eth_chainId' });
    const confirmedChainId = parseChainId(confirmedChainHex);

    if (confirmedChainId !== MONAD_TESTNET_CHAIN_ID_DECIMAL) {
      setStatus({
        type: 'error',
        message: 'Chain ID confirmation failed. Transaction cancelled. Monad Testnet (10143) required.',
      });
      return false;
    }

    return true;
  };

  const disconnectWallet = useCallback(() => {
    // 1. Mark as manually disconnected in storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DISCONNECTED_STORAGE_KEY, 'true');
      } catch {
        // ignore storage error
      }
    }

    // 2. Clear provider reference
    clearActiveEthereumProvider();
    setConnectedWalletName(null);

    // 3. Clear all local account, balance, and operational states immediately
    setAccount(null);
    setBalanceMon(null);
    setBalanceWei(null);
    setIsConnecting(false);
    setIsSwitching(false);

    // 4. Set clean notification
    setStatus({
      type: 'info',
      message: 'Wallet disconnected.',
    });
  }, []);

  return {
    account,
    chainId,
    balanceMon,
    balanceWei,
    refreshBalance,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isSwitching,
    status,
    isConnectModalOpen,
    openConnectModal,
    closeConnectModal,
    connectWallet,
    connectWithProvider,
    connectedWalletName,
    switchToMonadTestnet,
    ensureMonadNetwork,
    disconnectWallet,
    clearStatus: () => setStatus(null),
  };
}

const WalletContext = createContext<MonadWalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useMonadWalletInternal();
  return React.createElement(WalletContext.Provider, { value: wallet }, children);
}

export function useMonadWallet(): MonadWalletContextType {
  const context = useContext(WalletContext);
  if (context) {
    return context;
  }
  return useMonadWalletInternal();
}
