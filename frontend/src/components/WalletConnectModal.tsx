'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useMonadWallet } from '../hooks/useMonadWallet';
import {
  detectWallets,
  EIP6963ProviderDetail,
  WalletOption,
} from '../utils/wallet';
import styles from './WalletConnectModal.module.css';

/* ==========================================================================
   Fallback Generic Icon for unknown EIP-6963 providers
   ========================================================================== */

function GenericWalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

/**
 * Renders the official wallet logo asset directly from the supplied files
 * with normalized proportions and perfect visual centering.
 */
function renderWalletIcon(wallet: WalletOption) {
  const id = wallet.id.toLowerCase();

  if (id === 'metamask') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/wallets/metamask.png"
        alt="MetaMask"
        className={`${styles.walletIconImg} ${styles.walletIconImg_metamask}`}
      />
    );
  }

  if (id === 'phantom') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/wallets/phantom.png"
        alt="Phantom"
        className={`${styles.walletIconImg} ${styles.walletIconImg_phantom}`}
      />
    );
  }

  if (id === 'rabby' || id.includes('rabby')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/wallets/rabby.png"
        alt="Rabby Wallet"
        className={`${styles.walletIconImg} ${styles.walletIconImg_rabby}`}
      />
    );
  }

  if (id === 'okx' || id.includes('okex')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/wallets/okx.png"
        alt="OKX Wallet"
        className={`${styles.walletIconImg} ${styles.walletIconImg_okx}`}
      />
    );
  }

  if (wallet.icon && wallet.icon.startsWith('data:image')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={wallet.icon} alt={wallet.name} className={styles.walletIconImg} />
    );
  }

  return <GenericWalletIcon className={styles.walletIconImg} />;
}

/* ==========================================================================
   Main WalletConnectModal Component
   ========================================================================== */

export function WalletConnectModal() {
  const {
    isConnectModalOpen,
    closeConnectModal,
    connectWithProvider,
    isConnecting,
    status,
    clearStatus,
  } = useMonadWallet();

  const [eip6963Providers, setEip6963Providers] = useState<EIP6963ProviderDetail[]>([]);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
  const [modalStatus, setModalStatus] = useState<{
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
  } | null>(null);

  // EIP-6963 Multi-Injected Discovery Event Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAnnounce = (event: any) => {
      const detail = event.detail as EIP6963ProviderDetail;
      if (detail && detail.info && detail.provider) {
        setEip6963Providers((prev) => {
          const exists = prev.some(
            (p) => p.info.uuid === detail.info.uuid || p.info.rdns === detail.info.rdns
          );
          if (exists) return prev;
          return [...prev, detail];
        });
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    };
  }, []);

  // Listen for Escape key to close modal
  useEffect(() => {
    if (!isConnectModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeConnectModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnectModalOpen, closeConnectModal]);

  // Clean local state when modal closes
  useEffect(() => {
    if (!isConnectModalOpen) {
      setConnectingWalletId(null);
      setModalStatus(null);
    }
  }, [isConnectModalOpen]);

  // Sync wallet hook status into modal status if modal is open
  useEffect(() => {
    if (status && isConnectModalOpen) {
      setModalStatus(status);
    }
  }, [status, isConnectModalOpen]);

  const wallets = detectWallets(eip6963Providers);

  const handleWalletSelect = useCallback(
    async (wallet: WalletOption) => {
      clearStatus();

      // If wallet is not installed, open official installation URL
      // (Never falls back to MetaMask or requests sensitive credentials)
      if (!wallet.isInstalled) {
        if (wallet.installUrl) {
          setModalStatus({
            type: 'info',
            message: `Opening ${wallet.name} download page in a new tab... Refresh after installation.`,
          });
          window.open(wallet.installUrl, '_blank', 'noopener,noreferrer');
        } else {
          setModalStatus({
            type: 'warning',
            message: `${wallet.name} is not installed in your browser.`,
          });
        }
        return;
      }

      // If wallet is installed, connect specifically through its provider
      setConnectingWalletId(wallet.id);
      setModalStatus({
        type: 'info',
        message: `Connecting ${wallet.name}... Please approve the request in your wallet.`,
      });

      try {
        const success = await connectWithProvider(wallet.provider, wallet.name, wallet.id);
        if (success) {
          closeConnectModal();
        }
      } catch (err: any) {
        if (err?.code === 4001) {
          setModalStatus({
            type: 'warning',
            message: `Connection request was rejected in ${wallet.name}.`,
          });
        } else {
          setModalStatus({
            type: 'error',
            message: `Failed to connect ${wallet.name}: ${err?.message || 'Unknown error'}`,
          });
        }
      } finally {
        setConnectingWalletId(null);
      }
    },
    [clearStatus, connectWithProvider, closeConnectModal]
  );

  if (!isConnectModalOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) {
          closeConnectModal();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className={styles.modal}>
        {/* Cinematic ambient purple glow behind card header */}
        <div className={styles.ambientGlow} />

        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <h2 id="wallet-modal-title" className={styles.modalTitle}>
              Connect your wallet
              <span className={styles.titleBadge}>EVM</span>
            </h2>
            <p className={styles.modalSubtitle}>Choose a wallet to continue to SettleX.</p>
          </div>
          <button
            onClick={closeConnectModal}
            className={styles.closeBtn}
            aria-label="Close wallet selection modal"
            id="close-wallet-modal-button"
          >
            &times;
          </button>
        </div>

        {/* Dynamic Status / Feedback Banner */}
        {modalStatus && (
          <div className={`${styles.statusBanner} ${styles[`status_${modalStatus.type}`]}`}>
            {isConnecting ? (
              <span className={styles.spinner} />
            ) : (
              <span className={styles.statusIcon}>
                {modalStatus.type === 'error' && '✕'}
                {modalStatus.type === 'warning' && '!'}
                {modalStatus.type === 'success' && '✓'}
                {modalStatus.type === 'info' && 'ℹ'}
              </span>
            )}
            <span>{modalStatus.message}</span>
          </div>
        )}

        {/* Detected & Available Wallets Grid */}
        <div className={styles.walletList}>
          {wallets.map((wallet) => {
            const isCurrentlyConnecting = connectingWalletId === wallet.id && isConnecting;

            return (
              <button
                key={wallet.id}
                className={`${styles.walletCard} ${
                  isCurrentlyConnecting ? styles.walletCard_connecting : ''
                } ${!wallet.isInstalled ? styles.walletCard_uninstalled : ''}`}
                onClick={() => handleWalletSelect(wallet)}
                disabled={isConnecting && !isCurrentlyConnecting}
                id={`wallet-option-${wallet.id}`}
              >
                <div className={styles.walletLeft}>
                  <div className={styles.walletIconWrapper}>
                    {renderWalletIcon(wallet)}
                  </div>
                  <div className={styles.walletInfo}>
                    <span className={styles.walletName}>{wallet.name}</span>
                    <span className={styles.walletSubtext}>
                      {wallet.isInstalled ? 'Ready to connect' : 'Extension not detected'}
                    </span>
                  </div>
                </div>

                <div className={styles.walletRight}>
                  {isCurrentlyConnecting ? (
                    <span className={styles.spinner} />
                  ) : wallet.isInstalled ? (
                    <span className={styles.detectedBadge}>
                      <span className={styles.detectedDot} />
                      Detected
                    </span>
                  ) : (
                    <span className={styles.installBadge}>
                      Install
                      <span className={styles.installArrow}>↗</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Security Assurance Footnote */}
        <div className={styles.securityFooter}>
          <svg
            className={styles.securityIcon}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>SettleX will never ask for your seed phrase or private keys.</span>
        </div>
      </div>
    </div>
  );
}
