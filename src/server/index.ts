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
import { loadConfig } from "../config.js";

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

  // Payment routes — require Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    const stripe = new Stripe(stripeKey);
    const db = getDb(dbPath);

    // Stripe webhooks need raw body for signature verification
    app.use("/webhook", express.raw({ type: "application/json" }));

    // Everything else uses JSON
    app.use(express.json());

    // Mount payment routes
    const config = loadConfig();
    const routes = createRoutes(stripe, db, baseUrl, config);
    app.use(routes);

    // Mount developer API routes
    const apiRoutes = createApiRoutes(db, baseUrl, config);
    app.use(apiRoutes);

    // Mount subscriber dashboard routes
    // JSON + URL-encoded body parsing is already set up above
    app.use(express.urlencoded({ extended: false }));
    const dashboardRoutes = createDashboardRoutes(db, baseUrl, config);
    app.use(dashboardRoutes);
  }

  app.listen(port, () => {
    console.log(`Regenerative Compute server running on ${baseUrl}`);
    console.log(`  Certificates: ${baseUrl}/impact/:nodeId`);
    if (stripeKey) {
      console.log(`  Checkout page: ${baseUrl}/checkout-page`);
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
