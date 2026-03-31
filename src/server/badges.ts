/**
 * GET /badges            — Badge & seal pack page
 * GET /badges/badge-dark.svg   — Compact badge, dark background
 * GET /badges/badge-light.svg  — Compact badge, light background
 * GET /badges/badge-green.svg  — Compact badge, green background
 * GET /badges/usage.svg?token= — Dynamic usage badge (live credits retired, uses badge_token not api_key)
 */

import { Router, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import type Database from "better-sqlite3";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { getUserByBadgeToken, getSubscriberByUserId, getCumulativeAttribution } from "./db.js";

// ---------------------------------------------------------------------------
// In-memory rate limiter for /badges/* endpoints
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window per IP

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateBucket>();

// Cleanup stale entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateLimitMap) {
    if (bucket.resetAt <= now) rateLimitMap.delete(ip);
  }
}, 120_000).unref();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX;
}

function loadIconBase64(filename: string): string {
  const iconPath = join(process.cwd(), "public", filename);
  if (!existsSync(iconPath)) return "";
  const data = readFileSync(iconPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

const ICONS = [
  { id: "1", file: "badge-icon-1.png", label: "Leaf Swirl",   desc: "Clean & minimal" },
  { id: "2", file: "badge-icon-2.png", label: "Circuit Leaf", desc: "Bold & distinctive" },
  { id: "3", file: "badge-icon-3.png", label: "Glossy Badge", desc: "Premium feel" },
];

const ICON_DATA_URIS: Record<string, string> = Object.fromEntries(
  ICONS.map(icon => [icon.id, loadIconBase64(icon.file)])
);

// Default icon used for the static SVG badge assets
const ICON_DATA_URI = ICON_DATA_URIS["1"] || "";

// ---------------------------------------------------------------------------
// Static badge SVGs (compact horizontal, three themes)
// ---------------------------------------------------------------------------

function compactBadgeSVG(theme: "dark" | "light" | "green", iconUrl: string = ICON_DATA_URI): string {
  const themes = {
    dark: {
      leftBg1: "#0b3322", leftBg2: "#0a2e1f",
      rightBg1: "#145433", rightBg2: "#0f4029",
      labelColor: "rgba(255,255,255,0.92)", valueColor: "#7ee8a8",
      border: "", borderGlow: "rgba(79,181,115,0.15)",
      divider: "rgba(255,255,255,0.12)", dividerGlow: "rgba(126,232,168,0.25)",
      leafColor: "rgba(79,181,115,0.07)", shadowColor: "rgba(0,0,0,0.35)",
    },
    light: {
      leftBg1: "#f7fcf9", leftBg2: "#eef7f1",
      rightBg1: "#ffffff", rightBg2: "#f8fcfa",
      labelColor: "#0a2e1f", valueColor: "#1a7a45",
      border: "#c3e8d0", borderGlow: "rgba(79,181,115,0.08)",
      divider: "#d4ead9", dividerGlow: "rgba(26,122,69,0.08)",
      leafColor: "rgba(79,181,115,0.06)", shadowColor: "rgba(0,0,0,0.06)",
    },
    green: {
      leftBg1: "#1e7a4c", leftBg2: "#1a6640",
      rightBg1: "#56c07d", rightBg2: "#4fb573",
      labelColor: "rgba(255,255,255,0.95)", valueColor: "#ffffff",
      border: "", borderGlow: "rgba(255,255,255,0.12)",
      divider: "rgba(255,255,255,0.18)", dividerGlow: "rgba(255,255,255,0.08)",
      leafColor: "rgba(255,255,255,0.06)", shadowColor: "rgba(0,0,0,0.2)",
    },
  };
  const t = themes[theme];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="32" viewBox="0 0 240 32" role="img" aria-label="Powered by Regenerative Compute">
  <defs>
    <clipPath id="rc-clip-${theme}"><rect width="240" height="32" rx="6"/></clipPath>
    <linearGradient id="rc-left-${theme}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.leftBg1}"/>
      <stop offset="100%" stop-color="${t.leftBg2}"/>
    </linearGradient>
    <linearGradient id="rc-right-${theme}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.rightBg1}"/>
      <stop offset="100%" stop-color="${t.rightBg2}"/>
    </linearGradient>
    <filter id="rc-shadow-${theme}" x="-2%" y="-8%" width="104%" height="125%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="${t.shadowColor}"/>
    </filter>
    <filter id="rc-glow-${theme}" x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
    </filter>
  </defs>
  <g filter="url(#rc-shadow-${theme})">
    <g clip-path="url(#rc-clip-${theme})">
      <!-- Left section gradient -->
      <rect width="240" height="32" fill="url(#rc-left-${theme})" rx="6"/>
      <!-- Right section gradient -->
      <rect x="134" width="106" height="32" fill="url(#rc-right-${theme})"/>
      <!-- Decorative leaf vein at divider -->
      <path d="M131,28 Q127,20 131,11 Q129,17 133,22 Q131,19 131,28 Z" fill="${t.leafColor}" opacity="0.9"/>
      <path d="M135,4 Q139,12 135,21 Q137,15 133,10 Q135,13 135,4 Z" fill="${t.leafColor}" opacity="0.6"/>
      <!-- Divider glow (soft bloom behind line) -->
      <line x1="133.5" y1="5" x2="133.5" y2="27" stroke="${t.dividerGlow}" stroke-width="3" filter="url(#rc-glow-${theme})"/>
      <!-- Divider line (crisp) -->
      <line x1="133.5" y1="7" x2="133.5" y2="25" stroke="${t.divider}" stroke-width="0.75"/>
      <!-- Border -->
      ${t.border ? `<rect width="240" height="32" fill="none" rx="6" stroke="${t.border}" stroke-width="1"/>` : ""}
      <!-- Subtle top-edge highlight for depth -->
      <rect x="1" y="1" width="238" height="1" rx="0.5" fill="${t.borderGlow}"/>
      <!-- Icon -->
      <image href="${iconUrl}" x="6" y="4" width="24" height="24"/>
      <!-- Label -->
      <text x="36" y="20.5" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="11.5" font-weight="600" fill="${t.labelColor}" letter-spacing="0.03em">Regen Compute</text>
      <!-- Value (uppercase for distinction) -->
      <text x="187" y="20.5" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="10.5" font-weight="700" fill="${t.valueColor}" text-anchor="middle" letter-spacing="0.06em">REGENERATIVE AI</text>
    </g>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Dynamic usage badge SVG
// ---------------------------------------------------------------------------

function usageBadgeSVG(opts: {
  credits: number;
  label: string;
  months: number;
  theme?: "dark" | "light" | "green";
  iconUrl?: string;
}): string {
  const { credits, label, months, iconUrl = ICON_DATA_URI } = opts;
  const theme = opts.theme ?? "dark";

  const themes = {
    dark: {
      bg1: "#0b3322", bg2: "#0a2e1f",
      accent: "#7ee8a8", accentDim: "rgba(126,232,168,0.15)",
      text: "#fff", sub: "rgba(255,255,255,0.5)",
      divider: "rgba(126,232,168,0.2)", shadowColor: "rgba(0,0,0,0.4)",
      patternColor: "rgba(79,181,115,0.04)", glowColor: "rgba(126,232,168,0.12)",
      leafColor: "rgba(79,181,115,0.06)",
    },
    light: {
      bg1: "#f7fcf9", bg2: "#eef7f1",
      accent: "#1a7a45", accentDim: "rgba(26,122,69,0.08)",
      text: "#0a2e1f", sub: "#6b8f7a",
      divider: "rgba(26,122,69,0.12)", shadowColor: "rgba(0,0,0,0.08)",
      patternColor: "rgba(79,181,115,0.04)", glowColor: "rgba(26,122,69,0.05)",
      leafColor: "rgba(79,181,115,0.05)",
    },
    green: {
      bg1: "#1e7a4c", bg2: "#1a6640",
      accent: "#d4f5e2", accentDim: "rgba(255,255,255,0.1)",
      text: "#fff", sub: "rgba(255,255,255,0.6)",
      divider: "rgba(255,255,255,0.15)", shadowColor: "rgba(0,0,0,0.25)",
      patternColor: "rgba(255,255,255,0.03)", glowColor: "rgba(255,255,255,0.06)",
      leafColor: "rgba(255,255,255,0.05)",
    },
  };
  const t = themes[theme];

  const creditsFormatted = credits >= 1000
    ? `${(credits / 1000).toFixed(1)}k`
    : credits.toFixed(credits < 10 ? 2 : 1);

  // Growth bar width (visual indicator, caps at 100% for display)
  const growthPercent = Math.min(100, Math.max(4, credits * 10));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80" role="img" aria-label="Regen Compute — ${creditsFormatted} ${label} retired">
  <defs>
    <clipPath id="ub-clip-${theme}"><rect width="240" height="80" rx="10"/></clipPath>
    <linearGradient id="ub-bg-${theme}" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
    <linearGradient id="ub-bar-${theme}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.accent}"/>
      <stop offset="100%" stop-color="${t.accent}" stop-opacity="0.4"/>
    </linearGradient>
    <filter id="ub-shadow-${theme}" x="-3%" y="-5%" width="106%" height="118%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${t.shadowColor}"/>
    </filter>
    <filter id="ub-numglow-${theme}" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
    </filter>
    <!-- Subtle diagonal line pattern for texture -->
    <pattern id="ub-pattern-${theme}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="${t.patternColor}" stroke-width="1"/>
    </pattern>
  </defs>
  <g filter="url(#ub-shadow-${theme})">
    <g clip-path="url(#ub-clip-${theme})">
      <!-- Background gradient -->
      <rect width="240" height="80" fill="url(#ub-bg-${theme})"/>
      <!-- Subtle diagonal texture -->
      <rect width="240" height="80" fill="url(#ub-pattern-${theme})"/>
      <!-- Decorative leaf veins (bottom-right corner) -->
      <path d="M220,80 Q210,65 220,50 Q215,60 225,68 Q220,63 220,80 Z" fill="${t.leafColor}" opacity="0.8"/>
      <path d="M230,80 Q225,70 230,58 Q228,66 233,72 Q230,69 230,80 Z" fill="${t.leafColor}" opacity="0.5"/>
      <path d="M210,80 Q202,72 210,60 Q206,68 214,74 Q210,71 210,80 Z" fill="${t.leafColor}" opacity="0.3"/>
      <!-- Top highlight strip -->
      <rect x="0" y="0" width="240" height="1" fill="${t.glowColor}"/>
      <!-- Icon -->
      <image href="${iconUrl}" x="14" y="10" width="36" height="36"/>
      <!-- Credits number glow -->
      <text x="62" y="34" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="26" font-weight="800" fill="${t.accent}" letter-spacing="-0.03em" filter="url(#ub-numglow-${theme})" opacity="0.4">${creditsFormatted}</text>
      <!-- Credits number (prominent) -->
      <text x="62" y="34" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="26" font-weight="800" fill="${t.accent}" letter-spacing="-0.03em">${creditsFormatted}</text>
      <!-- Label -->
      <text x="62" y="48" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="10.5" font-weight="600" fill="${t.text}" letter-spacing="0.04em" opacity="0.85">${label} retired</text>
      <!-- Growth progress bar -->
      <rect x="14" y="56" width="212" height="3" rx="1.5" fill="${t.accentDim}"/>
      <rect x="14" y="56" width="${(growthPercent / 100) * 212}" height="3" rx="1.5" fill="url(#ub-bar-${theme})"/>
      <!-- Footer -->
      <text x="14" y="73" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="8.5" fill="${t.sub}" letter-spacing="0.05em" font-weight="500">POWERED BY REGENERATIVE COMPUTE</text>
      ${months > 0 ? `<text x="226" y="73" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif" font-size="8.5" fill="${t.sub}" text-anchor="end" letter-spacing="0.02em" font-weight="500">${months} mo</text>` : ""}
    </g>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Page HTML
// ---------------------------------------------------------------------------

function badgesPageHTML(baseUrl: string): string {
  const darkEncoded   = encodeURIComponent(compactBadgeSVG("dark"));
  const lightEncoded  = encodeURIComponent(compactBadgeSVG("light"));
  const greenEncoded  = encodeURIComponent(compactBadgeSVG("green"));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Badge Pack — Regenerative Compute</title>
  <meta name="description" content="Display your commitment to ecological AI. Download the Regen Compute badge or seal for your README, website, or product docs.">
  <meta property="og:title" content="Regen Compute — Badge Pack">
  <meta property="og:description" content="Show your commitment to regenerative AI. Free badge assets for your README, website, or product.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/badges">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenChristian">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .badges-hero {
      padding: 64px 0 48px; text-align: center;
      border-bottom: 1px solid var(--color-border);
    }
    .badges-hero h1 {
      font-size: 36px; font-weight: 800; color: var(--color-cream);
      font-family: var(--font-display), serif;
      margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .badges-hero h1 span {
      background: linear-gradient(180deg, var(--color-emerald-bright), var(--color-emerald));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .badges-hero .subtitle {
      font-size: 17px; color: var(--color-muted);
      font-family: var(--font-body), serif;
      max-width: 580px; margin: 0 auto; line-height: 1.65;
    }

    .section { padding: 56px 0; }
    .section h2 {
      font-size: 22px; font-weight: 800; color: var(--color-cream);
      font-family: var(--font-display), serif;
      margin: 0 0 6px; letter-spacing: -0.01em;
    }
    .section-lead {
      font-size: 15px; color: var(--color-muted); margin: 0 0 32px; line-height: 1.6;
      font-family: var(--font-body), serif;
    }

    .badge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px; margin-bottom: 48px;
    }

    .badge-card {
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius-lg);
      overflow: hidden; background: var(--color-card);
    }
    .badge-preview {
      padding: 36px 24px;
      display: flex; align-items: center; justify-content: center;
      min-height: 100px;
    }
    .badge-preview--black  { background: #111; }
    .badge-preview--white  { background: #fff; border-bottom: 1px solid var(--color-border); }
    .badge-preview--green  { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }
    .badge-preview--seal-black { background: #111; }
    .badge-preview--seal-white { background: #fff; border-bottom: 1px solid var(--color-border); }
    .badge-preview--seal-green { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }

    .badge-info { padding: 18px 18px 22px; border-top: 1px solid var(--color-border); }
    .badge-info h3 { font-size: 14px; font-weight: 700; color: var(--color-cream); margin: 0 0 4px; font-family: var(--font-ui), sans-serif; }
    .badge-info p  { font-size: 13px; color: var(--color-muted); margin: 0 0 14px; line-height: 1.5; font-family: var(--font-body), serif; }

    .snippet-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
    .tab-btn {
      font-size: 11px; font-weight: 600; padding: 3px 9px;
      border-radius: 4px; border: 1px solid var(--color-border);
      background: var(--color-surface); color: var(--color-muted);
      cursor: pointer; font-family: var(--font-ui), sans-serif;
    }
    .tab-btn.active {
      background: var(--color-emerald-dim); color: var(--color-emerald-bright);
      border-color: var(--color-border-emerald);
    }
    .snippet-block {
      position: relative;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 6px; padding: 9px 40px 9px 11px;
      font-family: var(--font-mono), 'Monaco','Menlo','Consolas',monospace;
      font-size: 10.5px; color: var(--color-cream-soft); line-height: 1.6;
      word-break: break-all; white-space: pre-wrap;
      display: none;
    }
    .snippet-block.visible { display: block; }
    .copy-btn {
      position: absolute; top: 7px; right: 7px;
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: 4px; padding: 2px 7px;
      font-size: 11px; font-weight: 600; color: var(--color-muted);
      cursor: pointer; font-family: var(--font-ui), sans-serif;
    }
    .copy-btn:hover { background: var(--color-emerald-dim); color: var(--color-emerald-bright); border-color: var(--color-border-emerald); }
    .copy-btn.copied { color: var(--color-emerald-bright); border-color: var(--color-border-emerald); }

    .download-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600; color: var(--color-emerald-bright);
      text-decoration: none; padding: 5px 11px;
      border: 1px solid var(--color-border-emerald);
      border-radius: 6px; background: var(--color-emerald-dim);
      margin-top: 10px; font-family: var(--font-ui), sans-serif;
    }
    .download-btn:hover { background: var(--color-emerald-glow); }

    .icon-pick-btn {
      padding: 14px 18px; border-radius: 10px; border: 2px solid var(--color-border);
      background: var(--color-card); cursor: pointer; text-align: center;
      min-width: 100px; transition: all 0.15s; font-family: inherit;
    }
    .icon-pick-btn:hover { border-color: var(--color-emerald); background: var(--color-emerald-dim); }

    /* Usage badge section */
    .usage-explainer {
      background: var(--color-card);
      border: 1px solid var(--color-border-emerald);
      border-radius: var(--regen-radius-lg);
      padding: 40px; margin-bottom: 32px; color: var(--color-cream);
    }
    .usage-explainer h2 { color: var(--color-cream); font-size: 20px; margin: 0 0 12px; font-family: var(--font-display), serif; }
    .usage-explainer p  { color: var(--color-cream-soft); font-size: 15px; line-height: 1.7; margin: 0 0 20px; font-family: var(--font-body), serif; }
    .usage-key-form { display: flex; gap: 10px; flex-wrap: wrap; }
    .usage-key-input {
      flex: 1; min-width: 240px;
      background: var(--color-surface); border: 1px solid var(--color-border-light);
      border-radius: 6px; padding: 10px 14px;
      font-size: 13px; color: var(--color-cream); font-family: var(--font-mono), 'Monaco','Menlo','Consolas',monospace;
      outline: none;
    }
    .usage-key-input::placeholder { color: var(--color-dim); }
    .usage-key-input:focus { border-color: var(--color-emerald); }
    .usage-preview-btn {
      background: var(--color-emerald); color: var(--color-cream); border: none;
      border-radius: 6px; padding: 10px 20px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: var(--font-ui), sans-serif;
    }
    .usage-preview-btn:hover { background: var(--color-emerald-bright); }
    .usage-preview-area { margin-top: 24px; display: none; }
    .usage-preview-area.visible { display: block; }
    .usage-preview-frames {
      display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
    }
    .usage-frame {
      padding: 20px 24px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .usage-frame--black { background: #111; }
    .usage-frame--white { background: #fff; border: 1px solid var(--color-border); }
    .usage-frame--green { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }

    .usage-snippet {
      background: var(--color-surface); border: 1px solid var(--color-border-light);
      border-radius: 6px; padding: 12px 40px 12px 14px; position: relative;
      font-family: var(--font-mono), 'Monaco','Menlo','Consolas',monospace;
      font-size: 11px; color: var(--color-cream-soft); line-height: 1.6;
      word-break: break-all; white-space: pre-wrap;
    }
    .usage-snippet .copy-btn {
      background: var(--color-card); border-color: var(--color-border-light); color: var(--color-muted);
    }

    .what-it-means {
      background: var(--color-emerald-dim);
      border: 1px solid var(--color-border-emerald);
      border-radius: var(--regen-radius-lg);
      padding: 40px; margin-bottom: 56px;
    }
    .what-it-means h2 { font-size: 20px; color: var(--color-cream); margin: 0 0 12px; font-family: var(--font-display), serif; }
    .what-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px; margin-top: 20px;
    }
    .what-card {
      background: var(--color-card); border: 1px solid var(--color-border-emerald);
      border-radius: var(--regen-radius); padding: 16px 18px;
    }
    .what-card .icon { font-size: 18px; margin-bottom: 6px; }
    .what-card h3 { font-size: 13px; font-weight: 700; color: var(--color-cream); margin: 0 0 4px; font-family: var(--font-ui), sans-serif; }
    .what-card p  { font-size: 13px; color: var(--color-muted); line-height: 1.55; margin: 0; font-family: var(--font-body), serif; }

    @media (max-width: 640px) {
      .badges-hero { padding: 48px 0 36px; }
      .badges-hero h1 { font-size: 26px; }
      .usage-explainer { padding: 28px 20px; }
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({
    nav: [
      { label: "AI Plugin", href: "/ai-plugin" },
      { label: "Research", href: "/research" },
      { label: "About", href: "/about" },
      { label: "Dashboard", href: "/dashboard/login" },
    ],
  })}

  <section class="badges-hero">
    <div class="regen-container">
      <h1>Show Your <span>Regenerative AI</span> Commitment</h1>
      <p class="subtitle">
        Use these badges in your README, on your website, or in your product docs.
        Every badge signals that your AI usage funds verified ecological regeneration on Regen Network.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="regen-container">

      <!-- Compact badges -->
      <h2>Compact Badges</h2>
      <p class="section-lead">Horizontal badge in three themes — pick what fits your background.</p>

      <div class="badge-grid">
        ${["dark","light","green"].map(theme => {
          const labels: Record<string,string> = { dark: "Dark", light: "Light", green: "Green" };
          const descs: Record<string,string> = {
            dark: "For dark backgrounds, dark-theme READMEs, and dark UIs.",
            light: "For light backgrounds, white docs, and GitHub READMEs.",
            green: "For green-branded pages or anywhere you want a bold look.",
          };
          const svgUrl = `${baseUrl}/badges/badge-${theme}.svg`;
          const encoded = theme === "dark" ? darkEncoded : theme === "light" ? lightEncoded : greenEncoded;
          return `
        <div class="badge-card">
          <div class="badge-preview badge-preview--${theme === "dark" ? "black" : theme === "light" ? "white" : "green"}">
            <img src="data:image/svg+xml,${encoded}" alt="Regen Compute ${labels[theme]} badge" width="240" height="32">
          </div>
          <div class="badge-info">
            <h3>${labels[theme]}</h3>
            <p>${descs[theme]}</p>
            <div class="snippet-tabs">
              <button class="tab-btn active" onclick="showTab(this,'${theme}','markdown')">Markdown</button>
              <button class="tab-btn" onclick="showTab(this,'${theme}','html')">HTML</button>
              <button class="tab-btn" onclick="showTab(this,'${theme}','url')">URL</button>
            </div>
            <div class="snippet-block visible" id="${theme}-markdown">[![Powered by Regenerative Compute](${svgUrl})](${baseUrl})<button class="copy-btn" onclick="copySnippet(this,'${theme}-markdown')">Copy</button></div>
            <div class="snippet-block" id="${theme}-html">&lt;a href="${baseUrl}" target="_blank" rel="noopener"&gt;\n  &lt;img src="${svgUrl}" alt="Powered by Regenerative Compute" width="240" height="32"&gt;\n&lt;/a&gt;<button class="copy-btn" onclick="copySnippet(this,'${theme}-html')">Copy</button></div>
            <div class="snippet-block" id="${theme}-url">${svgUrl}<button class="copy-btn" onclick="copySnippet(this,'${theme}-url')">Copy</button></div>
            <a class="download-btn" href="${svgUrl}" download="regen-compute-badge-${theme}.svg">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Download SVG
            </a>
          </div>
        </div>`;
        }).join("")}
      </div>

      <!-- Icon picker -->
      <h2>Certified Seal</h2>
      <p class="section-lead">Choose your icon, then grab the embed code for your preferred background.</p>

      <!-- Icon selector -->
      <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
        ${ICONS.map(icon => `
        <button class="icon-pick-btn" id="pick-${icon.id}" onclick="selectIcon('${icon.id}','${baseUrl}/public/${icon.file}')" style="${icon.id === "1" ? "border-color:var(--color-emerald);background:var(--color-emerald-dim);" : ""}">
          <img src="data:image/png;base64,${ICON_DATA_URIS[icon.id].replace("data:image/png;base64,","")}" width="64" height="64" style="display:block;margin:0 auto 8px;">
          <div style="font-size:12px;font-weight:700;color:var(--color-cream)">${icon.label}</div>
          <div style="font-size:11px;color:var(--color-dim)">${icon.desc}</div>
        </button>`).join("")}
      </div>

      <div class="badge-grid" id="seal-grid">
        ${[["black","#111"],["white","#fff"],["green","linear-gradient(135deg,#1a5c3a,#0d7a5f)"]].map(([bg, _]) => {
          const sealUrl = `${baseUrl}/public/badge-icon-1.png`;
          const id = `seal-${bg}`;
          return `
        <div class="badge-card">
          <div class="badge-preview badge-preview--seal-${bg}">
            <img class="seal-preview-img" src="${sealUrl}" alt="Regen Compute seal" style="width:120px;height:120px;object-fit:contain;">
          </div>
          <div class="badge-info">
            <h3>Seal — ${bg.charAt(0).toUpperCase() + bg.slice(1)}</h3>
            <p>120×120 icon on ${bg} background.</p>
            <div class="snippet-tabs">
              <button class="tab-btn active" onclick="showTab(this,'${id}','html')">HTML</button>
              <button class="tab-btn" onclick="showTab(this,'${id}','markdown')">Markdown</button>
              <button class="tab-btn" onclick="showTab(this,'${id}','url')">URL</button>
            </div>
            <div class="snippet-block visible" id="${id}-html">&lt;a href="${baseUrl}" target="_blank" rel="noopener"&gt;\n  &lt;img src="${sealUrl}" alt="Regen Compute Certified" width="120" height="120"&gt;\n&lt;/a&gt;<button class="copy-btn" onclick="copySnippet(this,'${id}-html')">Copy</button></div>
            <div class="snippet-block" id="${id}-markdown">[![Regen Compute Certified](${sealUrl})](${baseUrl})<button class="copy-btn" onclick="copySnippet(this,'${id}-markdown')">Copy</button></div>
            <div class="snippet-block" id="${id}-url">${sealUrl}<button class="copy-btn" onclick="copySnippet(this,'${id}-url')">Copy</button></div>
            <a class="download-btn seal-download-btn" href="${sealUrl}" download="regen-compute-seal.png">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Download PNG
            </a>
          </div>
        </div>`;
        }).join("")}
      </div>

      <!-- Dynamic usage badge -->
      <div class="usage-explainer">
        <h2>Live Usage Badge</h2>
        <p>
          A dynamic badge that shows your actual credits retired — updated live from your subscription.
          Paste your <strong style="color:var(--color-emerald-bright)">badge token</strong> (from your dashboard) to preview and get your embed code.
          Your badge token is read-only and safe to embed in public HTML.
        </p>
        <div class="usage-key-form">
          <input class="usage-key-input" id="api-key-input" type="text" placeholder="Paste your badge token (from your dashboard)">
          <button class="usage-preview-btn" onclick="previewUsage()">Preview Badge</button>
        </div>
        <div class="usage-preview-area" id="usage-preview-area">
          <div class="usage-preview-frames">
            <div class="usage-frame usage-frame--black">
              <img id="usage-badge-dark"  src="" alt="Usage badge dark"  width="240" height="80">
            </div>
            <div class="usage-frame usage-frame--white">
              <img id="usage-badge-light" src="" alt="Usage badge light" width="240" height="80">
            </div>
            <div class="usage-frame usage-frame--green">
              <img id="usage-badge-green" src="" alt="Usage badge green" width="240" height="80">
            </div>
          </div>
          <div class="usage-snippet" id="usage-snippet">
            <button class="copy-btn" onclick="copyUsageSnippet()">Copy</button>
          </div>
        </div>
      </div>

      <!-- What it means -->
      <div class="what-it-means">
        <h2>What Does the Badge Mean?</h2>
        <p style="color:var(--color-cream-soft);font-size:15px;line-height:1.7;margin:0 0 4px;font-family:var(--font-body),serif;">
          When you display the Regen Compute badge, you&rsquo;re telling your users that your AI usage
          is backed by verified ecological credit retirements on <a href="https://regen.network" target="_blank" rel="noopener" style="color:var(--color-emerald-bright)">Regen Network</a>.
          Not a pledge — real credits, retired permanently on-chain.
        </p>
        <div class="what-grid">
          <div class="what-card">
            <div class="icon">🌱</div>
            <h3>Verified Credits</h3>
            <p>Every credit is MRV-verified by independent scientists.</p>
          </div>
          <div class="what-card">
            <div class="icon">⛓️</div>
            <h3>On-Chain Proof</h3>
            <p>Retirements are recorded permanently on Regen Ledger. Anyone can verify.</p>
          </div>
          <div class="what-card">
            <div class="icon">🌍</div>
            <h3>Beyond Carbon</h3>
            <p>Carbon, biodiversity, marine, and species stewardship credits.</p>
          </div>
          <div class="what-card">
            <div class="icon">🔗</div>
            <h3>Linkable Certificate</h3>
            <p>Every retirement generates a public, shareable on-chain certificate.</p>
          </div>
        </div>
      </div>

    </div>
  </section>

  ${brandFooter({ links: [
    { label: "Home", href: "/" },
    { label: "Badges", href: "/badges" },
    { label: "Research", href: "/research" },
    { label: "About", href: "/about" },
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ], showInstall: true })}

  ${betaBannerJS()}
  <script>
    function selectIcon(id, url) {
      // Update picker button styles
      document.querySelectorAll('.icon-pick-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.background = '';
      });
      const picked = document.getElementById('pick-' + id);
      if (picked) { picked.style.borderColor = 'var(--color-emerald)'; picked.style.background = 'var(--color-emerald-dim)'; }

      // Update all seal preview images
      document.querySelectorAll('.seal-preview-img').forEach(img => img.src = url);

      // Update all snippet blocks and download links with new URL
      ['seal-black','seal-white','seal-green'].forEach(prefix => {
        const htmlEl = document.getElementById(prefix + '-html');
        const mdEl   = document.getElementById(prefix + '-markdown');
        const urlEl  = document.getElementById(prefix + '-url');
        if (htmlEl) htmlEl.childNodes[0].textContent = htmlEl.childNodes[0].textContent.replace(/badge-icon[^"]*\.png/, url.split('/').pop());
        if (mdEl)   mdEl.childNodes[0].textContent   = mdEl.childNodes[0].textContent.replace(/badge-icon[^)]*\.png/, url.split('/').pop());
        if (urlEl)  urlEl.childNodes[0].textContent  = url;
      });
      document.querySelectorAll('.seal-download-btn').forEach(a => { a.href = url; });
    }

    function showTab(btn, prefix, format) {
      const card = btn.closest('.badge-info');
      card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      card.querySelectorAll('.snippet-block').forEach(b => b.classList.remove('visible'));
      const target = document.getElementById(prefix + '-' + format);
      if (target) target.classList.add('visible');
    }

    function copySnippet(btn, id) {
      const block = document.getElementById(id);
      if (!block) return;
      const text = block.childNodes[0]?.textContent ?? '';
      navigator.clipboard.writeText(text.trim()).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    }

    async function previewUsage() {
      const token = document.getElementById('api-key-input').value.trim();
      if (!token) return;
      const base = '${baseUrl}';
      const area = document.getElementById('usage-preview-area');
      const snippet = document.getElementById('usage-snippet');

      ['dark','light','green'].forEach(theme => {
        const url = base + '/badges/usage.svg?token=' + encodeURIComponent(token) + '&theme=' + theme + '&t=' + Date.now();
        document.getElementById('usage-badge-' + theme).src = url;
      });

      const mdUrl = base + '/badges/usage.svg?token=' + encodeURIComponent(token);
      snippet.childNodes[0]?.remove?.();
      snippet.insertBefore(
        Object.assign(document.createTextNode(
          '[![My Regenerative AI Impact](' + mdUrl + ')](${baseUrl})'
        ), {}),
        snippet.firstChild
      );

      area.classList.add('visible');
    }

    function copyUsageSnippet() {
      const snippet = document.getElementById('usage-snippet');
      const text = snippet.childNodes[0]?.textContent ?? '';
      const btn = snippet.querySelector('.copy-btn');
      navigator.clipboard.writeText(text.trim()).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createBadgesRoutes(baseUrl: string, db?: Database.Database): Router {
  const router = Router();

  // Rate-limit all /badges/* endpoints
  router.use("/badges", (req: Request, res: Response, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      res.status(429).setHeader("Content-Type", "text/plain");
      return res.send("Too Many Requests");
    }
    next();
  });

  // Static compact badge assets (never change — cache for 24 hours)
  router.get("/badges/badge-dark.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("dark"));
  });

  router.get("/badges/badge-light.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("light"));
  });

  router.get("/badges/badge-green.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("green"));
  });

  // Dynamic usage badge
  router.get("/badges/usage.svg", (req: Request, res: Response) => {
    const badgeToken = (req.query.token as string) ?? "";
    const theme = (["dark","light","green"].includes(req.query.theme as string)
      ? req.query.theme
      : "dark") as "dark" | "light" | "green";

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let svg: string;

    if (!badgeToken || !db) {
      svg = usageBadgeSVG({ credits: 0, label: "credits", months: 0, theme });
    } else {
      const user = getUserByBadgeToken(db, badgeToken);
      if (!user) {
        svg = usageBadgeSVG({ credits: 0, label: "credits", months: 0, theme });
      } else {
        const subscriber = getSubscriberByUserId(db, user.id);
        const attr = subscriber
          ? getCumulativeAttribution(db, subscriber.id)
          : { total_carbon: 0, total_biodiversity: 0, total_uss: 0, total_contribution_cents: 0, months_active: 0 };

        const totalCredits = attr.total_carbon + attr.total_biodiversity + attr.total_uss;

        // Pick the most meaningful label
        let credits = totalCredits;
        let label = "credits";
        if (attr.total_carbon > 0 && attr.total_biodiversity === 0 && attr.total_uss === 0) {
          credits = attr.total_carbon; label = "carbon credits";
        } else if (totalCredits === 0) {
          credits = 0; label = "credits";
        }

        svg = usageBadgeSVG({ credits, label, theme, months: attr.months_active });
      }
    }

    // ETag based on content hash for conditional requests
    const etag = `"${createHash("md5").update(svg).digest("hex")}"`;
    res.setHeader("ETag", etag);

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.send(svg);
  });

  // Main page
  router.get("/badges", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(badgesPageHTML(baseUrl));
  });

  return router;
}
