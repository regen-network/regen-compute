#!/usr/bin/env npx tsx
/**
 * Stripe Product + Price Setup Script
 *
 * Creates the "Regen Compute" product and three monthly subscription
 * prices (Seedling $1.25, Grove $2.50, Forest $5) in your Stripe account.
 *
 * Prerequisites:
 *   1. Create a Stripe account at https://stripe.com (free)
 *   2. Copy your Secret Key from Dashboard → Developers → API Keys
 *   3. Set it: export STRIPE_SECRET_KEY=sk_test_...
 *
 * Usage:
 *   npx tsx scripts/stripe-setup.ts
 *
 * The script is idempotent — it checks for an existing product named
 * "Regen Compute" before creating a new one.
 */

import Stripe from "stripe";

const PRODUCT_NAME = "Regen Compute";
const TIERS = [
  { name: "Seedling", amount: 125, envVar: "STRIPE_PRICE_ID_SEEDLING" },
  { name: "Grove", amount: 250, envVar: "STRIPE_PRICE_ID_GROVE" },
  { name: "Forest", amount: 500, envVar: "STRIPE_PRICE_ID_FOREST" },
] as const;

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Error: STRIPE_SECRET_KEY is not set.");
    console.error("");
    console.error("To get your key:");
    console.error("  1. Go to https://dashboard.stripe.com/apikeys");
    console.error("  2. Copy the Secret key (starts with sk_test_ or sk_live_)");
    console.error("  3. Run: export STRIPE_SECRET_KEY=sk_test_...");
    console.error("  4. Then re-run this script");
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const mode = key.startsWith("sk_test_") ? "TEST" : "LIVE";
  console.log(`Stripe mode: ${mode}`);
  console.log("");

  // Check for existing product
  let productId: string | undefined;
  const existingProducts = await stripe.products.list({ limit: 100 });
  const existing = existingProducts.data.find((p) => p.name === PRODUCT_NAME && p.active);
  if (existing) {
    productId = existing.id;
    console.log(`Found existing product: ${PRODUCT_NAME} (${productId})`);
  } else {
    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "Monthly subscription that retires verified ecological credits on Regen Network. Regenerative contribution, not carbon offset.",
      metadata: {
        source: "regen-compute",
      },
    });
    productId = product.id;
    console.log(`Created product: ${PRODUCT_NAME} (${productId})`);
  }

  console.log("");

  // Create prices (or find existing)
  const envLines: string[] = [];

  for (const tier of TIERS) {
    // Check if a matching price already exists
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });
    const existingPrice = existingPrices.data.find(
      (p) =>
        p.unit_amount === tier.amount &&
        p.recurring?.interval === "month" &&
        p.currency === "usd"
    );

    if (existingPrice) {
      console.log(`  ${tier.name} ($${(tier.amount / 100).toFixed(2)}/mo): ${existingPrice.id} (existing)`);
      envLines.push(`${tier.envVar}=${existingPrice.id}`);
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: tier.amount,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: {
          tier: tier.name.toLowerCase(),
          source: "regen-compute",
        },
      });
      console.log(`  ${tier.name} ($${(tier.amount / 100).toFixed(2)}/mo): ${price.id} (created)`);
      envLines.push(`${tier.envVar}=${price.id}`);
    }
  }

  console.log("");
  console.log("Add these to your .env file:");
  console.log("─".repeat(50));
  for (const line of envLines) {
    console.log(line);
  }
  console.log("─".repeat(50));
  console.log("");
  console.log("Next steps:");
  console.log("  1. Copy the lines above into your .env file");
  console.log("  2. For local webhook testing:");
  console.log("     stripe listen --forward-to localhost:3141/webhook");
  console.log("     (copy the whsec_... secret into STRIPE_WEBHOOK_SECRET in .env)");
  console.log("  3. Start the server: npx regen-compute serve");
}

main().catch((err) => {
  console.error("Script failed:", err.message);
  process.exit(1);
});
