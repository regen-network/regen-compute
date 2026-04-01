/**
 * GET /rainbows — "Save the Rainbows" themed landing page.
 *
 * A fantasy-themed marketing page that hooks with absurdist humor
 * about AI draining the color spectrum, then pivots to real ecological
 * impact. Same pricing/subscribe infrastructure as the main landing page.
 *
 * Visual theme: spectral rainbow gradients on dark → gradual transition
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

export function createRainbowRoutes(db: Database.Database, baseUrl: string, config?: Config): Router {
  const router = Router();

  router.get("/rainbows", async (req: Request, res: Response) => {
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
  <title>Save the Rainbows — Regen Compute</title>
  <meta name="description" content="The rainbows are losing their color. Your AI is draining the spectrum. Or is it? Discover the real ecological impact — and what you can do.">
  <meta property="og:title" content="The Rainbows Are Losing Their Color">
  <meta property="og:description" content="Your AI is draining the color spectrum. Scientists project full grayscale by 2031. Act now.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/rainbows">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    /* === RAINBOW FANTASY THEME === */
    :root {
      --rb-red: #ff4545;
      --rb-orange: #ff8c42;
      --rb-yellow: #ffd166;
      --rb-green: #06d6a0;
      --rb-blue: #118ab2;
      --rb-indigo: #7b2ff7;
      --rb-violet: #c77dff;
      --rb-pink: #ff2d95;
      --rb-midnight: #0a0a1a;
      --rb-deep: #110a2e;
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
      background: var(--rb-midnight);
      color: #fff;
      overflow-x: hidden;
    }
    a { color: var(--rb-green); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .rb-container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

    /* Animations */
    @keyframes fade-gray {
      0% { filter: saturate(1); }
      100% { filter: saturate(0.1); }
    }
    @keyframes rainbow-shift {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(255,69,69,0.3); }
      50% { box-shadow: 0 0 40px rgba(123,47,247,0.5); }
    }
    @keyframes color-drain {
      0%, 40% { opacity: 1; }
      60%, 100% { opacity: 0.15; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }

    /* === HERO (Rainbow Crisis) === */
    .rb-hero {
      position: relative;
      padding: 80px 0 60px;
      text-align: center;
      background: linear-gradient(135deg, var(--rb-midnight) 0%, #1a0a2e 30%, #0a1a2e 60%, var(--rb-midnight) 100%);
      overflow: hidden;
    }
    .rb-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 15% 30%, rgba(255,69,69,0.12) 0%, transparent 40%),
        radial-gradient(circle at 40% 50%, rgba(255,209,102,0.1) 0%, transparent 35%),
        radial-gradient(circle at 60% 40%, rgba(6,214,160,0.1) 0%, transparent 35%),
        radial-gradient(circle at 85% 30%, rgba(123,47,247,0.12) 0%, transparent 40%);
      pointer-events: none;
    }
    /* Spectral color bars that fade */
    .rb-hero__bars {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      display: flex;
    }
    .rb-hero__bars span {
      flex: 1;
      animation: color-drain 6s ease-in-out infinite alternate;
    }
    .rb-hero__bars span:nth-child(1) { background: var(--rb-red); animation-delay: 0s; }
    .rb-hero__bars span:nth-child(2) { background: var(--rb-orange); animation-delay: 0.4s; }
    .rb-hero__bars span:nth-child(3) { background: var(--rb-yellow); animation-delay: 0.8s; }
    .rb-hero__bars span:nth-child(4) { background: var(--rb-green); animation-delay: 1.2s; }
    .rb-hero__bars span:nth-child(5) { background: var(--rb-blue); animation-delay: 1.6s; }
    .rb-hero__bars span:nth-child(6) { background: var(--rb-indigo); animation-delay: 2.0s; }
    .rb-hero__bars span:nth-child(7) { background: var(--rb-violet); animation-delay: 2.4s; }

    .rb-hero__rainbow {
      font-size: 80px;
      margin-bottom: 16px;
      display: inline-block;
      animation: fade-gray 4s ease-in-out infinite alternate;
    }
    .rb-hero h1 {
      font-size: 48px;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 12px;
      background: linear-gradient(135deg, var(--rb-red), var(--rb-orange), var(--rb-yellow), var(--rb-green), var(--rb-blue), var(--rb-indigo), var(--rb-violet));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .rb-hero p {
      font-size: 18px;
      color: rgba(255,255,255,0.7);
      max-width: 540px;
      margin: 0 auto 20px;
      line-height: 1.6;
    }
    .rb-hero__urgent {
      display: inline-block;
      background: linear-gradient(135deg, var(--rb-red), var(--rb-indigo));
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 8px 24px;
      border-radius: 30px;
      animation: pulse-glow 2s ease-in-out infinite;
      margin-bottom: 32px;
    }
    .rb-hero__stats {
      display: flex;
      gap: 40px;
      justify-content: center;
      margin-top: 36px;
      flex-wrap: wrap;
    }
    .rb-hero__stat {
      text-align: center;
    }
    .rb-hero__stat-num {
      font-size: 44px;
      font-weight: 900;
      background: linear-gradient(135deg, var(--rb-orange), var(--rb-violet));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .rb-hero__stat-label {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* === THE PIVOT === */
    .rb-pivot {
      padding: 80px 0 60px;
      background: linear-gradient(180deg, var(--rb-midnight) 0%, #1a1a2e 30%, #1a2a3e 60%, #1a3a3e 100%);
      text-align: center;
      position: relative;
    }
    .rb-pivot__confession {
      font-size: 16px;
      font-weight: 700;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 24px;
    }
    .rb-pivot h2 {
      font-size: 40px;
      font-weight: 900;
      line-height: 1.2;
      margin-bottom: 20px;
      color: #fff;
    }
    .rb-pivot h2 span {
      color: var(--rb-green);
    }
    .rb-pivot__subtitle {
      font-size: 18px;
      color: rgba(255,255,255,0.6);
      max-width: 560px;
      margin: 0 auto 48px;
      line-height: 1.7;
    }
    .rb-pivot__real-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      text-align: left;
    }
    .rb-real-card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--regen-radius-lg);
      overflow: hidden;
      transition: transform 0.3s, border-color 0.3s;
    }
    .rb-real-card:hover {
      transform: translateY(-4px);
      border-color: var(--regen-green);
    }
    .rb-real-card__img {
      height: 160px;
      background-size: cover;
      background-position: center;
    }
    .rb-real-card__body {
      padding: 20px;
    }
    .rb-real-card__badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 8px;
    }
    .rb-real-card__name {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }
    .rb-real-card__location {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 8px;
    }
    .rb-real-card__desc {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      line-height: 1.6;
    }

    /* Teaser CTA */
    .rb-teaser-cta {
      text-align: center;
      margin-top: 48px;
    }
    .rb-teaser-cta a {
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
    .rb-teaser-cta a:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(79,181,115,0.4);
      text-decoration: none;
    }

    /* === TRANSITION ZONE (Fantasy -> Reality) === */
    .rb-transition {
      padding: 60px 0;
      background: linear-gradient(180deg, #1a3a3e 0%, #f0f7f2 100%);
      text-align: center;
    }
    .rb-transition__card {
      max-width: 520px;
      margin: 0 auto;
      background: rgba(15, 10, 30, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--regen-radius-lg);
      padding: 36px 32px;
    }
    .rb-transition__card p {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.8;
      color: #fff;
      margin: 0;
    }
    .rb-transition__card p span {
      background: linear-gradient(135deg, var(--rb-red), var(--rb-violet));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* === REALITY SECTION (Regen brand from here) === */
    .rb-reality {
      background: var(--regen-gray-50);
      color: #1f2937;
    }

    /* How it works */
    .rb-hiw {
      padding: 64px 0;
      border-top: 1px solid var(--regen-gray-200);
    }
    .rb-hiw h2 {
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      color: var(--regen-navy);
      margin-bottom: 32px;
    }
    .rb-hiw__steps {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .rb-hiw__step {
      flex: 1 1 220px;
      max-width: 260px;
      text-align: center;
    }
    .rb-hiw__num {
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
    .rb-hiw__step h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--regen-navy);
      margin-bottom: 6px;
    }
    .rb-hiw__step p {
      font-size: 13px;
      color: var(--regen-gray-500);
    }

    /* Pricing (Reality theme) */
    .rb-pricing {
      padding: 64px 0;
      background: #fff;
      border-top: 1px solid var(--regen-gray-200);
    }
    .rb-pricing h2 {
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      color: var(--regen-navy);
      margin-bottom: 8px;
    }
    .rb-pricing__sub {
      text-align: center;
      font-size: 15px;
      color: var(--regen-gray-500);
      margin-bottom: 32px;
    }
    .rb-tiers {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      max-width: 720px;
      margin: 0 auto;
    }
    .rb-tier {
      background: #fff;
      border: 2px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      padding: 28px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .rb-tier:hover {
      border-color: var(--regen-green);
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(79,181,115,0.15);
    }
    .rb-tier--featured {
      border-color: var(--regen-green);
      position: relative;
    }
    .rb-tier__badge {
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
    .rb-tier__name {
      font-size: 14px;
      font-weight: 800;
      color: var(--regen-navy);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .rb-tier__price {
      font-size: 32px;
      font-weight: 900;
      color: var(--regen-navy);
      margin-bottom: 4px;
    }
    .rb-tier__price span {
      font-size: 14px;
      font-weight: 500;
      color: var(--regen-gray-500);
    }
    .rb-tier__desc {
      font-size: 13px;
      color: var(--regen-gray-500);
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .rb-tier__cta {
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
    .rb-tier__cta:hover { opacity: 0.9; text-decoration: none; }

    /* Stats bar */
    .rb-stats {
      padding: 52px 0;
      border-top: 1px solid var(--regen-gray-200);
      background: var(--regen-gray-50);
    }
    .rb-stats__bar {
      display: flex;
      gap: 48px;
      flex-wrap: wrap;
      justify-content: center;
      text-align: center;
    }
    .rb-stats__num {
      font-size: 36px;
      font-weight: 800;
      color: var(--regen-green);
    }
    .rb-stats__label {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 14px;
      color: var(--regen-gray-500);
      margin-top: 4px;
    }

    /* Footer */
    .rb-footer {
      padding: 40px 0;
      text-align: center;
      background: var(--regen-gray-50);
      border-top: 1px solid var(--regen-gray-200);
    }
    .rb-footer a {
      color: var(--regen-gray-500);
      font-size: 13px;
      margin: 0 12px;
    }
    .rb-footer a:hover { color: var(--regen-green); }
    .rb-footer__powered {
      font-size: 12px;
      color: var(--regen-gray-400);
      margin-top: 16px;
    }

    /* Crypto badge */
    .rb-crypto-badge {
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
    .rb-crypto-badge:hover { color: var(--regen-green); border-color: var(--regen-green); }

    @media (max-width: 700px) {
      .rb-hero h1 { font-size: 32px; }
      .rb-pivot h2 { font-size: 28px; }
      .rb-hero__rainbow { font-size: 60px; }
      .rb-hero__stats { gap: 24px; }
      .rb-hero__stat-num { font-size: 32px; }
    }
  </style>
</head>
<body>

  <!-- ============ ACT I: THE RAINBOW CRISIS ============ -->

  <section class="rb-hero">
    <div class="rb-hero__bars">
      <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
    </div>
    <div class="rb-container">
      <div class="rb-hero__rainbow">&#127752;</div>
      <div class="rb-hero__urgent">SPECTRAL EMERGENCY</div>
      <h1>The Rainbows Are Losing Their Color</h1>
      <p>Scientists have confirmed: the global rainbow spectrum is fading at an alarming rate. Each AI conversation consumes approximately 0.003 rainbow-color-units (RCUs). At current rates, all rainbows will be fully grayscale by 2031.</p>

      <div class="rb-hero__stats">
        <div class="rb-hero__stat">
          <div class="rb-hero__stat-num">17%</div>
          <div class="rb-hero__stat-label">Color already lost</div>
        </div>
        <div class="rb-hero__stat">
          <div class="rb-hero__stat-num">2031</div>
          <div class="rb-hero__stat-label">Estimated grayscale date</div>
        </div>
        <div class="rb-hero__stat">
          <div class="rb-hero__stat-num">0.003</div>
          <div class="rb-hero__stat-label">RCUs per AI query</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ ACT II: THE PIVOT ============ -->

  <section class="rb-pivot">
    <div class="rb-container">
      <div class="rb-pivot__confession">Okay, real talk</div>
      <h2>We can&rsquo;t save the rainbows.<br><span>But here&rsquo;s what&rsquo;s actually real.</span></h2>
      <p class="rb-pivot__subtitle">
        Your AI does have a real ecological footprint. And there are real ecosystems &mdash; not rainbow color reserves, but rainforests, jaguar corridors, and carbon sinks &mdash; that are being protected <em>right now</em> by real people on the ground. Here&rsquo;s proof.
      </p>

      <div class="rb-pivot__real-cards">
        ${jaguar ? `
        <div class="rb-real-card">
          <div class="rb-real-card__img" style="background-image:url('${jaguar.imageUrl}');"></div>
          <div class="rb-real-card__body">
            <span class="rb-real-card__badge" style="background:${jaguar.accentColor}33;color:${jaguar.accentColor};">${jaguar.creditTypeLabel}</span>
            <div class="rb-real-card__name">${jaguar.name}</div>
            <div class="rb-real-card__location">${jaguar.location}</div>
            <p class="rb-real-card__desc">Indigenous communities protecting jaguar corridors and umbrella species habitat. Every credit retired = more protected land.</p>
          </div>
        </div>` : ""}

        ${elGlobo ? `
        <div class="rb-real-card">
          <div class="rb-real-card__img" style="background-image:url('${elGlobo.imageUrl}');"></div>
          <div class="rb-real-card__body">
            <span class="rb-real-card__badge" style="background:${elGlobo.accentColor}33;color:${elGlobo.accentColor};">${elGlobo.creditTypeLabel}</span>
            <div class="rb-real-card__name">${elGlobo.name}</div>
            <div class="rb-real-card__location">${elGlobo.location}</div>
            <p class="rb-real-card__desc">Biodiverse ecosystems monitored with satellite imagery and on-the-ground surveys. Real biodiversity, real verification.</p>
          </div>
        </div>` : ""}

        ${carbon ? `
        <div class="rb-real-card">
          <div class="rb-real-card__img" style="background-image:url('${carbon.imageUrl}');"></div>
          <div class="rb-real-card__body">
            <span class="rb-real-card__badge" style="background:${carbon.accentColor}33;color:${carbon.accentColor};">${carbon.creditTypeLabel}</span>
            <div class="rb-real-card__name">${carbon.name}</div>
            <div class="rb-real-card__location">${carbon.location}</div>
            <p class="rb-real-card__desc">Verified carbon sequestration. Every tonne measured, minted on-chain, and permanently retired. No double-counting, ever.</p>
          </div>
        </div>` : ""}
      </div>

      <div class="rb-teaser-cta">
        <a href="#pricing">Protect Real Magic &mdash; from $1.25/mo</a>
      </div>
    </div>
  </section>

  <!-- ============ ACT III: THE TRANSITION ============ -->

  <section class="rb-transition">
    <div class="rb-container">
      <div class="rb-transition__card">
        <p><span>The rainbows aren&rsquo;t fading.</span> But your AI&rsquo;s footprint is real.<br>Every credit is verified on-chain. Every retirement is permanent.<br>This is ecological regeneration you can actually verify.</p>
      </div>
    </div>
  </section>

  <!-- ============ ACT IV: THE REAL THING ============ -->

  <div class="rb-reality">

    <section class="rb-pricing" id="pricing">
      <div class="rb-container">
        <h2>Save Some Real Magic</h2>
        <p class="rb-pricing__sub">No rainbows harmed. Real ecosystems protected. Cancel anytime.</p>

        <div class="rb-tiers">
          <div class="rb-tier" onclick="${hasPriceIds ? "subscribe('dabbler')" : `window.location.href='${config?.stripePaymentLinkSeedling ?? "#"}'`}">
            <div class="rb-tier__name">Dabbler</div>
            <div class="rb-tier__price">$1.25<span>/mo</span></div>
            <div class="rb-tier__desc">Use AI a few times a week. This covers your share.</div>
            <div class="rb-tier__cta">Subscribe</div>
          </div>
          <div class="rb-tier rb-tier--featured" onclick="${hasPriceIds ? "subscribe('builder')" : `window.location.href='${config?.stripePaymentLinkGrove ?? "#"}'`}">
            <div class="rb-tier__badge">Most Popular</div>
            <div class="rb-tier__name">Builder</div>
            <div class="rb-tier__price">$2.50<span>/mo</span></div>
            <div class="rb-tier__desc">AI is part of your daily workflow. Full ecological accountability.</div>
            <div class="rb-tier__cta">Subscribe</div>
          </div>
          <div class="rb-tier" onclick="${hasPriceIds ? "subscribe('agent')" : `window.location.href='${config?.stripePaymentLinkForest ?? "#"}'`}">
            <div class="rb-tier__name">Agent</div>
            <div class="rb-tier__price">$5<span>/mo</span></div>
            <div class="rb-tier__desc">For AI-native teams and autonomous agents. Maximum impact.</div>
            <div class="rb-tier__cta">Subscribe</div>
          </div>
        </div>

        <div style="text-align:center;">
          <span class="rb-crypto-badge" onclick="window.location.href='/#pricing'">
            Prefer crypto? Pay with ETH, BTC, SOL, or USDC &rarr;
          </span>
        </div>
      </div>
    </section>

    <section class="rb-hiw">
      <div class="rb-container">
        <h2>How It Works</h2>
        <div class="rb-hiw__steps">
          <div class="rb-hiw__step">
            <div class="rb-hiw__num">1</div>
            <h3>You Subscribe</h3>
            <p>Pick a plan. That&rsquo;s it. No installs, no setup, no code changes.</p>
          </div>
          <div class="rb-hiw__step">
            <div class="rb-hiw__num">2</div>
            <h3>We Retire Credits</h3>
            <p>Every month, verified ecological credits are permanently retired on-chain on your behalf.</p>
          </div>
          <div class="rb-hiw__step">
            <div class="rb-hiw__num">3</div>
            <h3>You Get Proof</h3>
            <p>Dashboard with on-chain receipts. Shareable retirement certificates you can verify yourself.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rb-stats">
      <div class="rb-container">
        <div class="rb-stats__bar">
          <div>
            <div class="rb-stats__num">${totalRetirements}</div>
            <div class="rb-stats__label">Credits Retired</div>
          </div>
          <div>
            <div class="rb-stats__num">9+</div>
            <div class="rb-stats__label">Countries</div>
          </div>
          <div>
            <div class="rb-stats__num">5</div>
            <div class="rb-stats__label">Credit Types</div>
          </div>
          <div>
            <div class="rb-stats__num">0</div>
            <div class="rb-stats__label">Rainbows Saved (sorry)</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="rb-footer">
      <div class="rb-container">
        <div>
          <a href="/">Main Site</a>
          <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a>
          <a href="https://app.regen.network" target="_blank" rel="noopener">Marketplace</a>
          <a href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="rb-footer__powered">
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
