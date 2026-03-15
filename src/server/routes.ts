/**
 * Express routes for the Regenerative Compute payment service.
 *
 * GET  /                  — Subscription landing page with live stats
 * POST /checkout          — Create a Stripe Checkout session
 * POST /webhook           — Handle Stripe webhook events
 * GET  /manage            — Redirect to Stripe Customer Portal (subscription self-management)
 * GET  /balance           — Check prepaid balance (API key in header)
 * POST /debit             — Debit balance after retirement (API key in header)
 * GET  /transactions      — Transaction history (API key in header)
 */

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { getNetworkStats, type NetworkStats } from "../services/indexer.js";
import {
  getUserByApiKey,
  getUserByEmail,
  createUser,
  creditBalance,
  debitBalance,
  getTransactions,
  getSubscriberByStripeId,
  createSubscriber,
  updateSubscriber,
  updateSubscriberStatus,
  getUserByReferralCode,
  setUserReferredBy,
  createReferralReward,
  getReferralCount,
  setSubscriberRegenAddress,
  createScheduledRetirement,
  getDueScheduledRetirements,
  updateScheduledRetirement,
  cancelScheduledRetirements,
  setUserDisplayName,
  getSubscriberByUserId,
  getCumulativeAttribution,
  isEventProcessed,
  markEventProcessed,
} from "./db.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { sendWelcomeEmail, sendFirstRetirementEmail, sendRetirementReceiptEmail } from "../services/email.js";
import { deriveSubscriberAddress } from "../services/subscriber-wallet.js";
import { retireForSubscriber, accumulateBurnBudget, getPendingBurnBudget, markBurnExecuted, calculateNetAfterStripe, type SubscriberRetirementResult } from "../services/retire-subscriber.js";
import { swapAndBurn, checkOsmosisReadiness } from "../services/swap-and-burn.js";
import { getProjectForBatch } from "./project-metadata.js";
import { checkAndSendMonthlyReminder, checkTradableStock } from "../services/admin-telegram.js";
import { updateRegistryProfile } from "../services/registry-profile.js";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";

/** Per-subscriber lock to prevent concurrent retirement execution */
const _subscriberLocks = new Map<number, Promise<void>>();

async function withSubscriberLock<T>(subscriberId: number, fn: () => Promise<T>): Promise<T> {
  const existing = _subscriberLocks.get(subscriberId) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  _subscriberLocks.set(subscriberId, next);

  await existing; // Wait for any prior retirement to finish
  try {
    return await fn();
  } finally {
    resolve!();
    if (_subscriberLocks.get(subscriberId) === next) {
      _subscriberLocks.delete(subscriberId);
    }
  }
}

// 5-minute in-memory cache for network stats
let statsCache: { data: NetworkStats; fetchedAt: number } | null = null;
const STATS_CACHE_TTL = 300_000;

async function getCachedStats(): Promise<NetworkStats | null> {
  if (statsCache && Date.now() - statsCache.fetchedAt < STATS_CACHE_TTL) {
    return statsCache.data;
  }
  try {
    const data = await getNetworkStats();
    statsCache = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return statsCache?.data ?? null;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function createRoutes(stripe: Stripe | null, db: Database.Database, baseUrl: string, config?: Config): Router {
  const router = Router();

  // --- Public routes ---

  /**
   * GET /
   * Subscription landing page with live impact stats.
   */
  router.get("/", async (_req: Request, res: Response) => {
    const dabblerUrl = config?.stripePaymentLinkSeedling ?? process.env.STRIPE_PAYMENT_LINK_SEEDLING ?? "#";
    const builderUrl = config?.stripePaymentLinkGrove ?? process.env.STRIPE_PAYMENT_LINK_GROVE ?? "#";
    const agentUrl = config?.stripePaymentLinkForest ?? process.env.STRIPE_PAYMENT_LINK_FOREST ?? "#";

    // Check for referral code
    const refCode = (_req.query.ref as string) || "";
    let referralValid = false;
    if (refCode) {
      const referrer = getUserByReferralCode(db, refCode);
      referralValid = !!referrer;
    }
    const hasPriceIds = !!(config?.stripePriceIdSeedling && config?.stripePriceIdGrove && config?.stripePriceIdForest);

    const stats = await getCachedStats();
    const totalRetirements = stats ? stats.totalRetirements.toLocaleString() : "--";
    const totalOrders = stats ? stats.totalOrders.toLocaleString() : "--";

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regenerative Compute — Fund Ecological Regeneration from Your AI Sessions</title>
  <meta name="description" content="Your AI has an ecological footprint. Regenerative Compute channels a small monthly amount into verified forests, soil, and biodiversity projects — with permanent, auditable proof.">
  <meta property="og:title" content="Regenerative Compute — Fund Ecological Regeneration from Your AI Sessions">
  <meta property="og:description" content="Your AI has an ecological footprint. Regenerative Compute channels a small monthly amount into verified forests, soil, and biodiversity projects — with permanent, auditable proof.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenCompute">
  <meta name="twitter:title" content="Regenerative Compute — Fund Ecological Regeneration from Your AI Sessions">
  <meta name="twitter:description" content="Your AI has an ecological footprint. Fund verified forests, soil, and biodiversity projects with permanent proof.">
  <meta name="twitter:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    /* How it works */
    .hiw-section { padding: 64px 0; border-top: 1px solid var(--regen-gray-200); }
    .hiw-steps {
      display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;
    }
    .hiw-step {
      flex: 1 1 220px; max-width: 260px;
      text-align: center; padding: 0 8px;
    }
    .hiw-num {
      width: 44px; height: 44px; line-height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--regen-green), var(--regen-sage));
      color: #fff; font-size: 18px; font-weight: 800;
      margin: 0 auto 12px;
    }
    .hiw-step h3 { font-size: 16px; margin: 0 0 6px; color: var(--regen-navy); font-weight: 700; }
    .hiw-step p { font-size: 13px; color: var(--regen-gray-500); margin: 0; }

    /* Pricing section */
    .pricing-section {
      padding: 64px 0; background: var(--regen-gray-50);
      border-top: 1px solid var(--regen-gray-200);
    }
    .tier-featured { border-color: var(--regen-green); position: relative; }
    .tier-featured-badge {
      position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, var(--regen-green), var(--regen-sage));
      color: #fff; font-size: 11px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 4px 14px; border-radius: 20px; white-space: nowrap;
    }
    .interval-btn {
      padding: 8px 20px; border: 1px solid transparent; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      background: transparent; color: var(--regen-gray-500);
      transition: all 0.15s;
    }
    .interval-btn--active {
      background: var(--regen-white); color: var(--regen-navy);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-color: transparent;
    }
    .interval-btn--yearly {
      border: 1px solid var(--regen-green);
      animation: yearly-pulse 2.5s ease-in-out infinite;
    }
    .interval-btn--yearly.interval-btn--active {
      border-color: var(--regen-green);
      animation: none;
    }
    @keyframes yearly-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(79, 181, 115, 0); }
      50% { box-shadow: 0 0 0 6px rgba(79, 181, 115, 0.25); }
    }
    .regen-tier--clickable {
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .regen-tier--clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(79, 181, 115, 0.2);
    }
    .regen-tier--clickable:active {
      transform: translateY(0);
    }
    .regen-tier__cta-btn {
      margin-top: auto;
      pointer-events: none;
    }
    .regen-tier__effective {
      font-size: 13px; color: var(--regen-green); font-weight: 600;
      margin: -4px 0 8px;
    }

    /* Annual nudge modal */
    .nudge-overlay {
      display: none; position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.45); align-items: center; justify-content: center;
    }
    .nudge-overlay.active { display: flex; }
    .nudge-box {
      background: var(--regen-white); border-radius: var(--regen-radius-lg);
      padding: 32px 28px; max-width: 420px; width: 90%;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2); text-align: center;
      position: relative;
    }
    .nudge-box h3 {
      font-size: 20px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px;
    }
    .nudge-reason {
      display: flex; align-items: flex-start; gap: 10px;
      text-align: left; margin-bottom: 12px;
    }
    .nudge-reason-icon {
      flex-shrink: 0; width: 28px; height: 28px; line-height: 28px;
      border-radius: 50%; background: var(--regen-green); color: #fff;
      font-size: 14px; font-weight: 800; text-align: center;
    }
    .nudge-reason p {
      margin: 0; font-size: 14px; color: var(--regen-gray-500); line-height: 1.5;
    }
    .nudge-reason strong { color: var(--regen-navy); }
    .nudge-btns {
      display: flex; flex-direction: column; gap: 10px; margin-top: 20px;
    }
    .nudge-btn-yearly {
      display: block; width: 100%; padding: 12px;
      background: linear-gradient(135deg, var(--regen-green), var(--regen-sage));
      color: #fff; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 700; cursor: pointer;
      transition: opacity 0.15s;
    }
    .nudge-btn-yearly:hover { opacity: 0.9; }
    .nudge-btn-monthly {
      display: block; width: 100%; padding: 10px;
      background: transparent; color: var(--regen-gray-500);
      border: 1px solid var(--regen-gray-200); border-radius: 10px;
      font-size: 13px; cursor: pointer;
      transition: background 0.15s;
    }
    .nudge-btn-monthly:hover { background: var(--regen-gray-50); }

    /* Stats section */
    .stats-section { padding: 52px 0; border-top: 1px solid var(--regen-gray-200); }
    .stats-bar {
      display: flex; gap: 48px; flex-wrap: wrap;
      justify-content: center; text-align: center;
    }
    .stats-bar__num {
      font-size: 36px; font-weight: 800; color: var(--regen-green);
      line-height: 1.1;
    }
    .stats-bar__label {
      font-family: var(--regen-font-secondary);
      font-size: 14px; color: var(--regen-gray-500); margin-top: 4px;
    }

    /* Credit basket section */
    .basket-section { padding: 64px 0; border-top: 1px solid var(--regen-gray-200); }
    .basket-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px; margin-top: 28px;
    }
    .basket-card {
      background: var(--regen-white);
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      overflow: hidden; text-align: left;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .basket-card:hover {
      box-shadow: var(--regen-shadow-card-hover);
      transform: translateY(-3px);
    }
    .basket-visual {
      height: 96px;
      display: flex; align-items: center; justify-content: center;
    }
    .basket-visual svg {
      width: 48px; height: 48px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
    }
    .basket-visual--carbon { background: linear-gradient(135deg, #2d6a4f, #52b788); }
    .basket-visual--biodiversity { background: linear-gradient(135deg, #7b5e00, #d4a017); }
    .basket-visual--urban { background: linear-gradient(135deg, #527984, #79C6AA); }
    .basket-visual--marine { background: linear-gradient(135deg, #1565c0, #42a5f5); }
    .basket-visual--grazing { background: linear-gradient(135deg, #5d4037, #a1887f); }
    .basket-body { padding: 20px 24px 24px; }
    .basket-dimension {
      font-family: var(--regen-font-secondary);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 4px;
    }
    .basket-dimension--carbon { color: #2d6a4f; }
    .basket-dimension--biodiversity { color: #b8860b; }
    .basket-dimension--urban { color: #527984; }
    .basket-dimension--marine { color: #1565c0; }
    .basket-dimension--grazing { color: #6d4c41; }
    .basket-name {
      font-size: 16px; font-weight: 700; color: var(--regen-navy);
      margin-bottom: 8px;
    }
    .basket-desc {
      font-size: 13px; color: var(--regen-gray-500);
      line-height: 1.55; margin: 0 0 14px;
    }
    .basket-link {
      font-family: var(--regen-font-secondary);
      font-size: 13px; font-weight: 600; color: var(--regen-green);
    }
    .basket-link:hover { text-decoration: underline; }

    /* Trust section */
    .trust-section { padding: 64px 0; border-top: 1px solid var(--regen-gray-200); }
    .trust-grid { display: flex; gap: 32px; flex-wrap: wrap; justify-content: center; }
    .trust-item { flex: 1 1 220px; max-width: 260px; }
    .trust-item h3 { font-size: 16px; margin: 0 0 6px; color: var(--regen-green); font-weight: 700; }
    .trust-item p { font-size: 14px; color: var(--regen-gray-500); margin: 0; }

    @media (max-width: 700px) {
      .hiw-step { flex: 1 1 140px; }
      .stats-bar { gap: 24px; }
      .stats-bar__num { font-size: 28px; }
      .trust-item { flex: 1 1 100%; max-width: 100%; }
      .basket-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${referralValid ? `<div class="regen-ref-banner"><span>Your friend invited you</span> — first month free!</div>` : ""}

  ${brandHeader({ nav: [{ label: "AI Plugin", href: "/ai-plugin" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Dashboard", href: "/dashboard/login" }] })}

  <!-- Hero -->
  <section class="regen-hero">
    <div class="regen-container">
      <div class="regen-hero__label">For Claude, Cursor &amp; ChatGPT Users</div>
      <h1>Your AI Has a Footprint. <span>Fund Ecological Regeneration</span> to Balance It.</h1>
      <p>Every AI session uses energy. Regenerative Compute channels a small monthly amount into verified ecological projects — forests, soil, biodiversity — with permanent, auditable proof.</p>
      <a class="regen-btn regen-btn--solid" href="#pricing">Choose Your Plan</a>
    </div>
  </section>

  <!-- Impact callout -->
  <div style="text-align:center; padding: 18px 24px; background: linear-gradient(135deg, rgba(79,181,115,0.08), rgba(121,198,170,0.08)); border-top: 1px solid rgba(79,181,115,0.15); border-bottom: 1px solid rgba(79,181,115,0.15);">
    <p style="margin:0; font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #374151; font-weight: 500;">
      A daily AI user generates <strong style="color:#101570;">2–10 kg CO&#8322;/year</strong>. Agentic workflows: <strong style="color:#101570;">up to 335 kg</strong>.
      <a href="/research" style="color:#4FB573; font-weight:600; margin-left:6px;">See the research &rarr;</a>
    </p>
  </div>

  <!-- How it works -->
  <section class="hiw-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">How It Works</h2>
      <div class="hiw-steps">
        <div class="hiw-step">
          <div class="hiw-num">1</div>
          <h3>Subscribe</h3>
          <p>Pick a plan — monthly or yearly. Your payment funds verified ecological projects around the world.</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">2</div>
          <h3>Connect</h3>
          <p>Add Regenerative Compute to your AI assistant with one command. Works with Claude Code, Cursor, and more.</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">3</div>
          <h3>Track Your Impact</h3>
          <p>See exactly which projects you support. Every credit retirement is publicly recorded and verifiable.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section class="pricing-section" id="pricing">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">Choose Your Plan</h2>

      <!-- Monthly / Yearly toggle -->
      <div style="display:flex;justify-content:center;margin-bottom:28px;">
        <div id="interval-toggle" style="display:inline-flex;background:var(--regen-gray-100);border-radius:10px;padding:4px;">
          <button id="toggle-monthly" onclick="setInterval('monthly')" class="interval-btn interval-btn--active">Monthly</button>
          <button id="toggle-yearly" onclick="setInterval('yearly')" class="interval-btn interval-btn--yearly">Yearly <span style="font-size:11px;font-weight:700;color:var(--regen-green);">Save 17%</span></button>
        </div>
      </div>

      <div class="regen-tiers">
        <div class="regen-tier regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('dabbler')" : `window.location.href='${dabblerUrl}'`}">
          <div class="regen-tier__name">Dabbler</div>
          <div class="regen-tier__price price-monthly">$1.25<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$12.50<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$1.25/mo + 2 months free</div>
          <div class="regen-tier__desc">You use AI a few times a week. This covers your share and funds real ecological projects.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">Subscribe</div>
        </div>
        <div class="regen-tier tier-featured regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('builder')" : `window.location.href='${builderUrl}'`}">
          <div class="tier-featured-badge">Most Popular</div>
          <div class="regen-tier__name">Builder</div>
          <div class="regen-tier__price price-monthly">$2.50<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$25<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$2.50/mo + 2 months free</div>
          <div class="regen-tier__desc">AI is part of your daily workflow. Full ecological accountability for regular use.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">Subscribe</div>
        </div>
        <div class="regen-tier regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('agent')" : `window.location.href='${agentUrl}'`}">
          <div class="regen-tier__name">Agent</div>
          <div class="regen-tier__price price-monthly">$5<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$50<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$5/mo + 2 months free</div>
          <div class="regen-tier__desc">For autonomous agents and power users — maximum autonomy, maximum impact.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">Subscribe</div>
        </div>
      </div>

      <!-- Custom Amount — inline card under tiers -->
      <div style="background:var(--regen-white);border:2px solid var(--regen-gray-200);border-radius:var(--regen-radius-lg);padding:20px 28px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">
        <span style="font-weight:700;font-size:15px;color:var(--regen-navy);white-space:nowrap;">Set your own subscription amount</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:15px;color:var(--regen-navy);font-weight:600;">$</label>
          <input id="custom-amount" type="number" min="1" step="0.50" value="10" style="width:80px;padding:8px 12px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:16px;text-align:center;">
          <span style="font-size:14px;color:var(--regen-gray-500);">/mo</span>
        </div>
        <button onclick="fundCustom()" class="regen-btn regen-btn--solid regen-btn--sm" style="white-space:nowrap;">Subscribe</button>
        <p id="custom-error" style="color:#c33;font-size:13px;margin:0;display:none;width:100%;text-align:center;"></p>
      </div>

    </div>
  </section>

  <!-- Let Your AI Help You Choose -->
  <section class="hiw-section">
    <div class="regen-container" style="max-width:640px;text-align:center;">
      <h2 class="regen-section-title">Let Your AI Assistant Help You Choose</h2>
      <p style="color:var(--regen-gray-500);margin-bottom:20px;">Copy and paste this into Claude Code or Cursor. It will install the tool if needed and help you pick the right plan.</p>
      <div style="background:#fff;border:1px solid var(--regen-gray-200);border-radius:10px;padding:16px;position:relative;text-align:left;">
        <code id="ai-prompt" style="font-size:13px;color:var(--regen-navy);white-space:pre-wrap;display:block;">I want to figure out the right Regenerative Compute plan for me.

First, if you don't already have regen-compute connected, run this:
  claude mcp add -s user regen-compute -- npx regen-compute

Then estimate my AI usage footprint and recommend a tier ($1.25, $2.50, or $5/mo) based on how much I use you. What do you need to know?</code>
        <button onclick="navigator.clipboard.writeText(document.getElementById('ai-prompt').textContent).then(function(){this.textContent='Copied!';var b=this;setTimeout(function(){b.textContent='Copy'},1500)}.bind(this))" style="position:absolute;top:12px;right:12px;background:var(--regen-green);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;">Copy</button>
      </div>
    </div>
  </section>

  <!-- One-time / Choose Your Own Credits -->
  <section class="hiw-section" style="background:var(--regen-gray-50);">
    <div class="regen-container" style="max-width:640px;text-align:center;">
      <h2 class="regen-section-title">Prefer a one-time purchase?</h2>
      <p style="color:var(--regen-gray-500);margin-bottom:24px;">Browse verified ecological credits on the Regen Marketplace and choose exactly which projects to support — pay with a credit card.</p>
      <a class="regen-btn regen-btn--primary" href="https://app.regen.network/projects/1?buying_options_filters=credit_card" target="_blank" rel="noopener">Let Me Choose</a>
    </div>
  </section>

  <!-- Live Stats -->
  <section class="stats-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">Real Impact, Publicly Verified</h2>
      <p class="regen-section-subtitle" style="text-align:center;">All credit retirements happen on Regen Network, a public ecological ledger. These numbers update in real time.</p>
      <div class="stats-bar">
        <div>
          <div class="stats-bar__num">${totalRetirements}</div>
          <div class="stats-bar__label">Credits Retired On-Chain</div>
        </div>
        <div>
          <div class="stats-bar__num">9+</div>
          <div class="stats-bar__label">Countries</div>
        </div>
        <div>
          <div class="stats-bar__num">5</div>
          <div class="stats-bar__label">Ecological Credit Types</div>
        </div>
      </div>
    </div>
  </section>

  <!-- What Your Subscription Funds — Credit Basket -->
  <section class="basket-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">What Your Subscription Funds</h2>
      <p class="regen-section-subtitle" style="text-align:center;">Your subscription retires verified ecocredits drawn from a curated selection across the Regen Registry — including carbon, biodiversity, and other ecological credit types. The mix evolves as new projects and credits become available.</p>
      <div class="basket-grid">

        <div class="basket-card">
          <div class="basket-visual basket-visual--carbon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 6c-2 3-6 8-6 14a6 6 0 0012 0c0-6-4-11-6-14z" fill="#fff" opacity="0.3"/><path d="M24 4V44M16 36l8-12 8 12" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 24c3-2 6-2 9 1M27 21c3-3 6-3 9 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/><circle cx="24" cy="8" r="2" fill="#fff" opacity="0.5"/></svg>
          </div>
          <div class="basket-body">
            <div class="basket-dimension basket-dimension--carbon">Carbon Removal</div>
            <div class="basket-name">Carbon Credits</div>
            <p class="basket-desc">Forest conservation and reforestation projects sequestering atmospheric carbon. Every tonne retired represents real carbon removed from the atmosphere and locked in living ecosystems.</p>
            <a class="basket-link" href="https://app.regen.network/credit-classes/C" target="_blank" rel="noopener">Learn more &rarr;</a>
          </div>
        </div>

        <div class="basket-card">
          <div class="basket-visual basket-visual--biodiversity">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 18c0-4 4-8 10-8s10 4 10 8c0 6-4 8-6 12h-8c-2-4-6-6-6-12z" fill="#fff" opacity="0.25"/><path d="M18 34c0 0 2 6 6 6s6-6 6-6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="20" cy="18" r="2" fill="#fff"/><circle cx="28" cy="18" r="2" fill="#fff"/><path d="M8 12c2 0 4 2 4 4M40 12c-2 0-4 2-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/><path d="M20 24c1.5 1 3 1 4 1s2.5 0 4-1" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="basket-body">
            <div class="basket-dimension basket-dimension--biodiversity">Biodiversity</div>
            <div class="basket-name">Terrasos Biodiversity Credits</div>
            <p class="basket-desc">Habitat conservation protecting Colombia's critical ecosystems and wildlife corridors. 30-year crediting periods safeguard jaguars, tapirs, and hundreds of endemic species.</p>
            <a class="basket-link" href="https://app.regen.network/credit-classes/BT" target="_blank" rel="noopener">Learn more &rarr;</a>
          </div>
        </div>

        <div class="basket-card">
          <div class="basket-visual basket-visual--urban">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="22" width="12" height="18" rx="1.5" fill="#fff" opacity="0.7"/><rect x="9" y="25" width="3" height="3" rx="0.5" fill="#527984" opacity="0.6"/><rect x="12" y="25" width="3" height="3" rx="0.5" fill="#527984" opacity="0.6"/><rect x="9" y="31" width="3" height="3" rx="0.5" fill="#527984" opacity="0.6"/><rect x="12" y="31" width="3" height="3" rx="0.5" fill="#527984" opacity="0.6"/><path d="M32 40V18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="14" r="8" fill="#fff" opacity="0.35"/><circle cx="32" cy="10" r="5" fill="#fff" opacity="0.5"/><line x1="4" y1="40" x2="44" y2="40" stroke="#fff" stroke-width="1.5" opacity="0.4"/></svg>
          </div>
          <div class="basket-body">
            <div class="basket-dimension basket-dimension--urban">Urban Canopy</div>
            <div class="basket-name">City Forest Credits</div>
            <p class="basket-desc">Urban tree canopy projects cleaning air, reducing heat islands, and strengthening communities. The national standard for urban forest carbon in U.S. cities.</p>
            <a class="basket-link" href="https://app.regen.network/credit-classes/CFC" target="_blank" rel="noopener">Learn more &rarr;</a>
          </div>
        </div>

        <div class="basket-card">
          <div class="basket-visual basket-visual--marine">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 22c4-3 8-3 12 0s8 3 12 0 8-3 12 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/><path d="M4 28c4-3 8-3 12 0s8 3 12 0 8-3 12 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/><path d="M4 34c4-3 8-3 12 0s8 3 12 0 8-3 12 0" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity="0.3"/><path d="M26 6c0 0 7 3 9 9s-3 11-9 11-9-5-9-11c0-4 4-7 7-9" fill="#fff" opacity="0.35"/><path d="M35 13l5-2-5-2" fill="#fff" opacity="0.6"/><circle cx="29" cy="13" r="1.5" fill="#fff"/></svg>
          </div>
          <div class="basket-body">
            <div class="basket-dimension basket-dimension--marine">Ocean &amp; Coast</div>
            <div class="basket-name">Marine Biodiversity Stewardship</div>
            <p class="basket-desc">Coastal and ocean ecosystem protection supporting the health of marine habitats, fisheries, and the communities that depend on them.</p>
            <a class="basket-link" href="https://app.regen.network/credit-classes/MBS" target="_blank" rel="noopener">Learn more &rarr;</a>
          </div>
        </div>

        <div class="basket-card">
          <div class="basket-visual basket-visual--grazing">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="24" rx="11" ry="7" fill="#fff" opacity="0.35"/><circle cx="24" cy="17" r="5" fill="#fff" opacity="0.45"/><circle cx="20" cy="15" r="2.5" fill="#fff" opacity="0.55"/><circle cx="28" cy="15" r="2.5" fill="#fff" opacity="0.55"/><circle cx="24" cy="12.5" r="2.5" fill="#fff" opacity="0.55"/><circle cx="21" cy="19" r="1" fill="#5d4037"/><circle cx="27" cy="19" r="1" fill="#5d4037"/><line x1="18" y1="31" x2="18" y2="36" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/><line x1="30" y1="31" x2="30" y2="36" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/><path d="M6 40c4-2 8-3 12-1s8 2 12 0 8-2 12-1" stroke="#fff" stroke-width="1" opacity="0.35"/></svg>
          </div>
          <div class="basket-body">
            <div class="basket-dimension basket-dimension--grazing">Regenerative Grazing</div>
            <div class="basket-name">Kilo-Sheep-Hour Credits</div>
            <p class="basket-desc">Regenerative grazing practices restoring grassland health by measuring verified animal impact. Building soil carbon, water retention, and biodiversity from the ground up.</p>
            <a class="basket-link" href="https://app.regen.network/credit-classes/KSH" target="_blank" rel="noopener">Learn more &rarr;</a>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- Trust -->
  <section class="trust-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">Why Regenerative Compute</h2>
      <div class="trust-grid">
        <div class="trust-item">
          <h3>Publicly Auditable</h3>
          <p>Every credit retirement is recorded on a public ledger. Anyone can verify. No double-counting, no greenwashing.</p>
        </div>
        <div class="trust-item">
          <h3>Beyond Carbon Offsets</h3>
          <p>Regenerative contribution funds real ecological projects — carbon removal, biodiversity protection, and soil health.</p>
        </div>
        <div class="trust-item">
          <h3>Open Source &amp; Transparent</h3>
          <p>The code is public. The retirements are public. The projects are public. Inspect anything, anytime.</p>
        </div>
      </div>
    </div>
  </section>

  ${brandFooter({ showInstall: false, links: [
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
    { label: "GitHub", href: "https://github.com/regen-network/regen-compute" },
  ] })}

  <script>
    function fundCustom() {
      var input = document.getElementById('custom-amount');
      var errEl = document.getElementById('custom-error');
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
          errEl.textContent = data.error || 'Something went wrong. Is Stripe configured?';
          errEl.style.display = 'block';
        }
      })
      .catch(function(e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      });
    }
  </script>

  <script>
    var currentInterval = 'monthly';
    function setInterval(interval) {
      currentInterval = interval;
      var monthlyEls = document.querySelectorAll('.price-monthly');
      var yearlyEls = document.querySelectorAll('.price-yearly');
      for (var i = 0; i < monthlyEls.length; i++) monthlyEls[i].style.display = interval === 'monthly' ? '' : 'none';
      for (var i = 0; i < yearlyEls.length; i++) yearlyEls[i].style.display = interval === 'yearly' ? '' : 'none';
      document.getElementById('toggle-monthly').className = 'interval-btn' + (interval === 'monthly' ? ' interval-btn--active' : '');
      document.getElementById('toggle-yearly').className = 'interval-btn interval-btn--yearly' + (interval === 'yearly' ? ' interval-btn--active' : '');
    }
  </script>

  <!-- Annual nudge modal -->
  <div class="nudge-overlay" id="nudge-overlay" onclick="if(event.target===this)closeNudge()">
    <div class="nudge-box">
      <h3>Consider going yearly</h3>
      <div class="nudge-reason">
        <div class="nudge-reason-icon">1</div>
        <p><strong>Save money</strong> — the yearly plan is like getting two months free.</p>
      </div>
      <div class="nudge-reason">
        <div class="nudge-reason-icon">2</div>
        <p><strong>More ecological impact</strong> — with fewer transactions, less goes to payment processing fees and more funds verified ecological regeneration.</p>
      </div>
      <div class="nudge-btns">
        <button class="nudge-btn-yearly" id="nudge-btn-yearly" onclick="switchToYearly()">Switch to Yearly & Save</button>
        <button class="nudge-btn-monthly" id="nudge-btn-monthly" onclick="continueMonthly()">Continue with Monthly</button>
      </div>
    </div>
  </div>

  ${hasPriceIds ? `<script>
    var pendingTier = null;

    function subscribe(tier) {
      if (currentInterval === 'monthly') {
        pendingTier = tier;
        document.getElementById('nudge-overlay').classList.add('active');
        return;
      }
      doSubscribe(tier, currentInterval);
    }

    function switchToYearly() {
      var tier = pendingTier;
      closeNudge();
      setInterval('yearly');
      doSubscribe(tier, 'yearly');
    }

    function continueMonthly() {
      var tier = pendingTier;
      closeNudge();
      doSubscribe(tier, 'monthly');
    }

    function closeNudge() {
      document.getElementById('nudge-overlay').classList.remove('active');
      pendingTier = null;
    }

    function doSubscribe(tier, interval) {
      var body = { tier: tier, interval: interval };
      ${refCode ? `body.referral_code = ${JSON.stringify(refCode)};` : ""}
      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.url) window.location.href = data.url;
        else alert('Error: ' + (data.error || 'Unknown error'));
      })
      .catch(function(e) { alert('Error: ' + e.message); });
    }
  </script>` : ""}

${betaBannerJS()}
</body>
</html>`);
  });

  // --- Stripe-dependent routes (only registered when Stripe is configured) ---
  if (stripe) {

  /**
   * POST /subscribe
   * Body: { tier: "dabbler"|"builder"|"agent", interval?: "monthly"|"yearly", email?: string, referral_code?: string }
   * Returns: { url: "https://checkout.stripe.com/..." }
   *
   * Creates a Stripe Checkout Session in subscription mode.
   * If a valid referral_code is provided, the subscription gets a 30-day free trial.
   */
  router.post("/subscribe", async (req: Request, res: Response) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { tier, interval, email, referral_code } = body ?? {};

      if (!tier || !["dabbler", "builder", "agent"].includes(tier)) {
        res.status(400).json({ error: 'tier must be "dabbler", "builder", or "agent"' });
        return;
      }

      const isYearly = interval === "yearly";

      // Resolve price ID for the tier + interval
      // Config still uses seedling/grove/forest env var names for Stripe price IDs
      const monthlyPriceIdMap: Record<string, string | undefined> = {
        dabbler: config?.stripePriceIdSeedling,
        builder: config?.stripePriceIdGrove,
        agent: config?.stripePriceIdForest,
      };
      const yearlyPriceIdMap: Record<string, string | undefined> = {
        dabbler: config?.stripePriceIdSeedlingYearly,
        builder: config?.stripePriceIdGroveYearly,
        agent: config?.stripePriceIdForestYearly,
      };

      const priceId = isYearly ? yearlyPriceIdMap[tier] : monthlyPriceIdMap[tier];
      if (!priceId) {
        // Fall back to Payment Links (monthly only)
        const linkMap: Record<string, string> = {
          dabbler: config?.stripePaymentLinkSeedling ?? "#",
          builder: config?.stripePaymentLinkGrove ?? "#",
          agent: config?.stripePaymentLinkForest ?? "#",
        };
        res.json({ url: linkMap[tier], fallback: true });
        return;
      }

      // Check referral code
      let referrerUser: ReturnType<typeof getUserByReferralCode> | undefined;
      if (referral_code) {
        referrerUser = getUserByReferralCode(db, referral_code);
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
        cancel_url: `${baseUrl}/cancel`,
        ...(email ? { customer_email: email } : {}),
        subscription_data: {
          metadata: {
            tier,
            source: "regen-compute",
            ...(referrerUser
              ? {
                  referrer_id: String(referrerUser.id),
                  referral_code: referral_code,
                }
              : {}),
          },
          ...(referrerUser ? { trial_period_days: 30 } : {}),
        },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Subscribe error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /r/:code
   * Short referral redirect → /?ref=CODE
   */
  router.get("/r/:code", (req: Request, res: Response) => {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    res.redirect(302, `${baseUrl}/?ref=${encodeURIComponent(code)}`);
  });

  /**
   * POST /checkout
   * Body: { amount_cents: 1000, email?: "user@example.com" }
   * Returns: { url: "https://checkout.stripe.com/..." }
   */
  router.post("/checkout", async (req: Request, res: Response) => {
    try {
      const { amount_cents, email } = req.body;

      if (!amount_cents || typeof amount_cents !== "number" || amount_cents < 100) {
        res.status(400).json({ error: "amount_cents must be at least 100 ($1.00)" });
        return;
      }

      const amountDollars = (amount_cents / 100).toFixed(2);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount_cents,
              product_data: {
                name: "Regenerative Compute — Ecological Credit Balance",
                description: `$${amountDollars} prepaid balance for retiring verified ecocredits via your AI assistant`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cancel`,
        ...(email ? { customer_email: email } : {}),
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Checkout error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /boost-checkout
   * Body: { amount_cents: 500, batch_denom: "BT01-001-...", project_name: "El Globo..." }
   * Creates a Stripe Checkout session for a one-time boost retirement targeting a specific project.
   * Returns: { url: "https://checkout.stripe.com/..." }
   */
  router.post("/boost-checkout", async (req: Request, res: Response) => {
    try {
      const { amount_cents, batch_denom, project_name } = req.body;

      if (!amount_cents || typeof amount_cents !== "number" || amount_cents < 100) {
        res.status(400).json({ error: "amount_cents must be at least 100 ($1.00)" });
        return;
      }

      if (!batch_denom || typeof batch_denom !== "string") {
        res.status(400).json({ error: "batch_denom is required" });
        return;
      }

      // Get the logged-in subscriber from the session cookie
      const { getSessionEmail } = await import("./magic-link.js");
      const email = getSessionEmail(req.headers.cookie, config?.sessionSecret ?? "");
      if (!email) {
        res.status(401).json({ error: "Not logged in" });
        return;
      }

      const user = getUserByEmail(db, email);
      const subscriber = user ? getSubscriberByStripeId(db, "") : null;
      // Look up subscriber by user id instead
      const sub = user ? db.prepare("SELECT * FROM subscribers WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(user.id) as { id: number } | undefined : undefined;

      const amountDollars = (amount_cents / 100).toFixed(2);
      const displayName = project_name || batch_denom;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount_cents,
              product_data: {
                name: `Boost: ${displayName}`,
                description: `$${amountDollars} one-time ecological credit retirement — ${displayName}`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "boost",
          batch_denom,
          project_name: displayName,
          subscriber_id: sub?.id?.toString() ?? "",
        },
        success_url: `${baseUrl}/dashboard?boost=success`,
        cancel_url: `${baseUrl}/dashboard`,
        customer_email: email,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Boost checkout error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /webhook
   * Stripe webhook handler — processes checkout.session.completed events.
   * Creates user if new, credits their balance, generates API key.
   */
  router.post("/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Webhook signature verification failed:", msg);
        res.status(400).json({ error: `Webhook Error: ${msg}` });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("Webhook rejected: STRIPE_WEBHOOK_SECRET is required in production");
      res.status(500).json({ error: "Webhook signature verification not configured" });
      return;
    } else {
      // Development only: accept unverified webhooks for local testing
      console.warn("WARNING: Processing unverified webhook (no STRIPE_WEBHOOK_SECRET set)");
      const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
      event = (typeof body === "string" ? JSON.parse(body) : body) as Stripe.Event;
    }

    // Idempotency: skip duplicate webhook events (Stripe retries)
    if (isEventProcessed(db, event.id)) {
      console.log(`Skipping duplicate webhook event: ${event.id} (${event.type})`);
      return res.json({ received: true });
    }
    markEventProcessed(db, event.id, event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const amountCents = session.amount_total ?? 0;
      const email = session.customer_email ?? session.customer_details?.email ?? null;
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

      // Find or create user
      let user = email ? getUserByEmail(db, email) : undefined;
      if (!user) {
        user = createUser(db, email, stripeCustomerId);
        console.log(`New user created: ${user.api_key} (${email})`);
      }

      // Extract billing interval from the Stripe subscription (if subscription mode)
      const isSubscription = session.mode === "subscription";
      let billingInterval: "monthly" | "yearly" | undefined;
      let stripeSubscriptionId: string | undefined;
      if (isSubscription && session.subscription) {
        stripeSubscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
        try {
          const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          billingInterval = interval === "year" ? "yearly" : "monthly";
        } catch (err) {
          console.warn(`Could not retrieve subscription ${stripeSubscriptionId} for billing interval:`, err instanceof Error ? err.message : err);
          billingInterval = undefined; // Will be backfilled from subscriber record
        }
      }

      creditBalance(
        db,
        user.id,
        amountCents,
        session.id,
        isSubscription
          ? `Subscription payment (${billingInterval ?? "unknown"}): $${(amountCents / 100).toFixed(2)}`
          : `One-time boost: $${(amountCents / 100).toFixed(2)}`,
        isSubscription ? "subscription" : "topup",
        billingInterval,
        stripeSubscriptionId
      );

      console.log(
        `Balance credited: user=${user.id} amount=$${(amountCents / 100).toFixed(2)} interval=${billingInterval ?? "n/a"} balance=$${((user.balance_cents + amountCents) / 100).toFixed(2)}`
      );
    } else if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionCreated(db, sub, stripe, baseUrl);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionUpdated(db, sub);
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionDeleted(db, sub);
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      // Note: handleInvoicePaid triggers retirement asynchronously (fire-and-forget)
      // so the webhook responds quickly. We still await the synchronous part (period updates).
      await handleInvoicePaid(db, invoice, baseUrl);
    }

    res.json({ received: true });
  });

  /**
   * GET /success?session_id=cs_xxx
   * Success page after Stripe Checkout — shows API key and install instructions.
   */
  router.get("/success", async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;
      const isSubscription = req.query.type === "subscription";
      if (!sessionId) {
        res.status(400).send("Missing session_id");
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = session.customer_email ?? session.customer_details?.email ?? null;

      if (!email) {
        res.status(400).send("No email found for this session");
        return;
      }

      const user = getUserByEmail(db, email);
      if (!user) {
        res.status(404).send("User not found — webhook may not have processed yet. Refresh in a few seconds.");
        return;
      }

      res.setHeader("Content-Type", "text/html");

      if (isSubscription) {
        // Subscription success page
        const referralLink = `${baseUrl}/r/${user.referral_code}`;
        const shareText = encodeURIComponent(
          "I just subscribed to @RegenCompute — funding verified ecological regeneration from my AI sessions. Use my link for a free first month:"
        );
        const shareUrl = encodeURIComponent(referralLink);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regenerative Compute — Thank You!</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
    .setup-toggle { background: none; border: none; color: var(--regen-green); font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
    .setup-toggle:hover { color: var(--regen-teal); }
    .setup-details { display: none; margin-top: 16px; }
    .profile-prompt { background: linear-gradient(135deg, var(--regen-gray-50), #f0faf4); border: 1px solid #d0e8d8; border-radius: 12px; padding: 20px 24px; }
    .profile-prompt h2 { color: var(--regen-green); margin: 0 0 6px; font-size: 18px; font-weight: 700; }
    .profile-prompt p { color: var(--regen-gray-700); font-size: 14px; margin: 0 0 14px; }
    .profile-prompt input { width: 100%; padding: 10px 14px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; font-family: inherit; box-sizing: border-box; }
    .profile-prompt input:focus { outline: none; border-color: var(--regen-green); box-shadow: 0 0 0 2px rgba(76,175,80,0.15); }
    .profile-prompt .btn-row { display: flex; gap: 10px; margin-top: 12px; align-items: center; }
    .profile-prompt .save-btn { background: var(--regen-green); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .profile-prompt .save-btn:hover { background: var(--regen-teal); }
    .profile-prompt .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .profile-prompt .skip-btn { background: none; border: none; color: var(--regen-gray-500); font-size: 13px; cursor: pointer; text-decoration: underline; }
    .profile-saved { display: none; padding: 14px 20px; background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 10px; color: var(--regen-green); font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  ${betaBannerHTML()}
  ${brandHeader({ nav: [{ label: "AI Plugin", href: "/ai-plugin" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Dashboard", href: "/dashboard" }] })}

  <div class="regen-container--narrow" style="padding-top:32px;">
    <div style="text-align:center;padding:32px 0 8px;">
      <h1 style="margin:0 0 12px;font-size:36px;font-weight:800;color:var(--regen-navy);">Thank You</h1>
      <p style="margin:0 auto;font-size:18px;color:var(--regen-gray-600);max-width:460px;line-height:1.6;">You're now funding real ecological regeneration every month. Welcome aboard.</p>
    </div>

    <div class="profile-prompt" id="profilePrompt" style="margin-top:28px;">
      <h2 style="color:var(--regen-navy);font-size:20px;margin:0 0 4px;">One more thing</h2>
      <p style="color:var(--regen-gray-700);font-size:15px;margin:0 0 14px;">Every credit we retire on your behalf goes to a public <a href="https://app.regen.network" target="_blank" rel="noopener" style="color:var(--regen-green);font-weight:600;">Regen Network portfolio page</a> with your name on it. What would you like displayed?</p>
      <input type="text" id="displayNameInput" placeholder="e.g. Jane Smith, Acme Corp, JS" maxlength="100" autocomplete="name" />
      <div class="btn-row">
        <button class="save-btn" id="saveNameBtn" onclick="saveDisplayName()">Save</button>
        <button class="skip-btn" onclick="skipDisplayName()">Skip for now</button>
      </div>
    </div>
    <div class="profile-saved" id="profileSaved"></div>

    <div class="regen-card" style="margin-top:24px;">
      <div class="regen-card__body">
        <h2 style="color:var(--regen-green);margin:0 0 12px;font-size:20px;font-weight:700;">What your subscription does</h2>
        <p style="margin:0 0 10px;color:var(--regen-gray-700);">Every month, we retire verified ecological credits on <strong>Regen Network</strong> — a public blockchain purpose-built for climate and biodiversity action.</p>
        <ul style="margin:12px 0 0;padding-left:20px;color:var(--regen-gray-700);">
          <li style="margin-bottom:6px;"><strong>Real impact</strong> — your money goes directly to projects restoring forests, protecting biodiversity, and regenerating land</li>
          <li style="margin-bottom:6px;"><strong>Permanently recorded</strong> — every retirement is on-chain, immutable, and verifiable by anyone</li>
          <li style="margin-bottom:6px;"><strong>You'll get a monthly email</strong> with a certificate showing exactly what was retired on your behalf</li>
        </ul>
        <p style="margin:12px 0 0;color:var(--regen-gray-700);">This isn't a carbon offset. It's a direct contribution to ecological regeneration.</p>
      </div>
    </div>

    <div class="regen-card" style="margin-top:24px;">
      <div class="regen-card__body">
        <h2 style="color:var(--regen-navy);margin:0 0 8px;font-size:18px;font-weight:700;">Connect to your AI assistant (optional)</h2>
        <p style="color:var(--regen-gray-500);font-size:14px;margin:0 0 16px;">If you use Claude Code, Cursor, or another AI tool that supports MCP, you can connect your subscription so your assistant can check your impact and retire credits on your behalf. <em>Skip this if you'd rather just let your monthly subscription do the work.</em></p>
        <button class="setup-toggle" onclick="toggleSetup()">Show setup instructions</button>
        <div class="setup-details" id="setupDetails">
          <p style="margin:8px 0;"><strong>Your API Key</strong></p>
          <span class="regen-api-key">${user.api_key}</span>
          <p style="font-size:13px;color:var(--regen-gray-500);margin-bottom:16px;">This key links your AI assistant to your subscription. Copy it somewhere safe.</p>
          <p style="margin:8px 0;"><strong>Step 1.</strong> Install the MCP server:</p>
          <pre class="regen-pre">claude mcp add -s user regen-compute -- npx regen-compute</pre>
          <p style="margin:8px 0;"><strong>Step 2.</strong> Set your API key (add to your shell profile or <span class="regen-code">.env</span>):</p>
          <pre class="regen-pre">export REGEN_API_KEY=${user.api_key}
export REGEN_BALANCE_URL=${baseUrl}</pre>
          <p style="margin:8px 0;"><strong>That's it.</strong> Your assistant can now show your subscription status and ecological impact. Try asking: <em>"What's my regenerative compute impact?"</em></p>
        </div>
      </div>
    </div>

    <div class="regen-referral-box">
      <h2>Give a Friend Their First Month Free</h2>
      <p>Share your link and your friend gets 30 days free. You earn bonus credit retirements.</p>
      <span class="regen-ref-link" onclick="copyLink()" id="refLink">${referralLink}</span>
      <div class="regen-share-btns">
        <a class="regen-share-btn regen-share-btn--x" href="${twitterUrl}" target="_blank" rel="noopener">Post on X</a>
        <a class="regen-share-btn regen-share-btn--linkedin" href="${linkedinUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
        <button class="regen-share-btn regen-share-btn--copy" onclick="copyLink()">Copy Link</button>
      </div>
    </div>
  </div>

  ${brandFooter({ links: [
    { label: "Manage subscription", href: baseUrl + "/manage?email=" + encodeURIComponent(email) },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Regen Marketplace", href: "https://app.regen.network" },
  ] })}

  <script>
    function copyLink() {
      var el = document.getElementById('refLink');
      navigator.clipboard.writeText(el.textContent).then(function() {
        el.textContent = 'Copied!';
        setTimeout(function() { el.textContent = '${referralLink}'; }, 2000);
      });
    }
    function toggleSetup() {
      var d = document.getElementById('setupDetails');
      var btn = d.previousElementSibling;
      if (d.style.display === 'block') {
        d.style.display = 'none';
        btn.textContent = 'Show setup instructions';
      } else {
        d.style.display = 'block';
        btn.textContent = 'Hide setup instructions';
      }
    }
    function saveDisplayName() {
      var name = document.getElementById('displayNameInput').value.trim();
      if (!name) return;
      var btn = document.getElementById('saveNameBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      fetch('/profile/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: '${sessionId}', display_name: name })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.ok) {
          document.getElementById('profilePrompt').style.display = 'none';
          var saved = document.getElementById('profileSaved');
          saved.style.display = 'block';
          var msg = 'Saved! Your retirements will be credited to <strong>' + name.replace(/</g,'&lt;') + '</strong>.';
          if (data.profile_url) {
            msg += ' <a href="' + data.profile_url + '" target="_blank" rel="noopener" style="color:var(--regen-green);font-weight:600;">View your Regen portfolio &rarr;</a>';
          }
          saved.innerHTML = msg;
        } else {
          btn.disabled = false;
          btn.textContent = 'Save';
          alert('Could not save: ' + (data.error || 'unknown error'));
        }
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = 'Save';
        alert('Network error — please try again.');
      });
    }
    function skipDisplayName() {
      document.getElementById('profilePrompt').style.display = 'none';
      // Set default name in background
      fetch('/profile/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: '${sessionId}', display_name: 'My On-Chain Proof' })
      }).catch(function() {});
    }
  </script>
${betaBannerJS()}
</body>
</html>`);
      } else {
        // One-time payment success page (existing)
        const amountDollars = (session.amount_total ?? 0) / 100;

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regenerative Compute — Payment Successful</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
  </style>
</head>
<body>
  ${betaBannerHTML()}
  ${brandHeader({ nav: [{ label: "AI Plugin", href: "/ai-plugin" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Dashboard", href: "/dashboard/login" }] })}

  <div class="regen-container--narrow" style="padding-top:40px;padding-bottom:40px;">
    <h1 style="color:var(--regen-navy);font-size:28px;font-weight:800;margin:0 0 8px;">Payment Successful</h1>
    <p>You've added <strong>$${amountDollars.toFixed(2)}</strong> to your Regenerative Compute balance.</p>
    <p>Current balance: <span style="font-size:24px;font-weight:800;color:var(--regen-green);">$${(user.balance_cents / 100).toFixed(2)}</span></p>

    <div class="regen-card" style="margin:24px 0;">
      <div class="regen-card__body">
        <strong style="color:var(--regen-navy);">Your API Key</strong>
        <span class="regen-api-key">${user.api_key}</span>
        <p style="font-size:14px;color:var(--regen-gray-500);"><strong>Save this key!</strong> You'll need it to connect your AI assistant.</p>
      </div>
    </div>

    <h2 style="color:var(--regen-navy);font-size:20px;font-weight:700;">Setup (30 seconds)</h2>
    <p><strong>1. Install the MCP server</strong> (if you haven't already):</p>
    <pre class="regen-pre">claude mcp add -s user regen-compute -- npx regen-compute</pre>
    <p><strong>2. Set your API key</strong> — add to your shell profile or <span class="regen-code">.env</span>:</p>
    <pre class="regen-pre">export REGEN_API_KEY=${user.api_key}
export REGEN_BALANCE_URL=${baseUrl}</pre>
    <p><strong>3. Done!</strong> In Claude Code, just say "retire 1 carbon credit" and it'll happen automatically from your prepaid balance.</p>

    <h2 style="color:var(--regen-navy);font-size:20px;font-weight:700;margin-top:28px;">What happens next</h2>
    <ul style="color:var(--regen-gray-700);">
      <li>Your AI assistant checks your balance before each retirement</li>
      <li>Credits are retired on-chain on Regen Network with verifiable proof</li>
      <li>When your balance gets low, you'll be prompted to top up</li>
    </ul>
    <p style="margin-top:20px;"><a class="regen-btn regen-btn--outline regen-btn--sm" href="${baseUrl}/#pricing">Top up again</a></p>
  </div>

  ${brandFooter({ showInstall: true })}
${betaBannerJS()}
</body>
</html>`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Success page error:", msg);
      res.status(500).send("Error loading success page. Your payment was received — check back shortly.");
    }
  });

  } // end if (stripe)

  /**
   * GET /cancel
   * Cancelled checkout — redirect or show message.
   */
  router.get("/cancel", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Regenerative Compute — Checkout Cancelled</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
  </style>
</head>
<body>
  ${betaBannerHTML()}
  ${brandHeader({ nav: [{ label: "AI Plugin", href: "/ai-plugin" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Dashboard", href: "/dashboard/login" }] })}
  <div class="regen-container--narrow" style="padding:60px 24px;text-align:center;max-width:540px;margin:0 auto;">
    <h1 style="color:var(--regen-navy);font-size:24px;font-weight:700;margin:0 0 16px;">No worries!</h1>
    <p style="color:var(--regen-gray-600);font-size:15px;line-height:1.6;margin:0 0 24px;">
      No payment was processed. A subscription isn't for everyone, and that's totally okay.
    </p>
    <p style="color:var(--regen-gray-600);font-size:15px;line-height:1.6;margin:0 0 32px;">
      If you're curious about ecological credits — carbon, biodiversity, marine stewardship, and more — you can explore what's available and retire credits directly on the Regen Marketplace.
    </p>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
      <a class="regen-btn regen-btn--primary regen-btn--sm" href="/#pricing">Back to subscription plans</a>
      <a class="regen-btn regen-btn--outline regen-btn--sm" href="https://app.regen.network" target="_blank" rel="noopener">Explore ecocredits on Regen Marketplace &rarr;</a>
    </div>
  </div>
  ${brandFooter()}
${betaBannerJS()}
</body>
</html>`);
  });

  /**
   * GET /checkout-page
   * Legacy route — redirects to landing page pricing section.
   */
  router.get("/checkout-page", (_req: Request, res: Response) => {
    res.redirect(301, "/#pricing");
  });

  if (stripe) {
  /**
   * GET /manage?email=user@example.com
   * Creates a Stripe Billing Portal session for subscription self-management
   * (upgrade, downgrade, cancel, update payment method) and redirects to it.
   */
  router.get("/manage", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string | undefined;

      if (!email) {
        res.status(400).send("Missing email parameter. Use: /manage?email=you@example.com");
        return;
      }

      // Look up user to get their Stripe customer ID
      const user = getUserByEmail(db, email);
      if (!user || !user.stripe_customer_id) {
        res.status(404).send("No subscription found for this email. If you just subscribed, try again in a few seconds.");
        return;
      }

      const returnUrl = config?.stripePortalReturnUrl ?? baseUrl;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: returnUrl,
      });

      res.redirect(303, portalSession.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Manage portal error:", msg);
      res.status(500).send("Error creating subscription management session. Please try again.");
    }
  });
  } // end if (stripe) — /manage

  // --- Authenticated routes (API key in header) ---

  /**
   * GET /balance
   * Header: Authorization: Bearer rfa_xxx
   * Returns: { balance_cents, balance_dollars, email }
   */
  router.get("/balance", (req: Request, res: Response) => {
    const user = authenticateRequest(req, res, db);
    if (!user) return;

    res.json({
      balance_cents: user.balance_cents,
      balance_dollars: (user.balance_cents / 100).toFixed(2),
      email: user.email,
      topup_url: `${baseUrl}/#pricing`,
    });
  });

  /**
   * POST /debit
   * Header: Authorization: Bearer rfa_xxx
   * Body: { amount_cents, description, retirement_tx_hash?, credit_class?, credits_retired? }
   * Returns: { success, balance_cents, balance_dollars }
   */
  router.post("/debit", (req: Request, res: Response) => {
    const user = authenticateRequest(req, res, db);
    if (!user) return;

    const { amount_cents, description, retirement_tx_hash, credit_class, credits_retired } = req.body;

    if (!amount_cents || typeof amount_cents !== "number" || amount_cents <= 0) {
      res.status(400).json({ error: "amount_cents must be a positive number" });
      return;
    }

    const result = debitBalance(
      db,
      user.id,
      amount_cents,
      description ?? "Credit retirement",
      retirement_tx_hash,
      credit_class,
      credits_retired
    );

    if (!result.success) {
      res.status(402).json({
        error: "Insufficient balance",
        balance_cents: result.balance_cents,
        balance_dollars: (result.balance_cents / 100).toFixed(2),
        topup_url: `${baseUrl}/#pricing`,
      });
      return;
    }

    res.json({
      success: true,
      balance_cents: result.balance_cents,
      balance_dollars: (result.balance_cents / 100).toFixed(2),
    });
  });

  /**
   * GET /transactions
   * Header: Authorization: Bearer rfa_xxx
   * Returns: { transactions: [...] }
   */
  router.get("/transactions", (req: Request, res: Response) => {
    const user = authenticateRequest(req, res, db);
    if (!user) return;

    const txns = getTransactions(db, user.id);
    res.json({
      transactions: txns.map((t) => ({
        ...t,
        amount_dollars: (t.amount_cents / 100).toFixed(2),
      })),
    });
  });

  // --- Profile endpoints ---

  router.post("/profile/display-name", async (req: Request, res: Response) => {
    try {
      const { session_id, display_name } = req.body ?? {};
      if (!session_id || typeof session_id !== "string") {
        res.status(400).json({ error: "session_id is required" });
        return;
      }
      const name = typeof display_name === "string" ? display_name.trim().slice(0, 100) : "";
      if (!name) {
        res.status(400).json({ error: "display_name is required" });
        return;
      }
      if (!stripe) {
        res.status(503).json({ error: "Stripe not configured" });
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(session_id);
      const email = session.customer_email ?? session.customer_details?.email ?? null;
      if (!email) {
        res.status(400).json({ error: "No email found for session" });
        return;
      }

      const user = getUserByEmail(db, email);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      setUserDisplayName(db, user.id, name);
      const subscriber = getSubscriberByUserId(db, user.id);
      const regenAddress = subscriber?.regen_address ?? null;
      const profileUrl = regenAddress
        ? `https://app.regen.network/profiles/${regenAddress}/portfolio`
        : null;

      // Push profile to app.regen.network registry in the background (non-blocking)
      if (subscriber) {
        updateRegistryProfile(subscriber.id, {
          name,
          image: `${baseUrl}/profile-avatar.svg`,
          bgImage: `${baseUrl}/profile-banner.svg`,
        }).then((result) => {
          if (result.success) {
            console.log(`Registry profile synced for subscriber=${subscriber.id}`);
          } else {
            console.warn(`Registry profile sync failed for subscriber=${subscriber.id}: ${result.error}`);
          }
        }).catch(() => {}); // swallow — this is best-effort
      }

      res.json({ ok: true, display_name: name, regen_address: regenAddress, profile_url: profileUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Profile display-name error:", msg);
      res.status(500).json({ error: "Failed to save display name" });
    }
  });

  // --- Beta feedback endpoints ---

  router.post("/feedback", (req: Request, res: Response) => {
    const { name, message, category, page } = req.body ?? {};
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const cat = ["bug", "suggestion", "comment"].includes(category) ? category : "comment";
    db.prepare(
      "INSERT INTO beta_feedback (name, message, category, page) VALUES (?, ?, ?, ?)"
    ).run(
      typeof name === "string" && name.trim() ? name.trim() : null,
      message.trim(),
      cat,
      typeof page === "string" ? page : null
    );
    res.json({ ok: true });
  });

  router.get("/feedback", (_req: Request, res: Response) => {
    const rows = db.prepare(
      "SELECT * FROM beta_feedback ORDER BY created_at DESC"
    ).all() as Array<{ id: number; name: string | null; message: string; category: string; page: string | null; created_at: string }>;

    const tableRows = rows.map(r =>
      `<tr><td>${r.id}</td><td>${r.created_at}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.name ?? "")}</td><td>${escapeHtml(r.message)}</td><td>${escapeHtml(r.page ?? "")}</td></tr>`
    ).join("");

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><head><title>Beta Feedback</title>
<style>body{font-family:sans-serif;margin:24px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:14px;} th{background:#f9fafb;} tr:hover{background:#f0f7f4;}</style>
</head><body><h1>Beta Feedback (${rows.length})</h1>
<table><thead><tr><th>ID</th><th>Date</th><th>Category</th><th>Name</th><th>Message</th><th>Page</th></tr></thead>
<tbody>${tableRows || "<tr><td colspan=6>No feedback yet</td></tr>"}</tbody></table></body></html>`);
  });

  // Daily admin checks: monthly credit selection + tradable stock levels
  const DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(() => {
    checkAndSendMonthlyReminder().catch((err) => {
      console.error("Monthly reminder check error:", err instanceof Error ? err.message : err);
    });
    checkTradableStock().catch((err) => {
      console.error("Tradable stock check error:", err instanceof Error ? err.message : err);
    });
  }, DAILY_CHECK_INTERVAL_MS);
  // Also check on startup
  setTimeout(() => {
    checkAndSendMonthlyReminder().catch((err) => {
      console.error("Monthly reminder check error (startup):", err instanceof Error ? err.message : err);
    });
    checkTradableStock().catch((err) => {
      console.error("Tradable stock check error (startup):", err instanceof Error ? err.message : err);
    });
  }, 15_000);

  // Start scheduled retirement processor — checks every hour for due yearly retirements
  const SCHEDULED_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  setInterval(() => {
    processScheduledRetirements(db, baseUrl).catch((err) => {
      console.error("Scheduled retirement processor error:", err instanceof Error ? err.message : err);
    });
  }, SCHEDULED_CHECK_INTERVAL_MS);
  // Also run once on startup (after a short delay to let the server finish initializing)
  setTimeout(() => {
    processScheduledRetirements(db, baseUrl).catch((err) => {
      console.error("Scheduled retirement processor error (startup):", err instanceof Error ? err.message : err);
    });
  }, 10_000);

  return router;
}

/** Extract and validate API key from Authorization header */
function authenticateRequest(req: Request, res: Response, db: Database.Database) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header. Use: Bearer <api_key>" });
    return null;
  }

  const apiKey = auth.slice(7).trim();
  const user = getUserByApiKey(db, apiKey);
  if (!user) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }

  return user;
}

/** Map Stripe subscription amount to plan name */
function amountToPlan(amountCents: number, interval: "monthly" | "yearly" = "monthly"): "dabbler" | "builder" | "agent" {
  if (interval === "yearly") {
    // Yearly amounts: $12.50 (1250), $25 (2500), $50 (5000)
    if (amountCents <= 1500) return "dabbler";
    if (amountCents <= 3000) return "builder";
    return "agent";
  }
  // Monthly amounts: $1.25 (125), $2.50 (250), $5 (500)
  if (amountCents <= 150) return "dabbler";
  if (amountCents <= 300) return "builder";
  return "agent";
}

/** Map Stripe subscription status to our subscriber status */
function stripeStatusToLocal(status: string): "active" | "paused" | "cancelled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "paused") return "paused";
  return "cancelled";
}

async function handleSubscriptionCreated(db: Database.Database, sub: Stripe.Subscription, stripe: Stripe, baseUrl: string) {
  try {
    const stripeSubId = sub.id;
    const existing = getSubscriberByStripeId(db, stripeSubId);
    if (existing) return; // Already processed

    // Get customer email to find/create user
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    let email: string | null = null;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) {
          email = (customer as Stripe.Customer).email;
        }
      } catch { /* ignore */ }
    }

    let user = email ? getUserByEmail(db, email) : undefined;
    if (!user) {
      user = createUser(db, email, customerId ?? null);
      console.log(`New user created for subscription: ${user.api_key} (${email})`);
    }

    const priceItem = sub.items?.data?.[0]?.price;
    const amountCents = priceItem?.unit_amount ?? 0;
    const stripeInterval = priceItem?.recurring?.interval;
    const billingInterval: "monthly" | "yearly" = stripeInterval === "year" ? "yearly" : "monthly";
    const plan = amountToPlan(amountCents, billingInterval);
    const periodStart = (sub as unknown as Record<string, unknown>).current_period_start
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_start as number) * 1000).toISOString()
      : undefined;
    const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_end as number) * 1000).toISOString()
      : undefined;

    const subscriber = createSubscriber(db, user.id, stripeSubId, plan, amountCents, periodStart, periodEnd, billingInterval);
    console.log(`Subscription created: ${stripeSubId} plan=${plan} interval=${billingInterval} amount=$${(amountCents / 100).toFixed(2)}`);

    // Derive and store Regen address for this subscriber
    try {
      const regenAddr = await deriveSubscriberAddress(subscriber.id);
      setSubscriberRegenAddress(db, subscriber.id, regenAddr);
      console.log(`Regen address derived: subscriber=${subscriber.id} addr=${regenAddr}`);
    } catch (err) {
      console.error(`Failed to derive regen address for subscriber ${subscriber.id}:`, err instanceof Error ? err.message : err);
    }

    // Send welcome email (fire-and-forget, don't block webhook response)
    if (email) {
      const dashboardUrl = `${baseUrl}/dashboard/login`;
      sendWelcomeEmail(email, plan, dashboardUrl).catch(err => {
        console.error("Failed to send welcome email:", err instanceof Error ? err.message : err);
      });
    }

    // Handle referral tracking from subscription metadata
    const referrerId = sub.metadata?.referrer_id;
    if (referrerId) {
      const referrerUserId = parseInt(referrerId, 10);
      if (!isNaN(referrerUserId) && referrerUserId !== user.id) {
        setUserReferredBy(db, user.id, referrerUserId);
        createReferralReward(db, referrerUserId, user.id, "extra_credit_retirement");
        console.log(`Referral tracked: referrer=${referrerUserId} referred=${user.id}`);
      }
    }
  } catch (err) {
    console.error("Error handling subscription.created:", err instanceof Error ? err.message : err);
  }
}

function handleSubscriptionUpdated(db: Database.Database, sub: Stripe.Subscription) {
  try {
    const stripeSubId = sub.id;
    const existing = getSubscriberByStripeId(db, stripeSubId);
    if (!existing) return; // Not tracked

    const priceItem = sub.items?.data?.[0]?.price;
    const amountCents = priceItem?.unit_amount ?? existing.amount_cents;
    const stripeInterval = priceItem?.recurring?.interval;
    const billingInterval: "monthly" | "yearly" = stripeInterval === "year" ? "yearly" : "monthly";
    const plan = amountToPlan(amountCents, billingInterval);
    const status = stripeStatusToLocal(sub.status);
    const periodStart = (sub as unknown as Record<string, unknown>).current_period_start
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_start as number) * 1000).toISOString()
      : undefined;
    const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_end as number) * 1000).toISOString()
      : undefined;

    updateSubscriber(db, stripeSubId, {
      plan,
      amount_cents: amountCents,
      billing_interval: billingInterval,
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    console.log(`Subscription updated: ${stripeSubId} plan=${plan} interval=${billingInterval} status=${status}`);
  } catch (err) {
    console.error("Error handling subscription.updated:", err instanceof Error ? err.message : err);
  }
}

function handleSubscriptionDeleted(db: Database.Database, sub: Stripe.Subscription) {
  try {
    const stripeSubId = sub.id;
    const existing = getSubscriberByStripeId(db, stripeSubId);
    updateSubscriberStatus(db, stripeSubId, "cancelled");

    // Cancel any pending scheduled retirements for yearly subscribers
    if (existing) {
      const cancelled = cancelScheduledRetirements(db, existing.id);
      if (cancelled > 0) {
        console.log(`Cancelled ${cancelled} scheduled retirement(s) for subscriber ${existing.id}`);
      }
    }

    console.log(`Subscription cancelled: ${stripeSubId}`);
  } catch (err) {
    console.error("Error handling subscription.deleted:", err instanceof Error ? err.message : err);
  }
}

async function handleInvoicePaid(db: Database.Database, invoice: Stripe.Invoice, baseUrl: string, retryCount = 0) {
  try {
    // In Stripe SDK v20+, subscription is nested under parent.subscription_details
    const subDetails = invoice.parent?.subscription_details;
    const subRef = subDetails?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return; // Not a subscription invoice

    let existing = getSubscriberByStripeId(db, subId);
    if (!existing) {
      // Race condition: invoice.paid can arrive before customer.subscription.created.
      // Retry up to 3 times with increasing delays to give subscription.created time to process.
      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [5_000, 15_000, 30_000]; // 5s, 15s, 30s
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(`Invoice paid but subscriber not found for ${subId} — retrying in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          handleInvoicePaid(db, invoice, baseUrl, retryCount + 1).catch(err => {
            console.error(`Invoice retry failed for ${subId}:`, err instanceof Error ? err.message : err);
          });
        }, delay);
        return;
      }
      console.error(`Invoice paid but subscriber never found for ${subId} after ${MAX_RETRIES} retries — retirement skipped`);
      return;
    }

    // Update subscription period from the invoice
    const periodStart = invoice.lines?.data?.[0]?.period?.start;
    const periodEnd = invoice.lines?.data?.[0]?.period?.end;

    const updates: Parameters<typeof updateSubscriber>[2] = {};
    if (periodStart) {
      updates.current_period_start = new Date(periodStart * 1000).toISOString();
    }
    if (periodEnd) {
      updates.current_period_end = new Date(periodEnd * 1000).toISOString();
    }

    if (Object.keys(updates).length > 0) {
      updateSubscriber(db, subId, updates);
    }

    const amountCents = invoice.amount_paid ?? 0;
    console.log(
      `Invoice paid: subscription=${subId} amount=$${(amountCents / 100).toFixed(2)} period=${updates.current_period_start ?? "?"} to ${updates.current_period_end ?? "?"}`
    );

    // Trigger per-subscriber retirement (fire-and-forget, don't block webhook response)
    if (amountCents > 0 && existing.status === "active") {
      // Derive and store regen address if not yet set
      if (!existing.regen_address) {
        try {
          const regenAddr = await deriveSubscriberAddress(existing.id);
          setSubscriberRegenAddress(db, existing.id, regenAddr);
        } catch (err) {
          console.error(`Failed to derive regen address for subscriber ${existing.id}:`, err instanceof Error ? err.message : err);
        }
      }

      if (existing.billing_interval === "yearly") {
        // Yearly: deduct Stripe fees ONCE on the full payment, then divide net by 12.
        const netTotal = calculateNetAfterStripe(amountCents);
        const monthlyNet = Math.floor(netTotal / 12);
        const firstMonthNet = netTotal - (monthlyNet * 11); // remainder goes to first month
        const monthlyGross = Math.floor(amountCents / 12);
        const firstMonthGross = amountCents - (monthlyGross * 11);

        // Schedule months 2-12 (store gross for display, but net is pre-computed at execution)
        const now = new Date();
        for (let month = 1; month <= 11; month++) {
          const scheduledDate = new Date(now);
          scheduledDate.setMonth(scheduledDate.getMonth() + month);
          createScheduledRetirement(
            db, existing.id, monthlyGross, monthlyNet,
            scheduledDate.toISOString().split("T")[0],
            "yearly"
          );
        }
        console.log(
          `Scheduled 11 future retirements for yearly subscriber ${existing.id} ` +
          `(net $${(monthlyNet / 100).toFixed(2)}/mo from $${(amountCents / 100).toFixed(2)} yearly)`
        );

        // Accumulate FULL year's burn budget upfront (5% of entire net payment).
        // Monthly retirements will skip burn accumulation since it's already front-loaded.
        const yearlyBurnBudget = Math.floor(netTotal * 0.05); // 5% burn split
        if (yearlyBurnBudget > 0) {
          accumulateBurnBudget(db, yearlyBurnBudget);
          console.log(
            `Front-loaded yearly burn budget: $${(yearlyBurnBudget / 100).toFixed(2)} ` +
            `(5% of $${(netTotal / 100).toFixed(2)} net) for subscriber ${existing.id}`
          );
          maybeExecuteAutoBurn(db).catch(() => {});
        }

        // Execute first month immediately — pass precomputedNetCents to skip double fee deduction.
        // skipBurnAccumulation=true because burn was already front-loaded above.
        executeRetirementAsync(db, existing.id, firstMonthGross, existing.billing_interval, baseUrl, firstMonthNet, invoice.id, true);
      } else {
        // Monthly: execute immediately (Stripe fees deducted inside retireForSubscriber)
        executeRetirementAsync(db, existing.id, amountCents, existing.billing_interval, baseUrl, undefined, invoice.id);
      }
    }
  } catch (err) {
    console.error("Error handling invoice.paid:", err instanceof Error ? err.message : err);
  }
}

/** Send the appropriate retirement notification email (first vs recurring) */
async function sendRetirementNotificationEmail(
  db: Database.Database,
  subscriberId: number,
  result: SubscriberRetirementResult,
  baseUrl: string,
): Promise<void> {
  try {
    // Look up subscriber email
    const sub = db.prepare(
      "SELECT s.*, u.email FROM subscribers s JOIN users u ON u.id = s.user_id WHERE s.id = ?"
    ).get(subscriberId) as { email: string; id: number } | undefined;
    if (!sub?.email) return;

    const dashboardUrl = `${baseUrl}/dashboard/login`;
    const portfolioUrl = result.regenAddress
      ? `https://app.regen.network/profiles/${result.regenAddress}/portfolio`
      : null;

    // Build batch summaries from result
    const batchSummaries = result.batches
      .filter((b) => b.creditsRetired > 0)
      .map((b) => {
        const project = getProjectForBatch(b.batchDenom);
        return {
          projectName: project?.name ?? b.creditClassId,
          credits: b.creditsRetired,
          creditType: project?.creditTypeLabel ?? b.creditTypeAbbrev,
        };
      });

    // Count total retirements to determine first vs recurring
    const retirementCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM subscriber_retirements WHERE subscriber_id = ?"
    ).get(subscriberId) as { cnt: number })?.cnt ?? 0;

    if (retirementCount <= 1) {
      await sendFirstRetirementEmail(
        sub.email, dashboardUrl, result.totalCreditsRetired, portfolioUrl, batchSummaries,
      );
      console.log(`First retirement email sent to ${sub.email}`);
    } else {
      // Get cumulative stats
      const cumulative = getCumulativeAttribution(db, subscriberId);
      const totalCumCredits = cumulative.total_carbon + cumulative.total_biodiversity + cumulative.total_uss;
      await sendRetirementReceiptEmail(
        sub.email, dashboardUrl, result.totalCreditsRetired, totalCumCredits,
        Math.max(1, cumulative.months_active), portfolioUrl, batchSummaries,
      );
      console.log(`Retirement receipt email sent to ${sub.email}`);
    }
  } catch (err) {
    console.error(`Failed to send retirement email for subscriber ${subscriberId}:`, err instanceof Error ? err.message : err);
  }
}

/** Fire-and-forget retirement execution with logging */
function executeRetirementAsync(
  db: Database.Database,
  subscriberId: number,
  grossAmountCents: number,
  billingInterval: "monthly" | "yearly",
  baseUrl: string,
  precomputedNetCents?: number,
  paymentId?: string,
  skipBurnAccumulation = false
): void {
  withSubscriberLock(subscriberId, async () => {
    const result = await retireForSubscriber({
      subscriberId,
      grossAmountCents,
      billingInterval,
      precomputedNetCents,
      paymentId,
    });

    if (!skipBurnAccumulation && result.burnBudgetCents > 0 && (result.status === "success" || result.status === "partial")) {
      accumulateBurnBudget(db, result.burnBudgetCents);
      // Check if pending burn budget has reached threshold — trigger auto burn
      maybeExecuteAutoBurn(db).catch(() => {});
    }
    if (result.status === "success") {
      console.log(
        `Retirement completed: subscriber=${subscriberId} credits=${result.totalCreditsRetired.toFixed(6)} ` +
        `spent=$${(result.totalSpentCents / 100).toFixed(2)} status=${result.status}`
      );
      // Send retirement notification email (fire-and-forget)
      sendRetirementNotificationEmail(db, subscriberId, result, baseUrl).catch(() => {});
    } else if (result.status === "partial" && paymentId) {
      // Some batches failed — schedule a retry in 1 hour
      console.warn(
        `Retirement partial: subscriber=${subscriberId} credits=${result.totalCreditsRetired.toFixed(6)} ` +
        `errors=${result.errors.length} — scheduling retry in 1 hour`
      );
      setTimeout(() => {
        console.log(`Retrying partial retirement for subscriber=${subscriberId} payment=${paymentId}`);
        executeRetirementAsync(db, subscriberId, grossAmountCents, billingInterval, baseUrl, precomputedNetCents, paymentId, skipBurnAccumulation);
      }, 60 * 60 * 1000);
    } else if (result.status === "partial") {
      console.warn(
        `Retirement partial: subscriber=${subscriberId} credits=${result.totalCreditsRetired.toFixed(6)} ` +
        `errors=${result.errors.length} (no paymentId, cannot retry)`
      );
    } else {
      console.error(
        `Retirement failed: subscriber=${subscriberId} errors=${JSON.stringify(result.errors)}`
      );
    }
  }).catch((err) => {
    console.error(`Retirement error for subscriber ${subscriberId}:`, err instanceof Error ? err.message : err);
  });
}

/**
 * Process due scheduled retirements (for yearly subscribers).
 * Should be called periodically (e.g. daily via cron or setInterval).
 */
async function processScheduledRetirements(db: Database.Database, baseUrl?: string): Promise<void> {
  const due = getDueScheduledRetirements(db);
  if (due.length === 0) return;

  console.log(`Processing ${due.length} scheduled retirement(s)...`);

  for (const scheduled of due) {
    updateScheduledRetirement(db, scheduled.id, { status: "running" });

    try {
      await withSubscriberLock(scheduled.subscriber_id, async () => {
        const result = await retireForSubscriber({
          subscriberId: scheduled.subscriber_id,
          grossAmountCents: scheduled.gross_amount_cents,
          billingInterval: scheduled.billing_interval as "monthly" | "yearly",
          precomputedNetCents: scheduled.net_amount_cents || undefined,
          paymentId: `scheduled-${scheduled.id}`,
        });

        // Yearly burn budget is front-loaded at payment time — skip per-month accumulation.
        // Only accumulate burn for monthly scheduled retirements (currently none, but future-proof).
        const isYearlyScheduled = scheduled.billing_interval === "yearly";

        if (result.status === "success") {
          if (!isYearlyScheduled && result.burnBudgetCents > 0) {
            accumulateBurnBudget(db, result.burnBudgetCents);
            maybeExecuteAutoBurn(db).catch(() => {});
          }
          updateScheduledRetirement(db, scheduled.id, {
            status: "completed",
            executed_at: new Date().toISOString(),
          });
          console.log(
            `Scheduled retirement completed: id=${scheduled.id} subscriber=${scheduled.subscriber_id} ` +
            `credits=${result.totalCreditsRetired.toFixed(6)}`
          );
          // Send retirement notification email
          if (baseUrl) {
            sendRetirementNotificationEmail(db, scheduled.subscriber_id, result, baseUrl).catch(() => {});
          }
        } else if (result.status === "partial") {
          // Some batches succeeded, others failed — mark as partial so it will be retried
          if (!isYearlyScheduled && result.burnBudgetCents > 0) {
            accumulateBurnBudget(db, result.burnBudgetCents);
            maybeExecuteAutoBurn(db).catch(() => {});
          }
          updateScheduledRetirement(db, scheduled.id, {
            status: "partial",
            error: result.errors.join("; "),
            executed_at: new Date().toISOString(),
          });
          console.warn(
            `Scheduled retirement partial: id=${scheduled.id} subscriber=${scheduled.subscriber_id} ` +
            `credits=${result.totalCreditsRetired.toFixed(6)} — will retry failed batches`
          );
        } else {
          updateScheduledRetirement(db, scheduled.id, {
            status: "failed",
            error: result.errors.join("; "),
            executed_at: new Date().toISOString(),
          });
          console.error(
            `Scheduled retirement failed: id=${scheduled.id} subscriber=${scheduled.subscriber_id} ` +
            `errors=${JSON.stringify(result.errors)}`
          );
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateScheduledRetirement(db, scheduled.id, {
        status: "failed",
        error: msg,
        executed_at: new Date().toISOString(),
      });
      console.error(`Scheduled retirement error: id=${scheduled.id} ${msg}`);
    }
  }
}

// --- Auto burn trigger ---

/** Minimum pending burn budget before triggering a swap-and-burn (in cents). */
const AUTO_BURN_THRESHOLD_CENTS = 100; // $1.00

/** Debounce: don't trigger another burn if one ran within the last hour. */
let _lastBurnAttempt = 0;
const BURN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check pending burn budget and trigger swap-and-burn if threshold is met.
 * Called after every retirement that accumulates burn budget.
 * Non-blocking, fire-and-forget — failures are logged, not thrown.
 */
async function maybeExecuteAutoBurn(db: Database.Database): Promise<void> {
  const now = Date.now();
  if (now - _lastBurnAttempt < BURN_COOLDOWN_MS) return;

  const pendingCents = getPendingBurnBudget(db);
  if (pendingCents < AUTO_BURN_THRESHOLD_CENTS) return;

  // Check Osmosis wallet readiness before attempting
  const readiness = await checkOsmosisReadiness();
  if (!readiness.ready) {
    console.log(
      `Auto-burn: $${(pendingCents / 100).toFixed(2)} pending but Osmosis wallet not ready: ` +
      readiness.issues.join("; ")
    );
    return;
  }

  _lastBurnAttempt = now;
  console.log(`Auto-burn: triggering swap-and-burn for $${(pendingCents / 100).toFixed(2)} pending burn budget`);

  try {
    const result = await swapAndBurn({
      allocationCents: pendingCents,
      swapDenom: readiness.usdcBalance >= pendingCents / 100 ? "usdc" : "osmo",
    });

    if (result.status === "completed") {
      // Mark accumulated entries as executed
      const maxId = db.prepare(
        "SELECT MAX(id) AS max_id FROM burn_accumulator WHERE executed = 0"
      ).get() as { max_id: number | null };
      if (maxId.max_id) {
        markBurnExecuted(db, maxId.max_id);
      }
      console.log(
        `Auto-burn completed: burned ${Number(result.burnAmountUregen) / 1e6} REGEN ` +
        `(swap: ${result.swapTxHash}, ibc: ${result.ibcTxHash}, burn: ${result.burnTxHash})`
      );
    } else {
      console.warn(`Auto-burn ${result.status}: ${result.errors.join("; ")}`);
    }
  } catch (err) {
    console.error("Auto-burn error:", err instanceof Error ? err.message : err);
  }
}
