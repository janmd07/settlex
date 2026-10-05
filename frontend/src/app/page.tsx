'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import { WalletBar } from '../components/WalletBar';
import { ContractInspector } from '../components/ContractInspector';
import { Icon, IconName } from '../components/Icons';
import { HeroVisual } from '../components/HeroVisual';
import { HeroEnvironment } from '../components/HeroEnvironment';
import {
  MONAD_TESTNET_CHAIN_ID,
  SETTLEX_BOUNTY_ADDRESS,
  getExplorerAddressUrl,
} from '../config/contract';

type AppView = 'home' | 'bounties' | 'create' | 'payment-activity';

function FlowStep({
  number,
  icon,
  title,
  text,
  tone,
}: {
  number: string;
  icon: IconName;
  title: string;
  text: string;
  tone: 'purple' | 'blue' | 'pink' | 'gold';
}) {
  return (
    <article className={styles.flowCard}>
      <div className={`${styles.flowIcon} ${styles[tone]}`}>
        <Icon name={icon} size={22} />
      </div>
      <div>
        <div className={styles.flowNumber}>{number}</div>
        <div className={styles.flowTitle}>{title}</div>
        <div className={styles.flowText}>{text}</div>
      </div>
    </article>
  );
}

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [myBountiesFilter, setMyBountiesFilter] = useState(false);
  const [activeNav, setActiveNav] = useState<'bounties' | 'how' | 'my' | 'dashboard'>('bounties');

  const navigateTo = (view: AppView, myOnly = false) => {
    setCurrentView(view);
    setMyBountiesFilter(myOnly);
    if (view === 'bounties') {
      setActiveNav(myOnly ? 'my' : 'bounties');
      if (typeof window !== 'undefined') {
        window.location.hash = myOnly ? 'my-bounties' : 'bounties';
      }
    } else if (view === 'create') {
      setActiveNav('bounties');
      if (typeof window !== 'undefined') {
        window.location.hash = 'create';
      }
    } else if (view === 'payment-activity') {
      setActiveNav('dashboard');
      if (typeof window !== 'undefined') {
        window.location.hash = 'payment-activity';
      }
    } else {
      setActiveNav('bounties');
      if (typeof window !== 'undefined') {
        window.location.hash = '';
      }
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToHow = () => {
    setActiveNav('how');
    if (currentView !== 'home') {
      setCurrentView('home');
      if (typeof window !== 'undefined') {
        window.location.hash = 'how';
        setTimeout(() => {
          document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      if (typeof window !== 'undefined') {
        window.location.hash = 'how';
        document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const scrollToStats = () => {
    navigateTo('payment-activity');
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'bounties') {
        setCurrentView('bounties');
        setMyBountiesFilter(false);
        setActiveNav('bounties');
      } else if (hash === 'my-bounties') {
        setCurrentView('bounties');
        setMyBountiesFilter(true);
        setActiveNav('my');
      } else if (hash === 'create') {
        setCurrentView('create');
        setMyBountiesFilter(false);
      } else if (hash === 'payment-activity' || hash === 'dashboard') {
        setCurrentView('payment-activity');
        setActiveNav('dashboard');
      } else if (hash === 'how') {
        setCurrentView('home');
        setActiveNav('how');
        setTimeout(() => {
          document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else if (hash === 'stats') {
        setCurrentView('payment-activity');
        setActiveNav('dashboard');
      } else {
        setCurrentView('home');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <div className={styles.appShell}>
      {/* Full-width Application Shell Header */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          {/* LEFT: SettleX Brand Mark & Title */}
          <a
            className={styles.brandGroup}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('home');
            }}
          >
            <div className={styles.logoIcon}>
              <Image
                src="/settlex-logo.png"
                alt="SettleX Logo"
                width={38}
                height={27}
                priority
                unoptimized
                className={styles.headerLogoImage}
              />
            </div>
            <div className={styles.brandTextGroup}>
              <span className={styles.brandName}>
                Settle<span className={styles.brandAccent}>X</span>
              </span>
              <span className={styles.brandSubtitle}>Onchain Work Bounties</span>
            </div>
          </a>

          {/* CENTER: Application Navigation */}
          <nav className={styles.centerNav} aria-label="Primary Navigation">
            <button
              className={`${styles.navLink} ${currentView === 'bounties' && !myBountiesFilter ? styles.activeNavLink : ''}`}
              onClick={() => navigateTo('bounties', false)}
              id="nav-bounties-btn"
            >
              <Icon name="grid" size={14} />
              <span>Bounties</span>
            </button>
            <button
              className={`${styles.navLink} ${activeNav === 'how' && currentView === 'home' ? styles.activeNavLink : ''}`}
              onClick={scrollToHow}
              id="nav-how-btn"
            >
              <Icon name="info" size={14} />
              <span>How it works</span>
            </button>
            <button
              className={`${styles.navLink} ${currentView === 'bounties' && myBountiesFilter ? styles.activeNavLink : ''}`}
              onClick={() => navigateTo('bounties', true)}
              id="nav-my-bounties-btn"
            >
              <Icon name="file" size={14} />
              <span>My Bounties</span>
            </button>
            <button
              className={`${styles.navLink} ${activeNav === 'dashboard' || currentView === 'payment-activity' ? styles.activeNavLink : ''}`}
              onClick={scrollToStats}
              id="nav-dashboard-btn"
            >
              <Icon name="dashboard" size={14} />
              <span>Payment Activity</span>
            </button>
          </nav>

          {/* RIGHT: Wallet Bar & Network Status */}
          <WalletBar />
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* ================================================================= */}
        {/* 1. FOCUSED PRODUCT LANDING PAGE VIEW                              */}
        {/* ================================================================= */}
        {currentView === 'home' && (
          <>
            {/* Full-width Hero Section */}
            <section className={styles.hero}>
              {/* Full-width Unified Cinematic Environment */}
              <HeroEnvironment />

              <div className={styles.heroInner}>
                {/* Left: Hero Copy & Actions */}
                <div className={styles.heroCopy}>
                  <div className={styles.eyebrow}>
                    <span className={styles.eyebrowStar}>★</span> TRUSTLESS ONCHAIN WORK
                  </div>
                  <h1 className={styles.heroTitle}>
                    Work first.
                    <br />
                    <span className={styles.heroAccent}>Payment guaranteed by code.</span>
                  </h1>
                  <p className={styles.heroSubtitle}>
                    Permissionless onchain work bounties with immutable acceptance
                    criteria, transparent review, and guaranteed settlement on Monad.
                  </p>

                  <div className={styles.heroButtons}>
                    <button
                      className={styles.primaryBtn}
                      onClick={() => navigateTo('bounties', false)}
                      id="hero-explore-btn"
                    >
                      <Icon name="search" size={16} />
                      <span>Explore Bounties</span>
                      <Icon name="arrow" size={15} />
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => navigateTo('create', false)}
                      id="hero-create-btn"
                    >
                      <span>Create a Bounty</span>
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                </div>

                {/* Right: SettleX Central 3D Glass Cube & Protocol Architecture */}
                <HeroVisual
                  onCreateClick={() => navigateTo('create', false)}
                  onFundClick={() => navigateTo('bounties', false)}
                  onWorkClick={() => navigateTo('bounties', false)}
                  onSettleClick={() => navigateTo('bounties', false)}
                />
              </div>
            </section>

            {/* Primary Action Area: The Two Clear Product Paths */}
            <section className={styles.actionSection} aria-label="Choose Your Path">
              <div className={styles.sectionInner}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionTag}>CHOOSE YOUR PATH</div>
                  <h2 className={styles.actionTitle}>What do you want to do?</h2>
                  <p className={styles.actionSubtitle}>
                    Select an entry point to discover trustless work or post an immutable bounty on Monad.
                  </p>
                </div>

                <div className={styles.actionCardsGrid}>
                  {/* PATH 1: EXPLORE BOUNTIES */}
                  <div
                    className={`${styles.actionCard} ${styles.actionCardExplore}`}
                    onClick={() => navigateTo('bounties', false)}
                    id="path-explore-bounties"
                  >
                    <div className={`${styles.cardAmbientGlow} ${styles.glowExplore}`} aria-hidden="true" />
                    <div className={styles.actionCardTop}>
                      <div className={`${styles.actionCardIcon} ${styles.iconExplore}`}>
                        <Icon name="search" size={22} />
                      </div>
                      <span className={`${styles.actionCardPill} ${styles.pillExplore}`}>FOR CONTRIBUTORS</span>
                    </div>

                    <div className={styles.actionCardBody}>
                      <h3 className={styles.actionCardHeading}>EXPLORE BOUNTIES</h3>
                      <div className={styles.actionCardSubtitle}>Find work. Submit. Earn.</div>
                      <p className={styles.actionCardDesc}>
                        Browse active onchain work bounties, choose a task, and submit your work for guaranteed protocol settlement.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.actionCardBtnPrimary}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('bounties', false);
                      }}
                      id="action-btn-explore"
                    >
                      <span>Explore Bounties</span>
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>

                  {/* PATH 2: CREATE A BOUNTY */}
                  <div
                    className={`${styles.actionCard} ${styles.actionCardCreate}`}
                    onClick={() => navigateTo('create', false)}
                    id="path-create-bounty"
                  >
                    <div className={`${styles.cardAmbientGlow} ${styles.glowCreate}`} aria-hidden="true" />
                    <div className={styles.actionCardTop}>
                      <div className={`${styles.actionCardIcon} ${styles.iconCreate}`}>
                        <Icon name="file" size={22} />
                      </div>
                      <span className={`${styles.actionCardPill} ${styles.pillCreate}`}>FOR CREATORS</span>
                    </div>

                    <div className={styles.actionCardBody}>
                      <h3 className={styles.actionCardHeading}>CREATE A BOUNTY</h3>
                      <div className={styles.actionCardSubtitle}>Post work. Fund. Review.</div>
                      <p className={styles.actionCardDesc}>
                        Create a permissionless bounty with immutable acceptance criteria and lock the reward onchain.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.actionCardBtnSecondary}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('create', false);
                      }}
                      id="action-btn-create"
                    >
                      <span>Create a Bounty</span>
                      <Icon name="plus" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Live Protocol Statistics Strip (Real onchain data) */}
            <section id="stats" className={styles.statsSection} aria-label="Protocol Metrics">
              <div className={styles.sectionInner}>
                <div className={styles.statsHeader}>
                  <div className={styles.actionTag}>LIVE PROTOCOL METRICS</div>
                  <h2 className={styles.statsTitle}>Real-time onchain settlement volume</h2>
                </div>
                <ContractInspector
                  viewMode="home-stats"
                  onNavigateExplore={() => navigateTo('bounties', false)}
                  onNavigateCreate={() => navigateTo('create', false)}
                />
              </div>
            </section>

            {/* How It Works Section */}
            <section id="how" className={styles.how} aria-label="How SettleX Works">
              <div className={styles.sectionInner}>
                <div className={styles.sectionTag}>HOW IT WORKS</div>
                <h2 className={styles.howTitle}>From idea to payment, onchain.</h2>
                <p className={styles.howSubtitle}>
                  A simple, transparent flow for trustless collaboration.
                </p>

                <div className={styles.flow}>
                  <FlowStep
                    number="01"
                    icon="file"
                    title="Create"
                    text="Define the work, reward and immutable acceptance criteria."
                    tone="purple"
                  />
                  <div className={styles.flowArrow}>
                    <Icon name="arrow" size={18} />
                  </div>
                  <FlowStep
                    number="02"
                    icon="coins"
                    title="Fund"
                    text="Lock the reward onchain before anyone starts working."
                    tone="blue"
                  />
                  <div className={styles.flowArrow}>
                    <Icon name="arrow" size={18} />
                  </div>
                  <FlowStep
                    number="03"
                    icon="code"
                    title="Submit"
                    text="Anyone can contribute and submit their work."
                    tone="pink"
                  />
                  <div className={styles.flowArrow}>
                    <Icon name="arrow" size={18} />
                  </div>
                  <FlowStep
                    number="04"
                    icon="check"
                    title="Settle"
                    text="Approved work receives the guaranteed reward automatically."
                    tone="gold"
                  />
                </div>
              </div>
            </section>

            {/* Product Value Proposition (4 Core Principles) */}
            <section className={styles.valueSection} aria-label="Core Protocol Value Proposition">
              <div className={styles.sectionInner}>
                <div className={styles.valueGrid}>
                  <div className={styles.valueCard}>
                    <div className={styles.valueIndex}>01</div>
                    <h3 className={styles.valueTitle}>Permissionless Work</h3>
                    <p className={styles.valueText}>
                      Anyone can contribute. Deliver work against open bounties with no upfront stake,
                      gatekeepers, or deposit required.
                    </p>
                  </div>

                  <div className={styles.valueCard}>
                    <div className={styles.valueIndex}>02</div>
                    <h3 className={styles.valueTitle}>Immutable Criteria</h3>
                    <p className={styles.valueText}>
                      Acceptance rules are locked onchain when created. Submissions are judged strictly
                      against these terms.
                    </p>
                  </div>

                  <div className={styles.valueCard}>
                    <div className={styles.valueIndex}>03</div>
                    <h3 className={styles.valueTitle}>80/20 Guaranteed Reward</h3>
                    <p className={styles.valueText}>
                      Winner receives 80% of locked funds; remaining valid contributors share the 20%
                      participation pool.
                    </p>
                  </div>

                  <div className={styles.valueCard}>
                    <div className={styles.valueIndex}>04</div>
                    <h3 className={styles.valueTitle}>24-Hour Review</h3>
                    <p className={styles.valueText}>
                      Creator has a defined review window to evaluate deliverables against criteria.
                      Escalates to dispute resolver on expiration.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================================================================= */}
        {/* 2. DEDICATED EXPLORE BOUNTIES VIEW (Active / Completed / Details) */}
        {/* ================================================================= */}
        {currentView === 'bounties' && (
          <div className={styles.sectionInner}>
            <ContractInspector
              viewMode="bounties"
              myBountiesOnly={myBountiesFilter}
              onNavigateHome={() => navigateTo('home')}
              onNavigateCreate={() => navigateTo('create', false)}
              onNavigateExplore={() => navigateTo('bounties', false)}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. DEDICATED CREATE A BOUNTY VIEW                                 */}
        {/* ================================================================= */}
        {currentView === 'create' && (
          <div className={styles.sectionInner}>
            <ContractInspector
              viewMode="create"
              onNavigateHome={() => navigateTo('home')}
              onNavigateExplore={() => navigateTo('bounties', false)}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. DEDICATED PAYMENT ACTIVITY & FINANCIAL OVERVIEW VIEW           */}
        {/* ================================================================= */}
        {currentView === 'payment-activity' && (
          <div className={styles.sectionInner}>
            <ContractInspector
              viewMode="payment-activity"
              onNavigateHome={() => navigateTo('home')}
              onNavigateCreate={() => navigateTo('create', false)}
              onNavigateExplore={() => navigateTo('bounties', false)}
            />
          </div>
        )}

        {/* Minimal Production Footer */}
        <footer className={styles.footer}>
          <div className={styles.sectionInner}>
            <div className={styles.footerContent}>
              <span>
                SettleX &bull; Monad Testnet (Chain ID {MONAD_TESTNET_CHAIN_ID})
              </span>
              <a
                href={getExplorerAddressUrl(SETTLEX_BOUNTY_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerLink}
                title="Inspect SettleXBounty contract on Monadscan"
              >
                Contract: {SETTLEX_BOUNTY_ADDRESS.slice(0, 6)}...{SETTLEX_BOUNTY_ADDRESS.slice(-4)} &nearr;
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

