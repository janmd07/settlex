'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { formatEther } from 'viem';
import { publicClient } from '../contracts/client';
import {
  MONAD_TESTNET_CHAIN_ID_DECIMAL,
} from '../config/network';
import {
  getEthereumProvider,
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
  connectWallet: () => Promise<void>;
  switchToMonadTestnet: () => Promise<boolean>;
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

  /**
   * Connects the wallet using standard eth_requestAccounts.
   * If on a different network, prompts for network switch with user confirmation.
   */
  const connectWallet = async () => {
    // Clear manual disconnect flag since user explicitly clicked Connect
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(DISCONNECTED_STORAGE_KEY);
      } catch {
        // ignore storage error
      }
    }

    const provider = getEthereumProvider();
    if (!provider) {
      setStatus({
        type: 'error',
        message: 'No EVM wallet detected. Please install MetaMask, Rabby, or Phantom.',
      });
      return;
    }

    setIsConnecting(true);
    setStatus({ type: 'info', message: 'Connecting wallet... Please approve in your wallet.' });

    try {
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
            message: `Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)} on Monad Testnet.`,
          });
        } else {
          setStatus({
            type: 'warning',
            message: 'Wallet connected on another network. Prompting to switch to Monad Testnet...',
          });
          // Initiate switch prompt
          await switchToMonadTestnet();
        }
      }
    } catch (err) {
      const error = err as WalletError;
      if (error.code === 4001) {
        setStatus({
          type: 'warning',
          message: 'Connection request was rejected in your wallet.',
        });
      } else {
        setStatus({
          type: 'error',
          message: `Connection failed: ${error.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Prompts the wallet to switch or add Monad Testnet.
   * Shows wallet confirmation UI and handles approval/rejection.
   */
  const switchToMonadTestnet = async (): Promise<boolean> => {
    setIsSwitching(true);
    setStatus({
      type: 'info',
      message: 'Please approve the network switch/add request in your wallet...',
    });

    try {
      const result = await requestSwitchOrAddMonadTestnet();

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
  };

  /**
   * Guard function: ensures that Monad Testnet is selected and confirmed
   * BEFORE executing any escrow transaction.
   * Halts transaction and displays clear reason if user rejects.
   */
  const ensureMonadNetwork = async (): Promise<boolean> => {
    const provider = getEthereumProvider();
    if (!provider) {
      setStatus({
        type: 'error',
        message: 'Wallet not detected. Monad Testnet wallet is required for escrow transactions.',
      });
      return false;
    }

    // If not connected, connect first
    if (!account) {
      await connectWallet();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts || accounts.length === 0) {
        return false;
      }
    }

    // Verify chain ID
    const chainHex = await provider.request({ method: 'eth_chainId' });
    const currentChainId = parseChainId(chainHex);

    if (currentChainId === MONAD_TESTNET_CHAIN_ID_DECIMAL) {
      return true;
    }

    // Not on Monad Testnet: prompt switch
    setStatus({
      type: 'warning',
      message: 'Monad Testnet required for this transaction. Please confirm the switch in your wallet.',
    });

    const switched = await switchToMonadTestnet();
    if (!switched) {
      return false;
    }

    // Double check confirmation post-switch
    const postSwitchChainHex = await provider.request({ method: 'eth_chainId' });
    const confirmedChainId = parseChainId(postSwitchChainHex);

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
    // 1. Mark as manually disconnected in storage so auto-sync does not re-connect on refresh or re-render
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DISCONNECTED_STORAGE_KEY, 'true');
      } catch {
        // ignore storage error
      }
    }

    // 2. Clear all local account, balance, and operational states immediately
    setAccount(null);
    setBalanceMon(null);
    setBalanceWei(null);
    setIsConnecting(false);
    setIsSwitching(false);

    // 3. Clear status or set clean notification
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
    connectWallet,
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

