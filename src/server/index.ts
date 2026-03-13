/**
 * Regenerative Compute — Payment & Balance Server
 *
 * A small Express server that handles:
 * - Shareable retirement certificate pages (/impact/:nodeId)
 * - Stripe Checkout for prepaid balance top-ups
 * - Stripe webhooks for payment confirmation
 * - Balance checking and debiting for MCP clients
 * - Developer REST API (/api/v1/) for programmatic access
 *
 * Run: npx regen-compute serve [--port 3141]
 *
 * Certificate routes work without Stripe configuration.
 * Payment routes require STRIPE_SECRET_KEY.
 * API routes require STRIPE_SECRET_KEY (for the DB / API key system).
 */

import express from "express";
import Stripe from "stripe";
import { getDb } from "./db.js";
import { createRoutes } from "./routes.js";
import { createCertificateRoutes } from "./certificate.js";
import { createApiRoutes } from "./api-routes.js";
import { createDashboardRoutes } from "./dashboard.js";
import { createResearchRoutes } from "./research.js";
import { createAboutRoutes } from "./about.js";
import { createAiPluginRoutes } from "./ai-plugin.js";
import { loadConfig } from "../config.js";
import { regenLogoSVG, regenLogoPNG } from "./brand.js";

export function startServer(options: { port?: number; dbPath?: string } = {}) {
  const port = options.port ?? parseInt(process.env.REGEN_SERVER_PORT ?? "3141", 10);
  const dbPath = options.dbPath ?? process.env.REGEN_DB_PATH ?? "data/regen-compute.db";

  const baseUrl = process.env.REGEN_SERVER_URL ?? `http://localhost:${port}`;

  const app = express();

  // Certificate routes — no Stripe dependency, mount first
  const certificateRoutes = createCertificateRoutes(baseUrl);
  app.use(certificateRoutes);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "0.3.0" });
  });

  // Static logo for emails (SVG)
  app.get("/logo.svg", (_req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(regenLogoSVG);
  });

  // Static logo for emails (PNG — compatible with Gmail, Outlook, Apple Mail)
  app.get("/logo.png", (_req, res) => {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(regenLogoPNG);
  });

  // Profile avatar for app.regen.network (square, solid green background + leaf mark)
  app.get("/profile-avatar.svg", (_req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a5c3a"/>
      <stop offset="100%" stop-color="#0d7a5f"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g transform="translate(52,40) scale(3.7)" fill="white" opacity="0.95">
    <path d="M39.83 27.32V27.37L34.98 1.8L30.97.52 28.44 3.92 39.83 27.32Z"/>
    <path d="M42.46 16.65L44.52 26.55 46.73 16.5 44.57 15.05 42.46 16.65Z"/>
    <path d="M57.76 18.4L55.13 18.66 52.04 28.46 58.84 20.78 57.76 18.4Z"/>
    <path d="M80.22 20.47V16.29L76.15 15 57.09 32.89 80.22 20.47Z"/>
    <path d="M33.64 31.03L27.98 22.53 28.08 22.73 27.98 22.53 25.4 22.94 24.99 25.52 33.64 31.03Z"/>
    <path d="M70.12 39.7L59.97 41.71 70.12 43.92 71.67 41.81 70.12 39.7Z"/>
    <path d="M29.11 41.76L3.04 38.46.52 41.86 3.04 45.26 29.11 41.76Z"/>
    <path d="M19.48 47.43L18.7 49.85 20.82 51.4 29.83 46.35 19.48 47.43Z"/>
    <path d="M22.46 54.59L22.36 57.17 24.83 58.05 32.05 50.47 22.46 54.59Z"/>
    <path d="M35.45 53.98L27.77 60.73 28.44 63.2 31.07 63.31 35.45 53.98Z"/>
    <path d="M44.57 56.97L42.51 66.97 44.62 68.46 46.73 66.92 44.57 56.97Z"/>
    <path d="M80.27 63.05L57.09 50.73 76.25 68.51 80.27 67.22V63.05Z"/>
    <path d="M54.72 64.96L49.51 56.24 50.7 66.25 53.17 67.02 54.72 64.96Z"/>
    <path d="M39.88 56.24L28.6 79.7 31.12 83.1 35.14 81.81 39.88 56.24Z"/>
  </g>
</svg>`);
  });

  // Profile banner for app.regen.network (wide, abstract teal-green gradient)
  app.get("/profile-banner.svg", (_req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400" viewBox="0 0 1600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="#0a3d2e"/>
      <stop offset="40%" stop-color="#0d6b52"/>
      <stop offset="70%" stop-color="#1a8a6e"/>
      <stop offset="100%" stop-color="#0f5a4a"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.2" cy="0.5" r="0.4">
      <stop offset="0%" stop-color="#2dd4a8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#2dd4a8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.75" cy="0.3" r="0.35">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="400" fill="url(#bg)"/>
  <rect width="1600" height="400" fill="url(#glow1)"/>
  <rect width="1600" height="400" fill="url(#glow2)"/>
  <!-- Subtle network nodes -->
  <g fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1">
    <circle cx="200" cy="120" r="3" fill="rgba(255,255,255,0.12)"/>
    <circle cx="350" cy="80" r="2.5" fill="rgba(255,255,255,0.1)"/>
    <circle cx="480" cy="160" r="3.5" fill="rgba(255,255,255,0.1)"/>
    <circle cx="650" cy="90" r="2" fill="rgba(255,255,255,0.08)"/>
    <circle cx="800" cy="200" r="3" fill="rgba(255,255,255,0.1)"/>
    <circle cx="1000" cy="130" r="2.5" fill="rgba(255,255,255,0.1)"/>
    <circle cx="1150" cy="180" r="3" fill="rgba(255,255,255,0.12)"/>
    <circle cx="1300" cy="100" r="2" fill="rgba(255,255,255,0.08)"/>
    <circle cx="1420" cy="220" r="3.5" fill="rgba(255,255,255,0.1)"/>
    <line x1="200" y1="120" x2="350" y2="80"/>
    <line x1="350" y1="80" x2="480" y2="160"/>
    <line x1="480" y1="160" x2="650" y2="90"/>
    <line x1="650" y1="90" x2="800" y2="200"/>
    <line x1="800" y1="200" x2="1000" y2="130"/>
    <line x1="1000" y1="130" x2="1150" y2="180"/>
    <line x1="1150" y1="180" x2="1300" y2="100"/>
    <line x1="1300" y1="100" x2="1420" y2="220"/>
    <line x1="200" y1="120" x2="480" y2="160"/>
    <line x1="650" y1="90" x2="1000" y2="130"/>
    <line x1="800" y1="200" x2="1150" y2="180"/>
  </g>
  <!-- Subtle horizontal light streak -->
  <rect x="0" y="195" width="1600" height="1.5" fill="rgba(52,211,153,0.15)"/>
  <rect x="0" y="197" width="1600" height="0.5" fill="rgba(52,211,153,0.08)"/>
</svg>`);
  });

  // OG image for social media previews
  app.get("/og-preview.jpg", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.sendFile("og-preview.jpg", { root: process.cwd() });
  });
  // Legacy fallbacks
  app.get("/og-image.png", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.sendFile("og-preview.jpg", { root: process.cwd() });
  });
  app.get("/og-image.jpg", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.sendFile("og-image.jpg", { root: process.cwd() });
  });

  // Always init DB and config — display-only pages need them
  const db = getDb(dbPath);
  const config = loadConfig();

  // Stripe setup (optional — display pages work without it)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && process.env.NODE_ENV === "production" && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("WARNING: STRIPE_WEBHOOK_SECRET not set — webhook signature verification disabled. Set this for production security.");
  }
  const stripe = stripeKey ? new Stripe(stripeKey) : null;

  // Stripe webhooks need raw body for signature verification
  if (stripe) {
    app.use("/webhook", express.raw({ type: "application/json" }));
  }

  // JSON + URL-encoded body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Mount routes (landing page, feedback, cancel, checkout-page always work;
  // Stripe-dependent routes like /subscribe, /checkout, /webhook, /success, /manage
  // are conditionally registered inside createRoutes when stripe is non-null)
  const routes = createRoutes(stripe, db, baseUrl, config);
  app.use(routes);

  // Research page (static, no dependencies)
  const researchRoutes = createResearchRoutes(baseUrl);
  app.use(researchRoutes);

  // About page (static, no dependencies)
  const aboutRoutes = createAboutRoutes(baseUrl);
  app.use(aboutRoutes);

  // AI Plugin page (static, no dependencies)
  const aiPluginRoutes = createAiPluginRoutes(baseUrl);
  app.use(aiPluginRoutes);

  // Dashboard routes (login page works without Stripe; full dashboard needs DB)
  const dashboardRoutes = createDashboardRoutes(db, baseUrl, config);
  app.use(dashboardRoutes);

  if (stripe) {
    // Developer API routes (require Stripe for the full API key system)
    const apiRoutes = createApiRoutes(db, baseUrl, config);
    app.use(apiRoutes);
  }

  app.listen(port, () => {
    console.log(`Regenerative Compute server running on ${baseUrl}`);
    console.log(`  Certificates: ${baseUrl}/impact/:nodeId`);
    if (stripeKey) {
      console.log(`  Landing page: ${baseUrl}/`);
      console.log(`  Developer API: ${baseUrl}/api/v1/`);
      console.log(`  OpenAPI spec: ${baseUrl}/api/v1/openapi.json`);
      console.log(`  Dashboard: ${baseUrl}/dashboard`);
      console.log(`  Stripe mode: ${stripeKey.startsWith("sk_test_") ? "TEST" : "LIVE"}`);
      console.log(`  Database: ${dbPath}`);
    } else {
      console.log(`  Payment routes: disabled (no STRIPE_SECRET_KEY)`);
    }
  });
}
