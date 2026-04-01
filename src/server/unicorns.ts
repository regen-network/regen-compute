/**
 * GET /unicorns — "Save the Unicorns" themed landing page.
 *
 * A fantasy-themed marketing page that hooks with absurdist humor,
 * then pivots quickly to real ecological impact. Same pricing/subscribe
 * infrastructure as the main landing page.
 *
 * Visual theme: neon pink/purple/turquoise fantasy → gradual transition
 * to Regen green/navy reality.
 */

import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { getNetworkStats } from "../services/indexer.js";
import { getUserByReferralCode, getPublicOrganizations } from "./db.js";
import { brandFonts } from "./brand.js";
import { PROJECTS } from "./project-metadata.js";

// 5-minute cache for network stats (shared pattern from routes.ts)
let statsCache: { data: { totalRetirements: number; totalOrders: number }; fetchedAt: number } | null = null;
const STATS_CACHE_TTL = 300_000;

async function getCachedStats() {
  if (statsCache && Date.now() - statsCache.fetchedAt < STATS_CACHE_TTL) return statsCache.data;
  try {
    const data = await getNetworkStats();
    statsCache = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return statsCache?.data ?? null;
  }
}

export function createUnicornRoutes(db: Database.Database, baseUrl: string, config?: Config): Router {
  const router = Router();

  router.get("/unicorns", async (req: Request, res: Response) => {
    const refCode = (req.query.ref as string) || "";
    let referralValid = false;
    if (refCode) {
      const referrer = getUserByReferralCode(db, refCode);
      referralValid = !!referrer;
    }
    const hasPriceIds = !!(config?.stripePriceIdSeedling && config?.stripePriceIdGrove && config?.stripePriceIdForest);

    const stats = await getCachedStats();
    const totalRetirements = stats ? stats.totalRetirements.toLocaleString() : "--";

    // Pick the 3 most compelling projects for the pivot
    const jaguar = PROJECTS.find(p => p.creditType === "USS");
    const elGlobo = PROJECTS.find(p => p.creditType === "BT");
    const carbon = PROJECTS.find(p => p.creditType === "C");

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Save the Unicorns — Regen Compute</title>
  <meta name="description" content="The unicorns need your help. Your AI has an impact — and the magic is running out. Or is it?">
  <meta property="og:title" content="The Last Unicorns Need Your Help">
  <meta property="og:description" content="Your AI is draining the cosmic sparkle reserves. The unicorns are endangered. Act now before it's too late.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/unicorns">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    /* === FANTASY THEME === */
    :root {
      --uni-pink: #ff2d95;
      --uni-purple: #8b5cf6;
      --uni-turquoise: #06d6a0;
      --uni-lavender: #c084fc;
      --uni-gold: #fbbf24;
      --uni-deep: #1a0533;
      --uni-midnight: #0f0a1e;
      --uni-soft: #fdf4ff;
      --regen-green: #4FB573;
      --regen-navy: #101570;
      --regen-gray-50: #f9fafb;
      --regen-gray-100: #f3f4f6;
      --regen-gray-200: #e5e7eb;
      --regen-gray-400: #9ca3af;
      --regen-gray-500: #6b7280;
      --regen-gray-600: #4b5563;
      --regen-radius: 12px;
      --regen-radius-lg: 16px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Mulish', Arial, sans-serif;
      background: var(--uni-midnight);
      color: #fff;
      overflow-x: hidden;
    }
    a { color: var(--uni-turquoise); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .uni-container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

    /* Sparkle animation */
    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
      50% { opacity: 1; transform: scale(1) rotate(180deg); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(255,45,149,0.3); }
      50% { box-shadow: 0 0 40px rgba(139,92,246,0.5); }
    }

    /* === HERO (Compact Fantasy) === */
    .uni-hero {
      position: relative;
      padding: 80px 0 48px;
      text-align: center;
      background: linear-gradient(135deg, var(--uni-midnight) 0%, #2d1052 30%, #1a0533 60%, var(--uni-midnight) 100%);
      overflow: hidden;
    }
    .uni-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 30%, rgba(255,45,149,0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 60%, rgba(139,92,246,0.15) 0%, transparent 50%),
        radial-gradient(circle at 50% 80%, rgba(6,214,160,0.1) 0%, transparent 40%);
      pointer-events: none;
    }
    .uni-hero .sparkle {
      position: absolute;
      width: 8px; height: 8px;
      background: var(--uni-gold);
      border-radius: 50%;
      animation: sparkle 3s ease-in-out infinite;
    }
    .uni-hero .sparkle:nth-child(1) { top: 15%; left: 10%; animation-delay: 0s; }
    .uni-hero .sparkle:nth-child(2) { top: 25%; right: 15%; animation-delay: 0.7s; }
    .uni-hero .sparkle:nth-child(3) { top: 60%; left: 20%; animation-delay: 1.4s; }
    .uni-hero .sparkle:nth-child(4) { top: 40%; right: 25%; animation-delay: 2.1s; width: 6px; height: 6px; background: var(--uni-pink); }
    .uni-hero .sparkle:nth-child(5) { top: 70%; left: 60%; animation-delay: 0.3s; width: 10px; height: 10px; background: var(--uni-lavender); }
    .uni-hero .sparkle:nth-child(6) { top: 10%; left: 50%; animation-delay: 1.8s; background: var(--uni-turquoise); }

    .uni-hero__unicorn {
      font-size: 80px;
      animation: float 4s ease-in-out infinite;
      margin-bottom: 16px;
      display: inline-block;
    }
    .uni-hero h1 {
      font-size: 48px;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 12px;
      background: linear-gradient(135deg, var(--uni-pink), var(--uni-lavender), var(--uni-turquoise));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .uni-hero p {
      font-size: 18px;
      color: rgba(255,255,255,0.7);
      max-width: 520px;
      margin: 0 auto 20px;
      line-height: 1.6;
    }
    .uni-hero__urgent {
      display: inline-block;
      background: linear-gradient(135deg, var(--uni-pink), var(--uni-purple));
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 8px 24px;
      border-radius: 30px;
      animation: pulse-glow 2s ease-in-out infinite;
    }

    /* === THE PIVOT === */
    .uni-pivot {
      padding: 80px 0 60px;
      background: linear-gradient(180deg, var(--uni-midnight) 0%, #1a1a2e 30%, #1a2a3e 60%, #1a3a3e 100%);
      text-align: center;
      position: relative;
    }
    .uni-pivot__confession {
      font-size: 16px;
      font-weight: 700;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 24px;
    }
    .uni-pivot h2 {
      font-size: 40px;
      font-weight: 900;
      line-height: 1.2;
      margin-bottom: 20px;
      color: #fff;
    }
    .uni-pivot h2 span {
      color: var(--uni-turquoise);
    }
    .uni-pivot__subtitle {
      font-size: 18px;
      color: rgba(255,255,255,0.6);
      max-width: 560px;
      margin: 0 auto 48px;
      line-height: 1.7;
    }
    .uni-pivot__real-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      text-align: left;
    }
    .uni-real-card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--regen-radius-lg);
      overflow: hidden;
      transition: transform 0.3s, border-color 0.3s;
    }
    .uni-real-card:hover {
      transform: translateY(-4px);
      border-color: var(--regen-green);
    }
    .uni-real-card__img {
      height: 160px;
      background-size: cover;
      background-position: center;
    }
    .uni-real-card__body {
      padding: 20px;
    }
    .uni-real-card__badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 8px;
    }
    .uni-real-card__name {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }
    .uni-real-card__location {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 8px;
    }
    .uni-real-card__desc {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      line-height: 1.6;
    }

    /* Teaser CTA */
    .uni-teaser-cta {
      text-align: center;
      margin-top: 48px;
    }
    .uni-teaser-cta a {
      display: inline-block;
      background: linear-gradient(135deg, var(--regen-green), #79C6AA);
      color: #fff;
      font-size: 16px;
      font-weight: 800;
      padding: 14px 36px;
      border-radius: 30px;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 16px rgba(79,181,115,0.3);
    }
    .uni-teaser-cta a:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(79,181,115,0.4);
      text-decoration: none;
    }

    /* === TRANSITION ZONE (Fantasy -> Reality) === */
    .uni-transition {
      padding: 60px 0;
      background: linear-gradient(180deg, #1a3a3e 0%, #f0f7f2 100%);
      text-align: center;
    }
    .uni-transition__card {
      max-width: 520px;
      margin: 0 auto;
      background: rgba(15, 10, 30, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--regen-radius-lg);
      padding: 36px 32px;
    }
    .uni-transition__card p {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.8;
      color: #fff;
      margin: 0;
    }
    .uni-transition__card p span {
      color: var(--uni-pink);
    }

    /* === REALITY SECTION (Regen brand from here) === */
    .uni-reality {
      background: var(--regen-gray-50);
      color: #1f2937;
    }

    /* How it works */
    .uni-hiw {
      padding: 64px 0;
      border-top: 1px solid var(--regen-gray-200);
    }
    .uni-hiw h2 {
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      color: var(--regen-navy);
      margin-bottom: 32px;
    }
    .uni-hiw__steps {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .uni-hiw__step {
      flex: 1 1 220px;
      max-width: 260px;
      text-align: center;
    }
    .uni-hiw__num {
      width: 44px;
      height: 44px;
      line-height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--regen-green), #79C6AA);
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      margin: 0 auto 12px;
    }
    .uni-hiw__step h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--regen-navy);
      margin-bottom: 6px;
    }
    .uni-hiw__step p {
      font-size: 13px;
      color: var(--regen-gray-500);
    }

    /* Pricing (Reality theme) */
    .uni-pricing {
      padding: 64px 0;
      background: #fff;
      border-top: 1px solid var(--regen-gray-200);
    }
    .uni-pricing h2 {
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      color: var(--regen-navy);
      margin-bottom: 8px;
    }
    .uni-pricing__sub {
      text-align: center;
      font-size: 15px;
      color: var(--regen-gray-500);
      margin-bottom: 32px;
    }
    .uni-tiers {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      max-width: 720px;
      margin: 0 auto;
    }
    .uni-tier {
      background: #fff;
      border: 2px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      padding: 28px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .uni-tier:hover {
      border-color: var(--regen-green);
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(79,181,115,0.15);
    }
    .uni-tier--featured {
      border-color: var(--regen-green);
      position: relative;
    }
    .uni-tier__badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, var(--regen-green), #79C6AA);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 14px;
      border-radius: 20px;
      white-space: nowrap;
    }
    .uni-tier__name {
      font-size: 14px;
      font-weight: 800;
      color: var(--regen-navy);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .uni-tier__price {
      font-size: 32px;
      font-weight: 900;
      color: var(--regen-navy);
      margin-bottom: 4px;
    }
    .uni-tier__price span {
      font-size: 14px;
      font-weight: 500;
      color: var(--regen-gray-500);
    }
    .uni-tier__desc {
      font-size: 13px;
      color: var(--regen-gray-500);
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .uni-tier__cta {
      display: block;
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, var(--regen-green), #79C6AA);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .uni-tier__cta:hover { opacity: 0.9; text-decoration: none; }

    /* Stats bar */
    .uni-stats {
      padding: 52px 0;
      border-top: 1px solid var(--regen-gray-200);
      background: var(--regen-gray-50);
    }
    .uni-stats__bar {
      display: flex;
      gap: 48px;
      flex-wrap: wrap;
      justify-content: center;
      text-align: center;
    }
    .uni-stats__num {
      font-size: 36px;
      font-weight: 800;
      color: var(--regen-green);
    }
    .uni-stats__label {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 14px;
      color: var(--regen-gray-500);
      margin-top: 4px;
    }

    /* Footer */
    .uni-footer {
      padding: 40px 0;
      text-align: center;
      background: var(--regen-gray-50);
      border-top: 1px solid var(--regen-gray-200);
    }
    .uni-footer a {
      color: var(--regen-gray-500);
      font-size: 13px;
      margin: 0 12px;
    }
    .uni-footer a:hover { color: var(--regen-green); }
    .uni-footer__powered {
      font-size: 12px;
      color: var(--regen-gray-400);
      margin-top: 16px;
    }

    /* Crypto badge */
    .uni-crypto-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--regen-gray-500);
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 16px;
      border: 1.5px solid var(--regen-gray-200);
      border-radius: 10px;
      padding: 10px 18px;
      background: #fff;
    }
    .uni-crypto-badge:hover { color: var(--regen-green); border-color: var(--regen-green); }

    @media (max-width: 700px) {
      .uni-hero h1 { font-size: 32px; }
      .uni-pivot h2 { font-size: 28px; }
      .uni-hero__unicorn { font-size: 60px; }
    }
  </style>
</head>
<body>

  <!-- ============ ACT I: COMPACT HERO ============ -->

  <section class="uni-hero">
    <div class="sparkle"></div>
    <div class="sparkle"></div>
    <div class="sparkle"></div>
    <div class="sparkle"></div>
    <div class="sparkle"></div>
    <div class="sparkle"></div>
    <div class="uni-container">
      <div class="uni-hero__unicorn">&#129412;</div>
      <div class="uni-hero__urgent">CRITICAL ALERT</div>
      <h1>The Very Last Unicorns Need Your Help</h1>
      <p>Every AI query you run drains the cosmic sparkle reserves. The unicorn population has dropped to critical levels.</p>
    </div>
  </section>

  <!-- ============ ACT II: THE PIVOT ============ -->

  <section class="uni-pivot">
    <div class="uni-container">
      <div class="uni-pivot__confession">Okay, real talk</div>
      <h2>We can&rsquo;t save the unicorns.<br><span>But here&rsquo;s what&rsquo;s actually real.</span></h2>
      <p class="uni-pivot__subtitle">
        Your AI does have a real ecological footprint. And there are real species &mdash; not unicorns, but jaguars, native ecosystems, and agricultural landscapes &mdash; that are being protected <em>right now</em> by real people on the ground. Here&rsquo;s proof.
      </p>

      <div class="uni-pivot__real-cards">
        ${jaguar ? `
        <div class="uni-real-card">
          <div class="uni-real-card__img" style="background-image:url('${jaguar.imageUrl}');"></div>
          <div class="uni-real-card__body">
            <span class="uni-real-card__badge" style="background:${jaguar.accentColor}33;color:${jaguar.accentColor};">${jaguar.creditTypeLabel}</span>
            <div class="uni-real-card__name">${jaguar.name}</div>
            <div class="uni-real-card__location">${jaguar.location}</div>
            <p class="uni-real-card__desc">Indigenous communities protecting jaguar corridors and umbrella species habitat. Every credit retired = more protected land.</p>
          </div>
        </div>` : ""}

        ${elGlobo ? `
        <div class="uni-real-card">
          <div class="uni-real-card__img" style="background-image:url('${elGlobo.imageUrl}');"></div>
          <div class="uni-real-card__body">
            <span class="uni-real-card__badge" style="background:${elGlobo.accentColor}33;color:${elGlobo.accentColor};">${elGlobo.creditTypeLabel}</span>
            <div class="uni-real-card__name">${elGlobo.name}</div>
            <div class="uni-real-card__location">${elGlobo.location}</div>
            <p class="uni-real-card__desc">Biodiverse ecosystems monitored with satellite imagery and on-the-ground surveys. Real biodiversity, real verification.</p>
          </div>
        </div>` : ""}

        ${carbon ? `
        <div class="uni-real-card">
          <div class="uni-real-card__img" style="background-image:url('${carbon.imageUrl}');"></div>
          <div class="uni-real-card__body">
            <span class="uni-real-card__badge" style="background:${carbon.accentColor}33;color:${carbon.accentColor};">${carbon.creditTypeLabel}</span>
            <div class="uni-real-card__name">${carbon.name}</div>
            <div class="uni-real-card__location">${carbon.location}</div>
            <p class="uni-real-card__desc">Verified carbon sequestration. Every tonne measured, minted on-chain, and permanently retired. No double-counting, ever.</p>
          </div>
        </div>` : ""}
      </div>

      <div class="uni-teaser-cta">
        <a href="#pricing">Protect Real Magic &mdash; from $1.25/mo</a>
      </div>
    </div>
  </section>

  <!-- ============ ACT III: THE TRANSITION ============ -->

  <section class="uni-transition">
    <div class="uni-container">
      <div class="uni-transition__card">
        <p><span>The unicorns aren&rsquo;t real.</span> But the impact is.<br>Every credit is verified on-chain. Every retirement is permanent.<br>This is ecological regeneration you can actually verify.</p>
      </div>
    </div>
  </section>

  <!-- ============ ACT IV: THE REAL THING ============ -->

  <div class="uni-reality">

    <section class="uni-pricing" id="pricing">
      <div class="uni-container">
        <h2>Save Some Real Magic</h2>
        <p class="uni-pricing__sub">No unicorns harmed. Real ecosystems protected. Cancel anytime.</p>

        <div class="uni-tiers">
          <div class="uni-tier" onclick="${hasPriceIds ? "subscribe('dabbler')" : `window.location.href='${config?.stripePaymentLinkSeedling ?? "#"}'`}">
            <div class="uni-tier__name">Dabbler</div>
            <div class="uni-tier__price">$1.25<span>/mo</span></div>
            <div class="uni-tier__desc">Use AI a few times a week. This covers your share.</div>
            <div class="uni-tier__cta">Subscribe</div>
          </div>
          <div class="uni-tier uni-tier--featured" onclick="${hasPriceIds ? "subscribe('builder')" : `window.location.href='${config?.stripePaymentLinkGrove ?? "#"}'`}">
            <div class="uni-tier__badge">Most Popular</div>
            <div class="uni-tier__name">Builder</div>
            <div class="uni-tier__price">$2.50<span>/mo</span></div>
            <div class="uni-tier__desc">AI is part of your daily workflow. Full ecological accountability.</div>
            <div class="uni-tier__cta">Subscribe</div>
          </div>
          <div class="uni-tier" onclick="${hasPriceIds ? "subscribe('agent')" : `window.location.href='${config?.stripePaymentLinkForest ?? "#"}'`}">
            <div class="uni-tier__name">Agent</div>
            <div class="uni-tier__price">$5<span>/mo</span></div>
            <div class="uni-tier__desc">For AI-native teams and autonomous agents. Maximum impact.</div>
            <div class="uni-tier__cta">Subscribe</div>
          </div>
        </div>

        <div style="text-align:center;">
          <span class="uni-crypto-badge" onclick="window.location.href='/#pricing'">
            Prefer crypto? Pay with ETH, BTC, SOL, or USDC &rarr;
          </span>
        </div>
      </div>
    </section>

    <section class="uni-hiw">
      <div class="uni-container">
        <h2>How It Works</h2>
        <div class="uni-hiw__steps">
          <div class="uni-hiw__step">
            <div class="uni-hiw__num">1</div>
            <h3>You Subscribe</h3>
            <p>Pick a plan. That&rsquo;s it. No installs, no setup, no code changes.</p>
          </div>
          <div class="uni-hiw__step">
            <div class="uni-hiw__num">2</div>
            <h3>We Retire Credits</h3>
            <p>Every month, verified ecological credits are permanently retired on-chain on your behalf.</p>
          </div>
          <div class="uni-hiw__step">
            <div class="uni-hiw__num">3</div>
            <h3>You Get Proof</h3>
            <p>Dashboard with on-chain receipts. Shareable retirement certificates you can verify yourself.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="uni-stats">
      <div class="uni-container">
        <div class="uni-stats__bar">
          <div>
            <div class="uni-stats__num">${totalRetirements}</div>
            <div class="uni-stats__label">Credits Retired</div>
          </div>
          <div>
            <div class="uni-stats__num">9+</div>
            <div class="uni-stats__label">Countries</div>
          </div>
          <div>
            <div class="uni-stats__num">5</div>
            <div class="uni-stats__label">Credit Types</div>
          </div>
          <div>
            <div class="uni-stats__num">0</div>
            <div class="uni-stats__label">Unicorns Saved (sorry)</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="uni-footer">
      <div class="uni-container">
        <div>
          <a href="/">Main Site</a>
          <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a>
          <a href="https://app.regen.network" target="_blank" rel="noopener">Marketplace</a>
          <a href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="uni-footer__powered">
          Powered by <a href="https://regen.network" style="color:var(--regen-green);font-weight:600;">Regen Network</a> &mdash; On-chain ecological credits, verified and permanent.
        </div>
      </div>
    </footer>
  </div>

  ${hasPriceIds ? `<script>
    function subscribe(tier) {
      var body = { tier: tier, interval: 'monthly' };
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

</body>
</html>`);
  });

  return router;
}
