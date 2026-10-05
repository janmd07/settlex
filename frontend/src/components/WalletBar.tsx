'use client';

import { useState } from 'react';
import { useMonadWallet } from '../hooks/useMonadWallet';
import { Icon } from './Icons';
import styles from './WalletBar.module.css';

export function WalletBar() {
  const {
    account,
    balanceMon,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isSwitching,
    status,
    connectWallet,
    switchToMonadTestnet,
    disconnectWallet,
    clearStatus,
  } = useMonadWallet();

  const [copied, setCopied] = useState(false);

  const truncatedAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (account && navigator?.clipboard) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.walletArea}>
      {/* Network Status */}
      <div className={styles.network}>
        <i className={isCorrectNetwork ? styles.netGreen : styles.netAmber} />
        <span>Monad Testnet</span>
        <b className={styles.protectedTag}>PROTECTED</b>
      </div>

      {/* When Connected: Balance, Address, Copy, Disconnect */}
      {isConnected ? (
        <>
          {balanceMon !== null && (
            <div className={styles.balance} title="Native MON Balance">
              <span className={styles.balanceIcon}>◉</span>
              <span>{balanceMon} MON</span>
            </div>
          )}

          {truncatedAddress && (
            <button
              className={styles.addressBtn}
              onClick={handleCopyAddress}
              title={`Click to copy: ${account}`}
            >
              <span className={styles.addressDot} />
              <span>{truncatedAddress}</span>
              <Icon name={copied ? 'check-copy' : 'copy'} size={13} />
            </button>
          )}

          {!isCorrectNetwork && (
            <button
              onClick={switchToMonadTestnet}
              disabled={isSwitching}
              className={styles.switchBtn}
              id="switch-network-button"
            >
              {isSwitching ? 'Approving...' : 'Switch Network'}
            </button>
          )}

          <button
            onClick={disconnectWallet}
            className={styles.disconnectBtn}
            id="disconnect-wallet-button"
          >
            Disconnect
          </button>
        </>
      ) : (
        /* When Disconnected */
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className={styles.connectBtn}
          id="connect-wallet-button"
        >
          {isConnecting ? (
            <>
              <span className={styles.buttonSpinner} />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Icon name="wallet" size={14} />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      )}

      {/* Floating Status Notification */}
      {status && (
        <div className={`${styles.alert} ${styles[`alert_${status.type}`]}`} role="alert">
          <div className={styles.alertContent}>
            <span className={styles.alertIcon}>
              {status.type === 'error' && '✕'}
              {status.type === 'warning' && '!'}
              {status.type === 'success' && '✓'}
              {status.type === 'info' && 'i'}
            </span>
            <span className={styles.alertMessage}>{status.message}</span>
          </div>
          <button onClick={clearStatus} className={styles.alertDismiss} aria-label="Dismiss notification">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
