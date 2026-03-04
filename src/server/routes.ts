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
} from "./db.js";

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

export function createRoutes(stripe: Stripe, db: Database.Database, baseUrl: string, config?: Config): Router {
  const router = Router();

  // --- Public routes ---

  /**
   * GET /
   * Subscription landing page with live impact stats.
   */
  router.get("/", async (_req: Request, res: Response) => {
    const seedlingUrl = config?.stripePaymentLinkSeedling ?? process.env.STRIPE_PAYMENT_LINK_SEEDLING ?? "#";
    const groveUrl = config?.stripePaymentLinkGrove ?? process.env.STRIPE_PAYMENT_LINK_GROVE ?? "#";
    const forestUrl = config?.stripePaymentLinkForest ?? process.env.STRIPE_PAYMENT_LINK_FOREST ?? "#";

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
  <title>Regenerative Compute — Regenerative AI</title>
  <meta name="description" content="Fund verified ecological regeneration from your AI sessions. Monthly subscriptions retire real carbon and biodiversity credits on Regen Network.">
  <meta property="og:title" content="Regenerative Compute — Regenerative AI">
  <meta property="og:description" content="Fund verified ecological regeneration from your AI sessions. Monthly subscriptions retire real carbon and biodiversity credits on Regen Network.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Regenerative Compute — Regenerative AI">
  <meta name="twitter:description" content="Fund verified ecological regeneration from your AI sessions.">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
      margin: 0; padding: 0;
      color: #1a1a1a; line-height: 1.6;
      background: #fff;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

    /* Hero */
    .hero {
      padding: 80px 0 60px;
      text-align: center;
    }
    .hero-label {
      display: inline-block;
      font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
      color: #2d6a4f; background: #f0f7f4;
      padding: 4px 12px; border-radius: 20px; margin-bottom: 16px;
    }
    .hero h1 {
      font-size: 42px; font-weight: 700; color: #1a1a1a;
      margin: 0 0 16px; line-height: 1.15;
    }
    .hero h1 span { color: #2d6a4f; }
    .hero p {
      font-size: 18px; color: #555; max-width: 600px; margin: 0 auto 32px;
    }
    .cta-btn {
      display: inline-block; padding: 14px 32px;
      background: #2d6a4f; color: #fff;
      font-size: 16px; font-weight: 600;
      border-radius: 8px; text-decoration: none;
      transition: background 0.2s;
    }
    .cta-btn:hover { background: #1b4332; }

    /* How it works */
    .how-it-works {
      padding: 60px 0;
      border-top: 1px solid #e8e8e8;
    }
    .section-title {
      text-align: center; font-size: 28px; font-weight: 700;
      margin: 0 0 40px; color: #1a1a1a;
    }
    .steps {
      display: flex; gap: 24px; flex-wrap: wrap;
      justify-content: center;
    }
    .step {
      flex: 1 1 180px; max-width: 200px;
      text-align: center; padding: 0 8px;
    }
    .step-num {
      width: 40px; height: 40px; line-height: 40px;
      border-radius: 50%; background: #2d6a4f; color: #fff;
      font-size: 18px; font-weight: 700;
      margin: 0 auto 12px;
    }
    .step h3 { font-size: 16px; margin: 0 0 6px; color: #1a1a1a; }
    .step p { font-size: 13px; color: #666; margin: 0; }
    .step code {
      font-size: 11px; background: #f4f4f4; padding: 2px 5px;
      border-radius: 3px; word-break: break-all;
    }

    /* Pricing */
    .pricing {
      padding: 60px 0;
      background: #fafcfb;
      border-top: 1px solid #e8e8e8;
    }
    .tiers {
      display: flex; gap: 20px; flex-wrap: wrap;
      justify-content: center;
    }
    .tier {
      flex: 1 1 240px; max-width: 280px;
      background: #fff; border: 2px solid #e0e0e0; border-radius: 12px;
      padding: 32px 24px; text-align: center;
      text-decoration: none; color: #1a1a1a;
      transition: border-color 0.2s, box-shadow 0.2s;
      display: flex; flex-direction: column;
    }
    .tier:hover {
      border-color: #2d6a4f;
      box-shadow: 0 4px 20px rgba(45, 106, 79, 0.1);
    }
    .tier.featured {
      border-color: #2d6a4f;
      position: relative;
    }
    .tier-badge {
      position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
      background: #2d6a4f; color: #fff;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      padding: 4px 14px; border-radius: 20px; white-space: nowrap;
    }
    .tier-name { font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px; }
    .tier-price { font-size: 36px; font-weight: 700; margin: 8px 0 4px; }
    .tier-price span { font-size: 16px; font-weight: 400; color: #888; }
    .tier-desc {
      font-size: 14px; color: #666; margin: 12px 0 20px;
      flex-grow: 1;
    }
    .tier-btn {
      display: block; padding: 12px 0;
      background: #2d6a4f; color: #fff;
      font-size: 15px; font-weight: 600;
      border-radius: 8px; text-decoration: none;
      transition: background 0.2s;
    }
    .tier-btn:hover { background: #1b4332; }

    /* Stats */
    .stats {
      padding: 48px 0;
      border-top: 1px solid #e8e8e8;
    }
    .stats-bar {
      display: flex; gap: 40px; flex-wrap: wrap;
      justify-content: center; text-align: center;
    }
    .stat-item {}
    .stat-num {
      font-size: 36px; font-weight: 700; color: #2d6a4f;
      line-height: 1.1;
    }
    .stat-label { font-size: 14px; color: #888; margin-top: 4px; }

    /* Trust */
    .trust {
      padding: 60px 0;
      border-top: 1px solid #e8e8e8;
    }
    .trust-grid {
      display: flex; gap: 32px; flex-wrap: wrap;
      justify-content: center;
    }
    .trust-item {
      flex: 1 1 220px; max-width: 260px;
    }
    .trust-item h3 { font-size: 16px; margin: 0 0 6px; color: #2d6a4f; }
    .trust-item p { font-size: 14px; color: #666; margin: 0; }

    /* Footer */
    .footer {
      padding: 48px 0;
      text-align: center;
      border-top: 1px solid #e8e8e8;
    }
    .footer p { font-size: 14px; color: #888; margin: 12px 0; }
    .footer a { color: #2d6a4f; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }

    /* Referral banner */
    .ref-banner {
      background: linear-gradient(135deg, #2d6a4f, #52b788);
      color: #fff; text-align: center;
      padding: 16px 24px; font-size: 16px; font-weight: 600;
    }
    .ref-banner span { font-size: 22px; }

    /* Mobile */
    @media (max-width: 700px) {
      .hero { padding: 48px 0 40px; }
      .hero h1 { font-size: 28px; }
      .hero p { font-size: 16px; }
      .step { flex: 1 1 140px; }
      .tier { flex: 1 1 100%; max-width: 100%; }
      .stats-bar { gap: 24px; }
      .stat-num { font-size: 28px; }
      .trust-item { flex: 1 1 100%; max-width: 100%; }
    }
  </style>
</head>
<body>

  ${referralValid ? `<div class="ref-banner"><span>Your friend invited you</span> — first month free!</div>` : ""}

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="hero-label">Regenerative AI</div>
      <h1>Fund <span>Ecological Regeneration</span> from Your AI Sessions</h1>
      <p>Regenerative contribution, not carbon offset. Monthly subscriptions retire verified carbon and biodiversity credits on Regen Network.</p>
      <a class="cta-btn" href="#pricing">Choose Your Plan</a>
    </div>
  </section>

  <!-- How it works -->
  <section class="how-it-works">
    <div class="container">
      <h2 class="section-title">How It Works</h2>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <h3>Install</h3>
          <p>One command:<br><code>claude mcp add regen-compute</code></p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <h3>Estimate</h3>
          <p>AI estimates your session's ecological footprint</p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <h3>Subscribe</h3>
          <p>Pick a monthly tier that funds ongoing regeneration</p>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <h3>Retire</h3>
          <p>Credits retired on-chain monthly with verifiable proof</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section class="pricing" id="pricing">
    <div class="container">
      <h2 class="section-title">Choose Your Plan</h2>
      <div class="tiers">
        <div class="tier">
          <div class="tier-name">Seedling</div>
          <div class="tier-price">$2.50<span>/mo</span></div>
          <div class="tier-desc">~0.5 carbon credits retired per month. Perfect for individual developers.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          ${hasPriceIds
            ? `<button class="tier-btn" onclick="subscribe('seedling')">Subscribe</button>`
            : `<a class="tier-btn" href="${seedlingUrl}">Subscribe</a>`}
        </div>
        <div class="tier featured">
          <div class="tier-badge">Most Popular</div>
          <div class="tier-name">Grove</div>
          <div class="tier-price">$7<span>/mo</span></div>
          <div class="tier-desc">~1.5 carbon credits + biodiversity credits per month. The sweet spot.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          ${hasPriceIds
            ? `<button class="tier-btn" onclick="subscribe('grove')">Subscribe</button>`
            : `<a class="tier-btn" href="${groveUrl}">Subscribe</a>`}
        </div>
        <div class="tier">
          <div class="tier-name">Forest</div>
          <div class="tier-price">$15<span>/mo</span></div>
          <div class="tier-desc">~3 carbon credits + biodiversity credits per month. For teams and power users.${referralValid ? "<br><strong>First month free!</strong>" : ""}</div>
          ${hasPriceIds
            ? `<button class="tier-btn" onclick="subscribe('forest')">Subscribe</button>`
            : `<a class="tier-btn" href="${forestUrl}">Subscribe</a>`}
        </div>
      </div>
    </div>
  </section>

  <!-- Live Stats -->
  <section class="stats">
    <div class="container">
      <h2 class="section-title">Live from Regen Network</h2>
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-num">${totalRetirements}</div>
          <div class="stat-label">Total Retirements</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">${totalOrders}</div>
          <div class="stat-label">Marketplace Orders</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">5</div>
          <div class="stat-label">Credit Types</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Trust -->
  <section class="trust">
    <div class="container">
      <h2 class="section-title">Why Regenerative Compute</h2>
      <div class="trust-grid">
        <div class="trust-item">
          <h3>Verified On-Chain</h3>
          <p>Every retirement is recorded immutably on Regen Ledger. No double-counting, no greenwashing.</p>
        </div>
        <div class="trust-item">
          <h3>Not Carbon Offset</h3>
          <p>Regenerative contribution funds real ecological projects — carbon, biodiversity, and beyond.</p>
        </div>
        <div class="trust-item">
          <h3>Open Source</h3>
          <p>Full transparency. Inspect the MCP server, verify the retirements, audit the code yourself.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <section class="footer">
    <div class="container">
      <a class="cta-btn" href="#pricing">Choose Your Plan</a>
      <p>Powered by <a href="https://regen.network">Regen Network</a></p>
      <p><a href="https://github.com/regen-network/regen-compute">GitHub</a></p>
    </div>
  </section>

  ${hasPriceIds ? `<script>
    function subscribe(tier) {
      var body = { tier: tier };
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

</body>
</html>`);
  });

  /**
   * POST /subscribe
   * Body: { tier: "seedling"|"grove"|"forest", email?: string, referral_code?: string }
   * Returns: { url: "https://checkout.stripe.com/..." }
   *
   * Creates a Stripe Checkout Session in subscription mode.
   * If a valid referral_code is provided, the subscription gets a 30-day free trial.
   */
  router.post("/subscribe", async (req: Request, res: Response) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { tier, email, referral_code } = body ?? {};

      if (!tier || !["seedling", "grove", "forest"].includes(tier)) {
        res.status(400).json({ error: 'tier must be "seedling", "grove", or "forest"' });
        return;
      }

      // Resolve price ID for the tier
      const priceIdMap: Record<string, string | undefined> = {
        seedling: config?.stripePriceIdSeedling,
        grove: config?.stripePriceIdGrove,
        forest: config?.stripePriceIdForest,
      };

      const priceId = priceIdMap[tier];
      if (!priceId) {
        // Fall back to Payment Links
        const linkMap: Record<string, string> = {
          seedling: config?.stripePaymentLinkSeedling ?? "#",
          grove: config?.stripePaymentLinkGrove ?? "#",
          forest: config?.stripePaymentLinkForest ?? "#",
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

      // Credit balance
      creditBalance(
        db,
        user.id,
        amountCents,
        session.id,
        `Stripe top-up: $${(amountCents / 100).toFixed(2)}`
      );

      console.log(
        `Balance credited: user=${user.id} amount=$${(amountCents / 100).toFixed(2)} balance=$${((user.balance_cents + amountCents) / 100).toFixed(2)}`
      );
    } else if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionCreated(db, sub, stripe);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionUpdated(db, sub);
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      handleSubscriptionDeleted(db, sub);
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      handleInvoicePaid(db, invoice);
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
          "I just subscribed to Regenerative Compute — funding verified ecological regeneration from my AI sessions. Use my link for a free first month:"
        );
        const shareUrl = encodeURIComponent(referralLink);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Regenerative Compute — Thank You!</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
    .hero-box { background: linear-gradient(135deg, #2d6a4f, #40916c, #52b788); color: #fff; border-radius: 16px; padding: 40px 32px; text-align: center; margin: 24px 0; }
    .hero-box h1 { margin: 0 0 12px; font-size: 28px; font-weight: 700; }
    .hero-box p { margin: 0; opacity: 0.92; font-size: 17px; }
    .impact-box { background: #f0f7f4; border-radius: 12px; padding: 28px; margin: 28px 0; }
    .impact-box h2 { color: #2d6a4f; margin: 0 0 12px; font-size: 20px; }
    .impact-box p { margin: 0 0 10px; color: #333; }
    .impact-box ul { margin: 12px 0 0; padding-left: 20px; color: #444; }
    .impact-box ul li { margin-bottom: 6px; }
    .learn-link { display: inline-block; margin-top: 16px; color: #2d6a4f; font-weight: 600; text-decoration: none; border-bottom: 2px solid #b7e4c7; padding-bottom: 1px; }
    .learn-link:hover { border-color: #2d6a4f; }
    .setup-section { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px 28px; margin: 28px 0; }
    .setup-section h2 { color: #2d6a4f; margin: 0 0 8px; font-size: 18px; }
    .setup-section .subtitle { color: #666; font-size: 14px; margin: 0 0 16px; }
    .setup-section p { margin: 8px 0; }
    .api-key { font-family: monospace; font-size: 13px; background: #fff; border: 1px solid #d4d4d4; padding: 8px 12px; border-radius: 6px; word-break: break-all; display: block; margin: 8px 0; user-select: all; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    pre { background: #1a1a1a; color: #e0e0e0; padding: 14px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 8px 0 16px; }
    .toggle-btn { background: none; border: none; color: #2d6a4f; font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
    .toggle-btn:hover { color: #1b4332; }
    .setup-details { display: none; margin-top: 16px; }
    .referral-box { background: #faf5ff; border: 2px solid #c4b5fd; border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center; }
    .referral-box h2 { color: #7c3aed; margin: 0 0 8px; font-size: 20px; }
    .referral-box p { color: #555; margin: 4px 0 16px; }
    .ref-link { font-family: monospace; font-size: 14px; background: #fff; border: 1px solid #d8b4fe; padding: 10px 14px; border-radius: 8px; display: block; margin: 12px 0; word-break: break-all; cursor: pointer; user-select: all; }
    .share-btns { display: flex; gap: 10px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
    .share-btn { display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 8px; text-decoration: none; color: #fff; transition: opacity 0.15s; }
    .share-btn:hover { opacity: 0.88; }
    .share-x { background: #1a1a1a; }
    .share-linkedin { background: #0a66c2; }
    .share-copy { background: #6b7280; cursor: pointer; border: none; color: #fff; font-size: 14px; font-weight: 600; border-radius: 8px; padding: 10px 20px; }
    .footer-links { text-align: center; color: #999; font-size: 13px; margin: 32px 0 16px; }
    .footer-links a { color: #2d6a4f; text-decoration: none; }
    .footer-links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="hero-box">
    <h1>Thank you for being part of this.</h1>
    <p>While you use AI for your life and your work, you're now also rewarding the people and projects creating real ecological impact around the world.</p>
  </div>

  <div class="impact-box">
    <h2>What your subscription does</h2>
    <p>Every month, we pool contributions from subscribers like you and retire verified ecological credits on <strong>Regen Network</strong> — a public blockchain purpose-built for climate and biodiversity action.</p>
    <ul>
      <li><strong>Real impact</strong> — your money goes directly to projects restoring forests, protecting biodiversity, and regenerating land</li>
      <li><strong>Permanently recorded</strong> — every retirement is on-chain, immutable, and verifiable by anyone</li>
      <li><strong>You'll get a monthly email</strong> with a certificate showing exactly what was retired on your behalf</li>
    </ul>
    <p>This isn't a carbon offset. It's a direct contribution to ecological regeneration.</p>
    <a class="learn-link" href="https://app.regen.network" target="_blank" rel="noopener">Learn more about Regen Network and ecocredits &rarr;</a>
  </div>

  <div class="setup-section">
    <h2>Connect to your AI assistant (optional)</h2>
    <p class="subtitle">If you use Claude Code, Cursor, or another AI tool that supports MCP, you can connect your subscription so your assistant can check your impact and retire credits on your behalf. <em>Skip this if you'd rather just let your monthly subscription do the work.</em></p>
    <button class="toggle-btn" onclick="toggleSetup()">Show setup instructions</button>
    <div class="setup-details" id="setupDetails">
      <p><strong>Your API Key</strong></p>
      <span class="api-key">${user.api_key}</span>
      <p style="font-size: 13px; color: #666; margin-bottom: 16px;">This key links your AI assistant to your subscription. Copy it somewhere safe.</p>
      <p><strong>Step 1.</strong> Install the MCP server:</p>
      <pre>claude mcp add -s user regen-compute -- npx regen-compute</pre>
      <p><strong>Step 2.</strong> Set your API key (add to your shell profile or <code>.env</code>):</p>
      <pre>export REGEN_API_KEY=${user.api_key}
export REGEN_BALANCE_URL=${baseUrl}</pre>
      <p><strong>That's it.</strong> Your assistant can now show your subscription status and ecological impact. Try asking: <em>"What's my regenerative compute impact?"</em></p>
    </div>
  </div>

  <div class="referral-box">
    <h2>Give a Friend Their First Month Free</h2>
    <p>Share your link and your friend gets 30 days free. You earn bonus credit retirements.</p>
    <span class="ref-link" onclick="copyLink()" id="refLink">${referralLink}</span>
    <div class="share-btns">
      <a class="share-btn share-x" href="${twitterUrl}" target="_blank" rel="noopener">Post on X</a>
      <a class="share-btn share-linkedin" href="${linkedinUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
      <button class="share-copy" onclick="copyLink()">Copy Link</button>
    </div>
  </div>

  <div class="footer-links">
    <a href="${baseUrl}/manage?email=${encodeURIComponent(email)}">Manage subscription</a>
    &middot;
    <a href="${baseUrl}/dashboard">Dashboard</a>
    &middot;
    <a href="https://app.regen.network" target="_blank" rel="noopener">Regen Marketplace</a>
  </div>

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
  </script>
</body>
</html>`);
      } else {
        // One-time payment success page (existing)
        const amountDollars = (session.amount_total ?? 0) / 100;

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Regenerative Compute — Payment Successful</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { color: #2d6a4f; }
    .key-box { background: #f0f7f4; border: 2px solid #2d6a4f; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .api-key { font-family: monospace; font-size: 14px; background: #fff; border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; word-break: break-all; display: block; margin: 8px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    pre { background: #1a1a1a; color: #e0e0e0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    .balance { font-size: 24px; font-weight: bold; color: #2d6a4f; }
  </style>
</head>
<body>
  <h1>Payment Successful</h1>
  <p>You've added <strong>$${amountDollars.toFixed(2)}</strong> to your Regenerative Compute balance.</p>
  <p>Current balance: <span class="balance">$${(user.balance_cents / 100).toFixed(2)}</span></p>

  <div class="key-box">
    <strong>Your API Key</strong>
    <span class="api-key">${user.api_key}</span>
    <p><strong>Save this key!</strong> You'll need it to connect your AI assistant.</p>
  </div>

  <h2>Setup (30 seconds)</h2>

  <p><strong>1. Install the MCP server</strong> (if you haven't already):</p>
  <pre>claude mcp add -s user regen-compute -- npx regen-compute</pre>

  <p><strong>2. Set your API key</strong> — add to your shell profile or <code>.env</code>:</p>
  <pre>export REGEN_API_KEY=${user.api_key}
export REGEN_BALANCE_URL=${baseUrl}</pre>

  <p><strong>3. Done!</strong> In Claude Code, just say "retire 1 carbon credit" and it'll happen automatically from your prepaid balance.</p>

  <h2>What happens next</h2>
  <ul>
    <li>Your AI assistant checks your balance before each retirement</li>
    <li>Credits are retired on-chain on Regen Network with verifiable proof</li>
    <li>When your balance gets low, you'll be prompted to top up</li>
  </ul>

  <p><a href="${baseUrl}/checkout-page">Top up again</a></p>
</body>
</html>`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Success page error:", msg);
      res.status(500).send("Error loading success page. Your payment was received — check back shortly.");
    }
  });

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
  <title>Regenerative Compute — Checkout Cancelled</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { color: #666; }
  </style>
</head>
<body>
  <h1>Checkout Cancelled</h1>
  <p>No payment was processed. <a href="/checkout-page">Try again</a> when you're ready.</p>
</body>
</html>`);
  });

  /**
   * GET /checkout-page
   * Landing page with Payment Link tiers.
   * Payment Links are configured via STRIPE_PAYMENT_LINK_* env vars.
   */
  router.get("/checkout-page", (_req: Request, res: Response) => {
    const seedlingUrl = config?.stripePaymentLinkSeedling ?? process.env.STRIPE_PAYMENT_LINK_SEEDLING ?? "#";
    const groveUrl = config?.stripePaymentLinkGrove ?? process.env.STRIPE_PAYMENT_LINK_GROVE ?? "#";
    const forestUrl = config?.stripePaymentLinkForest ?? process.env.STRIPE_PAYMENT_LINK_FOREST ?? "#";

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Regenerative Compute — Fund Ecological Regeneration</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { color: #2d6a4f; }
    .tiers { display: flex; gap: 16px; margin: 24px 0; }
    .tier { flex: 1; border: 2px solid #ddd; border-radius: 12px; padding: 20px; text-align: center; text-decoration: none; color: #1a1a1a; transition: border-color 0.2s, background 0.2s; display: block; }
    .tier:hover { border-color: #2d6a4f; background: #f0f7f4; }
    .tier-name { font-weight: bold; font-size: 18px; color: #2d6a4f; }
    .tier-price { font-size: 28px; font-weight: bold; margin: 8px 0; }
    .tier-desc { font-size: 13px; color: #666; }
    .info { background: #f0f7f4; border-left: 4px solid #2d6a4f; padding: 12px 16px; margin: 20px 0; }
    .steps { margin: 24px 0; }
    .steps li { margin-bottom: 8px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Regenerative Compute</h1>
  <p>Fund verified ecological regeneration from your AI sessions. Pay once, retire credits seamlessly from Claude Code.</p>

  <div class="info">
    <strong>How it works:</strong> Pick a tier below, pay with your card, and you'll get an API key. Your AI assistant will use your prepaid balance to retire ecocredits on-chain — no need to leave your coding session.
  </div>

  <div class="tiers">
    <a class="tier" href="${seedlingUrl}">
      <div class="tier-name">Seedling</div>
      <div class="tier-price">$5</div>
      <div class="tier-desc">~1 carbon credit<br>~125 sessions</div>
    </a>
    <a class="tier" href="${groveUrl}">
      <div class="tier-name">Grove</div>
      <div class="tier-price">$10</div>
      <div class="tier-desc">~2.5 carbon credits<br>~250 sessions</div>
    </a>
    <a class="tier" href="${forestUrl}">
      <div class="tier-name">Forest</div>
      <div class="tier-price">$25</div>
      <div class="tier-desc">~6 carbon credits<br>~625 sessions</div>
    </a>
  </div>

  <h2>After payment</h2>
  <ol class="steps">
    <li>You'll receive an API key on the confirmation page</li>
    <li>Install the MCP: <code>claude mcp add -s user regen-compute -- npx regen-compute</code></li>
    <li>Set your key: <code>export REGEN_API_KEY=your_key</code> and <code>export REGEN_BALANCE_URL=${baseUrl}</code></li>
    <li>In Claude, say "retire 1 carbon credit" — it happens automatically from your balance</li>
  </ol>
</body>
</html>`);
  });

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
      topup_url: `${baseUrl}/checkout-page`,
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
        topup_url: `${baseUrl}/checkout-page`,
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
function amountToPlan(amountCents: number): "seedling" | "grove" | "forest" {
  if (amountCents <= 200) return "seedling";
  if (amountCents <= 500) return "grove";
  return "forest";
}

/** Map Stripe subscription status to our subscriber status */
function stripeStatusToLocal(status: string): "active" | "paused" | "cancelled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "paused") return "paused";
  return "cancelled";
}

async function handleSubscriptionCreated(db: Database.Database, sub: Stripe.Subscription, stripe: Stripe) {
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

    const amountCents = sub.items?.data?.[0]?.price?.unit_amount ?? 0;
    const plan = amountToPlan(amountCents);
    const periodStart = (sub as unknown as Record<string, unknown>).current_period_start
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_start as number) * 1000).toISOString()
      : undefined;
    const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end
      ? new Date(((sub as unknown as Record<string, unknown>).current_period_end as number) * 1000).toISOString()
      : undefined;

    createSubscriber(db, user.id, stripeSubId, plan, amountCents, periodStart, periodEnd);
    console.log(`Subscription created: ${stripeSubId} plan=${plan} amount=$${(amountCents / 100).toFixed(2)}`);

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

    const amountCents = sub.items?.data?.[0]?.price?.unit_amount ?? existing.amount_cents;
    const plan = amountToPlan(amountCents);
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
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    console.log(`Subscription updated: ${stripeSubId} plan=${plan} status=${status}`);
  } catch (err) {
    console.error("Error handling subscription.updated:", err instanceof Error ? err.message : err);
  }
}

function handleSubscriptionDeleted(db: Database.Database, sub: Stripe.Subscription) {
  try {
    const stripeSubId = sub.id;
    updateSubscriberStatus(db, stripeSubId, "cancelled");
    console.log(`Subscription cancelled: ${stripeSubId}`);
  } catch (err) {
    console.error("Error handling subscription.deleted:", err instanceof Error ? err.message : err);
  }
}

function handleInvoicePaid(db: Database.Database, invoice: Stripe.Invoice) {
  try {
    // In Stripe SDK v20+, subscription is nested under parent.subscription_details
    const subDetails = invoice.parent?.subscription_details;
    const subRef = subDetails?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return; // Not a subscription invoice

    const existing = getSubscriberByStripeId(db, subId);
    if (!existing) return; // Not tracked

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
  } catch (err) {
    console.error("Error handling invoice.paid:", err instanceof Error ? err.message : err);
  }
}
