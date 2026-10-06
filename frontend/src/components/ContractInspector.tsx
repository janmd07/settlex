'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { isAddress } from 'viem';
import { useSettleXBounty } from '../hooks/useSettleXBounty';
import { useMonadWallet } from '../hooks/useMonadWallet';
import {
  SETTLEX_BOUNTY_ADDRESS,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from '../config/contract';
import { BountyState, FormattedBounty, SettlementTxDetails, CreatorTab } from '../contracts/types';
import { getCachedSettlementTx, fetchSettlementTxHash, classifyCreatorBounty } from '../contracts/reads';
import { Icon } from './Icons';
import styles from './ContractInspector.module.css';

type ActiveTab = 'manage' | 'create';
type ExploreView = 'active' | 'completed';
type SortOption = 'reward-desc' | 'reward-asc' | 'newest' | 'deadline' | 'capacity' | 'reward';

const PAGE_SIZE = 10;

export interface ContractInspectorProps {
  viewMode?: 'home-stats' | 'bounties' | 'create' | 'all' | 'payment-activity';
  externalTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  myBountiesOnly?: boolean;
  onNeedsReviewCountChange?: (count: number) => void;
  onNavigateHome?: () => void;
  onNavigateCreate?: () => void;
  onNavigateExplore?: () => void;
}

export function ContractInspector({
  viewMode = 'all',
  externalTab,
  onTabChange,
  myBountiesOnly = false,
  onNeedsReviewCountChange,
  onNavigateHome,
  onNavigateCreate,
  onNavigateExplore,
}: ContractInspectorProps) {
  const wallet = useMonadWallet();
  const {
    isBountyDeployed,
    activeBounty,
    submissions,
    allBounties,
    isLoadingAllBounties,
    isLoadingBounty,
    nextBountyId,
    txState,
    currentRole,
    isCreator,
    isArbiter,
    userHasSubmitted,
    claimableReward,
    activeSettlementTx,
    isLoadingSettlementTx,
    paymentSummary,
    paymentActivity,
    isLoadingPayments,
    loadPaymentData,
    resolveBountySettlementTx,
    loadBounty,
    loadAllBounties,
    refreshNextBountyId,
    creatorBounties,
    isLoadingCreatorBounties,
    loadCreatorBounties,
    creatorNeedsReviewCount,
    handleCreateBounty,
    handleSubmitWork,
    handleCloseSubmissions,
    handleSelectWinner,
    handleEscalateToDispute,
    handleResolveDispute,
    handleClaimRefund,
    handleClaimReward,
    resetTxState,
  } = useSettleXBounty();

  const [activeTab, setActiveTabInternal] = useState<ActiveTab>(
    viewMode === 'create' ? 'create' : 'manage'
  );
  const [exploreView, setExploreView] = useState<ExploreView>('active');
  const [creatorTab, setCreatorTab] = useState<CreatorTab>('needs-review');
  const [hasSetInitialCreatorTab, setHasSetInitialCreatorTab] = useState(false);
  const [creatorTxMap, setCreatorTxMap] = useState<Record<number, SettlementTxDetails | null>>({});
  const [selectedBountyId, setSelectedBountyId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('reward-desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [lookupBountyId, setLookupBountyId] = useState<string>('');
  const [readError, setReadError] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [copiedTxHash, setCopiedTxHash] = useState<string | null>(null);

  const handleCopyTx = (txHash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(txHash);
      setCopiedTxHash(txHash);
      setTimeout(() => setCopiedTxHash(null), 2000);
    }
  };

  // Notify parent of review count for nav badge
  useEffect(() => {
    onNeedsReviewCountChange?.(creatorNeedsReviewCount);
  }, [creatorNeedsReviewCount, onNeedsReviewCountChange]);

  // Reset initial creator tab selection when wallet account changes
  useEffect(() => {
    setHasSetInitialCreatorTab(false);
  }, [wallet.account]);

  useEffect(() => {
    if (viewMode === 'payment-activity' && wallet.account) {
      loadPaymentData();
    }
  }, [viewMode, wallet.account, loadPaymentData]);

  // Reset pagination to Page 1 when search query, sort option, tab, or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, exploreView, creatorTab, myBountiesOnly]);

  // Sync with external tab or viewMode if provided
  useEffect(() => {
    if (viewMode === 'create') {
      setActiveTabInternal('create');
    } else if (viewMode === 'bounties') {
      setActiveTabInternal('manage');
    } else if (externalTab) {
      setActiveTabInternal(externalTab);
    }
  }, [viewMode, externalTab]);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabInternal(tab);
    onTabChange?.(tab);
  };

  // Form: Create Bounty State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCriteria, setFormCriteria] = useState('');
  const [formRewardMon, setFormRewardMon] = useState('0.1');
  const [formMaxSubmissions, setFormMaxSubmissions] = useState('5');
  const [formDurationHours, setFormDurationHours] = useState('48');
  const [formDisputeResolver, setFormDisputeResolver] = useState('');
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Contributor Submit Work Form
  const [submissionProofUri, setSubmissionProofUri] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Live countdown timer state
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all bounties on mount
  useEffect(() => {
    if (isBountyDeployed) {
      refreshNextBountyId();
      loadAllBounties().catch(() => {});
    }
  }, [isBountyDeployed, loadAllBounties, refreshNextBountyId]);

  // Open detail view for a specific bounty
  const handleViewBounty = async (bountyId: number) => {
    setSelectedBountyId(bountyId);
    setReadError(null);
    try {
      await loadBounty(bountyId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setReadError(`Failed to load Bounty #${bountyId}: ${msg}`);
    }
  };

  // Back to Explore list
  const handleBackToList = () => {
    setSelectedBountyId(null);
    setReadError(null);
  };

  // Search submit handler: ensures current page is reset to 1
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  // Direct lookup handler in detail view
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setReadError(null);
    const id = parseInt(lookupBountyId, 10);
    if (isNaN(id) || id <= 0) {
      setReadError('Please enter a valid bounty ID.');
      return;
    }

    try {
      setSelectedBountyId(id);
      await loadBounty(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('BountyDoesNotExist') || msg.includes('revert')) {
        setReadError(`Bounty #${id} does not exist yet.`);
      } else {
        setReadError(`Failed to fetch Bounty #${id}: ${msg}`);
      }
    }
  };

  // Live Protocol Statistics derived from real onchain data
  const stats = useMemo(() => {
    let locked = 0;
    let paidOut = 0;
    let active = 0;
    let completed = 0;

    for (const b of allBounties) {
      const reward = parseFloat(b.rewardMon) || 0;
      if (
        b.state === BountyState.Open ||
        b.state === BountyState.Reviewing ||
        b.state === BountyState.DisputeReview
      ) {
        locked += reward;
        active += 1;
      } else if (b.state === BountyState.Settled) {
        paidOut += reward;
        completed += 1;
      } else if (b.state === BountyState.Refunded) {
        completed += 1;
      }
    }

    return {
      totalLocked: allBounties.length > 0 ? `${locked.toFixed(2)} MON` : '—',
      activeCount: allBounties.length > 0 ? String(active) : '—',
      completedCount: allBounties.length > 0 ? String(completed) : '—',
      totalPaidOut: allBounties.length > 0 ? `${paidOut.toFixed(2)} MON` : '—',
    };
  }, [allBounties]);

  // Filtered lists for Active and Completed (Public Explore)
  const activeBountiesList = useMemo(() => {
    return allBounties.filter(
      (b) =>
        b.state === BountyState.Open ||
        b.state === BountyState.Reviewing ||
        b.state === BountyState.DisputeReview
    );
  }, [allBounties]);

  const completedBountiesList = useMemo(() => {
    return allBounties.filter(
      (b) =>
        b.state === BountyState.Settled ||
        b.state === BountyState.Refunded
    );
  }, [allBounties]);

  // Classify canonical creator bounties into review/action status groups
  const creatorCategorized = useMemo(() => {
    const needsReview: FormattedBounty[] = [];
    const active: FormattedBounty[] = [];
    const completed: FormattedBounty[] = [];
    const refunded: FormattedBounty[] = [];

    for (const b of creatorBounties) {
      const { isNeedsReview, isActive, isCompleted, isRefunded } = classifyCreatorBounty(b, currentTime);
      if (isNeedsReview) needsReview.push(b);
      else if (isActive) active.push(b);
      else if (isCompleted) completed.push(b);
      else if (isRefunded) refunded.push(b);
    }

    return {
      needsReview,
      active,
      completed,
      refunded,
      all: creatorBounties,
    };
  }, [creatorBounties, currentTime]);

  // Set initial Creator tab based on review priority
  useEffect(() => {
    if (creatorBounties.length > 0 && !hasSetInitialCreatorTab) {
      if (creatorNeedsReviewCount > 0) {
        setCreatorTab('needs-review');
      } else {
        const hasActive = creatorBounties.some(
          (b) => classifyCreatorBounty(b, currentTime).isActive
        );
        setCreatorTab(hasActive ? 'active' : 'all');
      }
      setHasSetInitialCreatorTab(true);
    }
  }, [creatorBounties, creatorNeedsReviewCount, hasSetInitialCreatorTab, currentTime]);

  // Resolve onchain settlement/refund transaction hashes for creator bounties using existing resolver
  useEffect(() => {
    if (!myBountiesOnly || creatorBounties.length === 0) return;
    const targetBounties = creatorBounties.filter(
      (b) => b.state === BountyState.Settled || b.state === BountyState.Refunded
    );
    for (const b of targetBounties) {
      const cached = getCachedSettlementTx(b.bountyId);
      if (cached) {
        setCreatorTxMap((prev) => (prev[b.bountyId] ? prev : { ...prev, [b.bountyId]: cached }));
      } else {
        fetchSettlementTxHash(b.bountyId, b.state, b.settledAtTimestamp)
          .then((details) => {
            if (details) {
              setCreatorTxMap((prev) => ({ ...prev, [b.bountyId]: details }));
            }
          })
          .catch((err) => console.warn(`Failed to resolve settlement tx for #${b.bountyId}:`, err));
      }
    }
  }, [myBountiesOnly, creatorBounties]);

  // Current creator list filtered by lightweight search (ID or title)
  const displayedCreatorBounties = useMemo(() => {
    let list: FormattedBounty[] = [];
    if (creatorTab === 'needs-review') list = creatorCategorized.needsReview;
    else if (creatorTab === 'active') list = creatorCategorized.active;
    else if (creatorTab === 'completed') list = creatorCategorized.completed;
    else if (creatorTab === 'refunded') list = creatorCategorized.refunded;
    else list = creatorCategorized.all;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;

    const cleanIdQuery = query.startsWith('#') ? query.slice(1).trim() : query;
    return list.filter((b) => {
      return (
        b.taskTitle.toLowerCase().includes(query) ||
        String(b.bountyId) === cleanIdQuery ||
        `#${b.bountyId}` === query ||
        b.taskMetadataUri.toLowerCase().includes(query)
      );
    });
  }, [creatorTab, creatorCategorized, searchQuery]);

  // Current list filtered by search and sorted
  const displayedBounties = useMemo(() => {
    const list = exploreView === 'active' ? activeBountiesList : completedBountiesList;
    const query = searchQuery.toLowerCase().trim();

    const filtered = list.filter((b) => {
      if (!query) return true;
      const cleanIdQuery = query.startsWith('#') ? query.slice(1).trim() : query;
      return (
        b.taskTitle.toLowerCase().includes(query) ||
        b.taskMetadataUri.toLowerCase().includes(query) ||
        b.acceptanceCriteria.toLowerCase().includes(query) ||
        String(b.bountyId) === cleanIdQuery ||
        `#${b.bountyId}` === query ||
        b.creator.toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === 'reward' || sortOption === 'reward-desc') {
        return parseFloat(b.rewardMon) - parseFloat(a.rewardMon);
      }
      if (sortOption === 'reward-asc') {
        return parseFloat(a.rewardMon) - parseFloat(b.rewardMon);
      }
      if (sortOption === 'newest') {
        return b.bountyId - a.bountyId;
      }
      if (sortOption === 'deadline') {
        return a.submissionDeadlineTimestamp - b.submissionDeadlineTimestamp;
      }
      if (sortOption === 'capacity') {
        return b.slotsRemaining - a.slotsRemaining;
      }
      return 0;
    });
  }, [exploreView, activeBountiesList, completedBountiesList, searchQuery, sortOption]);

  const totalPages = Math.max(1, Math.ceil(displayedBounties.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedBounties = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return displayedBounties.slice(startIndex, startIndex + PAGE_SIZE);
  }, [displayedBounties, safeCurrentPage]);

  // Reusable Pagination Controls Element
  const paginationControlsElement = totalPages > 1 && (
    <nav className={styles.paginationControls} aria-label="Bounties pagination">
      {safeCurrentPage > 1 && (
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => {
            setCurrentPage((p) => Math.max(1, p - 1));
          }}
          aria-label="Previous page"
        >
          &larr; Previous
        </button>
      )}
      <span className={styles.paginationInfo}>
        Page {safeCurrentPage} of {totalPages}
      </span>
      {safeCurrentPage < totalPages && (
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => {
            setCurrentPage((p) => Math.min(totalPages, p + 1));
          }}
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      )}
    </nav>
  );

  // Clean empty state when search/filter returns zero matches
  const emptyFilterElement = (
    <div className={styles.emptyFilterState}>
      <Icon name="search" size={24} />
      <div className={styles.emptyFilterTitle}>No bounties found.</div>
      <p className={styles.emptyFilterSubtitle}>
        No bounties match &ldquo;{searchQuery}&rdquo;. Try adjusting your search query or sorting options.
      </p>
      <button
        type="button"
        className={styles.secondaryBtnSmall}
        onClick={() => {
          setSearchQuery('');
          setCurrentPage(1);
        }}
      >
        Clear Search
      </button>
    </div>
  );

  // 80/20 Reward calculation preview
  const parsedReward = parseFloat(formRewardMon) || 0;
  const winnerPreviewMon = (parsedReward * 0.8).toFixed(4);
  const poolPreviewMon = (parsedReward * 0.2).toFixed(4);

  // Submission deadline remaining
  const formatCountdown = (deadlineTimestamp: number) => {
    const diff = deadlineTimestamp - currentTime;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m ${seconds}s remaining`;
  };

  // Submit Work Handler
  const onSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBounty) return;
    if (!submissionProofUri.trim()) {
      alert('Please provide a valid work/proof URI.');
      return;
    }

    const res = await handleSubmitWork({
      bountyId: activeBounty.bountyId,
      proofUri: submissionProofUri.trim(),
      notes: submissionNotes.trim(),
    });

    if (res.success) {
      setShowSubmitModal(false);
      setSubmissionProofUri('');
      setSubmissionNotes('');
    }
  };

  // Create Bounty Handler
  const onCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (!formTitle.trim()) {
      setFormValidationError('Please enter a task title.');
      return;
    }
    if (!formCriteria.trim()) {
      setFormValidationError('Please define immutable acceptance criteria.');
      return;
    }

    const reward = parseFloat(formRewardMon);
    if (isNaN(reward) || reward <= 0) {
      setFormValidationError('Please enter a valid MON reward amount.');
      return;
    }

    const maxSubs = parseInt(formMaxSubmissions, 10);
    if (isNaN(maxSubs) || maxSubs < 1 || maxSubs > 10) {
      setFormValidationError('Maximum submissions must be between 1 and 10.');
      return;
    }

    const hours = parseFloat(formDurationHours);
    if (isNaN(hours) || hours <= 0) {
      setFormValidationError('Please enter a valid duration in hours.');
      return;
    }

    let resolverAddr: `0x${string}` = '0x0000000000000000000000000000000000000000';
    if (formDisputeResolver.trim()) {
      if (!isAddress(formDisputeResolver.trim())) {
        setFormValidationError('Invalid dispute resolver address.');
        return;
      }
      resolverAddr = formDisputeResolver.trim() as `0x${string}`;
    }

    const durationSeconds = Math.floor(hours * 3600);

    const res = await handleCreateBounty({
      taskTitle: formTitle.trim(),
      taskMetadataUri: formDescription.trim(),
      acceptanceCriteria: formCriteria.trim(),
      maxSubmissions: maxSubs,
      durationSeconds,
      disputeResolverAddress: resolverAddr,
      rewardMon: formRewardMon.trim(),
    });

    if (res.success) {
      setFormTitle('');
      setFormDescription('');
      setFormCriteria('');
      setFormRewardMon('0.1');
      setFormDisputeResolver('');
      if (onNavigateExplore) {
        onNavigateExplore();
      } else {
        setActiveTab('manage');
      }
      setExploreView('active');
      setSelectedBountyId(null);
      await loadAllBounties();
    }
  };

  // Live Protocol Stats Strip JSX
  const statsStripElement = (
    <section className={styles.statsStrip} aria-label="Live Protocol Statistics">
      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.tonePurple}`}>
          <Icon name="lock" size={20} />
        </div>
        <div>
          <div className={styles.statLabel}>Total Locked</div>
          <div className={styles.statValue}>{stats.totalLocked}</div>
          <div className={styles.statNote}>In active bounties</div>
        </div>
      </div>

      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.toneBlue}`}>
          <Icon name="bounty" size={20} />
        </div>
        <div>
          <div className={styles.statLabel}>Active Bounties</div>
          <div className={styles.statValue}>{stats.activeCount}</div>
          <div className={styles.statNote}>Open for contributions</div>
        </div>
      </div>

      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.toneGold}`}>
          <Icon name="trophy" size={20} />
        </div>
        <div>
          <div className={styles.statLabel}>Completed Bounties</div>
          <div className={styles.statValue}>{stats.completedCount}</div>
          <div className={styles.statNote}>Successfully settled</div>
        </div>
      </div>

      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.toneGreen}`}>
          <Icon name="coins" size={20} />
        </div>
        <div>
          <div className={styles.statLabel}>Total Paid Out</div>
          <div className={styles.statValue}>{stats.totalPaidOut}</div>
          <div className={styles.statNote}>To contributors</div>
        </div>
      </div>
    </section>
  );

  // Active Transaction Notification Toast JSX
  const txNotificationElement = txState.status !== 'idle' && (
    <div className={`${styles.txStatus} ${styles[`txStatus_${txState.status}`]}`}>
      <div className={styles.txStatusContent}>
        {txState.status === 'submitting' && (
          <>
            <span className={styles.txSpinner} />
            <span>Awaiting wallet signature...</span>
          </>
        )}
        {txState.status === 'pending' && (
          <>
            <span className={styles.txSpinner} />
            <span>Broadcasting transaction to Monad Testnet...</span>
          </>
        )}
        {txState.status === 'confirmed' && (
          <>
            <span className={styles.txIconCheck}>✓</span>
            <span>Transaction confirmed onchain</span>
          </>
        )}
        {txState.status === 'error' && (
          <>
            <span className={styles.txIconError}>✕</span>
            <span>{txState.errorMessage || 'Transaction failed.'}</span>
          </>
        )}
      </div>

      <div className={styles.txLinks}>
        {txState.hash && (
          <a
            href={getExplorerTxUrl(txState.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.txExplorerLink}
          >
            View on Monadscan &nearr;
          </a>
        )}
        <button className={styles.txDismiss} onClick={resetTxState} title="Dismiss">
          &times;
        </button>
      </div>
    </div>
  );

  // Filtered payment activity memo
  const filteredActivity = useMemo(() => {
    if (paymentFilter === 'incoming') {
      return paymentActivity.filter((p) => p.direction === 'INCOMING');
    }
    if (paymentFilter === 'outgoing') {
      return paymentActivity.filter((p) => p.direction === 'OUTGOING');
    }
    return paymentActivity;
  }, [paymentActivity, paymentFilter]);

  // Dedicated Payment Activity View Mode
  if (viewMode === 'payment-activity') {
    return (
      <div className={styles.container}>
        {txNotificationElement}
        <div className={styles.paymentPageContainer}>
          {/* Header */}
          <div className={styles.paymentPageHeader}>
            <div className={styles.exploreBreadcrumb}>
              <button
                type="button"
                className={styles.backButton}
                onClick={onNavigateHome}
                id="payment-back-home-btn"
              >
                <span className={styles.backArrowIcon}>&larr;</span>
                <span>Back to Home</span>
              </button>
              <div className={styles.exploreNetworkBadge}>
                <span className={styles.badgePulseDot} />
                <span>Monad Testnet</span>
              </div>
            </div>

            <div className={styles.paymentTitleArea}>
              <div className={styles.createEyebrow}>
                <span className={styles.eyebrowStar}>✦</span> ONCHAIN FINANCIAL LEDGER
              </div>
              <h2 className={styles.paymentPageTitle}>Payment Activity & Settlement History</h2>
              <p className={styles.paymentPageSubtitle}>
                Real-time verified onchain settlements, creator funding deposits, winner rewards, and participation disbursements on Monad.
              </p>
            </div>
          </div>

          {!wallet.isConnected ? (
            <div className={styles.walletPromptCard}>
              <div className={styles.walletPromptIcon}>
                <Icon name="wallet" size={32} />
              </div>
              <h3 className={styles.walletPromptTitle}>Connect Wallet to View Payment Activity</h3>
              <p className={styles.walletPromptText}>
                Connect your EVM wallet on Monad Testnet to view your creator funding, earned rewards, and real onchain settlement transactions.
              </p>
              <button
                className={styles.buttonPrimary}
                onClick={wallet.connectWallet}
                id="payment-connect-wallet-btn"
              >
                <Icon name="wallet" size={16} />
                <span>Connect Wallet</span>
              </button>
            </div>
          ) : (
            <>
              {/* Financial Overview Cards */}
              <div className={styles.financialOverviewGrid}>
                {/* CREATOR FINANCIAL OVERVIEW */}
                <div className={styles.financialCard}>
                  <div className={styles.financialCardTop}>
                    <div className={styles.financialRoleBadgeCreator}>
                      <Icon name="file" size={13} />
                      <span>CREATOR FINANCIALS</span>
                    </div>
                    <span className={styles.financialCardNote}>Outbound & Refunds</span>
                  </div>

                  <div className={styles.financialMetricsList}>
                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Total Escrow Funded</span>
                      <span className={styles.metricValue}>
                        {paymentSummary?.creator.totalFundedMon ?? '0.00'} MON
                      </span>
                    </div>

                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Total Paid to Contributors</span>
                      <span className={styles.metricValueGreen}>
                        {paymentSummary?.creator.totalPaidMon ?? '0.00'} MON
                      </span>
                    </div>

                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Total Refunded to Creator</span>
                      <span className={styles.metricValueGold}>
                        {paymentSummary?.creator.totalRefundedMon ?? '0.00'} MON
                      </span>
                    </div>
                  </div>
                </div>

                {/* CONTRIBUTOR FINANCIAL OVERVIEW */}
                <div className={styles.financialCard}>
                  <div className={styles.financialCardTop}>
                    <div className={styles.financialRoleBadgeContributor}>
                      <Icon name="coins" size={13} />
                      <span>CONTRIBUTOR EARNINGS</span>
                    </div>
                    <span className={styles.financialCardNote}>Verified Inbound</span>
                  </div>

                  <div className={styles.financialMetricsList}>
                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Total Earned</span>
                      <span className={styles.metricValueGreenHighlight}>
                        {paymentSummary?.contributor.totalEarnedMon ?? '0.00'} MON
                      </span>
                    </div>

                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Winner Rewards (80% + dust)</span>
                      <span className={styles.metricValueGreen}>
                        {paymentSummary?.contributor.winnerRewardsMon ?? '0.00'} MON
                      </span>
                    </div>

                    <div className={styles.financialMetricRow}>
                      <span className={styles.metricLabel}>Participation Rewards (20% pool)</span>
                      <span className={styles.metricValuePurple}>
                        {paymentSummary?.contributor.participationRewardsMon ?? '0.00'} MON
                      </span>
                    </div>

                    {paymentSummary && BigInt(paymentSummary.contributor.pendingClaimableWei) > 0n && (
                      <div className={styles.claimableCallout}>
                        <div className={styles.claimableText}>
                          <span>Pending Fallback Pull Reward:</span>
                          <strong>{paymentSummary.contributor.pendingClaimableMon} MON</strong>
                        </div>
                        <button
                          className={styles.buttonClaimSmall}
                          onClick={handleClaimReward}
                        >
                          Withdraw
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment History Section */}
              <div className={styles.historySection}>
                <div className={styles.historySectionHeader}>
                  <div className={styles.historyTitleGroup}>
                    <h3 className={styles.historyTitle}>Payment History & Settlement Transactions</h3>
                    <span className={styles.historyCount}>
                      {filteredActivity.length} {filteredActivity.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>

                  {/* Filter Pills */}
                  <div className={styles.filterPills}>
                    <button
                      className={`${styles.filterPill} ${paymentFilter === 'all' ? styles.filterPillActive : ''}`}
                      onClick={() => setPaymentFilter('all')}
                    >
                      All ({paymentActivity.length})
                    </button>
                    <button
                      className={`${styles.filterPill} ${paymentFilter === 'incoming' ? styles.filterPillActive : ''}`}
                      onClick={() => setPaymentFilter('incoming')}
                    >
                      Incoming ({paymentActivity.filter((p) => p.direction === 'INCOMING').length})
                    </button>
                    <button
                      className={`${styles.filterPill} ${paymentFilter === 'outgoing' ? styles.filterPillActive : ''}`}
                      onClick={() => setPaymentFilter('outgoing')}
                    >
                      Outgoing ({paymentActivity.filter((p) => p.direction === 'OUTGOING').length})
                    </button>
                  </div>
                </div>

                {isLoadingPayments ? (
                  <div className={styles.loadingBox}>
                    <div className={styles.loadingSpinner} />
                    <p>Loading onchain payment activity from Monad Testnet...</p>
                  </div>
                ) : filteredActivity.length === 0 ? (
                  <div className={styles.emptyActivityCard}>
                    <div className={styles.emptyIcon}>
                      <Icon name="coins" size={36} />
                    </div>
                    <h4>No Payment Activity Found</h4>
                    <p>
                      You haven&apos;t created or contributed to any settled bounties with this wallet yet.
                    </p>
                    <div className={styles.emptyActions}>
                      <button
                        className={styles.buttonPrimary}
                        onClick={onNavigateExplore}
                      >
                        Explore Bounties
                      </button>
                      <button
                        className={styles.buttonSecondary}
                        onClick={onNavigateCreate}
                      >
                        Create a Bounty
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.activityList}>
                    {filteredActivity.map((item) => {
                      const isIncoming = item.direction === 'INCOMING';
                      const txHash = item.txHash || getCachedSettlementTx(item.bountyId)?.txHash;
                      const explorerUrl = item.explorerUrl || (txHash ? getExplorerTxUrl(txHash) : undefined);

                      return (
                        <div key={item.id} className={styles.activityCard}>
                          <div className={styles.activityCardTop}>
                            <div className={styles.activityTypeBadgeGroup}>
                              <span
                                className={
                                  isIncoming
                                    ? styles.directionBadgeIncoming
                                    : styles.directionBadgeOutgoing
                                }
                              >
                                {isIncoming ? '↓ INCOMING' : '↑ OUTGOING'}
                              </span>
                              <span className={styles.activityTypeLabel}>{item.typeLabel}</span>
                            </div>

                            <div className={styles.activityAmountGroup}>
                              <span
                                className={
                                  isIncoming
                                    ? styles.activityAmountIncoming
                                    : styles.activityAmountOutgoing
                                }
                              >
                                {isIncoming ? '+' : '-'}{item.amountMon} MON
                              </span>
                              <span className={styles.statusConfirmedBadge}>
                                ✓ {item.status}
                              </span>
                            </div>
                          </div>

                          <div className={styles.activityCardMiddle}>
                            {item.bountyId > 0 && (
                              <button
                                className={styles.bountyRefLink}
                                onClick={() => {
                                  setSelectedBountyId(item.bountyId);
                                  loadBounty(item.bountyId);
                                  if (onNavigateExplore) onNavigateExplore();
                                }}
                                title="Click to inspect this bounty in detail"
                              >
                                <Icon name="file" size={12} />
                                <span>
                                  Bounty #{item.bountyId}: {item.bountyTitle || 'Work Deliverable'}
                                </span>
                              </button>
                            )}

                            {item.notes && (
                              <p className={styles.activityNotes}>{item.notes}</p>
                            )}
                          </div>

                          <div className={styles.activityCardBottom}>
                            <div className={styles.activityCounterparty}>
                              <span className={styles.counterpartyLabel}>
                                {item.counterpartyRole ? `${item.counterpartyRole}: ` : 'Counterparty: '}
                              </span>
                              <span className={styles.counterpartyAddress}>
                                {item.counterparty
                                  ? `${item.counterparty.slice(0, 8)}...${item.counterparty.slice(-6)}`
                                  : 'Monad Protocol'}
                              </span>
                            </div>

                            <div className={styles.activityTxGroup}>
                              {txHash ? (
                                <div className={styles.txHashRow}>
                                  <span className={styles.txLabel}>TX:</span>
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.txLink}
                                    title={`View on Monadscan: ${txHash}`}
                                  >
                                    <span className={styles.txHashText}>
                                      {txHash.slice(0, 8)}...{txHash.slice(-6)}
                                    </span>
                                    <Icon name="external" size={11} />
                                  </a>
                                  <button
                                    type="button"
                                    className={styles.copyTxBtn}
                                    onClick={(e) => handleCopyTx(txHash, e)}
                                    title="Copy transaction hash"
                                  >
                                    <Icon
                                      name={copiedTxHash === txHash ? 'check-copy' : 'copy'}
                                      size={11}
                                    />
                                  </button>
                                </div>
                              ) : item.bountyId > 0 ? (
                                <span className={styles.resolvingTxSmall}>
                                  <span className={styles.buttonSpinner} /> Resolving TX...
                                </span>
                              ) : null}

                              <span className={styles.activityDate}>
                                {item.dateFormatted}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // If viewMode is 'home-stats', only render the live protocol statistics strip
  if (viewMode === 'home-stats') {
    return (
      <div id="stats" className={styles.statsContainer}>
        {txNotificationElement}
        {statsStripElement}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {viewMode === 'all' && statsStripElement}

      {/* Main Marketplace / Dedicated View Container */}
      <div id="bounties" className={styles.marketplaceBox}>
        {txNotificationElement}

        {/* Dedicated Explore Bounties / Creator Workspace Header */}
        {viewMode === 'bounties' && selectedBountyId === null && (
          myBountiesOnly ? (
            <div className={styles.creatorPageHeader}>
              <div className={styles.creatorBreadcrumb}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={onNavigateExplore || onNavigateHome}
                  id="creator-back-explore-btn"
                >
                  <span className={styles.backArrowIcon}>&larr;</span>
                  <span>Back to Explore Bounties</span>
                </button>
                <div className={styles.exploreNetworkBadge}>
                  <span className={styles.badgePulseDot} />
                  <span>Monad Testnet</span>
                </div>
              </div>
              <div className={styles.creatorTitleArea}>
                <div className={styles.creatorEyebrow}>
                  <span className={styles.eyebrowStar}>✦</span> CREATOR WORKSPACE
                </div>
                <h2 className={styles.creatorPageTitle}>
                  <span>My Bounties</span>
                  {creatorNeedsReviewCount > 0 && (
                    <span className={styles.creatorCountBadgeAlert}>
                      {creatorNeedsReviewCount} Ready for Review
                    </span>
                  )}
                </h2>
                <p className={styles.creatorPageSubtitle}>
                  Manage your created bounties, review contributor deliverables, and disburse onchain rewards.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.explorePageHeader}>
              <div className={styles.exploreBreadcrumb}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={onNavigateHome}
                  id="explore-back-home-btn"
                >
                  <span className={styles.backArrowIcon}>&larr;</span>
                  <span>Back to Home</span>
                </button>
                <div className={styles.exploreNetworkBadge}>
                  <span className={styles.badgePulseDot} />
                  <span>Monad Testnet</span>
                </div>
              </div>
              <div className={styles.exploreTitleArea}>
                <h2 className={styles.explorePageTitle}>Explore Work Bounties</h2>
                <p className={styles.explorePageSubtitle}>
                  Browse active onchain work bounties, inspect criteria, and submit deliverables for guaranteed protocol settlement.
                </p>
              </div>
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* TAB 1: EXPLORE BOUNTIES */}
        {/* ========================================================================= */}
        {activeTab === 'manage' && (
          <div className={styles.section}>
            {/* If no specific bounty selected: Discovery List View */}
            {selectedBountyId === null ? (
              myBountiesOnly ? (
                <div className={styles.discoveryWrapper}>
                  {!wallet.isConnected ? (
                    <div className={styles.creatorDisconnectedCard}>
                      <div className={styles.creatorPromptIcon}>
                        <Icon name="wallet" size={32} />
                      </div>
                      <h3 className={styles.creatorPromptTitle}>Connect your wallet to view your bounties</h3>
                      <p className={styles.creatorPromptText}>
                        Connect your EVM wallet on Monad Testnet to view your created bounties, evaluate submissions against criteria, and disburse guaranteed onchain rewards.
                      </p>
                      <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={wallet.connectWallet}
                        id="creator-connect-wallet-btn"
                      >
                        <Icon name="wallet" size={16} />
                        <span>Connect Wallet</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Review Priority Attention Banner */}
                      {creatorCategorized.needsReview.length > 0 && (
                        <div className={styles.reviewPriorityBanner}>
                          <div className={styles.reviewPriorityLeft}>
                            <span className={styles.priorityAlertIcon}>⚡</span>
                            <div>
                              <div className={styles.priorityAlertTitle}>
                                Action Required: {creatorCategorized.needsReview.length}{' '}
                                {creatorCategorized.needsReview.length === 1 ? 'bounty requires' : 'bounties require'} your review
                              </div>
                              <div className={styles.priorityAlertSubtitle}>
                                Submissions have closed. Review deliverables against Acceptance Criteria and select a winner before the review window closes.
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.priorityAlertBtn}
                            onClick={() => {
                              setCreatorTab('needs-review');
                              setSearchQuery('');
                            }}
                            id="banner-jump-review-btn"
                          >
                            Review Now &rarr;
                          </button>
                        </div>
                      )}

                      {/* Discovery Sub-tabs & Filter Controls for Creator Workspace */}
                      <div className={styles.discoveryHeader}>
                        <div className={styles.creatorNavTabs} role="tablist" aria-label="Creator Bounties Tabs">
                          <button
                            type="button"
                            className={`${styles.creatorNavTab} ${creatorTab === 'needs-review' ? styles.creatorNavTabActive : ''}`}
                            onClick={() => setCreatorTab('needs-review')}
                            id="creator-tab-needs-review"
                            role="tab"
                            aria-selected={creatorTab === 'needs-review'}
                          >
                            <Icon name="file" size={14} />
                            <span>Needs Review</span>
                            <span
                              className={`${styles.creatorCountBadge} ${
                                creatorCategorized.needsReview.length > 0 ? styles.creatorCountBadgeAlert : ''
                              }`}
                            >
                              {creatorCategorized.needsReview.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.creatorNavTab} ${creatorTab === 'active' ? styles.creatorNavTabActive : ''}`}
                            onClick={() => setCreatorTab('active')}
                            id="creator-tab-active"
                            role="tab"
                            aria-selected={creatorTab === 'active'}
                          >
                            <Icon name="bounty" size={14} />
                            <span>Active</span>
                            <span className={styles.creatorCountBadge}>
                              {creatorCategorized.active.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.creatorNavTab} ${creatorTab === 'completed' ? styles.creatorNavTabActive : ''}`}
                            onClick={() => setCreatorTab('completed')}
                            id="creator-tab-completed"
                            role="tab"
                            aria-selected={creatorTab === 'completed'}
                          >
                            <Icon name="check" size={14} />
                            <span>Completed</span>
                            <span className={styles.creatorCountBadge}>
                              {creatorCategorized.completed.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.creatorNavTab} ${creatorTab === 'refunded' ? styles.creatorNavTabActive : ''}`}
                            onClick={() => setCreatorTab('refunded')}
                            id="creator-tab-refunded"
                            role="tab"
                            aria-selected={creatorTab === 'refunded'}
                          >
                            <Icon name="coins" size={14} />
                            <span>Refunded</span>
                            <span className={styles.creatorCountBadge}>
                              {creatorCategorized.refunded.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.creatorNavTab} ${creatorTab === 'all' ? styles.creatorNavTabActive : ''}`}
                            onClick={() => setCreatorTab('all')}
                            id="creator-tab-all"
                            role="tab"
                            aria-selected={creatorTab === 'all'}
                          >
                            <Icon name="grid" size={14} />
                            <span>All</span>
                            <span className={styles.creatorCountBadge}>
                              {creatorCategorized.all.length}
                            </span>
                          </button>
                        </div>

                        {/* Search, Sort & Create Action Controls */}
                        <div className={styles.filterControls}>
                          <div className={styles.searchForm}>
                            <span className={styles.searchIcon}>
                              <Icon name="search" size={14} />
                            </span>
                            <input
                              type="text"
                              className={styles.searchInput}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search your bounties by title or #ID..."
                              id="creator-bounties-search-input"
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                className={styles.searchClear}
                                onClick={() => setSearchQuery('')}
                              >
                                &times;
                              </button>
                            )}
                          </div>

                          <button
                            className={styles.quickCreateBtn}
                            onClick={() => {
                              if (onNavigateCreate) {
                                onNavigateCreate();
                              } else {
                                setActiveTab('create');
                              }
                              resetTxState();
                            }}
                            id="creator-discovery-create-btn"
                          >
                            <Icon name="plus" size={13} />
                            <span>Create Bounty</span>
                          </button>
                        </div>
                      </div>

                      {/* Loading State */}
                      {isLoadingCreatorBounties && creatorBounties.length === 0 && (
                        <div className={styles.loadingDiscovery}>
                          <span className={styles.txSpinner} />
                          <span>Loading your creator bounties from Monad Testnet...</span>
                        </div>
                      )}

                      {/* Empty States */}
                      {displayedCreatorBounties.length === 0 && !isLoadingCreatorBounties && (
                        creatorCategorized.all.length === 0 ? (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="file" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>You haven&apos;t created any bounties yet.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              Publish an onchain work bounty with immutable criteria and guaranteed code settlement on Monad.
                            </p>
                            <div className={styles.creatorEmptyActions}>
                              <button
                                className={styles.buttonPrimary}
                                onClick={() => {
                                  if (onNavigateCreate) onNavigateCreate();
                                  else setActiveTab('create');
                                }}
                                id="creator-empty-create-btn"
                              >
                                <Icon name="plus" size={14} />
                                <span>Create a Bounty</span>
                              </button>
                            </div>
                          </div>
                        ) : searchQuery.trim() ? (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="search" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>No bounties found.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              No bounties match &ldquo;{searchQuery}&rdquo;. Try adjusting your search query.
                            </p>
                            <div className={styles.creatorEmptyActions}>
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={() => setSearchQuery('')}
                              >
                                Clear Search
                              </button>
                            </div>
                          </div>
                        ) : creatorTab === 'needs-review' ? (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="check" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>No bounties need your review right now.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              All your bounties are either still accepting submissions or have already been settled.
                            </p>
                            <div className={styles.creatorEmptyActions}>
                              <button
                                type="button"
                                className={styles.buttonSecondary}
                                onClick={onNavigateExplore}
                                id="needs-review-empty-explore-btn"
                              >
                                Explore Bounties
                              </button>
                              <button
                                type="button"
                                className={styles.buttonPrimary}
                                onClick={() => {
                                  if (onNavigateCreate) onNavigateCreate();
                                  else setActiveTab('create');
                                }}
                                id="needs-review-empty-create-btn"
                              >
                                <Icon name="plus" size={14} />
                                <span>Create a Bounty</span>
                              </button>
                            </div>
                          </div>
                        ) : creatorTab === 'active' ? (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="bounty" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>No active bounties accepting submissions.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              Launch a new bounty to start receiving permissionless contributions.
                            </p>
                            <div className={styles.creatorEmptyActions}>
                              <button
                                type="button"
                                className={styles.buttonPrimary}
                                onClick={() => {
                                  if (onNavigateCreate) onNavigateCreate();
                                  else setActiveTab('create');
                                }}
                                id="active-empty-create-btn"
                              >
                                <Icon name="plus" size={14} />
                                <span>Create a Bounty</span>
                              </button>
                            </div>
                          </div>
                        ) : creatorTab === 'completed' ? (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="check" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>No completed bounties yet.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              Bounties you have settled and disbursed will appear here.
                            </p>
                          </div>
                        ) : (
                          <div className={styles.creatorEmptyCard}>
                            <div className={styles.creatorEmptyIcon}>
                              <Icon name="coins" size={24} />
                            </div>
                            <h3 className={styles.creatorEmptyTitle}>No refunded bounties.</h3>
                            <p className={styles.creatorEmptySubtitle}>
                              Bounties that reached deadline with zero submissions and were refunded will appear here.
                            </p>
                          </div>
                        )
                      )}

                      {/* Creator Bounties Grid */}
                      {displayedCreatorBounties.length > 0 && (
                        <div className={styles.creatorBountiesGrid}>
                          {displayedCreatorBounties.map((bounty) => {
                            const classification = classifyCreatorBounty(bounty, currentTime);
                            const isNeedsRev = classification.isNeedsReview;
                            const isComp = classification.isCompleted;
                            const isRef = classification.isRefunded;
                            const isDisp = classification.isDisputeReview;
                            const txDetails = creatorTxMap[bounty.bountyId];

                            return (
                              <article
                                key={bounty.bountyId}
                                className={`${styles.creatorCard} ${
                                  isNeedsRev
                                    ? styles.creatorCardNeedsReview
                                    : isComp
                                    ? styles.creatorCardCompleted
                                    : isRef
                                    ? styles.creatorCardRefunded
                                    : isDisp
                                    ? styles.creatorCardDispute
                                    : ''
                                }`}
                              >
                                {/* Top Row: ID, Status, Reward */}
                                <div className={styles.creatorCardTop}>
                                  <div className={styles.creatorCardBadgeGroup}>
                                    <span className={styles.creatorBountyIdBadge}>
                                      #{bounty.bountyId}
                                    </span>
                                    <span
                                      className={`${styles.creatorStatusBadge} ${
                                        isNeedsRev
                                          ? styles.creatorStatusNeedsReview
                                          : isComp
                                          ? styles.creatorStatusCompleted
                                          : isRef
                                          ? styles.creatorStatusRefunded
                                          : isDisp
                                          ? styles.creatorStatusDispute
                                          : styles.creatorStatusActive
                                      }`}
                                    >
                                      {isNeedsRev && <span className={styles.creatorPulseDot} />}
                                      {classification.statusLabel}
                                    </span>
                                  </div>

                                  <div className={styles.creatorCardReward}>
                                    <span className={styles.creatorCardRewardLabel}>Reward</span>
                                    <span>{bounty.rewardMon} MON</span>
                                  </div>
                                </div>

                                {/* Body: Title & Specific Metrics */}
                                <div className={styles.creatorCardBody}>
                                  <h3 className={styles.creatorCardTitle}>{bounty.taskTitle}</h3>

                                  <div className={styles.creatorMetricsGrid}>
                                    <div className={styles.creatorMetricItem}>
                                      <span className={styles.creatorMetricLabel}>Submissions</span>
                                      <span className={styles.creatorMetricVal}>
                                        {bounty.submissionCount} / {bounty.maxSubmissions}
                                      </span>
                                      <div className={styles.creatorMiniProgressBar}>
                                        <div
                                          className={styles.creatorMiniProgressFill}
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              (bounty.submissionCount / Math.max(1, bounty.maxSubmissions)) * 100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {isNeedsRev && (
                                      <>
                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Review Window</span>
                                          <span className={styles.creatorMetricValAlert}>
                                            {bounty.reviewDeadlineTimestamp > 0
                                              ? formatCountdown(bounty.reviewDeadlineTimestamp)
                                              : 'Review Window Active'}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Review Deadline</span>
                                          <span className={styles.creatorMetricVal}>
                                            {bounty.reviewDeadlineDate}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Winner (80%)</span>
                                          <span className={styles.creatorMetricValHighlight}>
                                            {bounty.winnerMon} MON
                                          </span>
                                        </div>
                                      </>
                                    )}

                                    {classification.isActive && (
                                      <>
                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Time Left</span>
                                          <span className={styles.creatorMetricVal}>
                                            {formatCountdown(bounty.submissionDeadlineTimestamp)}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Deadline</span>
                                          <span className={styles.creatorMetricVal}>
                                            {bounty.submissionDeadlineDate}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Slots Open</span>
                                          <span className={styles.creatorMetricVal}>
                                            {bounty.slotsRemaining} of {bounty.maxSubmissions}
                                          </span>
                                        </div>
                                      </>
                                    )}

                                    {isComp && (
                                      <>
                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Winner</span>
                                          <span className={styles.creatorMetricValMono}>
                                            {bounty.winnerAddress
                                              ? `${bounty.winnerAddress.slice(0, 6)}...${bounty.winnerAddress.slice(-4)}`
                                              : `Submission #${bounty.winnerSubmissionId}`}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Winner Payout</span>
                                          <span className={styles.creatorMetricValHighlight}>
                                            {bounty.winnerMon} MON
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Settled At</span>
                                          <span className={styles.creatorMetricVal}>
                                            {bounty.settledAtDate || 'Onchain'}
                                          </span>
                                        </div>

                                        {txDetails?.txHash ? (
                                          <div className={styles.creatorTxRow}>
                                            <span className={styles.creatorTxLabel}>Settlement TX:</span>
                                            <a
                                              href={txDetails.explorerUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={styles.creatorTxLink}
                                              title={`Inspect on Monadscan: ${txDetails.txHash}`}
                                            >
                                              <span>
                                                {txDetails.txHash.slice(0, 8)}...{txDetails.txHash.slice(-6)}
                                              </span>
                                              <Icon name="external" size={11} />
                                            </a>
                                            <button
                                              type="button"
                                              className={styles.copyTxBtn}
                                              onClick={(e) => handleCopyTx(txDetails.txHash, e)}
                                              title="Copy settlement transaction hash"
                                            >
                                              <Icon
                                                name={copiedTxHash === txDetails.txHash ? 'check-copy' : 'copy'}
                                                size={11}
                                              />
                                            </button>
                                          </div>
                                        ) : bounty.bountyId > 0 ? (
                                          <div className={styles.creatorTxRow}>
                                            <span className={styles.resolvingTxSmall}>
                                              <span className={styles.buttonSpinner} /> Resolving TX...
                                            </span>
                                          </div>
                                        ) : null}
                                      </>
                                    )}

                                    {isRef && (
                                      <>
                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Refund Status</span>
                                          <span className={styles.creatorMetricVal}>
                                            {bounty.state === BountyState.Refunded
                                              ? 'Claimed onchain'
                                              : 'Eligible to reclaim'}
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Refund Amount</span>
                                          <span className={styles.creatorMetricValHighlight}>
                                            {bounty.rewardMon} MON (100%)
                                          </span>
                                        </div>

                                        {bounty.state === BountyState.Refunded && txDetails?.txHash ? (
                                          <div className={styles.creatorTxRow}>
                                            <span className={styles.creatorTxLabel}>Refund TX:</span>
                                            <a
                                              href={txDetails.explorerUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={styles.creatorTxLink}
                                              title={`Inspect on Monadscan: ${txDetails.txHash}`}
                                            >
                                              <span>
                                                {txDetails.txHash.slice(0, 8)}...{txDetails.txHash.slice(-6)}
                                              </span>
                                              <Icon name="external" size={11} />
                                            </a>
                                            <button
                                              type="button"
                                              className={styles.copyTxBtn}
                                              onClick={(e) => handleCopyTx(txDetails.txHash, e)}
                                              title="Copy refund transaction hash"
                                            >
                                              <Icon
                                                name={copiedTxHash === txDetails.txHash ? 'check-copy' : 'copy'}
                                                size={11}
                                              />
                                            </button>
                                          </div>
                                        ) : bounty.state === BountyState.Refunded ? (
                                          <div className={styles.creatorTxRow}>
                                            <span className={styles.resolvingTxSmall}>
                                              <span className={styles.buttonSpinner} /> Resolving TX...
                                            </span>
                                          </div>
                                        ) : null}
                                      </>
                                    )}

                                    {isDisp && (
                                      <>
                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Status Notice</span>
                                          <span className={styles.creatorMetricVal}>
                                            Review window expired
                                          </span>
                                        </div>

                                        <div className={styles.creatorMetricItem}>
                                          <span className={styles.creatorMetricLabel}>Resolver</span>
                                          <span className={styles.creatorMetricValMono}>
                                            {bounty.disputeResolver.slice(0, 6)}...{bounty.disputeResolver.slice(-4)}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Action Row */}
                                <div className={styles.creatorCardActions}>
                                  {isNeedsRev && (
                                    <button
                                      type="button"
                                      className={styles.creatorBtnReview}
                                      onClick={() => handleViewBounty(bounty.bountyId)}
                                      id={`creator-review-btn-${bounty.bountyId}`}
                                    >
                                      <span>Review Submissions</span>
                                      <Icon name="arrow" size={14} />
                                    </button>
                                  )}

                                  {classification.isActive && (
                                    <button
                                      type="button"
                                      className={styles.creatorBtnView}
                                      onClick={() => handleViewBounty(bounty.bountyId)}
                                      id={`creator-view-active-btn-${bounty.bountyId}`}
                                    >
                                      <span>View Bounty</span>
                                      <Icon name="arrow" size={14} />
                                    </button>
                                  )}

                                  {isComp && (
                                    <button
                                      type="button"
                                      className={styles.creatorBtnView}
                                      onClick={() => handleViewBounty(bounty.bountyId)}
                                      id={`creator-view-settled-btn-${bounty.bountyId}`}
                                    >
                                      <span>View Settlement</span>
                                      <Icon name="arrow" size={14} />
                                    </button>
                                  )}

                                  {isRef && (
                                    bounty.state === BountyState.Refunded ? (
                                      <button
                                        type="button"
                                        className={styles.creatorBtnView}
                                        onClick={() => handleViewBounty(bounty.bountyId)}
                                        id={`creator-view-refunded-btn-${bounty.bountyId}`}
                                      >
                                        <span>View Refund</span>
                                        <Icon name="arrow" size={14} />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className={styles.creatorBtnRefund}
                                        onClick={() => handleClaimRefund(bounty.bountyId)}
                                        id={`creator-claim-refund-btn-${bounty.bountyId}`}
                                      >
                                        <span>Claim Refund ({bounty.rewardMon} MON)</span>
                                      </button>
                                    )
                                  )}

                                  {isDisp && (
                                    <button
                                      type="button"
                                      className={styles.creatorBtnView}
                                      onClick={() => handleViewBounty(bounty.bountyId)}
                                      id={`creator-view-dispute-btn-${bounty.bountyId}`}
                                    >
                                      <span>View Bounty</span>
                                      <Icon name="arrow" size={14} />
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.discoveryWrapper}>
                {/* Discovery Sub-tabs & Filter Controls */}
                <div className={styles.discoveryHeader}>
                  <div className={styles.subTabGroup}>
                    <button
                      className={`${styles.subTabButton} ${exploreView === 'active' ? styles.subTabActive : ''}`}
                      onClick={() => setExploreView('active')}
                    >
                      <Icon name="bounty" size={14} />
                      <span>Active Bounties</span>
                      <span className={styles.countBadge}>{activeBountiesList.length}</span>
                    </button>
                    <button
                      className={`${styles.subTabButton} ${exploreView === 'completed' ? styles.subTabActive : ''}`}
                      onClick={() => setExploreView('completed')}
                    >
                      <Icon name="check" size={14} />
                      <span>Completed Bounties</span>
                      <span className={styles.countBadge}>{completedBountiesList.length}</span>
                    </button>
                  </div>

                  {/* Search, Sort & Create Action Controls */}
                  <div className={styles.filterControls}>
                    <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                      <span className={styles.searchIcon}>
                        <Icon name="search" size={14} />
                      </span>
                      <input
                        type="text"
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by title or bounty ID..."
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className={styles.searchClear}
                          onClick={() => {
                            setSearchQuery('');
                            setCurrentPage(1);
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </form>

                    <div className={styles.sortWrapper}>
                      <span className={styles.sortLabel}>Sort:</span>
                      <select
                        className={styles.sortSelect}
                        value={sortOption}
                        onChange={(e) => {
                          setSortOption(e.target.value as SortOption);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="reward-desc">Highest Reward</option>
                        <option value="reward-asc">Lowest Reward</option>
                        <option value="newest">Newest</option>
                        <option value="deadline">Ending Soon</option>
                        <option value="capacity">Most Capacity</option>
                      </select>
                    </div>

                    <button
                      className={styles.quickCreateBtn}
                      onClick={() => {
                        if (onNavigateCreate) {
                          onNavigateCreate();
                        } else {
                          setActiveTab('create');
                        }
                        resetTxState();
                      }}
                      id="discovery-create-bounty-btn"
                    >
                      <Icon name="plus" size={13} />
                      <span>Create Bounty</span>
                    </button>

                    {claimableReward > BigInt(0) && (
                      <button className={styles.claimButton} onClick={() => handleClaimReward()}>
                        Claim Pool ({(Number(claimableReward) / 1e18).toFixed(4)} MON)
                      </button>
                    )}
                  </div>
                </div>

                {/* Loading State */}
                {isLoadingAllBounties && allBounties.length === 0 && (
                  <div className={styles.loadingDiscovery}>
                    <span className={styles.txSpinner} />
                    <span>Loading onchain bounties...</span>
                  </div>
                )}

                {/* ACTIVE BOUNTIES VIEW */}
                {exploreView === 'active' && (
                  <>
                    {displayedBounties.length === 0 && !isLoadingAllBounties ? (
                      searchQuery.trim() ? (
                        emptyFilterElement
                      ) : (
                        /* Reference-inspired Empty State */
                        <div className={styles.emptyStateCard}>
                          <div className={`${styles.emptyIcon} ${styles.tonePurple}`}>
                            <Image
                              src="/settlex-logo.png"
                              alt="SettleX"
                              width={36}
                              height={26}
                              priority
                              unoptimized
                              style={{ objectFit: 'contain' }}
                            />
                          </div>
                          <div className={styles.emptyCopy}>
                            <h2>No active bounties yet.</h2>
                            <p>
                              Be the first creator to publish an onchain bounty and start receiving
                              contributions.
                            </p>
                            <div className={styles.emptyButtons}>
                              <button
                                className={styles.primaryBtnSmall}
                                onClick={() => setActiveTab('create')}
                              >
                                <span>Create your first bounty</span>
                                <Icon name="arrow" size={14} />
                              </button>
                              <button
                                className={styles.secondaryBtnSmall}
                                onClick={() => setExploreView('completed')}
                              >
                                Explore completed bounties
                              </button>
                            </div>
                          </div>
                          <div className={styles.emptyIllustration} aria-hidden="true">
                            <div className={styles.docGlow}>
                              <span />
                              <span />
                              <span />
                              <b>
                                <Icon name="plus" size={24} />
                              </b>
                            </div>
                            <div className={styles.illustrationLine} />
                          </div>
                        </div>
                      )
                    ) : (
                      <>
                        <div className={styles.bountyGrid}>
                          {paginatedBounties.map((b) => (
                            <div key={b.bountyId} className={styles.cardItem}>
                              {/* Card Top: ID & State */}
                              <div className={styles.cardItemTop}>
                                <div className={styles.cardIdGroup}>
                                  <span className={styles.cardId}>Bounty #{b.bountyId}</span>
                                  <span className={`${styles.statusBadge} ${styles[`status_${b.state}`]}`}>
                                    {b.stateLabel}
                                  </span>
                                </div>
                                <span className={styles.cardDeadline}>
                                  {b.state === BountyState.Open
                                    ? formatCountdown(b.submissionDeadlineTimestamp)
                                    : b.stateLabel}
                                </span>
                              </div>

                              {/* Card Title & Description */}
                              <div className={styles.cardItemBody}>
                                <h3 className={styles.cardTitle}>{b.taskTitle}</h3>
                                {b.taskMetadataUri && (
                                  <p className={styles.cardDesc}>
                                    {b.taskMetadataUri.length > 90
                                      ? `${b.taskMetadataUri.slice(0, 90)}...`
                                      : b.taskMetadataUri}
                                  </p>
                                )}
                              </div>

                              {/* 80/20 Reward Allocation Highlights */}
                              <div className={styles.cardRewardBox}>
                                <div className={styles.cardRewardMain}>
                                  <span className={styles.cardRewardLabel}>Reward</span>
                                  <span className={styles.cardRewardValue}>{b.rewardMon} MON</span>
                                </div>
                                <div className={styles.cardRewardSplits}>
                                  <div className={styles.cardSplit}>
                                    <span className={styles.cardSplitLabel}>Winner (80%)</span>
                                    <span className={`${styles.cardSplitValue} ${styles.winnerColor}`}>
                                      {b.winnerMon} MON
                                    </span>
                                  </div>
                                  <div className={styles.cardSplit}>
                                    <span className={styles.cardSplitLabel}>Pool (20%)</span>
                                    <span className={`${styles.cardSplitValue} ${styles.poolColor}`}>
                                      {b.participationPoolMon} MON
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Submission Progress & Creator */}
                              <div className={styles.cardFooter}>
                                <div className={styles.cardMetaCol}>
                                  <span className={styles.cardMetaLabel}>Submissions</span>
                                  <div className={styles.cardProgressWrapper}>
                                    <span className={styles.cardProgressText}>
                                      {b.submissionCount} / {b.maxSubmissions}
                                    </span>
                                    <div className={styles.progressBar}>
                                      <div
                                        className={styles.progressFill}
                                        style={{
                                          width: `${(b.submissionCount / b.maxSubmissions) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className={styles.cardMetaCol}>
                                  <span className={styles.cardMetaLabel}>Creator</span>
                                  <span className={styles.cardMetaMono}>
                                    {b.creator.slice(0, 6)}...{b.creator.slice(-4)}
                                  </span>
                                </div>
                              </div>

                              {/* CTA Button */}
                              <button
                                className={styles.buttonCardCta}
                                onClick={() => handleViewBounty(b.bountyId)}
                              >
                                <span>View Bounty</span>
                                <Icon name="arrow" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {paginationControlsElement}
                      </>
                    )}
                  </>
                )}

                {/* COMPLETED BOUNTIES VIEW */}
                {exploreView === 'completed' && (
                  <>
                    {displayedBounties.length === 0 && !isLoadingAllBounties ? (
                      searchQuery.trim() ? (
                        emptyFilterElement
                      ) : (
                        <div className={styles.emptyDiscovery}>
                          <div className={styles.emptyTitle}>No completed bounties yet.</div>
                          <p className={styles.emptySubtitle}>
                            Bounties that have been reviewed and settled will appear here.
                          </p>
                        </div>
                      )
                    ) : (
                      <>
                        <div className={styles.bountyGrid}>
                          {paginatedBounties.map((b) => (
                            <div
                              key={b.bountyId}
                              className={`${styles.cardItem} ${styles.cardItemCompleted}`}
                            >
                              {/* Card Top: ID & Settled Badge */}
                              <div className={styles.cardItemTop}>
                                <div className={styles.cardIdGroup}>
                                  <span className={styles.cardId}>Bounty #{b.bountyId}</span>
                                  <span className={`${styles.statusBadge} ${styles.status_4}`}>
                                    {b.stateLabel}
                                  </span>
                                </div>
                                <span className={styles.cardTimestamp}>
                                  {b.settledAtDate || 'Settled Onchain'}
                                </span>
                              </div>

                              {/* Title */}
                              <div className={styles.cardItemBody}>
                                <h3 className={styles.cardTitle}>{b.taskTitle}</h3>
                              </div>

                              {/* Completed Details */}
                              <div className={styles.completedDetailBox}>
                                <div className={styles.completedRow}>
                                  <span className={styles.completedLabel}>Total Reward:</span>
                                  <span className={styles.completedValueBold}>{b.rewardMon} MON</span>
                                </div>
                                <div className={styles.completedRow}>
                                  <span className={styles.completedLabel}>Winner:</span>
                                  <span className={styles.completedValueMono}>
                                    {b.winnerAddress
                                      ? `${b.winnerAddress.slice(0, 6)}...${b.winnerAddress.slice(-4)}`
                                      : b.state === BountyState.Refunded
                                      ? 'Refunded to Creator'
                                      : b.winnerSubmissionId > 0
                                      ? `Submission #${b.winnerSubmissionId}`
                                      : 'None'}
                                  </span>
                                </div>
                                <div className={styles.completedRow}>
                                  <span className={styles.completedLabel}>Submissions:</span>
                                  <span className={styles.completedValue}>
                                    {b.submissionCount} Submissions
                                  </span>
                                </div>
                              </div>

                              {/* CTA Button */}
                              <button
                                className={styles.buttonCardSecondary}
                                onClick={() => handleViewBounty(b.bountyId)}
                              >
                                <span>View Bounty</span>
                                <Icon name="arrow" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {paginationControlsElement}
                      </>
                    )}
                  </>
                )}
              </div>
              )
            ) : (
              /* DETAILED BOUNTY VIEW (Preserved existing detail logic) */
              <div className={styles.detailWrapper}>
                {/* Detail Navigation Header */}
                <div className={styles.detailNav}>
                  <button className={styles.backButton} onClick={handleBackToList}>
                    &larr; Back to {myBountiesOnly ? 'My Bounties' : exploreView === 'active' ? 'Active Bounties' : 'Completed Bounties'}
                  </button>
                  <div className={styles.detailNavRight}>
                    <a
                      href={getExplorerAddressUrl(SETTLEX_BOUNTY_ADDRESS)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.detailContractLink}
                      title="Inspect contract on Monadscan"
                    >
                      <span>Contract: {SETTLEX_BOUNTY_ADDRESS.slice(0, 6)}...{SETTLEX_BOUNTY_ADDRESS.slice(-4)}</span>
                      <Icon name="arrow" size={12} />
                    </a>
                  </div>
                </div>

                {readError && <div className={styles.errorMessage}>{readError}</div>}

                {isLoadingBounty ? (
                  <div className={styles.loadingDiscovery}>
                    <span className={styles.txSpinner} />
                    <span>Loading Bounty #{selectedBountyId} details...</span>
                  </div>
                ) : activeBounty ? (
                  <div className={styles.bountyCard}>
                    {/* Card Header: Bounty ID, Status, Role, Countdown */}
                    <div className={styles.bountyHeader}>
                      <div className={styles.bountyTitleGroup}>
                        <div className={styles.idBadgeGroup}>
                          <span className={styles.bountyId}>Bounty #{activeBounty.bountyId}</span>
                          <span
                            className={`${styles.statusBadge} ${
                              styles[`status_${activeBounty.state}`]
                            }`}
                          >
                            {activeBounty.stateLabel}
                          </span>
                          {currentRole !== 'Observer' && (
                            <span className={styles.roleBadge}>Role: {currentRole}</span>
                          )}
                        </div>
                        <h2 className={styles.taskTitle}>{activeBounty.taskTitle}</h2>
                        {activeBounty.taskMetadataUri && (
                          <div className={styles.specLinkWrapper}>
                            <span className={styles.metaLabel}>Specification:</span>
                            <a
                              href={
                                activeBounty.taskMetadataUri.startsWith('http')
                                  ? activeBounty.taskMetadataUri
                                  : '#'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.specLink}
                            >
                              {activeBounty.taskMetadataUri}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className={styles.timingGroup}>
                        {activeBounty.state === BountyState.Open && (
                          <div className={styles.countdownBadge}>
                            <span className={styles.timingLabel}>Deadline:</span>
                            <span className={styles.timingValue}>
                              {formatCountdown(activeBounty.submissionDeadlineTimestamp)}
                            </span>
                          </div>
                        )}

                        {activeBounty.state === BountyState.Reviewing && (
                          <div className={`${styles.countdownBadge} ${styles.countdownReview}`}>
                            <span className={styles.timingLabel}>Review window:</span>
                            <span className={styles.timingValue}>
                              {formatCountdown(activeBounty.reviewDeadlineTimestamp)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prominent Reward & Allocation Grid */}
                    <div className={styles.rewardGrid}>
                      <div className={styles.rewardCardPrimary}>
                        <span className={styles.rewardLabel}>Reward</span>
                        <div className={styles.rewardValue}>{activeBounty.rewardMon} MON</div>
                        <span className={styles.rewardSub}>Locked in contract</span>
                      </div>

                      <div className={styles.rewardCard}>
                        <span className={styles.rewardLabel}>Winner allocation</span>
                        <div className={`${styles.rewardValue} ${styles.winnerColor}`}>
                          {activeBounty.winnerMon} MON
                        </div>
                        <span className={styles.rewardSub}>80% payout (+ dust)</span>
                      </div>

                      <div className={styles.rewardCard}>
                        <span className={styles.rewardLabel}>Participation pool</span>
                        <div className={`${styles.rewardValue} ${styles.poolColor}`}>
                          {activeBounty.participationPoolMon} MON
                        </div>
                        <span className={styles.rewardSub}>20% shared by contributors</span>
                      </div>
                    </div>

                    {/* Key Metadata Overview */}
                    <div className={styles.metaRow}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Submissions</span>
                        <div className={styles.metaValueProgress}>
                          <span className={styles.metaValueText}>
                            {activeBounty.submissionCount} / {activeBounty.maxSubmissions}
                          </span>
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{
                                width: `${
                                  (activeBounty.submissionCount / activeBounty.maxSubmissions) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Deadline</span>
                        <span className={styles.metaValue}>
                          {activeBounty.submissionDeadlineDate}
                        </span>
                      </div>

                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Creator</span>
                        <span className={styles.metaValueMono}>
                          {activeBounty.creator.slice(0, 6)}...{activeBounty.creator.slice(-4)}
                        </span>
                      </div>

                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Dispute Resolver</span>
                        <span className={styles.metaValueMono}>
                          {activeBounty.disputeResolver ===
                          '0x0000000000000000000000000000000000000000'
                            ? 'Standard'
                            : `${activeBounty.disputeResolver.slice(0, 6)}...${activeBounty.disputeResolver.slice(-4)}`}
                        </span>
                      </div>
                    </div>

                    {/* Immutable Acceptance Criteria */}
                    <div className={styles.criteriaSection}>
                      <div className={styles.criteriaHeader}>
                        <span className={styles.criteriaTitle}>IMMUTABLE ACCEPTANCE CRITERIA</span>
                        <span className={styles.criteriaTag}>Locked onchain</span>
                      </div>
                      <div className={styles.criteriaBody}>
                        {activeBounty.acceptanceCriteria}
                      </div>
                      <p className={styles.criteriaNote}>
                        Criteria locked onchain at creation. Creator evaluates submissions against
                        these immutable terms. If configured, the authorized dispute resolver is
                        also bound by these criteria.
                      </p>
                    </div>

                    {/* Action Controls by State & Role */}
                    <div className={styles.actionRow}>
                      {/* Contributor: Submit Work */}
                      {activeBounty.state === BountyState.Open &&
                        !isCreator &&
                        !userHasSubmitted &&
                        activeBounty.slotsRemaining > 0 && (
                          <button
                            className={styles.buttonPrimary}
                            onClick={() => setShowSubmitModal(true)}
                          >
                            Submit Work ({activeBounty.slotsRemaining} Slots Remaining)
                          </button>
                        )}

                      {activeBounty.state === BountyState.Open && userHasSubmitted && (
                        <div className={styles.eligibleNotice}>
                          Your deliverable is submitted. Contributor reward eligibility is active.
                        </div>
                      )}

                      {/* Close Submissions if deadline elapsed */}
                      {activeBounty.state === BountyState.Open &&
                        activeBounty.isSubmissionExpired && (
                          <button
                            className={styles.buttonSecondary}
                            onClick={() => handleCloseSubmissions(activeBounty.bountyId)}
                          >
                            Close Submissions (Deadline Passed)
                          </button>
                        )}

                      {/* Expired Zero-Submission Refund for Creator */}
                      {activeBounty.state === BountyState.Open &&
                        activeBounty.isSubmissionExpired &&
                        activeBounty.submissionCount === 0 &&
                        isCreator && (
                          <button
                            className={styles.buttonDanger}
                            onClick={() => handleClaimRefund(activeBounty.bountyId)}
                          >
                            Reclaim Expired Bounty Deposit
                          </button>
                        )}

                      {/* Escalate to Dispute if Creator missed 24h review window */}
                      {activeBounty.state === BountyState.Reviewing &&
                        activeBounty.isReviewExpired && (
                          <button
                            className={styles.buttonSecondary}
                            onClick={() => handleEscalateToDispute(activeBounty.bountyId)}
                          >
                            Escalate to Dispute Review (Review Window Expired)
                          </button>
                        )}

                      {/* Dispute Review Status Notice */}
                      {activeBounty.state === BountyState.DisputeReview && (
                        <div className={styles.disputeNotice}>
                          <strong>Dispute Review Active:</strong> The 24-hour creator review window
                          has expired. The authorized dispute resolver evaluates deliverables
                          strictly against the Acceptance Criteria.
                        </div>
                      )}
                    </div>

                    {/* Submissions Section */}
                    <div className={styles.submissionsSection}>
                      <div className={styles.submissionsHeader}>
                        <h3 className={styles.submissionsTitle}>
                          Submissions ({submissions.length})
                        </h3>
                        {activeBounty.state === BountyState.Reviewing && isCreator && (
                          <span className={styles.reviewInstruction}>
                            Review deliverables against acceptance criteria and select the winner.
                          </span>
                        )}
                      </div>

                      {submissions.length === 0 ? (
                        <div className={styles.emptySubmissions}>
                          No submissions received yet. Eligible contributors can submit deliverables
                          against the criteria above.
                        </div>
                      ) : (
                        <div className={styles.submissionsList}>
                          {submissions.map((sub) => {
                            const isWinner =
                              activeBounty.state === BountyState.Settled &&
                              activeBounty.winnerSubmissionId === sub.submissionId;

                            return (
                              <div
                                key={sub.submissionId}
                                className={`${styles.submissionCard} ${
                                  isWinner ? styles.submissionCardWinner : ''
                                }`}
                              >
                                <div className={styles.submissionTop}>
                                  <div className={styles.submissionContributor}>
                                    <span className={styles.submissionNumber}>
                                      #{sub.submissionId}
                                    </span>
                                    <span className={styles.contributorAddress}>
                                      {sub.contributor.slice(0, 6)}...{sub.contributor.slice(-4)}
                                    </span>
                                    {isWinner && (
                                      <span className={styles.winnerBadge}>
                                        Winner (80% Payout)
                                      </span>
                                    )}
                                  </div>
                                  <span className={styles.submissionTime}>
                                    {sub.submittedAtDate}
                                  </span>
                                </div>

                                <div className={styles.submissionContent}>
                                  <div className={styles.deliverableRow}>
                                    <span className={styles.deliverableLabel}>Deliverable:</span>
                                    <a
                                      href={
                                        sub.proofUri.startsWith('http') ? sub.proofUri : '#'
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.deliverableLink}
                                    >
                                      {sub.proofUri}
                                    </a>
                                  </div>

                                  {sub.notes && (
                                    <div className={styles.submissionNotes}>
                                      <span className={styles.notesLabel}>Notes:</span>
                                      <p className={styles.notesText}>{sub.notes}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Creator Action: Select Winner */}
                                {activeBounty.state === BountyState.Reviewing && isCreator && (
                                  <div className={styles.submissionAction}>
                                    <button
                                      className={styles.buttonSelectWinner}
                                      onClick={() =>
                                        handleSelectWinner(
                                          activeBounty.bountyId,
                                          sub.submissionId
                                        )
                                      }
                                    >
                                      Select Winner
                                    </button>
                                  </div>
                                )}

                                {/* Dispute Resolver Action */}
                                {activeBounty.state === BountyState.DisputeReview && isArbiter && (
                                  <div className={styles.submissionAction}>
                                    <button
                                      className={styles.buttonSelectWinner}
                                      onClick={() =>
                                        handleResolveDispute(
                                          activeBounty.bountyId,
                                          sub.submissionId
                                        )
                                      }
                                    >
                                      Select Winner (Dispute Resolution)
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Settlement Onchain Verification Card */}
                    {activeBounty.state === BountyState.Settled && (
                      <div className={styles.settlementVerificationCard}>
                        <div className={styles.settlementCardHeader}>
                          <div className={styles.settlementBadge}>
                            <span className={styles.settlementDot} />
                            <span>✓ Settled Onchain</span>
                          </div>
                          <span className={styles.settlementTimestamp}>
                            Settled: {activeBounty.settledAtDate || 'Onchain'}
                          </span>
                        </div>

                        <div className={styles.settlementGrid}>
                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Settlement Transaction</span>
                            {activeSettlementTx ? (
                              <div className={styles.txHashRow}>
                                <a
                                  href={activeSettlementTx.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.settlementTxLink}
                                  title={`View settlement tx on Monad Explorer: ${activeSettlementTx.txHash}`}
                                >
                                  <span className={styles.settlementFieldValueMono}>
                                    {activeSettlementTx.txHash.slice(0, 8)}...{activeSettlementTx.txHash.slice(-6)}
                                  </span>
                                  <Icon name="external" size={12} />
                                </a>
                                <button
                                  type="button"
                                  className={styles.copyTxBtn}
                                  onClick={(e) => handleCopyTx(activeSettlementTx.txHash, e)}
                                  title="Copy transaction hash"
                                >
                                  <Icon
                                    name={copiedTxHash === activeSettlementTx.txHash ? 'check-copy' : 'copy'}
                                    size={12}
                                  />
                                </button>
                              </div>
                            ) : isLoadingSettlementTx ? (
                              <span className={styles.resolvingTx}>
                                <span className={styles.buttonSpinner} /> Resolving transaction...
                              </span>
                            ) : (
                              <span className={styles.pendingTxText}>Block confirmed onchain</span>
                            )}
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Winning Contributor</span>
                            <span className={styles.settlementFieldValueMono}>
                              {activeSettlementTx?.winnerAddress
                                ? `${activeSettlementTx.winnerAddress.slice(0, 8)}...${activeSettlementTx.winnerAddress.slice(-6)}`
                                : activeBounty.winnerAddress
                                ? `${activeBounty.winnerAddress.slice(0, 8)}...${activeBounty.winnerAddress.slice(-6)}`
                                : `Submission #${activeBounty.winnerSubmissionId}`}
                            </span>
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Winner Payout</span>
                            <span className={styles.settlementAmountGreen}>
                              {activeBounty.winnerMon} MON <span className={styles.payoutPercent}>(80%)</span>
                            </span>
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Participation Pool</span>
                            <span className={styles.settlementAmountPurple}>
                              {activeBounty.participationPoolMon} MON
                              <span className={styles.payoutPercent}>
                                {activeBounty.submissionCount === 1
                                  ? ' (Refunded to Creator)'
                                  : ` (${activeBounty.submissionCount - 1} Contributors)`}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Refund Onchain Verification Card */}
                    {activeBounty.state === BountyState.Refunded && (
                      <div className={styles.refundVerificationCard}>
                        <div className={styles.settlementCardHeader}>
                          <div className={styles.refundBadge}>
                            <span className={styles.refundDot} />
                            <span>✓ Refunded Onchain</span>
                          </div>
                          <span className={styles.settlementTimestamp}>
                            Refunded: {activeBounty.settledAtDate || 'Onchain'}
                          </span>
                        </div>

                        <div className={styles.settlementGrid}>
                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Refund Transaction</span>
                            {activeSettlementTx ? (
                              <div className={styles.txHashRow}>
                                <a
                                  href={activeSettlementTx.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.settlementTxLink}
                                  title={`View refund tx on Monad Explorer: ${activeSettlementTx.txHash}`}
                                >
                                  <span className={styles.settlementFieldValueMono}>
                                    {activeSettlementTx.txHash.slice(0, 8)}...{activeSettlementTx.txHash.slice(-6)}
                                  </span>
                                  <Icon name="external" size={12} />
                                </a>
                                <button
                                  type="button"
                                  className={styles.copyTxBtn}
                                  onClick={(e) => handleCopyTx(activeSettlementTx.txHash, e)}
                                  title="Copy transaction hash"
                                >
                                  <Icon
                                    name={copiedTxHash === activeSettlementTx.txHash ? 'check-copy' : 'copy'}
                                    size={12}
                                  />
                                </button>
                              </div>
                            ) : isLoadingSettlementTx ? (
                              <span className={styles.resolvingTx}>
                                <span className={styles.buttonSpinner} /> Resolving transaction...
                              </span>
                            ) : (
                              <span className={styles.pendingTxText}>Block confirmed onchain</span>
                            )}
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Creator Recipient</span>
                            <span className={styles.settlementFieldValueMono}>
                              {activeBounty.creator.slice(0, 8)}...{activeBounty.creator.slice(-6)}
                            </span>
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Refund Amount</span>
                            <span className={styles.refundAmountGold}>
                              {activeBounty.rewardMon} MON <span className={styles.payoutPercent}>(100% Reclaimed)</span>
                            </span>
                          </div>

                          <div className={styles.settlementField}>
                            <span className={styles.settlementFieldLabel}>Reason</span>
                            <span className={styles.settlementReason}>
                              Submission deadline passed with 0 submissions
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.emptyCard}>
                    <p>Bounty not found. Click &ldquo;Back to Bounties&rdquo; to return to the catalog.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CREATE NEW BOUNTY */}
        {/* ========================================================================= */}
        {activeTab === 'create' && (
          <div className={styles.createBountyContainer}>
            {/* Ambient Volumetric Backdrop Glow behind Form */}
            <div className={styles.createAmbientGlow} aria-hidden="true" />

            {/* Top Navigation & Status Bar */}
            <div className={styles.createNavHeader}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => {
                  if (onNavigateExplore) {
                    onNavigateExplore();
                  } else {
                    setActiveTab('manage');
                  }
                  resetTxState();
                }}
                id="create-back-to-bounties-btn"
              >
                <span className={styles.backArrowIcon}>&larr;</span>
                <span>Back to Bounties</span>
              </button>

              <div className={styles.createHeaderBadge}>
                <span className={styles.badgePulseDot} />
                <span>Protected Monad Escrow</span>
              </div>
            </div>

            {/* Page Title & Context Header */}
            <div className={styles.createIntro}>
              <div className={styles.createEyebrow}>
                <span className={styles.eyebrowStar}>✦</span> NEW BOUNTY ESCROW
              </div>
              <h2 className={styles.createTitle}>Create a Work Bounty</h2>
              <p className={styles.createSubtitle}>
                Lock MON reward in escrow with immutable acceptance criteria. You have 24 hours to
                review deliverables after submissions close.
              </p>
            </div>

            {/* Main Glassmorphic Form Card */}
            <form className={styles.createForm} onSubmit={onCreateBounty}>
              {/* SECTION 1: BOUNTY DETAILS */}
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWithBadge}>
                    <span className={styles.sectionNumber}>01</span>
                    <h3 className={styles.sectionTitle}>Bounty Details</h3>
                  </div>
                </div>

                <div className={styles.sectionFields}>
                  {/* Task Title */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="formTitle">
                      Task Title <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="formTitle"
                      type="text"
                      className={styles.textInput}
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Build Monad Testnet Subgraph for SettleX"
                      required
                    />
                  </div>

                  {/* Specification Link / Description */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="formDesc">
                      Specification Link or Description
                    </label>
                    <input
                      id="formDesc"
                      type="text"
                      className={styles.textInput}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="https://github.com/org/repo/issues/1 or specification URI"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formDivider} />

              {/* SECTION 2: ACCEPTANCE CRITERIA */}
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWithBadge}>
                    <span className={styles.sectionNumber}>02</span>
                    <h3 className={styles.sectionTitle}>Acceptance Criteria</h3>
                  </div>
                  <div className={styles.lockedOnchainBadge}>
                    <Icon name="lock" size={11} />
                    <span>LOCKED ONCHAIN</span>
                  </div>
                </div>

                <div className={styles.sectionFields}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="formCriteria">
                      Immutable Acceptance Criteria <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      id="formCriteria"
                      className={styles.textArea}
                      rows={4}
                      value={formCriteria}
                      onChange={(e) => setFormCriteria(e.target.value)}
                      placeholder="Define precise pass/fail criteria (e.g. test coverage, responsive design, verified pull request). These terms are permanently locked onchain."
                      required
                    />
                    <span className={styles.fieldHint}>
                      Locked onchain upon creation. Submissions are judged strictly against these terms.
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.formDivider} />

              {/* SECTION 3: REWARD & CAPACITY */}
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWithBadge}>
                    <span className={styles.sectionNumber}>03</span>
                    <h3 className={styles.sectionTitle}>Reward &amp; Capacity</h3>
                  </div>
                </div>

                <div className={styles.sectionFields}>
                  <div className={styles.twoColumn}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="formReward">
                        Total Reward (MON) <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.inputWithUnit}>
                        <input
                          id="formReward"
                          type="number"
                          step="any"
                          min="0.0001"
                          className={styles.textInput}
                          value={formRewardMon}
                          onChange={(e) => setFormRewardMon(e.target.value)}
                          placeholder="0.1"
                          required
                        />
                        <span className={styles.inputUnit}>MON</span>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="formMaxSubs">
                        Max Submissions (1–10) <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="formMaxSubs"
                        type="number"
                        min="1"
                        max="10"
                        className={styles.textInput}
                        value={formMaxSubmissions}
                        onChange={(e) => setFormMaxSubmissions(e.target.value)}
                        required
                      />
                      <span className={styles.fieldHint}>
                        Hard onchain cap. Automatically closes to review when full.
                      </span>
                    </div>
                  </div>

                  {/* Dynamic 80/20 Reward Allocation Mini-Cards */}
                  <div className={styles.allocationContainer}>
                    <div className={styles.allocationHeader}>
                      <span className={styles.allocationTitle}>Escrow Split Guarantee</span>
                      <span className={styles.allocationProtocolTag}>80 / 20 PROTOCOL RULE</span>
                    </div>

                    <div className={styles.previewGrid}>
                      {/* Winner Allocation Card */}
                      <div className={`${styles.previewCard} ${styles.winnerCard}`}>
                        <div className={styles.cardHeaderRow}>
                          <span className={styles.cardPercentageBadge}>80%</span>
                          <span className={styles.previewLabel}>Winner Allocation</span>
                        </div>
                        <div className={`${styles.previewValue} ${styles.winnerColor}`}>
                          {winnerPreviewMon} <span className={styles.unitSuffix}>MON</span>
                        </div>
                        <span className={styles.previewSub}>
                          Paid automatically to the single approved submitter
                        </span>
                      </div>

                      {/* Participation Pool Card */}
                      <div className={`${styles.previewCard} ${styles.poolCard}`}>
                        <div className={styles.cardHeaderRow}>
                          <span className={`${styles.cardPercentageBadge} ${styles.poolBadge}`}>20%</span>
                          <span className={styles.previewLabel}>Participation Pool</span>
                        </div>
                        <div className={`${styles.previewValue} ${styles.poolColor}`}>
                          {poolPreviewMon} <span className={styles.unitSuffix}>MON</span>
                        </div>
                        <span className={styles.previewSub}>
                          Shared equally among all valid contributors
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formDivider} />

              {/* SECTION 4: SUBMISSION WINDOW & RESOLUTION */}
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWithBadge}>
                    <span className={styles.sectionNumber}>04</span>
                    <h3 className={styles.sectionTitle}>Submission Window &amp; Resolution</h3>
                  </div>
                </div>

                <div className={styles.sectionFields}>
                  <div className={styles.twoColumn}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="formDuration">
                        Submission Window (Hours) <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.inputWithUnit}>
                        <input
                          id="formDuration"
                          type="number"
                          min="1"
                          className={styles.textInput}
                          value={formDurationHours}
                          onChange={(e) => setFormDurationHours(e.target.value)}
                          placeholder="48"
                          required
                        />
                        <span className={styles.inputUnit}>HOURS</span>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <div className={styles.labelWithOptional}>
                        <label className={styles.fieldLabel} htmlFor="formDisputeResolver">
                          Optional Dispute Resolver Address
                        </label>
                        <span className={styles.optionalPill}>ADVANCED</span>
                      </div>
                      <input
                        id="formDisputeResolver"
                        type="text"
                        className={styles.textInput}
                        value={formDisputeResolver}
                        onChange={(e) => setFormDisputeResolver(e.target.value)}
                        placeholder="0x... (Leave blank for default protocol handling)"
                      />
                      <span className={styles.fieldHint}>
                        Third-party arbiter address permitted to resolve contested submissions.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {formValidationError && (
                <div className={styles.errorMessage}>{formValidationError}</div>
              )}

              {/* Primary Action Button */}
              <div className={styles.formActionArea}>
                <button
                  type="submit"
                  className={styles.fundCreateBtn}
                  id="fund-and-create-bounty-btn"
                >
                  <Icon name="lock" size={17} />
                  <span>Fund &amp; Create Bounty ({formRewardMon} MON)</span>
                  <Icon name="arrow" size={15} />
                </button>
                <span className={styles.escrowNotice}>
                  Funds are locked in Monad Escrow upon transaction confirmation
                </span>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal: Contributor Submit Deliverable */}
      {showSubmitModal && activeBounty && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Submit Deliverable</h3>
              <button className={styles.modalClose} onClick={() => setShowSubmitModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={onSubmitWork} className={styles.createForm}>
              <div className={styles.criteriaSection}>
                <span className={styles.criteriaTitle}>Acceptance Criteria:</span>
                <div className={styles.criteriaBody}>{activeBounty.acceptanceCriteria}</div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="subProof">
                  Deliverable / Proof URI <span className={styles.required}>*</span>
                </label>
                <input
                  id="subProof"
                  type="text"
                  className={styles.textInput}
                  value={submissionProofUri}
                  onChange={(e) => setSubmissionProofUri(e.target.value)}
                  placeholder="https://github.com/org/repo/pull/1 or IPFS URI"
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="subNotes">
                  Verification Notes
                </label>
                <textarea
                  id="subNotes"
                  className={styles.textArea}
                  rows={3}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Summary of completed deliverables and instructions for testing..."
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => setShowSubmitModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.buttonPrimary}>
                  Submit Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
