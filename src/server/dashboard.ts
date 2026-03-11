/**
 * Subscriber dashboard routes.
 *
 * Routes:
 *   GET  /dashboard/login   — Email form page
 *   POST /dashboard/login   — Send magic link email
 *   GET  /dashboard/verify  — Verify magic link token, set session cookie
 *   GET  /dashboard         — Main dashboard (authenticated)
 *   GET  /dashboard/logout  — Clear session cookie
 *
 * Auth: Magic link email -> signed session cookie (HMAC-SHA256, 24h TTL).
 * HTML: Server-rendered with inline CSS, Chart.js via CDN for charts.
 */

import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import {
  getUserByEmail,
  getSubscriberByUserId,
  getCumulativeAttribution,
  getMonthlyAttributions,
  getTransactions,
  getCommunityStats,
  createMagicLinkToken,
  verifyMagicLinkToken,
  type CumulativeAttribution,
  type MonthlyAttribution,
  type Transaction,
  type CommunityStats,
} from "./db.js";
import { createSessionToken, getSessionEmail } from "./magic-link.js";
import { sendMagicLinkEmail } from "../services/email.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCredits(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return dateStr;
  }
}

// --- Rate limiting for login attempts ---
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 3600_000; // 1 hour

function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const existing = loginAttempts.get(key);
  if (!existing || now - existing.windowStart >= LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (existing.count >= LOGIN_RATE_LIMIT) return false;
  existing.count++;
  return true;
}

// Clean up stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now - val.windowStart > LOGIN_RATE_WINDOW_MS) loginAttempts.delete(key);
  }
}, 600_000);

// --- Badge system ---

interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string; // SVG content
  color: string;
}

function computeBadges(cumulative: CumulativeAttribution): Badge[] {
  return [
    {
      id: "first-retirement",
      name: "First Retirement",
      description: "Your first month with credits retired",
      earned: cumulative.months_active >= 1,
      icon: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      color: "#2d6a4f",
    },
    {
      id: "carbon-pioneer",
      name: "Carbon Pioneer",
      description: "1 carbon credit retired (1 tonne CO2e)",
      earned: cumulative.total_carbon >= 1.0,
      icon: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1-1c-2.5-2.4-4-3.9-4-5.5C6 8.6 7.6 7 9.5 7c1.1 0 2.1.5 2.5 1.3.4-.8 1.4-1.3 2.5-1.3C16.4 7 18 8.6 18 10.5c0 1.6-1.5 3.1-4 5.5l-1 1h-2z" fill="currentColor"/>`,
      color: "#2d6a4f",
    },
    {
      id: "biodiversity-guardian",
      name: "Biodiversity Guardian",
      description: "1 biodiversity credit retired",
      earned: cumulative.total_biodiversity >= 1.0,
      icon: `<path d="M12 2C8 2 4 4 4 8c0 3 2 5 4 6.5V22l4-2 4 2v-7.5c2-1.5 4-3.5 4-6.5 0-4-4-6-8-6zm0 2c2.5 0 5 1.5 5 4s-2 4-5 5c-3-1-5-2.5-5-5s2.5-4 5-4z" fill="currentColor"/>`,
      color: "#1e5fa8",
    },
    {
      id: "six-month-streak",
      name: "Six-Month Streak",
      description: "6 consecutive months subscribed",
      earned: cumulative.months_active >= 6,
      icon: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>`,
      color: "#d4a853",
    },
    {
      id: "one-tonne-club",
      name: "1 Tonne Club",
      description: "1 tonne of CO2e retired cumulative",
      earned: cumulative.total_carbon >= 1.0,
      icon: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>`,
      color: "#b5651d",
    },
  ];
}

// --- HTML rendering ---

function renderLoginPage(error?: string, success?: string, info?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Login - Regenerative Compute</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
    body {
      background: var(--regen-gray-50);
      min-height: 100vh;
      display: flex; flex-direction: column;
    }
    .login-wrapper {
      flex: 1; display: flex; align-items: center; justify-content: center;
    }
    .login-card {
      max-width: 420px; width: 100%; margin: 24px;
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg); padding: 40px 32px;
      box-shadow: var(--regen-shadow-card);
    }
    .login-card h1 {
      font-size: 24px; font-weight: 800; text-align: center;
      margin: 0 0 8px; color: var(--regen-navy);
    }
    .login-subtitle {
      font-size: 14px; color: var(--regen-gray-500); text-align: center; margin: 0 0 28px;
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}
  ${brandHeader({ nav: [{ label: "AI Plugin", href: "/ai-plugin" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Home", href: "/" }] })}
  <div class="login-wrapper">
    <div class="login-card">
      <h1>Dashboard Login</h1>
      <p class="login-subtitle">Enter your subscriber email to receive a login link.</p>
      ${error ? `<div class="regen-alert regen-alert--error">${escapeHtml(error)}</div>` : ""}
      ${success ? `<div class="regen-alert regen-alert--success">${escapeHtml(success)}</div>` : ""}
      ${info ? `<div class="regen-alert regen-alert--info">${info}</div>` : ""}
      <form method="POST" action="/dashboard/login">
        <label class="regen-label" for="email">Email address</label>
        <input class="regen-input" type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
        <button type="submit" class="regen-btn regen-btn--solid regen-btn--block" style="margin-top:16px;">Send Login Link</button>
      </form>
      <div style="text-align:center;margin-top:24px;font-size:13px;">
        <a href="/">Back to Regenerative Compute</a>
      </div>
    </div>
  </div>
${betaBannerJS()}
</body>
</html>`;
}

/** Map internal plan IDs to display names */
function displayPlanName(plan: string): string {
  const names: Record<string, string> = {
    seedling: "Dabbler",
    grove: "Builder",
    forest: "Agent",
  };
  return names[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

function renderDashboardPage(
  email: string,
  plan: string,
  memberSince: string,
  cumulative: CumulativeAttribution,
  monthly: MonthlyAttribution[],
  badges: Badge[],
  manageUrl: string,
  amountCents: number,
  baseUrl: string,
  nextRetirementDate: string | null,
  transactions: Transaction[],
  communityStats: CommunityStats,
): string {
  const planName = displayPlanName(plan);
  const totalCredits = cumulative.total_carbon + cumulative.total_biodiversity + cumulative.total_uss;
  // Show subscription amount if no pool runs have happened yet
  const contributedCents = cumulative.total_contribution_cents > 0
    ? cumulative.total_contribution_cents
    : amountCents;
  const shareText = encodeURIComponent(
    `I'm funding ecological regeneration through my AI usage with @RegenNetwork's Regenerative Compute. ${formatCredits(totalCredits)} credits retired so far.`
  );
  const shareUrl = encodeURIComponent(baseUrl);

  // Prepare chart data as JSON
  const chartData = JSON.stringify({
    labels: monthly.map(m => {
      const d = new Date(m.run_date);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }),
    carbon: monthly.map(m => m.carbon_credits),
    biodiversity: monthly.map(m => m.biodiversity_credits),
    uss: monthly.map(m => m.uss_credits),
  });

  // Render monthly history rows
  let monthlyRows = "";
  for (const m of [...monthly].reverse()) {
    const total = m.carbon_credits + m.biodiversity_credits + m.uss_credits;
    const dateLabel = formatDate(m.run_date);
    const certLink = m.carbon_tx_hash
      ? `<a href="https://www.mintscan.io/regen/tx/${escapeHtml(m.carbon_tx_hash)}" target="_blank" rel="noopener">View</a>`
      : m.biodiversity_tx_hash
        ? `<a href="https://www.mintscan.io/regen/tx/${escapeHtml(m.biodiversity_tx_hash)}" target="_blank" rel="noopener">View</a>`
        : "--";
    monthlyRows += `<tr>
      <td>${escapeHtml(dateLabel)}</td>
      <td>${escapeHtml(formatCredits(m.carbon_credits))}</td>
      <td>${escapeHtml(formatCredits(m.biodiversity_credits))}</td>
      <td>${escapeHtml(formatCredits(m.uss_credits))}</td>
      <td><strong>${escapeHtml(formatCredits(total))}</strong></td>
      <td>${certLink}</td>
    </tr>`;
  }

  // Render badges
  let badgeHtml = "";
  for (const badge of badges) {
    const opacity = badge.earned ? "1" : "0.35";
    const bgColor = badge.earned ? badge.color + "15" : "#f3f4f6";
    const borderColor = badge.earned ? badge.color : "#e5e7eb";
    const svgColor = badge.earned ? badge.color : "#9ca3af";
    const statusText = badge.earned ? badge.description : "Keep going!";
    badgeHtml += `
      <div class="regen-badge" style="opacity: ${opacity}; background: ${bgColor}; border-color: ${borderColor};">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" style="color: ${svgColor};">${badge.icon}</svg>
        <div class="regen-badge__name">${escapeHtml(badge.name)}</div>
        <div class="regen-badge__desc">${escapeHtml(statusText)}</div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Impact Dashboard - Regenerative Compute</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
    body { background: var(--regen-gray-50); }

    /* Chart */
    .dash-chart-section { margin-bottom: 32px; }
    .dash-chart-container {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); padding: 24px;
    }
    canvas { max-height: 300px; }
    .dash-empty {
      text-align: center; padding: 48px 0; color: var(--regen-gray-500); font-size: 15px;
    }

    /* Table */
    .dash-table-section { margin-bottom: 32px; }
    .dash-table-wrapper {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); overflow-x: auto;
    }

    /* Export */
    .dash-export {
      margin-bottom: 32px;
      background: var(--regen-gray-50); border: 1px dashed var(--regen-gray-300);
      border-radius: var(--regen-radius); padding: 24px; text-align: center;
    }
    .dash-export p { margin: 0; color: var(--regen-gray-500); font-size: 14px; }
    .dash-coming-soon {
      display: inline-block; font-size: 11px; font-weight: 700;
      color: var(--regen-gray-500); background: var(--regen-gray-100);
      padding: 3px 8px; border-radius: 4px; margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({
    badge: planName,
    nav: [{ label: "Home", href: "/" }, { label: "Log out", href: "/dashboard/logout" }],
  })}

  <div class="regen-container">
    ${monthly.length === 0 ? `
    <!-- ====== PRE-RETIREMENT WELCOME EXPERIENCE ====== -->

    <!-- Welcome hero -->
    <div style="padding:40px 0 24px;text-align:center;">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 8px;color:var(--regen-navy);">Welcome to the Regenerative Compute Community</h1>
      <p style="font-size:15px;color:var(--regen-gray-500);margin:0 0 4px;">Member since ${escapeHtml(memberSince)}</p>
    </div>

    <!-- Payment confirmation -->
    <div style="margin-bottom:32px;">
      <div style="background:linear-gradient(135deg,#f0f7f2,#e8f5ec);border:1px solid var(--regen-green-light);border-radius:var(--regen-radius);padding:28px 32px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">&#10003;</div>
        <div style="font-size:18px;font-weight:800;color:var(--regen-navy);margin-bottom:8px;">Payment received &mdash; thank you!</div>
        <p style="font-size:14px;color:var(--regen-gray-500);margin:0;max-width:480px;display:inline-block;">
          Your first ecocredit retirements are scheduled for
          <strong style="color:var(--regen-navy);">${escapeHtml(nextRetirementDate ?? "next billing cycle")}</strong>.
          We&rsquo;ll retire verified ecological credits on-chain and send you proof.
        </p>
      </div>
    </div>

    <!-- How it works timeline -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;text-align:center;">How It Works</h2>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;max-width:700px;margin:0 auto;">
        <div style="flex:1;min-width:140px;background:var(--regen-green-bg);border:1px solid var(--regen-green-light);border-radius:var(--regen-radius);padding:20px 16px;text-align:center;">
          <div style="font-size:24px;margin-bottom:4px;">&#10003;</div>
          <div style="font-size:13px;font-weight:700;color:var(--regen-green);">Payment Received</div>
          <div style="font-size:11px;color:var(--regen-gray-500);margin-top:4px;">Your subscription is active</div>
        </div>
        <div style="flex:1;min-width:140px;background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:20px 16px;text-align:center;opacity:0.85;">
          <div style="font-size:24px;margin-bottom:4px;">&#128269;</div>
          <div style="font-size:13px;font-weight:700;color:var(--regen-navy);">Credits Selected</div>
          <div style="font-size:11px;color:var(--regen-gray-500);margin-top:4px;">Best-price verified credits</div>
        </div>
        <div style="flex:1;min-width:140px;background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:20px 16px;text-align:center;opacity:0.7;">
          <div style="font-size:24px;margin-bottom:4px;">&#9939;</div>
          <div style="font-size:13px;font-weight:700;color:var(--regen-navy);">Retired On-Chain</div>
          <div style="font-size:11px;color:var(--regen-gray-500);margin-top:4px;">Permanently recorded on Regen Ledger</div>
        </div>
        <div style="flex:1;min-width:140px;background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:20px 16px;text-align:center;opacity:0.55;">
          <div style="font-size:24px;margin-bottom:4px;">&#128220;</div>
          <div style="font-size:13px;font-weight:700;color:var(--regen-navy);">Certificate Issued</div>
          <div style="font-size:11px;color:var(--regen-gray-500);margin-top:4px;">Shareable proof of retirement</div>
        </div>
      </div>
    </div>

    <!-- What your subscription funds -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;text-align:center;">What Your Subscription Funds</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;max-width:700px;margin:0 auto;">
        <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-left:4px solid var(--regen-green);border-radius:var(--regen-radius);padding:18px;">
          <div style="font-size:15px;font-weight:700;color:var(--regen-green);margin-bottom:4px;">Carbon</div>
          <div style="font-size:12px;color:var(--regen-gray-500);">Verified carbon removal and avoidance from projects around the world</div>
        </div>
        <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-left:4px solid var(--regen-teal);border-radius:var(--regen-radius);padding:18px;">
          <div style="font-size:15px;font-weight:700;color:var(--regen-teal);margin-bottom:4px;">Biodiversity</div>
          <div style="font-size:12px;color:var(--regen-gray-500);">Habitat protection and species conservation credits via Terrasos</div>
        </div>
        <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-left:4px solid var(--regen-sage);border-radius:var(--regen-radius);padding:18px;">
          <div style="font-size:15px;font-weight:700;color:var(--regen-sage);margin-bottom:4px;">Marine</div>
          <div style="font-size:12px;color:var(--regen-gray-500);">Ocean ecosystem stewardship and marine biodiversity protection</div>
        </div>
        <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-left:4px solid var(--regen-navy);border-radius:var(--regen-radius);padding:18px;">
          <div style="font-size:15px;font-weight:700;color:var(--regen-navy);margin-bottom:4px;">Urban Forestry</div>
          <div style="font-size:12px;color:var(--regen-gray-500);">City tree planting and urban canopy expansion credits</div>
        </div>
      </div>
    </div>

    <!-- Community stats -->
    ${communityStats.total_credits > 0 || communityStats.member_count > 1 ? `
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;text-align:center;">Community Impact</h2>
      <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">
        <div class="regen-stat-card regen-stat-card--green" style="min-width:160px;">
          <div class="regen-stat-value">${escapeHtml(formatCredits(communityStats.total_credits))}</div>
          <div class="regen-stat-label">Total Credits Retired</div>
        </div>
        <div class="regen-stat-card regen-stat-card--navy" style="min-width:160px;">
          <div class="regen-stat-value">${communityStats.member_count}</div>
          <div class="regen-stat-label">Community Members</div>
        </div>
      </div>
    </div>
    ` : ""}

    <!-- Share your commitment -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;text-align:center;">Share Your Commitment</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:24px;text-align:center;">
        <p style="font-size:14px;color:var(--regen-gray-500);margin:0 0 16px;">Let others know you&rsquo;re making your AI usage regenerative.</p>
        <div class="regen-share-btns">
          <a class="regen-share-btn regen-share-btn--x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent("I just joined @RegenNetwork's Regenerative Compute \u2014 making my AI compute fund verified ecological regeneration on-chain. Every session contributes to carbon, biodiversity, and marine credits.")}&url=${shareUrl}" target="_blank" rel="noopener">Post on X</a>
          <a class="regen-share-btn regen-share-btn--linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
        </div>
      </div>
    </div>

    <!-- Transition note -->
    <div style="margin-bottom:32px;text-align:center;">
      <div style="background:var(--regen-gray-50);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:20px 28px;display:inline-block;max-width:520px;">
        <p style="font-size:14px;color:var(--regen-gray-500);margin:0;">
          Once your first retirements happen, you&rsquo;ll see your personal impact stats, monthly breakdown charts, on-chain proof, and achievement badges right here.
        </p>
      </div>
    </div>

    ` : `
    <!-- ====== NORMAL DASHBOARD WITH RETIREMENT DATA ====== -->

    <!-- Hero -->
    <div style="padding:32px 0 24px;text-align:center;">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;color:var(--regen-navy);">Your Ecological Impact</h1>
      <p style="font-size:14px;color:var(--regen-gray-500);margin:0;">Member since ${escapeHtml(memberSince)}</p>
    </div>

    <!-- Cumulative stats -->
    <div class="regen-stats-grid">
      <div class="regen-stat-card regen-stat-card--green">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_carbon))}</div>
        <div class="regen-stat-label">Carbon Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--teal">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_biodiversity))}</div>
        <div class="regen-stat-label">Biodiversity Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--sage">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_uss))}</div>
        <div class="regen-stat-label">USS/Marine Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--navy">
        <div class="regen-stat-value">${escapeHtml(formatCredits(totalCredits))}</div>
        <div class="regen-stat-label">Total Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--muted">
        <div class="regen-stat-value">$${escapeHtml((contributedCents / 100).toFixed(2))}</div>
        <div class="regen-stat-label">Contributed</div>
      </div>
      <div class="regen-stat-card regen-stat-card--muted">
        <div class="regen-stat-value">${cumulative.months_active}</div>
        <div class="regen-stat-label">Months Active</div>
      </div>
    </div>
    `}

    <!-- Contributions -->
    ${transactions.length > 0 ? `
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Contributions</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);overflow:hidden;">
        <table class="regen-table">
          <thead><tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${transactions.map(t => {
              const date = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isBoost = t.type === "topup";
              const typeLabel = isBoost ? "One-time boost" : "Credit retirement";
              const typeColor = isBoost ? "var(--regen-green)" : "var(--regen-teal)";
              const hasRetirement = !!t.retirement_tx_hash;
              const statusLabel = hasRetirement ? "Retired" : "Paid — Retirement Scheduled";
              const statusBg = hasRetirement ? "#f0f7f2" : "#eff6ff";
              const statusColor = hasRetirement ? "#2d6a4f" : "#1e40af";
              const proofLink = hasRetirement
                ? ` <a href="https://www.mintscan.io/regen/tx/${escapeHtml(t.retirement_tx_hash!)}" target="_blank" rel="noopener" style="font-size:11px;">proof</a>`
                : "";
              return `<tr>
                <td style="font-size:13px;">${escapeHtml(date)}</td>
                <td><span style="color:${typeColor};font-weight:600;font-size:13px;">${typeLabel}</span></td>
                <td style="font-weight:700;">$${(t.amount_cents / 100).toFixed(2)}</td>
                <td><span style="display:inline-block;font-size:11px;font-weight:700;background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:10px;">${statusLabel}</span>${proofLink}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
    ` : ""}

    <!-- Monthly chart -->
    <div class="dash-chart-section">
      <h2 class="regen-section-title" style="font-size:20px;">Monthly Breakdown</h2>
      <div class="dash-chart-container">
        ${monthly.length > 0
          ? `<canvas id="impactChart"></canvas>
             <script type="application/json" id="chart-data">${chartData}</script>`
          : `<div class="dash-empty">No retirements yet. Your first monthly report will appear here.</div>`
        }
      </div>
    </div>

    <!-- Monthly history table -->
    <div class="dash-table-section">
      <h2 class="regen-section-title" style="font-size:20px;">History</h2>
      <div class="dash-table-wrapper">
        ${monthly.length > 0 ? `
        <table class="regen-table">
          <thead><tr>
            <th>Month</th><th>Carbon</th><th>Biodiversity</th><th>USS</th><th>Total</th><th>Proof</th>
          </tr></thead>
          <tbody>${monthlyRows}</tbody>
        </table>
        ` : `<div class="dash-empty">No history yet.</div>`}
      </div>
    </div>

    <!-- Badges -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Achievements</h2>
      <div class="regen-badges-grid">
        ${badgeHtml}
      </div>
    </div>

    <!-- Share your impact -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Share Your Impact</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:24px;text-align:center;">
        <p style="font-size:14px;color:var(--regen-gray-500);margin:0 0 16px;">Spread the word about regenerative AI and invite others to join.</p>
        <div class="regen-share-btns">
          <a class="regen-share-btn regen-share-btn--x" href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener">Post on X</a>
          <a class="regen-share-btn regen-share-btn--linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
          <button class="regen-share-btn regen-share-btn--copy" onclick="navigator.clipboard.writeText('${escapeHtml(baseUrl)}').then(function(){this.textContent='Copied!';var b=this;setTimeout(function(){b.textContent='Copy Link'},1500)}.bind(this))">Copy Link</button>
        </div>
      </div>
    </div>

    <!-- Boost your impact -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Boost Your Impact</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:24px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">
        <span style="font-size:14px;color:var(--regen-gray-500);">Make a one-time contribution to retire more credits:</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:15px;color:var(--regen-navy);font-weight:600;">$</label>
          <input id="boost-amount" type="number" min="1" step="0.50" value="5" style="width:80px;padding:8px 12px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:16px;text-align:center;">
        </div>
        <button onclick="boostImpact()" class="regen-btn regen-btn--solid regen-btn--sm">Boost</button>
        <p id="boost-error" style="color:#c33;font-size:13px;margin:0;display:none;width:100%;text-align:center;"></p>
      </div>
    </div>

    <!-- Subscription management -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Subscription</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--regen-navy);">${escapeHtml(planName)} Plan <span style="font-size:13px;font-weight:500;color:var(--regen-gray-500);">($${(amountCents / 100).toFixed(2)}/mo)</span></div>
          <div style="font-size:13px;color:var(--regen-gray-500);margin-top:4px;">Member since ${escapeHtml(memberSince)}</div>
        </div>
        <a class="regen-btn regen-btn--outline regen-btn--sm" href="${escapeHtml(manageUrl)}">Manage Subscription</a>
      </div>
    </div>
  </div>

  ${brandFooter({ links: [
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ] })}

  ${monthly.length > 0 ? `
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script>
    (function() {
      var raw = JSON.parse(document.getElementById('chart-data').textContent);
      var ctx = document.getElementById('impactChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: raw.labels,
          datasets: [
            { label: 'Carbon', data: raw.carbon, backgroundColor: '#4FB573', borderRadius: 4 },
            { label: 'Biodiversity', data: raw.biodiversity, backgroundColor: '#527984', borderRadius: 4 },
            { label: 'USS/Marine', data: raw.uss, backgroundColor: '#79C6AA', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Credits Retired' } }
          }
        }
      });
    })();
  </script>
  ` : ""}

  <script>
    function boostImpact() {
      var input = document.getElementById('boost-amount');
      var errEl = document.getElementById('boost-error');
      var amount = parseFloat(input.value);
      errEl.style.display = 'none';
      if (!amount || amount < 1) {
        errEl.textContent = 'Minimum amount is $1.00';
        errEl.style.display = 'block';
        return;
      }
      var cents = Math.round(amount * 100);
      fetch('/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: cents })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.url) window.location.href = data.url;
        else {
          errEl.textContent = data.error || 'Something went wrong.';
          errEl.style.display = 'block';
        }
      })
      .catch(function(e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      });
    }
  </script>

${betaBannerJS()}
</body>
</html>`;
}

// --- Express router ---

export function createDashboardRoutes(
  db: Database.Database,
  baseUrl: string,
  config: Config,
): Router {
  const router = Router();

  // GET /dashboard/login
  router.get("/dashboard/login", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(renderLoginPage());
  });

  // POST /dashboard/login — send magic link email
  router.post("/dashboard/login", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Please enter a valid email address."));
      return;
    }

    // Rate limit
    if (!checkLoginRateLimit(email)) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Too many login attempts. Please try again in an hour."));
      return;
    }

    // Check that this email has a subscriber account
    const user = getUserByEmail(db, email);
    if (!user) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(
        undefined,
        undefined,
        `No subscription found for <strong>${escapeHtml(email)}</strong>. <a href="/#pricing">Subscribe</a> to get started, or try another email you may have used at checkout.`,
      ));
      return;
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(
        undefined,
        undefined,
        `No active subscription found for <strong>${escapeHtml(email)}</strong>. <a href="/#pricing">Subscribe</a> to get started, or try another email you may have used at checkout.`,
      ));
      return;
    }

    // Create magic link token
    const token = createMagicLinkToken(db, email, config.magicLinkTtlMinutes);
    const verifyUrl = `${baseUrl}/dashboard/verify?token=${token}`;

    // Send email
    try {
      await sendMagicLinkEmail(email, verifyUrl, config.magicLinkTtlMinutes);
    } catch (err) {
      console.error("Failed to send magic link email:", err instanceof Error ? err.message : err);
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Failed to send email. Please try again."));
      return;
    }

    res.setHeader("Content-Type", "text/html");
    res.send(renderLoginPage(undefined, "If an account exists for that email, a login link has been sent. Check your inbox."));
  });

  // GET /dashboard/verify?token=...
  router.get("/dashboard/verify", (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      res.redirect("/dashboard/login");
      return;
    }

    const email = verifyMagicLinkToken(db, token);
    if (!email) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Invalid or expired login link. Please request a new one."));
      return;
    }

    // Create session token and set cookie
    const sessionToken = createSessionToken(email, config.sessionSecret);
    const isProduction = baseUrl.startsWith("https");

    res.setHeader("Set-Cookie", [
      `rfa_session=${sessionToken}; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=86400${isProduction ? "; Secure" : ""}`
    ]);
    res.redirect("/dashboard");
  });

  // GET /dashboard — main dashboard (authenticated)
  router.get("/dashboard", (req: Request, res: Response) => {
    const email = getSessionEmail(req.headers.cookie, config.sessionSecret);
    if (!email) {
      res.redirect("/dashboard/login");
      return;
    }

    const user = getUserByEmail(db, email);
    if (!user) {
      res.redirect("/dashboard/login");
      return;
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("No active subscription found for this email."));
      return;
    }

    const cumulative = getCumulativeAttribution(db, subscriber.id);
    const monthly = getMonthlyAttributions(db, subscriber.id);
    const badges = computeBadges(cumulative);
    const memberSince = formatDate(subscriber.created_at);
    const manageUrl = `${baseUrl}/manage?email=${encodeURIComponent(email)}`;
    const transactions = getTransactions(db, user.id, 20);
    const communityStats = getCommunityStats(db);

    // Next retirement date from subscription period end
    const nextRetirementDate = subscriber.current_period_end
      ? formatDate(subscriber.current_period_end)
      : null;

    res.setHeader("Content-Type", "text/html");
    res.send(renderDashboardPage(
      email,
      subscriber.plan,
      memberSince,
      cumulative,
      monthly,
      badges,
      manageUrl,
      subscriber.amount_cents,
      baseUrl,
      nextRetirementDate,
      transactions,
      communityStats,
    ));
  });

  // GET /dashboard/logout
  router.get("/dashboard/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", [
      "rfa_session=; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=0"
    ]);
    res.redirect("/dashboard/login");
  });

  return router;
}
