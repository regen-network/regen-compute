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
  fulfillReferralReward,
  getPendingReferralRewardForReferred,
  getTodayReferralCount,
  holdReferralReward,
  getHeldReferralRewards,
  approveReferralReward,
  getReferralCount,
  getMedianReferralCount,
  getFulfilledReferralRewardsForUser,
  insertReferralBonusTransaction,
  type ReferralReward,
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
  createOrganization,
  getOrganizationById,
  getOrganizationBySubscriberId,
  updateOrganizationPublicity,
  linkSubscriberToOrg,
  getPublicOrganizations,
} from "./db.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { sendWelcomeEmail, sendFirstRetirementEmail, sendRetirementReceiptEmail, sendReferralBonusEmail } from "../services/email.js";
import { deriveSubscriberAddress } from "../services/subscriber-wallet.js";
import { retireForSubscriber, accumulateBurnBudget, getPendingBurnBudget, markBurnExecuted, calculateNetAfterStripe, type SubscriberRetirementResult } from "../services/retire-subscriber.js";
import { swapAndBurn, checkOsmosisReadiness } from "../services/swap-and-burn.js";
import { getProjectForBatch, PROJECTS } from "./project-metadata.js";
import { checkAndSendMonthlyReminder, checkTradableStock, sendTelegram } from "../services/admin-telegram.js";
import { updateRegistryProfile } from "../services/registry-profile.js";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { t, SUPPORTED_LANGS, LANG_NAMES, LANG_FLAGS, LANG_SHORT, type LangCode } from "./translations.js";

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
   * GET / and GET /:lang
   * Subscription landing page with live impact stats.
   * Supports 21 languages via /:lang (e.g. /es, /fr, /zh).
   */
  async function serveLandingPage(_req: Request, res: Response, lang: LangCode = "en") {
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
    const publicOrgs = getPublicOrganizations(db);

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(lang, "page_title")}</title>
  <meta name="description" content="${t(lang, "page_description")}">
  <meta property="og:title" content="${t(lang, "page_title")}">
  <meta property="og:description" content="${t(lang, "page_description")}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenCompute">
  <meta name="twitter:title" content="${t(lang, "page_title")}">
  <meta name="twitter:description" content="${t(lang, "page_description")}">
  <meta name="twitter:image" content="${baseUrl}/og-card.jpg">
${SUPPORTED_LANGS.map(l => `  <link rel="alternate" hreflang="${l}" href="${baseUrl}/${l === 'en' ? '' : l}">`).join('\n')}
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    /* Language picker */
    .lang-picker { position: relative; margin-left: 8px; }
    .lang-picker__btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: 1px solid var(--regen-gray-200); border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 13px; color: var(--regen-navy); font-family: inherit; transition: border-color 0.2s; }
    .lang-picker__btn:hover { border-color: var(--regen-green); }
    .lang-picker__flag { font-size: 16px; line-height: 1; }
    .lang-picker__code { font-weight: 600; font-size: 12px; }
    .lang-picker__menu { display: none; position: absolute; right: 0; top: calc(100% + 6px); background: var(--regen-white); border: 1px solid var(--regen-gray-200); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 6px 0; min-width: 200px; max-height: 360px; overflow-y: auto; z-index: 1000; }
    .lang-picker__menu.open { display: block; }
    .lang-picker__item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 14px; color: var(--regen-navy); text-decoration: none; transition: background 0.15s; }
    .lang-picker__item:hover { background: var(--regen-gray-50); }
    .lang-picker__item--active { font-weight: 700; color: var(--regen-green); }

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
      display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px; margin-top: 28px;
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
    .basket-img {
      width: 100%; height: 180px; object-fit: cover;
      display: block;
    }
    .basket-body { padding: 20px 24px 24px; }
    .basket-badge {
      display: inline-block;
      font-family: var(--regen-font-secondary);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; padding: 3px 10px;
      border-radius: 20px; margin-bottom: 8px;
    }
    .basket-name {
      font-size: 17px; font-weight: 700; color: var(--regen-navy);
      margin-bottom: 4px; line-height: 1.3;
    }
    .basket-location {
      font-size: 13px; color: var(--regen-gray-400); margin-bottom: 10px;
      font-weight: 500;
    }
    .basket-desc {
      font-size: 13px; color: var(--regen-gray-500);
      line-height: 1.6; margin: 0 0 14px;
    }
    .basket-meta {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
    }
    .basket-meta-tag {
      font-size: 11px; font-weight: 600; color: var(--regen-gray-500);
      background: var(--regen-gray-100); padding: 2px 8px; border-radius: 4px;
    }
    .basket-links {
      display: flex; gap: 16px; flex-wrap: wrap;
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
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Regenerative Compute",
  "applicationCategory": "DeveloperApplication",
  "description": "Ecological accountability for AI compute — retire verified ecocredits on Regen Network. MCP server for Claude, Cursor, and any MCP-compatible AI tool.",
  "operatingSystem": "Any",
  "url": "https://compute.regen.network",
  "offers": [
    { "@type": "Offer", "name": "Dabbler", "price": "1.25", "priceCurrency": "USD", "billingDuration": "P1M", "description": "For casual AI users" },
    { "@type": "Offer", "name": "Builder", "price": "2.50", "priceCurrency": "USD", "billingDuration": "P1M", "description": "For regular AI developers" },
    { "@type": "Offer", "name": "Agent", "price": "50.00", "priceCurrency": "USD", "billingDuration": "P1Y", "description": "For AI-native teams and autonomous agents" }
  ],
  "provider": {
    "@type": "Organization",
    "name": "Regen Network Development",
    "url": "https://regen.network"
  }
}
</script>
</head>
<body>
  ${betaBannerHTML()}

  ${referralValid ? `<div class="regen-ref-banner"><span>${t(lang, "referral_banner_prefix")}</span> ${t(lang, "referral_banner_suffix")}</div>` : ""}

  ${brandHeader({ nav: [{ label: t(lang, "nav_ai_plugin"), href: "/ai-plugin" }, { label: t(lang, "nav_research"), href: "/research" }, { label: t(lang, "nav_about"), href: "/about" }, { label: t(lang, "nav_dashboard"), href: "/dashboard/login" }] }).replace('</nav>', `
    <div class="lang-picker">
      <button class="lang-picker__btn" onclick="document.querySelector('.lang-picker__menu').classList.toggle('open')" type="button">
        <span class="lang-picker__flag">${LANG_FLAGS[lang]}</span>
        <span class="lang-picker__code">${LANG_SHORT[lang]}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="margin-left:2px;"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="lang-picker__menu">
        ${SUPPORTED_LANGS.map(l => `<a class="lang-picker__item${l === lang ? ' lang-picker__item--active' : ''}" href="${l === 'en' ? '/' : '/' + l}"><span class="lang-picker__flag">${LANG_FLAGS[l]}</span> ${LANG_NAMES[l]}</a>`).join('')}
      </div>
    </div>
  </nav>`)}

  <!-- Hero -->
  <section class="regen-hero">
    <div class="regen-container">
      <div class="regen-hero__label">${t(lang, "hero_label")}</div>
      <h1>${t(lang, "hero_title")} <span>${t(lang, "hero_title_highlight")}</span> ${t(lang, "hero_title_suffix")}</h1>
      <p>${t(lang, "hero_desc")}</p>
      <a class="regen-btn regen-btn--solid" href="#pricing">${t(lang, "hero_cta")}</a>
    </div>
  </section>

  <!-- Impact callout -->
  <div style="text-align:center; padding: 18px 24px; background: linear-gradient(135deg, rgba(79,181,115,0.08), rgba(121,198,170,0.08)); border-top: 1px solid rgba(79,181,115,0.15); border-bottom: 1px solid rgba(79,181,115,0.15);">
    <p style="margin:0; font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #374151; font-weight: 500;">
      ${t(lang, "impact_prefix")} <strong style="color:#101570;">${t(lang, "impact_co2_daily")}</strong>. ${t(lang, "impact_middle")} <strong style="color:#101570;">${t(lang, "impact_co2_agentic")}</strong>.
      <a href="/research" style="color:#4FB573; font-weight:600; margin-left:6px;">${t(lang, "impact_link")} &rarr;</a>
    </p>
  </div>

  <!-- How it works -->
  <section class="hiw-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">${t(lang, "hiw_title")}</h2>
      <div class="hiw-steps">
        <div class="hiw-step">
          <div class="hiw-num">1</div>
          <h3>${t(lang, "hiw_step1_title")}</h3>
          <p>${t(lang, "hiw_step1_desc")}</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">2</div>
          <h3>${t(lang, "hiw_step2_title")}</h3>
          <p>${t(lang, "hiw_step2_desc")}</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">3</div>
          <h3>${t(lang, "hiw_step3_title")}</h3>
          <p>${t(lang, "hiw_step3_desc")}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section class="pricing-section" id="pricing">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">${t(lang, "pricing_title")}</h2>

      <!-- Monthly / Yearly toggle -->
      <div style="display:flex;justify-content:center;margin-bottom:28px;">
        <div id="interval-toggle" style="display:inline-flex;background:var(--regen-gray-100);border-radius:10px;padding:4px;">
          <button id="toggle-monthly" onclick="setInterval('monthly')" class="interval-btn interval-btn--active">${t(lang, "toggle_monthly")}</button>
          <button id="toggle-yearly" onclick="setInterval('yearly')" class="interval-btn interval-btn--yearly">${t(lang, "toggle_yearly")} <span style="font-size:11px;font-weight:700;color:var(--regen-green);">${t(lang, "toggle_save")}</span></button>
        </div>
      </div>

      <div class="regen-tiers">
        <div class="regen-tier regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('dabbler')" : `window.location.href='${dabblerUrl}'`}">
          <div class="regen-tier__name">${t(lang, "tier_dabbler")}</div>
          <div class="regen-tier__price price-monthly">$1.25<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$12.50<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$1.25/mo + ${t(lang, "tier_yearly_bonus")}</div>
          <div class="regen-tier__desc">${t(lang, "tier_dabbler_desc")}${referralValid ? `<br><strong>${t(lang, "tier_first_month_free")}</strong>` : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">${t(lang, "tier_cta")}</div>
        </div>
        <div class="regen-tier tier-featured regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('builder')" : `window.location.href='${builderUrl}'`}">
          <div class="tier-featured-badge">${t(lang, "tier_builder_badge")}</div>
          <div class="regen-tier__name">${t(lang, "tier_builder")}</div>
          <div class="regen-tier__price price-monthly">$2.50<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$25<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$2.50/mo + ${t(lang, "tier_yearly_bonus")}</div>
          <div class="regen-tier__desc">${t(lang, "tier_builder_desc")}${referralValid ? `<br><strong>${t(lang, "tier_first_month_free")}</strong>` : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">${t(lang, "tier_cta")}</div>
        </div>
        <div class="regen-tier regen-tier--clickable" onclick="${hasPriceIds ? "subscribe('agent')" : `window.location.href='${agentUrl}'`}">
          <div class="regen-tier__name">${t(lang, "tier_agent")}</div>
          <div class="regen-tier__price price-monthly">$5<span>/mo</span></div>
          <div class="regen-tier__price price-yearly" style="display:none;">$50<span>/yr</span></div>
          <div class="regen-tier__effective price-yearly" style="display:none;">$5/mo + ${t(lang, "tier_yearly_bonus")}</div>
          <div class="regen-tier__desc">${t(lang, "tier_agent_desc")}${referralValid ? `<br><strong>${t(lang, "tier_first_month_free")}</strong>` : ""}</div>
          <div class="regen-btn regen-btn--solid regen-btn--block regen-tier__cta-btn">${t(lang, "tier_cta")}</div>
        </div>
      </div>

      <!-- Team plan CTA -->
      <div id="org-cta" style="background:var(--regen-white);border:2px solid var(--regen-gray-200);border-radius:var(--regen-radius-lg);padding:20px 28px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;cursor:pointer;transition:border-color 0.2s;" onclick="showOrgForm()" onmouseover="this.style.borderColor='var(--regen-green)'" onmouseout="this.style.borderColor='var(--regen-gray-200)'">
        <span style="font-weight:700;font-size:15px;color:var(--regen-navy);white-space:nowrap;">${t(lang, "org_cta_heading")}</span>
        <span style="font-size:14px;color:var(--regen-gray-500);">${t(lang, "org_cta_desc")}</span>
        <span class="regen-btn regen-btn--solid regen-btn--sm" style="white-space:nowrap;">${t(lang, "org_cta_btn")}</span>
      </div>

      <!-- Organization form (revealed on click) -->
      <div id="org-form" style="display:none;margin-top:16px;">
        <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius-lg);padding:28px 32px;max-width:560px;margin:0 auto;">
          <h3 style="margin:0 0 4px;font-size:18px;color:var(--regen-navy);font-weight:700;">${t(lang, "org_title")}</h3>
          <p style="color:var(--regen-gray-500);font-size:14px;margin:0 0 20px;">${t(lang, "org_desc")}</p>
          <div style="margin-bottom:18px;">
            <label style="display:block;font-weight:600;font-size:14px;color:var(--regen-navy);margin-bottom:6px;">${t(lang, "org_label_name")}</label>
            <input id="org-name" type="text" placeholder="${t(lang, "org_placeholder_name")}" style="width:100%;padding:10px 14px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:15px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:block;font-weight:600;font-size:14px;color:var(--regen-navy);margin-bottom:6px;">${t(lang, "org_label_devs")} <span style="font-weight:400;color:var(--regen-gray-500);">${t(lang, "org_hint_devs")}</span></label>
            <input id="org-devs" type="number" min="0" value="0" style="width:100px;padding:10px 14px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:15px;text-align:center;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:block;font-weight:600;font-size:14px;color:var(--regen-navy);margin-bottom:6px;">${t(lang, "org_label_agents")} <span style="font-weight:400;color:var(--regen-gray-500);">${t(lang, "org_hint_agents")}</span></label>
            <input id="org-agents" type="number" min="0" value="0" style="width:100px;padding:10px 14px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:15px;text-align:center;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block;font-weight:600;font-size:14px;color:var(--regen-navy);margin-bottom:6px;">${t(lang, "org_label_parttime")} <span style="font-weight:400;color:var(--regen-gray-500);">${t(lang, "org_hint_parttime")}</span></label>
            <input id="org-parttime" type="number" min="0" value="0" style="width:100px;padding:10px 14px;border:1px solid var(--regen-gray-200);border-radius:8px;font-size:15px;text-align:center;">
          </div>

          <!-- Calculated estimate -->
          <div id="org-estimate" style="display:none;background:linear-gradient(135deg, rgba(79,181,115,0.06), rgba(16,21,112,0.04));border:1px solid rgba(79,181,115,0.2);border-radius:10px;padding:20px 24px;margin-bottom:20px;">
            <div style="font-size:13px;color:var(--regen-gray-500);margin-bottom:4px;">${t(lang, "org_estimate_label")}</div>
            <div style="display:flex;align-items:baseline;gap:8px;">
              <span id="org-price" style="font-size:32px;font-weight:800;color:var(--regen-navy);">$0</span>
              <span style="font-size:14px;color:var(--regen-gray-500);">${t(lang, "org_estimate_unit")}</span>
            </div>
            <div id="org-breakdown" style="margin-top:10px;font-size:13px;color:var(--regen-gray-600);line-height:1.6;"></div>
            <div style="margin-top:12px;font-size:12px;color:var(--regen-gray-400);">${t(lang, "org_estimate_note")}</div>
          </div>

          <button id="org-subscribe-btn" onclick="subscribeOrg()" class="regen-btn regen-btn--solid regen-btn--block" style="font-size:16px;padding:14px;">${t(lang, "org_submit")}</button>
          <p id="org-error" style="color:#c33;font-size:13px;margin:8px 0 0;display:none;text-align:center;"></p>
          <p style="text-align:center;margin:16px 0 0;font-size:14px;color:var(--regen-gray-500);">Have questions? <a href="https://calendar.app.google/PQV1pY7kjiBPN5eZ8" target="_blank" rel="noopener" style="color:var(--regen-green);font-weight:600;">Schedule a call</a> with our team.</p>
        </div>
      </div>

    </div>
  </section>

  <!-- Live Stats -->
  <section class="stats-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">${t(lang, "stats_title")}</h2>
      <p class="regen-section-subtitle" style="text-align:center;">${t(lang, "stats_desc")}</p>
      <div class="stats-bar">
        <div>
          <div class="stats-bar__num">${totalRetirements}</div>
          <div class="stats-bar__label">${t(lang, "stats_credits")}</div>
        </div>
        <div>
          <div class="stats-bar__num">9+</div>
          <div class="stats-bar__label">${t(lang, "stats_countries")}</div>
        </div>
        <div>
          <div class="stats-bar__num">5</div>
          <div class="stats-bar__label">${t(lang, "stats_credit_types")}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- What Your Subscription Funds — Credit Basket -->
  <section class="basket-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">${t(lang, "basket_title")}</h2>
      <p class="regen-section-subtitle" style="text-align:center;">${t(lang, "basket_desc")}</p>
      <div class="basket-grid">
        ${PROJECTS.map(p => `
        <div class="basket-card">
          <img class="basket-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy">
          <div class="basket-body">
            <span class="basket-badge" style="background: ${p.accentColor}22; color: ${p.accentColor};">${p.creditTypeLabel} (${p.creditType})</span>
            <div class="basket-name">${p.name}</div>
            <div class="basket-location">${p.location}</div>
            <p class="basket-desc">${p.description.length > 180 ? p.description.slice(0, 180) + '&hellip;' : p.description}</p>
            <div class="basket-meta">
              <span class="basket-meta-tag">${p.creditClassId}</span>
              <span class="basket-meta-tag">${p.projectId}</span>
            </div>
            <div class="basket-links">
              <a class="basket-link" href="${p.projectPageUrl}" target="_blank" rel="noopener">${t(lang, "basket_view_project")} &rarr;</a>
              <a class="basket-link" href="https://app.regen.network/credit-classes/${p.creditClassId}" target="_blank" rel="noopener">${t(lang, "basket_credit_class")}</a>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- Trust -->
  <section class="trust-section">
    <div class="regen-container">
      <h2 class="regen-section-title" style="text-align:center;">${t(lang, "trust_title")}</h2>
      <div class="trust-grid">
        <div class="trust-item">
          <h3>${t(lang, "trust_auditable_title")}</h3>
          <p>${t(lang, "trust_auditable_desc")}</p>
        </div>
        <div class="trust-item">
          <h3>${t(lang, "trust_beyond_title")}</h3>
          <p>${t(lang, "trust_beyond_desc")}</p>
        </div>
        <div class="trust-item">
          <h3>${t(lang, "trust_open_title")}</h3>
          <p>${t(lang, "trust_open_desc")}</p>
        </div>
      </div>
    </div>
  </section>

  ${publicOrgs.length > 0 ? `
  <!-- Organizations committed to Regenerative AI -->
  <section class="hiw-section">
    <div class="regen-container" style="text-align:center;">
      <h2 class="regen-section-title">${t(lang, "orgs_title")}</h2>
      <p class="regen-section-subtitle">${t(lang, "orgs_desc")}</p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px;margin-top:24px;">
        ${publicOrgs.map(o => `<div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:10px;padding:16px 24px;font-weight:600;color:var(--regen-navy);font-size:15px;">${o.name.replace(/</g, "&lt;")}</div>`).join("")}
      </div>
    </div>
  </section>
  ` : ""}

  <!-- One-time purchase -->
  <section class="hiw-section" style="background:var(--regen-gray-50);">
    <div class="regen-container" style="max-width:640px;text-align:center;">
      <h2 class="regen-section-title">${t(lang, "onetime_title")}</h2>
      <p style="color:var(--regen-gray-500);margin-bottom:24px;">${t(lang, "onetime_desc")}</p>
      <a class="regen-btn regen-btn--primary" href="https://app.regen.network/projects/1?buying_options_filters=credit_card" target="_blank" rel="noopener">${t(lang, "onetime_cta")}</a>
    </div>
  </section>


  ${brandFooter({ showInstall: false, links: [
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
    { label: "GitHub", href: "https://github.com/regen-network/regen-compute" },
  ] })}

  <button onclick="window.location.href='/?view=agent'" style="position:fixed;bottom:24px;right:24px;z-index:9999;background:#1a1a2e;color:#4FB573;border:1px solid #4FB573;border-radius:8px;padding:10px 18px;cursor:pointer;font-family:monospace;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:all 0.2s;" onmouseover="this.style.background='#2a2a4e'" onmouseout="this.style.background='#1a1a2e'">&#129302; Agent View</button>

  <script>
    // Close language picker when clicking outside
    document.addEventListener('click', function(e) {
      var menu = document.querySelector('.lang-picker__menu');
      var btn = document.querySelector('.lang-picker__btn');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
      }
    });

    function showOrgForm() {
      document.getElementById('org-cta').style.display = 'none';
      document.getElementById('org-form').style.display = 'block';
      document.getElementById('org-name').focus();
    }

    function recalcOrg() {
      var devs = parseInt(document.getElementById('org-devs').value) || 0;
      var agents = parseInt(document.getElementById('org-agents').value) || 0;
      var parttime = parseInt(document.getElementById('org-parttime').value) || 0;

      if (devs + agents + parttime === 0) {
        document.getElementById('org-estimate').style.display = 'none';
        return;
      }

      // Pricing: devs $2.50/mo, agents $5/mo (always-on, highest compute), part-time $1.25/mo
      var devCost = devs * 250;
      var agentCost = agents * 500;
      var ptCost = parttime * 125;
      var totalCents = devCost + agentCost + ptCost;

      document.getElementById('org-estimate').style.display = 'block';
      document.getElementById('org-price').textContent = '$' + (totalCents / 100).toFixed(2).replace(/\\.00$/, '');

      var parts = [];
      if (devs > 0) parts.push(devs + ' developer' + (devs > 1 ? 's' : '') + ' x $2.50');
      if (agents > 0) parts.push(agents + ' agent' + (agents > 1 ? 's' : '') + ' x $5.00');
      if (parttime > 0) parts.push(parttime + ' part-time' + ' x $1.25');
      document.getElementById('org-breakdown').textContent = parts.join(' + ');
    }

    // Recalculate on any input change
    ['org-devs', 'org-agents', 'org-parttime'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', recalcOrg);
    });

    function subscribeOrg() {
      var name = document.getElementById('org-name').value.trim();
      var devs = parseInt(document.getElementById('org-devs').value) || 0;
      var agents = parseInt(document.getElementById('org-agents').value) || 0;
      var parttime = parseInt(document.getElementById('org-parttime').value) || 0;
      var errEl = document.getElementById('org-error');
      errEl.style.display = 'none';

      if (!name) {
        errEl.textContent = 'Please enter your company name.';
        errEl.style.display = 'block';
        return;
      }
      if (devs + agents + parttime === 0) {
        errEl.textContent = 'Please enter at least one team member or agent.';
        errEl.style.display = 'block';
        return;
      }

      var totalCents = (devs * 250) + (agents * 500) + (parttime * 125);

      fetch('/subscribe-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_name: name, full_time_devs: devs, autonomous_agents: agents, part_time_users: parttime, amount_cents: totalCents })
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
      <h3>${t(lang, "nudge_title")}</h3>
      <div class="nudge-reason">
        <div class="nudge-reason-icon">1</div>
        <p><strong>${t(lang, "nudge_reason1_title")}</strong> — ${t(lang, "nudge_reason1_desc")}</p>
      </div>
      <div class="nudge-reason">
        <div class="nudge-reason-icon">2</div>
        <p><strong>${t(lang, "nudge_reason2_title")}</strong> — ${t(lang, "nudge_reason2_desc")}</p>
      </div>
      <div class="nudge-btns">
        <button class="nudge-btn-yearly" id="nudge-btn-yearly" onclick="switchToYearly()">${t(lang, "nudge_cta_yearly")}</button>
        <button class="nudge-btn-monthly" id="nudge-btn-monthly" onclick="continueMonthly()">${t(lang, "nudge_cta_monthly")}</button>
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
      ${refCode ? `body.referral_code = ${JSON.stringify(refCode).replace(/</g, "\\u003c")};` : ""}
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
  }

  // Language routes: GET / and GET /:lang
  router.get("/", async (req: Request, res: Response) => {
    // Auto-detect language from Accept-Language header
    const acceptLang = req.headers["accept-language"] || "";
    const preferred = acceptLang.split(",")[0]?.split("-")[0]?.toLowerCase() as LangCode;
    const lang: LangCode = SUPPORTED_LANGS.includes(preferred) ? preferred : "en";
    await serveLandingPage(req, res, lang);
  });

  // Explicit language routes
  for (const langCode of SUPPORTED_LANGS.filter(l => l !== "en")) {
    router.get(`/${langCode}`, async (req: Request, res: Response) => {
      await serveLandingPage(req, res, langCode);
    });
  }

  // Common language code redirects for unsupported variants
  const LANG_REDIRECTS: Record<string, LangCode> = { is: "es", br: "pt", mx: "es", cn: "zh", tw: "zh", in: "hi" };
  for (const [from, to] of Object.entries(LANG_REDIRECTS)) {
    router.get(`/${from}`, (_req: Request, res: Response) => {
      res.redirect(301, `/${to}`);
    });
  }

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
      res.status(500).json({ error: "An internal error occurred. Please try again." });
    }
  });

  /**
   * POST /subscribe-org
   * Body: { org_name, full_time_devs, autonomous_agents, part_time_users, amount_cents }
   * Creates organization record, then a Stripe Checkout Session for the calculated amount.
   */
  router.post("/subscribe-org", async (req: Request, res: Response) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { org_name, full_time_devs, autonomous_agents, part_time_users, amount_cents } = body ?? {};

      if (!org_name || typeof org_name !== "string" || !org_name.trim()) {
        res.status(400).json({ error: "org_name is required" });
        return;
      }

      const devs = Math.max(0, Math.floor(Number(full_time_devs) || 0));
      const agents = Math.max(0, Math.floor(Number(autonomous_agents) || 0));
      const parttime = Math.max(0, Math.floor(Number(part_time_users) || 0));

      if (devs + agents + parttime === 0) {
        res.status(400).json({ error: "At least one team member or agent is required" });
        return;
      }

      // Validate amount — minimum $1
      const cents = Math.max(100, Math.round(Number(amount_cents) || 0));

      // Create org record (will be linked to subscriber after Stripe checkout completes)
      const org = createOrganization(db, {
        name: org_name.trim(),
        contact_email: "", // filled by webhook when Stripe provides email
        full_time_devs: devs,
        autonomous_agents: agents,
        part_time_users: parttime,
        suggested_cents: cents,
      });

      const amountDollars = (cents / 100).toFixed(2);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              recurring: { interval: "month" },
              unit_amount: cents,
              product_data: {
                name: `Regenerative Compute — ${org_name.trim()} (Organization)`,
                description: `Monthly ecological credit retirement for ${devs + agents + parttime} team members/agents`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=subscription&org_id=${org.id}`,
        cancel_url: `${baseUrl}/cancel`,
        subscription_data: {
          metadata: {
            tier: "org",
            org_id: String(org.id),
            org_name: org_name.trim(),
            source: "regen-compute",
          },
        },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Subscribe-org error:", msg);
      res.status(500).json({ error: "An internal error occurred. Please try again." });
    }
  });

  /**
   * POST /org/publicity
   * Body: { org_id: number, opt_in: boolean }
   * Updates an organization's publicity preference.
   */
  router.post("/org/publicity", async (req: Request, res: Response) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { org_id, opt_in, session_id } = body ?? {};

      if (!org_id) {
        res.status(400).json({ error: "org_id is required" });
        return;
      }

      // Verify the org exists and the session matches
      const org = getOrganizationById(db, Number(org_id));
      if (!org) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }

      updateOrganizationPublicity(db, org.id, !!opt_in);

      // Update contact email if we can resolve it from the session
      if (session_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(session_id);
          const email = session.customer_email ?? session.customer_details?.email;
          if (email) {
            db.prepare("UPDATE organizations SET contact_email = ?, updated_at = datetime('now') WHERE id = ?").run(email, org.id);
          }
        } catch { /* non-critical */ }
      }

      res.json({ ok: true, publicity_opt_in: !!opt_in });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Org publicity error:", msg);
      res.status(500).json({ error: "An internal error occurred. Please try again." });
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
      res.status(500).json({ error: "An internal error occurred. Please try again." });
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
      res.status(500).json({ error: "An internal error occurred. Please try again." });
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
        console.log(`New user created: ${user.api_key.slice(0, 12)}... (${email})`);
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
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const subRef = subDetails?.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (subId) {
        const existing = getSubscriberByStripeId(db, subId);
        if (existing) {
          console.warn(`Payment failed for subscriber ${existing.id} (${subId}): ${invoice.id}`);
          sendTelegram(
            `\u26a0\ufe0f *Payment Failed*\nSubscriber ${existing.id} (${subId})\nInvoice: ${invoice.id}`
          ).catch(() => {});
        }
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const amountRefunded = charge.amount_refunded ?? 0;
      console.warn(`Charge refunded: ${charge.id}, amount=$${(amountRefunded / 100).toFixed(2)}`);
      // Note: Credits already retired on-chain cannot be reversed.
      // This is logged for accounting reconciliation.
      sendTelegram(
        `\ud83d\udcb8 *Charge Refunded*\nCharge: ${charge.id}\nAmount: $${(amountRefunded / 100).toFixed(2)}\n_Credits retired on-chain cannot be reversed._`
      ).catch(() => {});
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
      const orgIdParam = req.query.org_id as string | undefined;
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

        // Resolve organization if this is an org subscription
        const orgId = orgIdParam ? parseInt(orgIdParam, 10) : undefined;
        const org = orgId ? getOrganizationById(db, orgId) : undefined;

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

    ${org ? `
    <div class="regen-card" style="margin-top:24px;">
      <div class="regen-card__body">
        <h2 style="color:var(--regen-navy);margin:0 0 8px;font-size:18px;font-weight:700;">Share your commitment?</h2>
        <p style="color:var(--regen-gray-700);font-size:14px;margin:0 0 14px;line-height:1.6;">
          Would you like us to feature <strong>${escapeHtml(org.name)}</strong> on our website and social media as an organization committed to regenerative AI? This helps inspire others to follow your lead.
        </p>
        <div id="publicity-prompt" style="display:flex;gap:10px;align-items:center;">
          <button onclick="setPublicity(true)" class="regen-btn regen-btn--solid regen-btn--sm">Yes, share it</button>
          <button onclick="setPublicity(false)" style="background:none;border:none;color:var(--regen-gray-500);font-size:13px;cursor:pointer;text-decoration:underline;">No thanks</button>
        </div>
        <div id="publicity-saved" style="display:none;padding:10px 0;color:var(--regen-green);font-weight:600;font-size:14px;"></div>
      </div>
    </div>
    <script>
    function setPublicity(optIn) {
      fetch('/org/publicity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: ${org.id}, opt_in: optIn, session_id: ${JSON.stringify(sessionId).replace(/</g, "\\u003c")} })
      }).then(function(r) { return r.json(); }).then(function(data) {
        document.getElementById('publicity-prompt').style.display = 'none';
        var saved = document.getElementById('publicity-saved');
        saved.style.display = 'block';
        saved.textContent = optIn ? 'Thank you! We\\'ll feature ' + ${JSON.stringify(org.name).replace(/</g, "\\u003c")} + ' on our site.' : 'No problem — you can change this anytime from your dashboard.';
      });
    }
    </script>
    ` : ""}

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
        body: JSON.stringify({ session_id: ${JSON.stringify(sessionId).replace(/</g, "\\u003c")}, display_name: name })
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
        body: JSON.stringify({ session_id: ${JSON.stringify(sessionId).replace(/</g, "\\u003c")}, display_name: 'My On-Chain Proof' })
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
    // Backfill any subscribers missing regen_address from their retirement records
    backfillSubscriberRegenAddresses(db);
  }, 10_000);

  // --- Admin: approve held referral rewards ---
  // POST /admin/referrals/approve { reward_id: number } or { all: true }
  // Auth: Bearer SESSION_SECRET
  router.post("/admin/referrals/approve", async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${config?.sessionSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { reward_id, all } = body ?? {};

    const held = getHeldReferralRewards(db);
    if (held.length === 0) {
      res.json({ message: "No held referral rewards", approved: 0 });
      return;
    }

    const REFERRAL_BONUS_CAP_CENTS = 250;
    const toApprove = all ? held : held.filter(r => r.id === reward_id);
    let approved = 0;

    for (const reward of toApprove) {
      // Look up the referred subscriber to get their plan amount for the bonus calculation
      const referredSub = getSubscriberByUserId(db, reward.referred_user_id);
      const effectiveAmount = Math.min(referredSub?.amount_cents ?? 500, 500); // cap at $5
      approveReferralReward(db, reward.id);
      const updatedReward = getPendingReferralRewardForReferred(db, reward.referred_user_id);
      if (updatedReward) {
        await executeReferralBonus(db, updatedReward, effectiveAmount, REFERRAL_BONUS_CAP_CENTS, baseUrl);
      }
      approved++;
    }

    res.json({ message: `Approved ${approved} referral reward(s)`, approved, held_remaining: held.length - approved });
  });

  // GET /admin/referrals/held — list held referral rewards
  router.get("/admin/referrals/held", (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${config?.sessionSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const held = getHeldReferralRewards(db);
    res.json({ held, count: held.length });
  });

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
      console.log(`New user created for subscription: ${user.api_key.slice(0, 12)}... (${email})`);
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

    // Link to organization if this is an org subscription
    const orgId = sub.metadata?.org_id;
    if (orgId) {
      try {
        linkSubscriberToOrg(db, subscriber.id, parseInt(orgId, 10));
        // Update org contact email
        if (email) {
          db.prepare("UPDATE organizations SET contact_email = ?, updated_at = datetime('now') WHERE id = ?").run(email, parseInt(orgId, 10));
        }
        console.log(`Subscriber ${subscriber.id} linked to org ${orgId}`);
      } catch (err) {
        console.error(`Failed to link subscriber to org ${orgId}:`, err instanceof Error ? err.message : err);
      }
    }

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

    // If a yearly subscriber's amount changed, recalculate scheduled retirements
    if (existing.billing_interval === "yearly" && amountCents !== existing.amount_cents) {
      // Cancel existing pending scheduled retirements
      const cancelled = db.prepare(
        "UPDATE scheduled_retirements SET status = 'failed', error = 'plan_changed' WHERE subscriber_id = ? AND status = 'pending'"
      ).run(existing.id);

      if (cancelled.changes > 0) {
        // Recalculate with new amount
        const newNetTotal = calculateNetAfterStripe(amountCents);
        const newMonthlyNet = Math.floor(newNetTotal / 12);
        const newMonthlyGross = Math.floor(amountCents / 12);

        // Recreate scheduled retirements for remaining months
        const now = new Date();
        for (let i = 0; i < cancelled.changes; i++) {
          const scheduledDate = new Date(now);
          scheduledDate.setMonth(scheduledDate.getMonth() + i + 1);
          createScheduledRetirement(
            db, existing.id, newMonthlyGross, newMonthlyNet,
            scheduledDate.toISOString().split("T")[0],
            "yearly"
          );
        }

        console.log(
          `Recalculated ${cancelled.changes} scheduled retirements for subscriber ${existing.id} ` +
          `after plan change: $${(existing.amount_cents / 100).toFixed(2)} → $${(amountCents / 100).toFixed(2)}`
        );
      }
    }

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

      // Refund unused burn budget for yearly subscribers
      if (existing.billing_interval === "yearly") {
        // Count how many monthly retirements were actually executed
        const executedCount = db.prepare(
          "SELECT COUNT(*) as count FROM subscriber_retirements WHERE subscriber_id = ?"
        ).get(existing.id) as { count: number };

        const monthsUsed = executedCount.count;
        const monthsUnused = Math.max(0, 12 - monthsUsed);

        if (monthsUnused > 0) {
          const yearlyNet = calculateNetAfterStripe(existing.amount_cents);
          const yearlyBurnBudget = Math.floor(yearlyNet * 0.05);
          const unusedBurn = Math.floor(yearlyBurnBudget * monthsUnused / 12);

          if (unusedBurn > 0) {
            // Insert negative entry to offset the front-loaded burn
            accumulateBurnBudget(db, -unusedBurn, "yearly_cancel_refund", existing.id);
            console.log(
              `Refunded unused burn budget for cancelled yearly subscriber ${existing.id}: ` +
              `$${(unusedBurn / 100).toFixed(2)} (${monthsUnused} unused months of ${yearlyBurnBudget} total)`
            );
          }
        }
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
    // For free-month referrals ($0 invoice), retire as if the subscriber paid their plan amount.
    // Apply Stripe fee deduction to match what they'll see on paid months (consistency).
    // The full cost is funded from the Operations budget.
    const FREE_MONTH_CAP_CENTS = 500; // Cap free-month retirement at $5
    const REFERRAL_BONUS_CAP_CENTS = 250; // Cap referral bonus at $2.50
    let effectiveAmountCents = amountCents;
    const isFreeMonth = amountCents === 0 && existing.status === "active" && existing.amount_cents > 0;
    if (isFreeMonth) {
      effectiveAmountCents = Math.min(existing.amount_cents, FREE_MONTH_CAP_CENTS);
      console.log(
        `Free-month referral: subscriber=${existing.id} plan=${existing.plan} — ` +
        `retiring as if paid $${(effectiveAmountCents / 100).toFixed(2)} (capped at $${(FREE_MONTH_CAP_CENTS / 100).toFixed(2)}, funded from ops budget)`
      );
    }

    if (effectiveAmountCents > 0 && existing.status === "active") {
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
        const netTotal = calculateNetAfterStripe(effectiveAmountCents);
        const monthlyNet = Math.floor(netTotal / 12);
        const firstMonthNet = netTotal - (monthlyNet * 11); // remainder goes to first month
        const monthlyGross = Math.floor(effectiveAmountCents / 12);
        const firstMonthGross = effectiveAmountCents - (monthlyGross * 11);

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
          `(net $${(monthlyNet / 100).toFixed(2)}/mo from $${(effectiveAmountCents / 100).toFixed(2)} yearly)`
        );

        // Accumulate FULL year's burn budget upfront (5% of entire net payment).
        // Monthly retirements will skip burn accumulation since it's already front-loaded.
        const yearlyBurnBudget = Math.floor(netTotal * 0.05); // 5% burn split
        if (yearlyBurnBudget > 0) {
          accumulateBurnBudget(db, yearlyBurnBudget, "yearly_frontload", existing.id);
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
        executeRetirementAsync(db, existing.id, effectiveAmountCents, existing.billing_interval, baseUrl, undefined, invoice.id);
      }

      // Referral bonus: triggered immediately when a free-month referral signs up.
      // The referrer gets rewarded right away — caps and daily rate limits prevent abuse.
      if (isFreeMonth) {
        const referralReward = getPendingReferralRewardForReferred(db, existing.user_id);
        if (referralReward) {
          // Rate-limit: if more than 10 referrals today, hold for admin review
          const todayCount = getTodayReferralCount(db);
          if (todayCount > 10) {
            holdReferralReward(db, referralReward.id);
            console.warn(
              `Referral anomaly: ${todayCount} referrals today — holding reward ${referralReward.id} ` +
              `(referrer=${referralReward.referrer_user_id} referred=${referralReward.referred_user_id}) for admin review`
            );
            sendTelegram(
              `⚠️ *Referral Anomaly*\n${todayCount} referrals today — exceeds daily limit of 10.\n` +
              `Reward #${referralReward.id} held for review.\n` +
              `Referrer: user ${referralReward.referrer_user_id}\n` +
              `Referred: user ${referralReward.referred_user_id}`
            ).catch(() => {});
          } else {
            const cappedForBonus = Math.min(effectiveAmountCents, FREE_MONTH_CAP_CENTS);
            executeReferralBonus(db, referralReward, cappedForBonus, REFERRAL_BONUS_CAP_CENTS, baseUrl);
          }
        }
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

/**
 * Execute referral bonus retirement for the referrer.
 * Retires at half the referred subscriber's effective amount (capped),
 * plus half the burn credit. Both funded from ops budget.
 */
async function executeReferralBonus(
  db: Database.Database,
  referralReward: ReferralReward,
  referredEffectiveAmountCents: number,
  bonusCapCents: number,
  baseUrl: string,
): Promise<void> {
  const referrerSub = getSubscriberByUserId(db, referralReward.referrer_user_id);
  if (!referrerSub || referrerSub.status !== "active") {
    console.warn(
      `Referral bonus skipped: referrer user=${referralReward.referrer_user_id} has no active subscription`
    );
    return;
  }

  const bonusGross = Math.min(Math.floor(referredEffectiveAmountCents / 2), bonusCapCents);

  // Ensure referrer has a regen address
  if (!referrerSub.regen_address) {
    try {
      const addr = await deriveSubscriberAddress(referrerSub.id);
      setSubscriberRegenAddress(db, referrerSub.id, addr);
    } catch (err) {
      console.error(`Failed to derive regen address for referrer subscriber ${referrerSub.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `Referral bonus: referrer subscriber=${referrerSub.id} (user=${referralReward.referrer_user_id}) — ` +
    `retiring $${(bonusGross / 100).toFixed(2)} gross (half of $${(referredEffectiveAmountCents / 100).toFixed(2)}, ` +
    `capped at $${(bonusCapCents / 100).toFixed(2)}) funded from ops budget`
  );

  // Look up referrer's email and referral code for the bonus notification email
  const referrerUser = db.prepare(
    "SELECT email, referral_code FROM users WHERE id = ?"
  ).get(referralReward.referrer_user_id) as { email: string | null; referral_code: string } | undefined;

  // Execute retirement for the referrer (Stripe fees applied to match normal flow).
  // skipBurnAccumulation=true — burn is handled separately below at the explicit half rate.
  executeRetirementAsync(db, referrerSub.id, bonusGross, referrerSub.billing_interval, baseUrl, undefined, `referral-bonus-${referralReward.id}`, true,
    (result) => {
      // Record transaction for dashboard contributions table
      const firstTxHash = result.batches.find(b => b.buyTxHash)?.buyTxHash ?? null;
      insertReferralBonusTransaction(
        db, referralReward.referrer_user_id, bonusGross,
        firstTxHash, result.totalCreditsRetired,
      );

      // Send referral bonus thank-you email on successful retirement
      if (referrerUser?.email && result.totalCreditsRetired > 0) {
        const dashboardUrl = `${baseUrl}/dashboard/login`;
        const referralLink = `${baseUrl}/r/${referrerUser.referral_code}`;
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
        sendReferralBonusEmail(
          referrerUser.email, dashboardUrl, referralLink,
          result.totalCreditsRetired, batchSummaries,
        ).then(() => {
          console.log(`Referral bonus email sent to ${referrerUser.email}`);
        }).catch((err) => {
          console.error(`Failed to send referral bonus email to ${referrerUser.email}:`, err instanceof Error ? err.message : err);
        });
      }
    },
  );

  // Credit half the burn amount that the referred subscriber's retirement generates
  const referredNet = calculateNetAfterStripe(referredEffectiveAmountCents);
  const referredBurn = Math.floor(referredNet * 0.05);
  const bonusBurn = Math.floor(referredBurn / 2);
  if (bonusBurn > 0) {
    accumulateBurnBudget(db, bonusBurn, "referral_bonus", referrerSub.id);
    console.log(
      `Referral bonus burn: $${(bonusBurn / 100).toFixed(2)} credited for referrer subscriber=${referrerSub.id}`
    );
    maybeExecuteAutoBurn(db).catch(() => {});
  }

  // Mark the referral reward as fulfilled
  fulfillReferralReward(db, referralReward.id, `referral-bonus-${referrerSub.id}`);
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
  skipBurnAccumulation = false,
  onSuccess?: (result: SubscriberRetirementResult) => void,
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
      accumulateBurnBudget(db, result.burnBudgetCents, "monthly_retirement", subscriberId);
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
      // Invoke optional success callback (e.g., referral bonus email)
      if (onSuccess) {
        try { onSuccess(result); } catch (err) {
          console.error(`onSuccess callback error for subscriber ${subscriberId}:`, err instanceof Error ? err.message : err);
        }
      }
    } else if (result.status === "partial" && paymentId) {
      // Auto-retry partial retirements after 60 seconds
      const failedBatches = result.batches.filter(b => b.error !== null);
      console.log(
        `Partial retirement for subscriber ${subscriberId}: ${failedBatches.length} failed batches. ` +
        `Auto-retrying in 60s with payment_id=${paymentId}`
      );
      setTimeout(async () => {
        try {
          console.log(`Auto-retry: re-executing retirement for subscriber ${subscriberId} (payment_id=${paymentId})`);
          const retryResult = await retireForSubscriber({
            subscriberId,
            grossAmountCents,
            billingInterval,
            precomputedNetCents,
            paymentId,
          });
          console.log(`Auto-retry result: subscriber ${subscriberId} status=${retryResult.status} credits=${retryResult.totalCreditsRetired}`);
        } catch (err) {
          console.error(`Auto-retry failed for subscriber ${subscriberId}:`, err instanceof Error ? err.message : err);
        }
      }, 60_000);
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
            accumulateBurnBudget(db, result.burnBudgetCents, "scheduled_retirement", scheduled.subscriber_id);
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
            accumulateBurnBudget(db, result.burnBudgetCents, "scheduled_retirement", scheduled.subscriber_id);
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
      db.prepare("UPDATE scheduled_retirements SET retry_count = retry_count + 1 WHERE id = ?").run(scheduled.id);
      updateScheduledRetirement(db, scheduled.id, {
        status: "failed",
        error: msg,
        executed_at: new Date().toISOString(),
      });
      console.error(`Scheduled retirement error: id=${scheduled.id} retry_count=${(scheduled.retry_count ?? 0) + 1} ${msg}`);
    }
  }
}

// --- Auto burn trigger ---

/** Minimum pending burn budget before triggering a swap-and-burn (in cents). */
const AUTO_BURN_THRESHOLD_CENTS = 100; // $1.00

/** Debounce: don't trigger another burn if one ran within the last hour. */
const BURN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/** Get last burn attempt timestamp from DB (survives restarts). */
function getLastBurnAttempt(db: Database.Database): number {
  const row = db.prepare(
    "SELECT MAX(created_at) as last FROM burn_accumulator WHERE executed = 1"
  ).get() as { last: string | null } | undefined;
  if (!row?.last) return 0;
  return new Date(row.last).getTime();
}

/**
 * Backfill subscribers.regen_address from subscriber_retirements for any subscribers
 * that have had retirements executed but are missing the address on their subscriber record.
 * Runs once on startup. Also derives addresses for active subscribers with no retirements yet.
 */
function backfillSubscriberRegenAddresses(db: Database.Database): void {
  try {
    const backfillable = db.prepare(`
      SELECT sr.subscriber_id, sr.regen_address
      FROM subscriber_retirements sr
      JOIN subscribers s ON s.id = sr.subscriber_id
      WHERE s.regen_address IS NULL
      GROUP BY sr.subscriber_id
    `).all() as { subscriber_id: number; regen_address: string }[];

    for (const row of backfillable) {
      setSubscriberRegenAddress(db, row.subscriber_id, row.regen_address);
    }

    if (backfillable.length > 0) {
      console.log(`Backfilled regen_address for ${backfillable.length} subscribers from retirement records`);
    }

    // Also derive addresses for active subscribers with no retirements and no address
    const needDerivation = db.prepare(`
      SELECT s.id FROM subscribers s
      WHERE s.regen_address IS NULL AND s.status = 'active'
    `).all() as { id: number }[];

    for (const row of needDerivation) {
      deriveSubscriberAddress(row.id).then(addr => {
        setSubscriberRegenAddress(db, row.id, addr);
        console.log(`Derived regen_address for subscriber ${row.id}: ${addr}`);
      }).catch(err => {
        console.error(`Failed to derive regen_address for subscriber ${row.id}:`, err instanceof Error ? err.message : err);
      });
    }
  } catch (err) {
    console.error("Backfill regen addresses error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Check pending burn budget and trigger swap-and-burn if threshold is met.
 * Called after every retirement that accumulates burn budget.
 * Non-blocking, fire-and-forget — failures are logged, not thrown.
 */
async function maybeExecuteAutoBurn(db: Database.Database): Promise<void> {
  const now = Date.now();
  const lastBurn = getLastBurnAttempt(db);
  if (now - lastBurn < BURN_COOLDOWN_MS) return;

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

  console.log(`Auto-burn: triggering swap-and-burn for $${(pendingCents / 100).toFixed(2)} pending burn budget`);

  try {
    const result = await swapAndBurn({
      allocationCents: pendingCents,
      swapDenom: readiness.usdcBalance >= pendingCents / 100 ? "usdc" : "osmo",
    });

    if (result.status === "completed" || result.status === "partial") {
      // Mark accumulated entries as executed — even on partial, the swap already
      // happened so we must not re-process these entries (prevents over-burning).
      const maxId = db.prepare(
        "SELECT MAX(id) AS max_id FROM burn_accumulator WHERE executed = 0"
      ).get() as { max_id: number | null };
      if (maxId.max_id) {
        markBurnExecuted(db, maxId.max_id);
      }
      if (result.status === "partial") {
        console.warn(`Auto-burn partial: swap succeeded but IBC/burn may have failed. Entries marked executed to prevent double-swap.`);
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
