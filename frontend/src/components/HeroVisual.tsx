'use client';

import React from 'react';
import Image from 'next/image';
import styles from './HeroVisual.module.css';
import { Icon } from './Icons';

interface HeroVisualProps {
  onCreateClick: () => void;
  onFundClick: () => void;
  onWorkClick: () => void;
  onSettleClick: () => void;
}

export function HeroVisual({
  onCreateClick,
  onFundClick,
  onWorkClick,
  onSettleClick,
}: HeroVisualProps) {
  return (
    <div className={styles.visualContainer} aria-label="SettleX Protocol Architecture">
      {/* 3D Cinematic Scene Wrapper */}
      <div className={styles.sceneWrapper}>

        {/* ============================================================== */}
        {/* LAYER A: BACK SVG SCENE                                        */}
        {/* (Grounding rocks, pedestal, reactor beam, back cube & caustics)*/}
        {/* ============================================================== */}
        <svg
          viewBox="0 0 1000 680"
          className={styles.sceneSvgBack}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            {/* Atmospheric Multi-Stage Glow Filters */}
            <filter id="cinematicBloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="34" result="blurDeep" />
              <feGaussianBlur stdDeviation="15" result="blurMid" />
              <feGaussianBlur stdDeviation="4" result="blurTight" />
              <feMerge>
                <feMergeNode in="blurDeep" />
                <feMergeNode in="blurMid" />
                <feMergeNode in="blurTight" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="neonGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="14" result="glowWide" />
              <feGaussianBlur stdDeviation="5" result="glowMid" />
              <feGaussianBlur stdDeviation="1.5" result="glowCore" />
              <feMerge>
                <feMergeNode in="glowWide" />
                <feMergeNode in="glowMid" />
                <feMergeNode in="glowCore" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="specularGleam" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="anamorphicStreak" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="9 1.5" result="streak" />
              <feMerge>
                <feMergeNode in="streak" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="contactShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="18" />
            </filter>

            {/* Vertical Atmospheric Beam */}
            <linearGradient id="verticalLightShaft" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.45" />
              <stop offset="35%" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#4c1d95" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </linearGradient>

            {/* Platform Ground Purple Wash */}
            <radialGradient id="groundPurpleWash" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.65" />
              <stop offset="30%" stopColor="#7c3aed" stopOpacity="0.45" />
              <stop offset="65%" stopColor="#43187a" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#080614" stopOpacity="0" />
            </radialGradient>

            {/* Monolithic Platform Metallic Finishes */}
            <linearGradient id="platformDeckLit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#352864" />
              <stop offset="30%" stopColor="#1d163d" />
              <stop offset="70%" stopColor="#120e26" />
              <stop offset="100%" stopColor="#080614" />
            </linearGradient>

            <linearGradient id="platformBevelFrontLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#432c7a" />
              <stop offset="45%" stopColor="#25194a" />
              <stop offset="100%" stopColor="#110b24" />
            </linearGradient>

            <linearGradient id="platformBevelFrontRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2a1c52" />
              <stop offset="55%" stopColor="#170f33" />
              <stop offset="100%" stopColor="#0a0718" />
            </linearGradient>

            {/* High-Intensity Continuous Neon Light Ribbons */}
            <linearGradient id="neonRibbonMain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#c084fc" stopOpacity="1" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="75%" stopColor="#e879f9" stopOpacity="1" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="neonRibbonCore" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
            </linearGradient>

            {/* Upward Volumetric Reactor Beam */}
            <linearGradient id="upwardReactorBeam" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="15%" stopColor="#e9d5ff" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#a855f7" stopOpacity="0.38" />
              <stop offset="85%" stopColor="#6366f1" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
            </linearGradient>

            {/* Containment Riser Core Emitter */}
            <radialGradient id="riserEmitter" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="25%" stopColor="#f3e8ff" stopOpacity="1" />
              <stop offset="55%" stopColor="#c084fc" stopOpacity="0.9" />
              <stop offset="80%" stopColor="#7c3aed" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3b0764" stopOpacity="0" />
            </radialGradient>

            {/* Grounding Rocky Crag Gradients */}
            <linearGradient id="cragBodyGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#221845" />
              <stop offset="30%" stopColor="#140f2b" />
              <stop offset="70%" stopColor="#0b0818" />
              <stop offset="100%" stopColor="#05040a" />
            </linearGradient>

            <linearGradient id="cragRimHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#c084fc" stopOpacity="0.75" />
              <stop offset="80%" stopColor="#7c3aed" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b0764" stopOpacity="0" />
            </linearGradient>

            {/* Orbital Rings Laser Filament Gradient */}
            <linearGradient id="orbitalLaserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="20%" stopColor="#818cf8" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="80%" stopColor="#e879f9" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* STAGE 1: Vertical Atmospheric Beam */}
          <polygon
            points="465,0 535,0 610,510 390,510"
            fill="url(#verticalLightShaft)"
            opacity="0.75"
          />

          {/* STAGE 2: Deep Ground Contact Shadows & Violet Ambient Spill */}
          <ellipse
            cx="500"
            cy="585"
            rx="380"
            ry="90"
            fill="url(#groundPurpleWash)"
            filter="url(#cinematicBloom)"
          />
          <ellipse
            cx="500"
            cy="598"
            rx="290"
            ry="55"
            fill="#000000"
            fillOpacity="0.94"
            filter="url(#contactShadow)"
          />

          {/* STAGE 3: Foreground Grounding Rocks Flanking the Pedestal Base */}
          {/* Left Rocky Massif */}
          <g className={styles.groundingRocksLeft}>
            <path
              d="M 120,640 L 155,575 Q 185,535 210,545 L 235,520 Q 265,510 290,535 L 320,550 Q 345,525 375,540 L 410,580 L 410,640 Z"
              fill="url(#cragBodyGrad)"
            />
            <path
              d="M 155,575 Q 185,535 210,545 L 235,520 Q 265,510 290,535 L 320,550 Q 345,525 375,540 L 410,580"
              fill="none"
              stroke="url(#cragRimHighlight)"
              strokeWidth="2.4"
              filter="url(#specularGleam)"
            />
            <path
              d="M 235,520 Q 250,565 270,610 M 290,535 Q 305,580 325,625"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="1.2"
              strokeOpacity="0.45"
            />
          </g>

          {/* Right Rocky Massif */}
          <g className={styles.groundingRocksRight}>
            <path
              d="M 590,640 L 615,570 Q 645,530 675,545 L 705,515 Q 735,505 765,528 L 805,540 Q 840,510 875,535 L 910,590 L 910,640 Z"
              fill="url(#cragBodyGrad)"
            />
            <path
              d="M 615,570 Q 645,530 675,545 L 705,515 Q 735,505 765,528 L 805,540 Q 840,510 875,535 L 910,590"
              fill="none"
              stroke="url(#cragRimHighlight)"
              strokeWidth="2.4"
              filter="url(#specularGleam)"
            />
            <path
              d="M 705,515 Q 720,560 740,610 M 765,528 Q 780,575 805,625"
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />
          </g>

          {/* STAGE 4: Monolithic Multi-Tiered Pedestal Platform */}
          <g className={styles.monolithPlatform}>
            {/* LOWER TIER */}
            <path
              d="M 235,530 Q 235,542 245,548 L 500,608 Q 500,608 500,608 L 500,638 Q 500,638 490,634 L 240,574 Q 230,568 230,556 Z"
              fill="url(#platformBevelFrontLeft)"
            />
            <path
              d="M 500,608 L 755,548 Q 765,542 765,530 L 770,556 Q 770,568 760,574 L 510,634 Q 500,638 500,638 L 500,608 Z"
              fill="url(#platformBevelFrontRight)"
            />
            <path
              d="M 500,472 L 755,530 Q 765,536 755,542 L 500,604 Q 490,606 480,604 L 245,542 Q 235,536 245,530 L 500,472 Z"
              fill="url(#platformDeckLit)"
              stroke="url(#neonRibbonMain)"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
            {/* Lower Emissive Neon Light Channel */}
            <path
              d="M 238,552 L 498,614 Q 500,615 502,614 L 762,552"
              fill="none"
              stroke="url(#neonRibbonMain)"
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#neonGlow)"
            />
            <path
              d="M 238,552 L 498,614 Q 500,615 502,614 L 762,552"
              fill="none"
              stroke="url(#neonRibbonCore)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* MID TIER Shadow Recess */}
            <path
              d="M 270,518 L 500,568 L 730,518 L 500,468 Z"
              fill="#080614"
            />

            {/* UPPER TIER */}
            <path
              d="M 285,492 L 500,540 L 500,562 L 285,514 Z"
              fill="url(#platformBevelFrontLeft)"
            />
            <path
              d="M 500,540 L 715,492 L 715,514 L 500,562 Z"
              fill="url(#platformBevelFrontRight)"
            />
            <polygon
              points="500,444 715,492 500,540 285,492"
              fill="url(#platformDeckLit)"
              stroke="url(#neonRibbonMain)"
              strokeWidth="1.4"
            />
            {/* Upper Emissive Neon Light Band */}
            <path
              d="M 285,514 L 500,562 L 715,514"
              fill="none"
              stroke="url(#neonRibbonMain)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#neonGlow)"
            />
            <path
              d="M 285,514 L 500,562 L 715,514"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Polished Mirror Reflection of Logo on Deck */}
            <g opacity="0.3" transform="translate(0, 770) scale(1, -0.55)">
              <ellipse
                cx="500"
                cy="490"
                rx="65"
                ry="38"
                fill="#a855f7"
                filter="url(#neonGlow)"
              />
            </g>

            {/* CONTAINMENT REACTOR PAD */}
            <polygon
              points="500,466 595,486 500,506 405,486"
              fill="#120c2b"
              stroke="url(#neonRibbonMain)"
              strokeWidth="2.2"
              filter="url(#specularGleam)"
            />
            <ellipse
              cx="500"
              cy="486"
              rx="85"
              ry="28"
              fill="url(#riserEmitter)"
              filter="url(#cinematicBloom)"
            />
            <ellipse
              cx="500"
              cy="486"
              rx="45"
              ry="15"
              fill="#ffffff"
              fillOpacity="0.95"
              filter="url(#neonGlow)"
            />

            {/* Upward Volumetric Reactor Light Column */}
            <polygon
              points="440,486 560,486 605,185 395,185"
              fill="url(#upwardReactorBeam)"
              filter="url(#specularGleam)"
            />
          </g>

          {/* STAGE 5: Orbital Rings - BACK ARC */}
          <g className={styles.orbitalBack}>
            <path
              d="M 210,310 C 220,165 410,125 605,150 C 735,168 830,225 845,300"
              fill="none"
              stroke="url(#orbitalLaserGrad)"
              strokeWidth="2.6"
              opacity="0.65"
            />
            <path
              d="M 270,300 C 280,190 425,155 580,175 C 685,190 770,235 785,295"
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.2"
              strokeDasharray="6 6"
              opacity="0.45"
            />
          </g>

          {/* STAGE 6: Crystal Cube - BACK FACES & CAUSTICS */}
          <g className={styles.cubeLevitationGroup}>
            <ellipse
              cx="500"
              cy="265"
              rx="135"
              ry="115"
              fill="#7c3aed"
              fillOpacity="0.45"
              filter="url(#cinematicBloom)"
            />
            <circle
              cx="500"
              cy="265"
              r="65"
              fill="#c084fc"
              fillOpacity="0.38"
              filter="url(#neonGlow)"
            />

            {/* Internal Crystal Lattice Refraction Web */}
            <path
              d="M 385,200 L 500,265 L 615,200 
                 M 385,335 L 500,265 L 615,335 
                 M 500,125 L 500,265 L 500,400"
              fill="none"
              stroke="#e9d5ff"
              strokeWidth="1.4"
              strokeOpacity="0.45"
            />
            <path
              d="M 430,170 Q 500,230 570,170 M 430,360 Q 500,300 570,360"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.6"
              strokeOpacity="0.55"
              filter="url(#specularGleam)"
            />
          </g>
        </svg>

        {/* ============================================================== */}
        {/* LAYER B: 3D SETTLEX LOGO (ENCLOSED INSIDE CRYSTAL CHAMBER)     */}
        {/* ============================================================== */}
        <div className={styles.floatingLogoWrapper}>
          <Image
            src="/settlex-logo.png"
            alt="SettleX Core Protocol"
            width={210}
            height={210}
            priority
            className={styles.internalLogoImage}
          />
        </div>

        {/* ============================================================== */}
        {/* LAYER C: FRONT SVG SCENE                                       */}
        {/* (Front crystal faces, sheen, neon chamfers, front orbital arc) */}
        {/* ============================================================== */}
        <svg
          viewBox="0 0 1000 680"
          className={styles.sceneSvgFront}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <filter id="neonGlowFront" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="12" result="glowWide" />
              <feGaussianBlur stdDeviation="4.5" result="glowMid" />
              <feGaussianBlur stdDeviation="1.5" result="glowCore" />
              <feMerge>
                <feMergeNode in="glowWide" />
                <feMergeNode in="glowMid" />
                <feMergeNode in="glowCore" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="specularGleamFront" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="anamorphicStreakFront" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="9 1.5" result="streak" />
              <feMerge>
                <feMergeNode in="streak" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Front Crystal Glass Face Gradients */}
            <linearGradient id="crystalTopRefractionFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.35" />
              <stop offset="25%" stopColor="#c084fc" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#818cf8" stopOpacity="0.1" />
              <stop offset="85%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.25" />
            </linearGradient>

            <linearGradient id="crystalLeftRefractionFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
              <stop offset="35%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="75%" stopColor="#1e1b4b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0b081a" stopOpacity="0.35" />
            </linearGradient>

            <linearGradient id="crystalRightRefractionFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.28" />
              <stop offset="40%" stopColor="#7c3aed" stopOpacity="0.16" />
              <stop offset="80%" stopColor="#31104e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#110724" stopOpacity="0.38" />
            </linearGradient>

            <linearGradient id="specularGlintBandFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="20%" stopColor="#f3e8ff" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#c084fc" stopOpacity="0.12" />
              <stop offset="80%" stopColor="#ffffff" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="neonRibbonMainFront" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#c084fc" stopOpacity="1" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="75%" stopColor="#e879f9" stopOpacity="1" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="crystalNeonApexFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#e9d5ff" />
              <stop offset="70%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>

            <linearGradient id="crystalNeonLeftFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#e9d5ff" />
              <stop offset="60%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>

            <linearGradient id="crystalNeonRightFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#e9d5ff" />
              <stop offset="60%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>

            <linearGradient id="orbitalLaserGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="20%" stopColor="#818cf8" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="80%" stopColor="#e879f9" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* FRONT CRYSTAL CUBE FACES & SHEEN */}
          <g className={styles.cubeLevitationGroup}>
            {/* FRONT-LEFT FACE */}
            <polygon
              points="500,265 375,195 375,340 500,410"
              fill="url(#crystalLeftRefractionFront)"
            />
            <polygon
              points="395,218 422,204 482,375 455,389"
              fill="url(#specularGlintBandFront)"
              opacity="0.6"
            />
            <polygon
              points="488,268 388,210 388,332 488,394"
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />

            {/* FRONT-RIGHT FACE */}
            <polygon
              points="500,265 625,195 625,340 500,410"
              fill="url(#crystalRightRefractionFront)"
            />
            <polygon
              points="545,389 572,375 602,235 575,249"
              fill="url(#specularGlintBandFront)"
              opacity="0.5"
            />
            <polygon
              points="500,268 612,210 612,332 500,394"
              fill="none"
              stroke="#818cf8"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />

            {/* TOP FACE */}
            <polygon
              points="500,125 625,195 500,265 375,195"
              fill="url(#crystalTopRefractionFront)"
            />
            <polygon
              points="500,125 570,165 500,205 430,165"
              fill="url(#specularGlintBandFront)"
              opacity="0.7"
            />
            <polygon
              points="500,140 612,202 500,252 388,202"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeOpacity="0.5"
            />

            {/* CONTINUOUS LUMINOUS NEON EDGES */}
            <polygon
              points="500,125 625,195 625,340 500,410 375,340 375,195"
              fill="none"
              stroke="url(#neonRibbonMainFront)"
              strokeWidth="3.2"
              strokeLinejoin="round"
              filter="url(#neonGlowFront)"
            />
            <polygon
              points="500,125 625,195 625,340 500,410 375,340 375,195"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Internal 3D Y-Axis Chamfers */}
            <line
              x1="500"
              y1="125"
              x2="500"
              y2="265"
              stroke="url(#crystalNeonApexFront)"
              strokeWidth="2.8"
              filter="url(#specularGleamFront)"
            />
            <line
              x1="375"
              y1="195"
              x2="500"
              y2="265"
              stroke="url(#crystalNeonLeftFront)"
              strokeWidth="2.8"
              filter="url(#specularGleamFront)"
            />
            <line
              x1="625"
              y1="195"
              x2="500"
              y2="265"
              stroke="url(#crystalNeonRightFront)"
              strokeWidth="2.8"
              filter="url(#specularGleamFront)"
            />
            <line
              x1="500"
              y1="265"
              x2="500"
              y2="410"
              stroke="#ffffff"
              strokeWidth="3.6"
              filter="url(#neonGlowFront)"
            />
            <line
              x1="500"
              y1="265"
              x2="500"
              y2="410"
              stroke="#ffffff"
              strokeWidth="1.6"
            />

            {/* Anamorphic Lens Flare Streaks */}
            <ellipse
              cx="500"
              cy="125"
              rx="38"
              ry="2.8"
              fill="#ffffff"
              filter="url(#anamorphicStreakFront)"
            />
            <ellipse
              cx="500"
              cy="265"
              rx="45"
              ry="3.2"
              fill="#ffffff"
              filter="url(#anamorphicStreakFront)"
            />

            {/* Specular Vertex Pinpoint Flares at 7 Cube Corners */}
            <circle cx="500" cy="125" r="4.8" fill="#ffffff" filter="url(#neonGlowFront)" />
            <circle cx="625" cy="195" r="3.8" fill="#ffffff" filter="url(#specularGleamFront)" />
            <circle cx="375" cy="195" r="3.8" fill="#ffffff" filter="url(#specularGleamFront)" />
            <circle cx="500" cy="265" r="5.5" fill="#ffffff" filter="url(#neonGlowFront)" />
            <circle cx="500" cy="410" r="4.2" fill="#c084fc" filter="url(#neonGlowFront)" />
            <circle cx="375" cy="340" r="3.6" fill="#c084fc" filter="url(#specularGleamFront)" />
            <circle cx="625" cy="340" r="3.6" fill="#c084fc" filter="url(#specularGleamFront)" />
          </g>

          {/* FRONT ORBITAL ARC & TRAVELLING PHOTON */}
          <g className={styles.orbitalFront}>
            <path
              d="M 845,300 C 860,380 705,460 500,465 C 295,470 200,390 210,310"
              fill="none"
              stroke="url(#orbitalLaserGradFront)"
              strokeWidth="3.4"
              filter="url(#neonGlowFront)"
            />
            <path
              d="M 845,300 C 860,380 705,460 500,465 C 295,470 200,390 210,310"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <path
              d="M 785,295 C 798,360 660,430 500,435 C 340,440 255,370 270,300"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.4"
              strokeOpacity="0.65"
            />

            {/* Orbiting Photon Satellite Orb */}
            <g className={styles.travellingOrb}>
              <circle cx="735" cy="390" r="5" fill="#ffffff" filter="url(#neonGlowFront)" />
              <circle cx="735" cy="390" r="2.2" fill="#ffffff" />
              <ellipse cx="735" cy="390" rx="18" ry="1.8" fill="#38bdf8" filter="url(#anamorphicStreakFront)" />
            </g>

            {/* Laser Guides to Floating HUD Cards */}
            <path
              d="M 330,225 Q 240,210 200,215"
              fill="none"
              stroke="#c084fc"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.45"
            />
            <path
              d="M 280,410 Q 215,440 185,455"
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.45"
            />
            <path
              d="M 670,225 Q 760,210 800,215"
              fill="none"
              stroke="#818cf8"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.45"
            />
            <path
              d="M 720,410 Q 785,440 815,455"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.45"
            />
          </g>
        </svg>

        {/* ============================================================== */}
        {/* LAYER D: 4 FLOATING CINEMATIC 3D WORKFLOW NODES               */}
        {/* ============================================================== */}
        {/* Node 1: CREATE (Top Left) */}
        <button
          type="button"
          className={`${styles.workflowCard} ${styles.cardCreate}`}
          onClick={onCreateClick}
          aria-label="Create Bounty Workflow Stage"
        >
          <span className={styles.volumetricHalo} aria-hidden="true" />
          <span className={styles.specularShine} aria-hidden="true" />
          <span className={styles.innerGlassGleam} aria-hidden="true" />
          <div className={styles.cardContent}>
            <div className={styles.cardIconWrap}>
              <Icon name="file" size={24} className={styles.nodeIcon} />
            </div>
            <span className={styles.nodeLabel}>Create</span>
          </div>
        </button>

        {/* Node 2: FUND (Bottom Left) */}
        <button
          type="button"
          className={`${styles.workflowCard} ${styles.cardFund}`}
          onClick={onFundClick}
          aria-label="Fund Bounty Workflow Stage"
        >
          <span className={styles.volumetricHalo} aria-hidden="true" />
          <span className={styles.specularShine} aria-hidden="true" />
          <span className={styles.innerGlassGleam} aria-hidden="true" />
          <div className={styles.cardContent}>
            <div className={styles.cardIconWrap}>
              <Icon name="coins" size={24} className={styles.nodeIcon} />
            </div>
            <span className={styles.nodeLabel}>Fund</span>
          </div>
        </button>

        {/* Node 3: WORK (Top Right) */}
        <button
          type="button"
          className={`${styles.workflowCard} ${styles.cardWork}`}
          onClick={onWorkClick}
          aria-label="Work Submission Workflow Stage"
        >
          <span className={styles.volumetricHalo} aria-hidden="true" />
          <span className={styles.specularShine} aria-hidden="true" />
          <span className={styles.innerGlassGleam} aria-hidden="true" />
          <div className={styles.cardContent}>
            <div className={styles.cardIconWrap}>
              <Icon name="code" size={24} className={styles.nodeIcon} />
            </div>
            <span className={styles.nodeLabel}>Work</span>
          </div>
        </button>

        {/* Node 4: SETTLE (Bottom Right - Emerald Success Protocol) */}
        <button
          type="button"
          className={`${styles.workflowCard} ${styles.cardSettle}`}
          onClick={onSettleClick}
          aria-label="Settlement Execution Workflow Stage"
        >
          <span className={styles.volumetricHalo} aria-hidden="true" />
          <span className={styles.specularShine} aria-hidden="true" />
          <span className={styles.innerGlassGleam} aria-hidden="true" />
          <div className={styles.cardContent}>
            <div className={`${styles.cardIconWrap} ${styles.settleIconBadge}`}>
              <Icon name="check" size={20} className={styles.nodeIcon} />
            </div>
            <span className={styles.nodeLabel}>Settle</span>
          </div>
        </button>

      </div>
    </div>
  );
}
