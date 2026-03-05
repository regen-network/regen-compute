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
import { createAiPluginRoutes } from "./ai-plugin.js";
import { loadConfig } from "../config.js";
import { regenLogoSVG } from "./brand.js";

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

  // Always init DB and config — display-only pages need them
  const db = getDb(dbPath);
  const config = loadConfig();

  // Stripe setup (optional — display pages work without it)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && process.env.NODE_ENV === "production" && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("FATAL: STRIPE_WEBHOOK_SECRET is required in production when Stripe is enabled");
    process.exit(1);
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
