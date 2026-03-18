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
  getAllSubscribersByUserId,
  getCumulativeAttribution,
  getMonthlyAttributions,
  getTransactions,
  getCommunityStats,
  getSubscriberBatchTotals,
  getActiveCommunityGoal,
  getCommunityTotalCreditsRetired,
  getCommunitySubscriberCount,
  getMonthlyCreditSelection,
  createMagicLinkToken,
  verifyMagicLinkToken,
  type CumulativeAttribution,
  type MonthlyAttribution,
  type Transaction,
  type CommunityStats,
  type CommunityGoal,
  type Subscriber,
  getReferralCount,
  getMedianReferralCount,
} from "./db.js";
import { PROJECTS, getProjectForBatch, type ProjectInfo } from "./project-metadata.js";
import { createSessionToken, getSessionEmail } from "./magic-link.js";
import { sendMagicLinkEmail } from "../services/email.js";
import { getFinancialSummary, formatFinancialReport } from "../services/accounting.js";

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

/** Data for rendering a project card on the dashboard */
interface ProjectCardData {
  project: ProjectInfo;
  batchDenom: string;
  totalCredits: number;
  latestTxHash: string | null;
}

function renderDashboardPage(opts: {
  email: string;
  plan: string;
  memberSince: string;
  cumulative: CumulativeAttribution;
  monthly: MonthlyAttribution[];
  badges: Badge[];
  manageUrl: string;
  amountCents: number;
  billingInterval: "monthly" | "yearly";
  baseUrl: string;
  nextRetirementDate: string | null;
  transactions: Transaction[];
  communityStats: CommunityStats;
  regenAddress: string | null;
  projectCards: ProjectCardData[];
  communityGoal: CommunityGoal | undefined;
  communityTotalCredits: number;
  communitySubscriberCount: number;
  batchDenomMap: Map<string, string>;
  totalRetiredCents: number;
  subscriptions: Array<{ plan: string; amountCents: number; billingInterval: "monthly" | "yearly" }>;
  referralCode: string;
  referralCount: number;
  isTopReferrer: boolean;
}): string {
  const {
    email, plan, memberSince, cumulative, monthly, badges, manageUrl,
    amountCents, billingInterval, baseUrl, nextRetirementDate, transactions, communityStats,
    regenAddress, projectCards, communityGoal, communityTotalCredits, communitySubscriberCount,
    batchDenomMap, totalRetiredCents, subscriptions, referralCode, referralCount, isTopReferrer,
  } = opts;
  const isYearly = billingInterval === "yearly";

  const planName = displayPlanName(plan);
  const totalCredits = cumulative.total_carbon + cumulative.total_biodiversity + cumulative.total_uss;
  const retiredCents = totalRetiredCents > 0
    ? totalRetiredCents
    : (cumulative.total_contribution_cents > 0 ? cumulative.total_contribution_cents : 0);
  // Profile link
  const profileUrl = regenAddress
    ? `https://app.regen.network/profiles/${regenAddress}/portfolio`
    : null;

  // Community goal progress
  let goalHtml = "";
  if (communityGoal) {
    const progress = Math.min(communityTotalCredits / communityGoal.goal_credits, 1);
    const pct = (progress * 100).toFixed(1);
    const remaining = Math.max(communityGoal.goal_credits - communityTotalCredits, 0);
    const deadlineStr = communityGoal.goal_deadline
      ? ` by ${communityGoal.goal_deadline}` : "";
    goalHtml = `
    <div style="margin-bottom:32px;">
      <div style="background:linear-gradient(135deg,#f0f7f2,#e8f5ec);border:1px solid var(--regen-green-light);border-radius:var(--regen-radius-lg);padding:28px 32px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--regen-green);margin-bottom:4px;">Community Goal</div>
            <div style="font-size:18px;font-weight:800;color:var(--regen-navy);">${escapeHtml(communityGoal.goal_label)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:var(--regen-green);">${pct}%</div>
            <div style="font-size:12px;color:var(--regen-gray-500);">${communitySubscriberCount} subscriber${communitySubscriberCount !== 1 ? "s" : ""} contributing</div>
          </div>
        </div>
        <div style="background:var(--regen-green-light);border-radius:8px;height:12px;overflow:hidden;">
          <div style="background:linear-gradient(90deg,#4FB573,#79C6AA);height:100%;width:${pct}%;border-radius:8px;transition:width 0.5s ease;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--regen-gray-500);">
          <span>${formatCredits(communityTotalCredits)} credits retired</span>
          <span>${formatCredits(remaining)} to go${escapeHtml(deadlineStr)}</span>
        </div>
      </div>
    </div>`;
  } else {
    // No goal set — compact community stats row
    goalHtml = `
    <div style="margin-bottom:32px;">
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="font-size:14px;color:var(--regen-gray-700);">
          <strong style="color:var(--regen-navy);">${communitySubscriberCount}</strong> subscriber${communitySubscriberCount !== 1 ? "s" : ""} have retired
          <strong style="color:var(--regen-green);">${formatCredits(communityTotalCredits)}</strong> credits together
        </div>
        <a href="/#pricing" style="font-size:13px;font-weight:600;color:var(--regen-green);">Invite a friend &rarr;</a>
      </div>
    </div>`;
  }

  // Project cards HTML
  let projectCardsHtml = "";
  if (projectCards.length > 0) {
    const cards = projectCards.map(pc => {
      const p = pc.project;
      const txLink = pc.latestTxHash
        ? `<a href="https://www.mintscan.io/regen/tx/${escapeHtml(pc.latestTxHash)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--regen-green);font-weight:600;">View on-chain</a>`
        : "";
      return `
      <div class="project-card" style="border-color:${p.accentColor}20;">
        <div class="project-card__img" style="background-image:url('${escapeHtml(p.imageUrl)}');">
          <span class="project-card__badge" style="background:${p.accentColor};">${escapeHtml(p.creditTypeLabel)}</span>
        </div>
        <div class="project-card__body">
          <h3 class="project-card__name">${escapeHtml(p.name)}</h3>
          <p class="project-card__location">${escapeHtml(p.location)}</p>
          <p class="project-card__desc">${escapeHtml(p.description)}</p>
          <div class="project-card__credits">
            <span style="font-size:20px;font-weight:800;color:${p.accentColor};">${formatCredits(pc.totalCredits)}</span>
            <span style="font-size:12px;color:var(--regen-gray-500);margin-left:4px;">credits retired</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
            <a href="${escapeHtml(p.projectPageUrl)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--regen-green);font-weight:600;">View project</a>
            ${txLink}
          </div>
        </div>
      </div>`;
    }).join("");

    // Add a "coming soon" card if odd number of projects, to fill out the grid
    const comingSoonCard = projectCards.length % 2 !== 0 ? `
      <div class="project-card" style="border-color:var(--regen-gray-200);display:flex;flex-direction:column;">
        <div class="project-card__img" style="background:linear-gradient(135deg,var(--regen-green-bg),#e0ede4);display:flex;align-items:center;justify-content:center;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="color:var(--regen-green);opacity:0.6;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
          </svg>
        </div>
        <div class="project-card__body" style="flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center;">
          <h3 class="project-card__name" style="color:var(--regen-gray-500);">More to come</h3>
          <p class="project-card__desc" style="color:var(--regen-gray-500);">Your subscription rotates through different ecological projects each month. Check back to see what gets retired next.</p>
        </div>
      </div>` : "";

    projectCardsHtml = `
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Projects You&rsquo;re Supporting</h2>
      <div class="project-cards-grid">${cards}${comingSoonCard}</div>
    </div>`;
  }

  // Projects for the boost dropdown — only those with a known batch denom
  const boostOptions = PROJECTS
    .filter(p => batchDenomMap.has(p.projectId))
    .map(p => {
      const denom = batchDenomMap.get(p.projectId)!;
      return `<option value="${escapeHtml(denom)}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)} (${escapeHtml(p.creditTypeLabel)})</option>`;
    }).join("");

  // Prepare chart data
  const chartData = JSON.stringify({
    labels: monthly.map(m => {
      const d = new Date(m.run_date);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }),
    carbon: monthly.map(m => m.carbon_credits),
    biodiversity: monthly.map(m => m.biodiversity_credits),
    uss: monthly.map(m => m.uss_credits),
  });

  const hasRetirements = monthly.length > 0 || projectCards.length > 0;

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

    /* Project cards */
    .project-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .project-card {
      background: var(--regen-white);
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      overflow: hidden;
      box-shadow: var(--regen-shadow-card);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .project-card:hover {
      box-shadow: var(--regen-shadow-card-hover);
      transform: translateY(-2px);
    }
    .project-card__img {
      height: 160px;
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .project-card__badge {
      position: absolute; top: 12px; left: 12px;
      font-size: 11px; font-weight: 700; color: #fff;
      padding: 4px 10px; border-radius: 6px;
      letter-spacing: 0.03em;
    }
    .project-card__body { padding: 16px 20px 20px; }
    .project-card__name {
      font-size: 16px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 2px;
    }
    .project-card__location {
      font-size: 12px; color: var(--regen-gray-500); margin: 0 0 8px;
      font-weight: 500;
    }
    .project-card__desc {
      font-size: 13px; color: var(--regen-gray-700); margin: 0 0 12px;
      line-height: 1.5;
    }
    .project-card__credits { margin-top: 4px; }

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

    /* Compact stat row */
    .dash-stats-row {
      display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;
      justify-content: center;
    }
    .dash-stat-pill {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: 20px; padding: 8px 16px;
      font-size: 13px; color: var(--regen-gray-700);
      display: flex; align-items: center; gap: 6px;
    }
    .dash-stat-pill strong {
      font-weight: 800; color: var(--regen-navy);
    }

    @media (max-width: 640px) {
      .project-cards-grid { grid-template-columns: 1fr; }
      .project-card__img { height: 140px; }
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

    ${!hasRetirements ? `
    <!-- ====== PRE-RETIREMENT WELCOME ====== -->
    <div style="padding:40px 0 24px;text-align:center;">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 8px;color:var(--regen-navy);">Welcome to the Regenerative Compute Community</h1>
      <p style="font-size:15px;color:var(--regen-gray-500);margin:0 0 4px;">Member since ${escapeHtml(memberSince)}</p>
    </div>
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
    ` : `
    <!-- ====== POST-RETIREMENT DASHBOARD ====== -->
    <div style="padding:32px 0 16px;text-align:center;">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;color:var(--regen-navy);">Your Ecological Impact</h1>
      <p style="font-size:14px;color:var(--regen-gray-500);margin:0 0 8px;">Member since ${escapeHtml(memberSince)}</p>
      ${profileUrl ? `
      <p style="font-size:13px;color:var(--regen-gray-500);margin:4px 0 0;max-width:420px;display:inline-block;">Every credit is minted based on verified ecological impact and retired permanently on the blockchain &mdash; <a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener" style="font-weight:600;">view your personal on-chain portfolio &rarr;</a></p>
      ` : ""}
    </div>

    <!-- Compact stats -->
    <div class="dash-stats-row">
      ${totalCredits >= 4 ? `<div class="dash-stat-pill"><strong>${escapeHtml(formatCredits(totalCredits))}</strong> total credits</div>` : ""}
      ${retiredCents > 0 ? `<div class="dash-stat-pill"><strong>$${escapeHtml((retiredCents / 100).toFixed(2))}</strong> retired to projects</div>` : ""}
      <div class="dash-stat-pill"><strong>${Math.max(1, cumulative.months_active)}</strong> month${Math.max(1, cumulative.months_active) !== 1 ? "s" : ""}</div>
    </div>
    `}

    <!-- Project cards -->
    ${projectCardsHtml}

    ${hasRetirements ? `
    <!-- Boost Your Impact -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Boost Your Impact</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius-lg);padding:24px 28px;">
        <p style="font-size:14px;color:var(--regen-gray-500);margin:0 0 16px;">Choose a project and make a one-time contribution to retire more credits.</p>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <select id="boost-project" style="flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--regen-gray-300);border-radius:8px;font-size:14px;font-family:var(--regen-font-primary);color:var(--regen-navy);">
            ${boostOptions}
          </select>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:16px;font-weight:700;color:var(--regen-navy);">$</span>
            <input id="boost-amount" type="number" min="1" step="0.50" value="5" style="width:80px;padding:10px 12px;border:1px solid var(--regen-gray-300);border-radius:8px;font-size:16px;text-align:center;font-family:var(--regen-font-primary);">
          </div>
          <button onclick="boostProject()" class="regen-btn regen-btn--solid regen-btn--sm">Retire Now</button>
        </div>
        <p id="boost-error" style="color:#c33;font-size:13px;margin:8px 0 0;display:none;"></p>
      </div>
    </div>

    <!-- Monthly chart -->
    ${monthly.length > 0 ? `
    <div class="dash-chart-section">
      <h2 class="regen-section-title" style="font-size:20px;">Monthly Breakdown</h2>
      <div class="dash-chart-container">
        <canvas id="impactChart"></canvas>
        <script type="application/json" id="chart-data">${chartData}</script>
      </div>
    </div>
    ` : ""}
    ` : ""}

    <!-- Contributions table -->
    ${transactions.length > 0 ? `
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Contributions</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);overflow:hidden;">
        <table class="regen-table">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${transactions.map(t => {
              const date = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isReferralBonus = t.type === "referral_bonus";
              const typeLabel = isReferralBonus ? "Referral bonus" : t.type === "subscription" ? "Subscription" : t.type === "topup" ? "One-time boost" : "Retirement";
              const typeColor = isReferralBonus ? "#7c3aed" : t.type === "subscription" ? "var(--regen-teal)" : t.type === "topup" ? "var(--regen-green)" : "var(--regen-navy)";
              const hasRetirementTx = !!t.retirement_tx_hash;
              const statusLabel = isReferralBonus ? (hasRetirementTx ? "Executed" : "Pending") : hasRetirementTx ? "Retired" : "Paid";
              const statusBg = isReferralBonus ? (hasRetirementTx ? "#f5f3ff" : "#fef3c7") : hasRetirementTx ? "#f0f7f2" : "#eff6ff";
              const statusColor = isReferralBonus ? (hasRetirementTx ? "#5b21b6" : "#92400e") : hasRetirementTx ? "#2d6a4f" : "#1e40af";
              const proofLink = hasRetirementTx
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

    <!-- Referrals -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Invite Friends, Protect Wildlife</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);overflow:hidden;">
        <div style="padding:24px 24px 0;">
          <p style="font-size:15px;color:var(--regen-gray-700);margin:0 0 8px;line-height:1.6;">
            Your referrals directly fund jaguar conservation, support indigenous-led stewardship, and sequester carbon. Every person you invite amplifies your ecological impact.
          </p>
          <p style="font-size:15px;color:var(--regen-gray-700);margin:0 0 16px;line-height:1.6;">
            Your friend gets their <strong>first month free</strong>. You earn a <strong>bonus credit retirement</strong>.
          </p>
        </div>

        <!-- Stats + encouragement -->
        <div style="padding:0 24px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:#f5f3ff;border-radius:50%;font-size:16px;font-weight:800;color:#7c3aed;">${referralCount}</span>
            <span style="font-size:14px;color:var(--regen-gray-600);font-weight:600;">${referralCount === 1 ? "referral" : "referrals"}</span>
          </div>
          ${isTopReferrer ? `
          <span style="display:inline-block;font-size:12px;font-weight:700;background:#f0fdf4;color:#166534;padding:4px 12px;border-radius:10px;">
            Top referrer — keep it up!
          </span>
          ` : referralCount > 0 ? `
          <span style="display:inline-block;font-size:12px;font-weight:600;color:var(--regen-gray-500);">
            Share more to join the top referrers
          </span>
          ` : `
          <span style="display:inline-block;font-size:12px;font-weight:600;color:var(--regen-gray-500);">
            Share your link below to get started
          </span>
          `}
        </div>

        <!-- Referral link -->
        <div style="padding:16px 24px;background:#f0fdf4;border-top:1px solid #bbf7d0;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">Your referral link</p>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <code id="refLink" style="flex:1;min-width:200px;padding:8px 12px;background:#fff;border:1px solid #d1d5db;border-radius:6px;font-size:13px;color:var(--regen-navy);word-break:break-all;">${baseUrl}/r/${escapeHtml(referralCode)}</code>
            <button onclick="copyRefLink()" style="padding:8px 16px;background:#4FB573;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Copy</button>
          </div>
        </div>

        <!-- Share buttons -->
        <div style="padding:16px 24px;text-align:center;border-top:1px solid var(--regen-gray-200);">
          <div class="regen-share-btns">
            <a class="regen-share-btn regen-share-btn--x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent("I use @RegenCompute to make my AI sessions fund ecological regeneration. Use my link for a free first month:")}&url=${encodeURIComponent(`${baseUrl}/r/${referralCode}`)}" target="_blank" rel="noopener">Post on X</a>
            <a class="regen-share-btn regen-share-btn--linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/r/${referralCode}`)}" target="_blank" rel="noopener">Share on LinkedIn</a>
          </div>
        </div>
      </div>
    </div>
    <script>
    function copyRefLink() {
      var el = document.getElementById('refLink');
      navigator.clipboard.writeText(el.textContent).then(function() {
        var orig = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(function() { el.textContent = orig; }, 2000);
      });
    }
    </script>

    <!-- Community goal / stats -->
    ${goalHtml}

    <!-- Subscription(s) -->
    <div style="margin-bottom:32px;">
      ${subscriptions.map((sub) => {
        const subYearly = sub.billingInterval === "yearly";
        return `<div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;${subscriptions.length > 1 ? "margin-bottom:8px;" : ""}">
          <div>
            <span style="font-size:14px;font-weight:700;color:var(--regen-navy);">${escapeHtml(displayPlanName(sub.plan))} Plan</span>
            <span style="font-size:13px;color:var(--regen-gray-500);margin-left:4px;">$${(sub.amountCents / 100).toFixed(2)}/${subYearly ? "year" : "mo"}</span>
            ${subYearly ? `<div style="font-size:12px;color:var(--regen-gray-500);margin-top:4px;">Your annual subscription funds 12 monthly retirements &mdash; credits are retired on your behalf each month throughout the year.</div>` : ""}
          </div>
          <a class="regen-btn regen-btn--outline regen-btn--sm" href="${escapeHtml(manageUrl)}">Manage</a>
        </div>`;
      }).join("\n")}
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
    function boostProject() {
      var select = document.getElementById('boost-project');
      var input = document.getElementById('boost-amount');
      var errEl = document.getElementById('boost-error');
      if (!select || !input || !errEl) return;
      var amount = parseFloat(input.value);
      var batchDenom = select.value;
      var projectName = select.options[select.selectedIndex].getAttribute('data-name') || '';
      errEl.style.display = 'none';
      if (!amount || amount < 1) {
        errEl.textContent = 'Minimum amount is $1.00';
        errEl.style.display = 'block';
        return;
      }
      if (!batchDenom) {
        errEl.textContent = 'Please select a project';
        errEl.style.display = 'block';
        return;
      }
      var cents = Math.round(amount * 100);
      fetch('/boost-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: cents, batch_denom: batchDenom, project_name: projectName })
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
      `rfa_session=${sessionToken}; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=2592000${isProduction ? "; Secure" : ""}`
    ]);
    res.redirect("/dashboard");
  });

  // Admin emails that can impersonate other subscribers via ?as=<subscriber_id>
  const ADMIN_EMAILS = new Set(["christian@regen.network"]);

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

    // Admin impersonation: ?as=<subscriber_id> or ?as=user:<user_id>
    const asParam = typeof req.query.as === "string" ? req.query.as : "";
    let allSubscribers: Subscriber[] = [];
    let subscriber: Subscriber | undefined;
    let viewEmail = email;

    if (asParam && ADMIN_EMAILS.has(email)) {
      if (asParam.startsWith("user:")) {
        // View all subscriptions for a user: ?as=user:7
        const targetUserId = parseInt(asParam.slice(5), 10);
        if (!isNaN(targetUserId)) {
          allSubscribers = getAllSubscribersByUserId(db, targetUserId);
          subscriber = allSubscribers[0];
          const targetUser = db.prepare("SELECT email FROM users WHERE id = ?").get(targetUserId) as { email: string } | undefined;
          if (targetUser) viewEmail = targetUser.email;
        }
      } else {
        // View single subscriber: ?as=7
        const subId = parseInt(asParam, 10);
        if (!isNaN(subId)) {
          const row = db.prepare(
            "SELECT s.*, u.email AS user_email FROM subscribers s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.status = 'active'"
          ).get(subId) as (Subscriber & { user_email?: string }) | undefined;
          if (row) {
            subscriber = row;
            // Load all subscribers for this user to show combined view
            allSubscribers = getAllSubscribersByUserId(db, row.user_id);
            if (row.user_email) viewEmail = row.user_email;
          }
        }
      }
    } else {
      allSubscribers = getAllSubscribersByUserId(db, user.id);
      subscriber = allSubscribers[0] ?? getSubscriberByUserId(db, user.id);
    }

    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("No active subscription found for this email."));
      return;
    }

    // Use all subscriber IDs for aggregation
    const allSubIds = allSubscribers.length > 0
      ? allSubscribers.map(s => s.id)
      : [subscriber.id];

    const cumulative = getCumulativeAttribution(db, allSubIds);
    const monthly = getMonthlyAttributions(db, allSubIds);
    const badges = computeBadges(cumulative);
    const memberSince = formatDate(
      allSubscribers.length > 0
        ? allSubscribers.reduce((earliest, s) => s.created_at < earliest ? s.created_at : earliest, allSubscribers[0].created_at)
        : subscriber.created_at
    );
    const manageUrl = `${baseUrl}/manage?email=${encodeURIComponent(viewEmail)}`;
    const viewUser = getUserByEmail(db, viewEmail);
    const transactions = getTransactions(db, viewUser?.id ?? user.id, 20);
    const communityStats = getCommunityStats(db);

    // Next retirement date — earliest period_end across all subs
    const nextRetirementDate = allSubscribers
      .map(s => s.current_period_end)
      .filter(Boolean)
      .sort()[0]
      ? formatDate(allSubscribers.map(s => s.current_period_end).filter(Boolean).sort()[0]!)
      : null;

    // Per-batch totals → project cards (aggregated across all subs)
    const batchTotals = getSubscriberBatchTotals(db, allSubIds);
    const projectCards: ProjectCardData[] = [];
    for (const bt of batchTotals) {
      const project = getProjectForBatch(bt.batch_denom);
      if (project) {
        projectCards.push({
          project,
          batchDenom: bt.batch_denom,
          totalCredits: bt.total_credits,
          latestTxHash: bt.latest_tx_hash,
        });
      }
    }

    // Regen address — check across all subscriber IDs
    const placeholdersAddr = allSubIds.map(() => "?").join(",");
    const regenAddress = (db.prepare(
      `SELECT regen_address FROM subscriber_retirements WHERE subscriber_id IN (${placeholdersAddr}) ORDER BY id DESC LIMIT 1`
    ).get(...allSubIds) as { regen_address: string } | undefined)?.regen_address ?? null;

    // Community goal data
    const communityGoal = getActiveCommunityGoal(db);
    const communityTotalCredits = getCommunityTotalCreditsRetired(db);
    const communitySubscriberCount = getCommunitySubscriberCount(db);

    // Build batch denom map for boost dropdown — from subscriber's retirements + monthly selection
    const batchDenomMap = new Map<string, string>(); // projectId → batchDenom
    for (const bt of batchTotals) {
      const project = getProjectForBatch(bt.batch_denom);
      if (project) batchDenomMap.set(project.projectId, bt.batch_denom);
    }
    // Fill in from monthly credit selection for any projects not yet retired
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const creditSelection = getMonthlyCreditSelection(db, currentMonth);
    if (creditSelection) {
      for (const denom of [creditSelection.batch1_denom, creditSelection.batch2_denom, creditSelection.batch3_denom]) {
        const project = getProjectForBatch(denom);
        if (project && !batchDenomMap.has(project.projectId)) {
          batchDenomMap.set(project.projectId, denom);
        }
      }
    }

    // For multi-sub users, pick highest plan for display
    const planPriority: Record<string, number> = { dabbler: 0, seedling: 1, builder: 2, grove: 3, forest: 4, agent: 5 };
    const displaySub = allSubscribers.length > 1
      ? allSubscribers.reduce((best, s) => (planPriority[s.plan] ?? 0) > (planPriority[best.plan] ?? 0) ? s : best, allSubscribers[0])
      : subscriber;

    // Total actually spent on credit retirements across all subs
    const retiredPlaceholders = allSubIds.map(() => "?").join(",");
    const totalRetiredCents = (db.prepare(
      `SELECT COALESCE(SUM(total_spent_cents), 0) AS total FROM subscriber_retirements WHERE subscriber_id IN (${retiredPlaceholders})`
    ).get(...allSubIds) as { total: number })?.total ?? 0;

    // Build subscription list for display
    const subscriptions = (allSubscribers.length > 0 ? allSubscribers : [subscriber]).map(s => ({
      plan: s.plan,
      amountCents: s.amount_cents,
      billingInterval: (s.billing_interval === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly",
    }));

    // Referral stats
    const referralCode = viewUser?.referral_code ?? user.referral_code;
    const referralCount = getReferralCount(db, viewUser?.id ?? user.id);
    const medianReferrals = getMedianReferralCount(db);
    const isTopReferrer = referralCount > 0 && referralCount >= medianReferrals;

    res.setHeader("Content-Type", "text/html");
    res.send(renderDashboardPage({
      email,
      plan: displaySub.plan,
      memberSince,
      cumulative,
      monthly,
      badges,
      manageUrl,
      amountCents: subscriber.amount_cents,
      billingInterval: (subscriber.billing_interval === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly",
      baseUrl,
      nextRetirementDate,
      transactions,
      communityStats,
      regenAddress,
      projectCards,
      communityGoal,
      communityTotalCredits,
      communitySubscriberCount,
      batchDenomMap,
      totalRetiredCents,
      subscriptions,
      referralCode,
      referralCount,
      isTopReferrer,
    }));
  });

  // GET /dashboard/logout
  router.get("/dashboard/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", [
      "rfa_session=; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=0"
    ]);
    res.redirect("/dashboard/login");
  });

  // GET /dashboard/accounting — admin-only financial summary
  router.get("/dashboard/accounting", (req: Request, res: Response) => {
    const email = getSessionEmail(req.headers.cookie, config.sessionSecret);
    if (!email || !ADMIN_EMAILS.has(email)) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const format = req.query.format === "text" ? "text" : "json";
    const summary = getFinancialSummary(db);

    if (format === "text") {
      res.setHeader("Content-Type", "text/plain");
      res.send(formatFinancialReport(summary));
    } else {
      res.json(summary);
    }
  });

  return router;
}
