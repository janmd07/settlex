'use client';

import React from 'react';
import styles from './HeroEnvironment.module.css';

export function HeroEnvironment() {
  return (
    <div className={styles.environmentRoot} aria-hidden="true">
      {/* Layer 1: Volumetric Cosmic Nebula & Layered Directional Radial Glows */}
      <div className={styles.nebulaGlowLayer} />

      {/* Layer 2: Cosmic Starfield & Micro-Dust Particles */}
      <svg
        className={styles.starfieldSvg}
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Distant Atmospheric Stars with varying sizes & subtle cosmic tints */}
        <circle cx="85" cy="45" r="0.9" fill="#ffffff" opacity="0.65" />
        <circle cx="140" cy="115" r="1.3" fill="#c084fc" opacity="0.75" />
        <circle cx="220" cy="65" r="1" fill="#818cf8" opacity="0.5" />
        <circle cx="295" cy="155" r="0.8" fill="#ffffff" opacity="0.4" />
        <circle cx="390" cy="85" r="1.1" fill="#e879f9" opacity="0.6" />
        <circle cx="510" cy="125" r="0.9" fill="#ffffff" opacity="0.5" />
        <circle cx="630" cy="38" r="1.4" fill="#38bdf8" opacity="0.8" />
        <circle cx="740" cy="110" r="1" fill="#c084fc" opacity="0.6" />
        <circle cx="860" cy="55" r="1.3" fill="#ffffff" opacity="0.75" />
        <circle cx="950" cy="140" r="0.8" fill="#818cf8" opacity="0.4" />
        <circle cx="1060" cy="45" r="1.4" fill="#e879f9" opacity="0.7" />
        <circle cx="1180" cy="95" r="1" fill="#ffffff" opacity="0.55" />
        <circle cx="1290" cy="55" r="1.2" fill="#38bdf8" opacity="0.65" />
        <circle cx="1380" cy="120" r="1" fill="#c084fc" opacity="0.5" />
        <circle cx="1470" cy="70" r="1.4" fill="#ffffff" opacity="0.75" />
        <circle cx="1550" cy="135" r="0.8" fill="#818cf8" opacity="0.45" />
      </svg>

      {/* Layer 3: Left Rocky Mountain Massif (Realistic Jagged Alpine Crag) */}
      <svg
        className={styles.leftMountainSvg}
        viewBox="0 0 280 560"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="leftCragGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e1838" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#141028" stopOpacity="0.96" />
            <stop offset="70%" stopColor="#0c0a18" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#07080d" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="leftRimLight" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#d8b4fe" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
          </linearGradient>

          <filter id="leftCragGlow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Realistic Rocky Mountain Body with Jagged Contours */}
        <path
          d="M 0,560 L 0,175 Q 8,155 18,140 Q 28,125 35,110 L 48,118 Q 58,102 72,82 L 80,90 Q 94,68 108,52 L 118,65 Q 128,88 136,115 L 145,110 Q 155,138 165,170 L 175,162 Q 188,198 198,240 L 190,255 Q 206,290 220,330 L 210,345 Q 228,390 242,435 L 232,450 Q 252,500 268,540 L 275,560 Z"
          fill="url(#leftCragGrad)"
        />

        {/* Illuminated Mountain Crest & Volumetric Violet Rim Light */}
        <path
          d="M 18,140 Q 28,125 35,110 L 48,118 Q 58,102 72,82 L 80,90 Q 94,68 108,52 L 118,65 Q 128,88 136,115 L 145,110 Q 155,138 165,170 L 175,162 Q 188,198 198,240 L 190,255 Q 206,290 220,330 L 210,345 Q 228,390 242,435 L 232,450 Q 252,500 268,540"
          fill="none"
          stroke="url(#leftRimLight)"
          strokeWidth="2.2"
          filter="url(#leftCragGlow)"
        />

        {/* Rocky Crevice Shadow & Facet Highlights */}
        <path
          d="M 108,52 Q 95,110 82,165 Q 70,210 58,260 
             M 136,115 Q 122,175 110,235 Q 98,290 85,340 
             M 165,170 Q 150,230 135,295 
             M 198,240 Q 180,310 162,380 
             M 220,330 Q 200,405 180,480"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1.2"
          strokeOpacity="0.32"
        />
        <path
          d="M 108,52 Q 115,85 125,120 M 136,115 Q 145,150 155,190 M 165,170 Q 175,210 188,255"
          fill="none"
          stroke="#c084fc"
          strokeWidth="1"
          strokeOpacity="0.4"
        />
      </svg>

      {/* Layer 4: Distant Horizon Mountain Ridges (Layered Atmospheric Depth) */}
      <svg
        className={styles.horizonMountainSvg}
        viewBox="0 0 1600 240"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="horizonRidgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1f183d" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#100d24" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#07080d" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="horizonRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="30%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#c084fc" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Natural Jagged Mountain Horizon Contour with Multi-Summit Ridges */}
        <path
          d="M 0,240 L 0,125 
             Q 45,115 85,102 Q 125,120 165,108 Q 205,88 250,95 Q 295,112 340,98 Q 385,75 430,82 Q 475,100 520,86 Q 565,65 615,72 Q 665,92 715,78 Q 765,58 815,64 Q 865,85 915,70 Q 965,52 1015,58 Q 1065,80 1115,68 Q 1165,48 1220,54 Q 1275,76 1330,62 Q 1385,42 1440,48 Q 1495,68 1550,56 Q 1580,64 1600,60 L 1600,240 Z"
          fill="url(#horizonRidgeGrad)"
        />
        {/* Subtle Violet Ridge Highlight along the crest */}
        <path
          d="M 0,125 
             Q 45,115 85,102 Q 125,120 165,108 Q 205,88 250,95 Q 295,112 340,98 Q 385,75 430,82 Q 475,100 520,86 Q 565,65 615,72 Q 665,92 715,78 Q 765,58 815,64 Q 865,85 915,70 Q 965,52 1015,58 Q 1065,80 1115,68 Q 1165,48 1220,54 Q 1275,76 1330,62 Q 1385,42 1440,48 Q 1495,68 1550,56 Q 1580,64 1600,60"
          fill="none"
          stroke="url(#horizonRimGrad)"
          strokeWidth="1.4"
          opacity="0.65"
        />
      </svg>

      {/* Layer 5: Distant Monumental Arch (Monad Portal) & Right Alpine Massif */}
      <div className={styles.rightEnvironmentCluster}>
        <svg
          className={styles.rightClusterSvg}
          viewBox="0 0 680 540"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Monumental Portal Gradients */}
            <linearGradient id="envPortalBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b084ff" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#7c3aed" stopOpacity="0.75" />
              <stop offset="75%" stopColor="#3b0764" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1a0b36" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="envPortalRimGrad" x1="0%" y1="0%" x2="100%" y2="70%">
              <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#c084fc" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#4338ca" stopOpacity="0.2" />
            </linearGradient>

            <filter id="envPortalGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" result="blurWide" />
              <feGaussianBlur stdDeviation="8" result="blurMid" />
              <feMerge>
                <feMergeNode in="blurWide" />
                <feMergeNode in="blurMid" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Right Rocky Massif Gradients */}
            <linearGradient id="envRightCragGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#1c163a" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#130e26" stopOpacity="0.96" />
              <stop offset="75%" stopColor="#0b0918" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#07080d" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="envRightRimLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d8b4fe" stopOpacity="0.8" />
              <stop offset="35%" stopColor="#a855f7" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Monumental Delta Arch Portal (Monad Architectural Monument) */}
          <g filter="url(#envPortalGlow)">
            <path
              d="M 400,240 C 375,130 435,35 510,30 C 585,25 625,105 605,210 C 585,290 500,305 430,290 C 405,280 402,255 400,240 Z"
              fill="url(#envPortalBodyGrad)"
              stroke="url(#envPortalRimGrad)"
              strokeWidth="5"
              opacity="0.85"
            />
            {/* Aperture */}
            <path
              d="M 440,230 C 430,155 465,95 515,90 C 558,85 580,135 568,205 C 552,258 500,268 460,258 C 448,250 442,240 440,230 Z"
              fill="#080712"
              fillOpacity="0.94"
              stroke="url(#envPortalRimGrad)"
              strokeWidth="2.5"
            />
            {/* Radiation Core */}
            <ellipse
              cx="510"
              cy="175"
              rx="65"
              ry="52"
              fill="#a855f7"
              fillOpacity="0.3"
            />
          </g>

          {/* Right Alpine Mountain Peaks */}
          <path
            d="M 220,540 L 250,440 Q 285,395 315,370 L 335,385 Q 365,335 390,320 L 410,340 Q 442,295 470,285 L 490,310 Q 525,265 560,255 L 580,280 Q 610,255 640,265 L 680,250 L 680,540 Z"
            fill="url(#envRightCragGrad)"
          />
          {/* Violet Rim Light along Mountain Crest */}
          <path
            d="M 250,440 Q 285,395 315,370 L 335,385 Q 365,335 390,320 L 410,340 Q 442,295 470,285 L 490,310 Q 525,265 560,255 L 580,280 Q 610,255 640,265 L 680,250"
            fill="none"
            stroke="url(#envRightRimLight)"
            strokeWidth="2.6"
          />
          {/* Internal Crevice Highlights */}
          <path
            d="M 390,320 Q 410,380 435,440 
               M 470,285 Q 490,355 520,430 
               M 560,255 Q 575,330 590,400"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1.2"
            strokeOpacity="0.35"
          />
        </svg>
      </div>

      {/* Layer 6: Seamless Atmospheric Bottom Fade into SettleX App Background */}
      <div className={styles.bottomSeamlessFade} />
    </div>
  );
}
