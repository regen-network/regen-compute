/**
 * x402 Payment Protocol middleware for the Developer API.
 *
 * Self-settling implementation — does NOT use @x402/express, @x402/core, or
 * @x402/evm packages. Implements the x402 protocol headers directly and
 * verifies payments on-chain using our own crypto-verify.ts infrastructure.
 *
 * When X402_ENABLED=true:
 *
 * 1. Requests with a valid API key → pass through (existing auth, untouched)
 * 2. Requests with a `payment-signature` header → verify on-chain + provision
 * 3. Unauthenticated requests → 402 response with payment requirements
 *
 * After successful payment verification, the middleware provisions a user +
 * subscriber and includes the API key in a custom response header so the
 * agent can reuse it for subsequent calls without paying again.
 */

import type { Request, Response, NextFunction } from "express";
import type Database from "better-sqlite3";
import {
  getUserByApiKey,
  createUser,
  createSubscriber,
  getCryptoPaymentByTxHash,
  createCryptoPayment,
  updateCryptoPaymentStatus,
  getAllSubscribersByUserId,
  type User,
} from "./db.js";
import { verifyPayment, getEvmChainCoingeckoId } from "../services/crypto-verify.js";
import { toUsdCents } from "../services/crypto-price.js";
import { deriveSubscriberAddress } from "../services/subscriber-wallet.js";

// --- Constants ---

const EVM_PAY_TO = "0x0687cC26060FE12Fd4A6210c2f30Cf24a9853C6b";

// Pricing: $0.01 per request (Agent tier $5/mo / ~3000 requests/mo)
const PRICE_USDC = "0.01";
const PRICE_USD_DISPLAY = "$0.01";

// Minimum payment to provision a subscription ($1.25 = Dabbler monthly)
const MIN_PAYMENT_USD_CENTS = 125;

// USDC contract addresses per chain (for payment requirements)
const USDC_CONTRACTS: Record<string, string> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",   // Ethereum
  "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  // Polygon
};

// CAIP-2 chain ID → our internal chain name
const CAIP2_TO_CHAIN: Record<string, string> = {
  "eip155:1": "ethereum",
  "eip155:8453": "base",
  "eip155:137": "polygon",
  "eip155:42161": "arbitrum",
  "eip155:10": "optimism",
  "eip155:43114": "avalanche",
  "eip155:56": "bnb",
  "eip155:59144": "linea",
  "eip155:324": "zksync",
  "eip155:534352": "scroll",
  "eip155:5000": "mantle",
  "eip155:81457": "blast",
  "eip155:42220": "celo",
  "eip155:100": "gnosis",
  "eip155:250": "fantom",
  "eip155:34443": "mode",
};

// Internal chain name → CAIP-2 (reverse mapping)
const CHAIN_TO_CAIP2: Record<string, string> = {};
for (const [caip2, chain] of Object.entries(CAIP2_TO_CHAIN)) {
  CHAIN_TO_CAIP2[chain] = caip2;
}

// Protected route patterns — matches routes behind auth in api-routes.ts
const PROTECTED_PREFIXES = [
  "/api/v1/retire",
  "/api/v1/credits",
  "/api/v1/footprint",
  "/api/v1/certificates/",
  "/api/v1/impact",
  "/api/v1/subscription",
];

// Public endpoints that should never trigger 402
const PUBLIC_PATHS = [
  "/api/v1/openapi.json",
  "/api/v1/payment-info",
  "/api/v1/confirm-payment",
];

// --- Payment requirement builder ---

function buildPaymentRequirements(baseUrl: string): object {
  const accepts = [];
  for (const [network, usdcAddress] of Object.entries(USDC_CONTRACTS)) {
    accepts.push({
      scheme: "exact",
      network,
      maxAmountRequired: PRICE_USDC,
      resource: `${baseUrl}/api/v1/*`,
      description: "Regen Compute API — per-request payment",
      mimeType: "application/json",
      payTo: EVM_PAY_TO,
      maxTimeoutSeconds: 300,
      asset: `erc20:${usdcAddress}`,
      extra: {
        name: "USDC",
        version: "1.0",
      },
    });
  }

  return {
    x402Version: 1,
    accepts,
    error: "X-PAYMENT-REQUIRED",
    description: "Payment required to access Regen Compute API",
    // Also include full payment info for clients that prefer the custom flow
    paymentInfo: {
      payTo: EVM_PAY_TO,
      networks: Object.keys(USDC_CONTRACTS),
      pricePerRequest: PRICE_USD_DISPLAY,
      minimumPayment: "$1.25",
      confirmEndpoint: `${baseUrl}/api/v1/confirm-payment`,
    },
  };
}

// --- Payment signature payload type ---

interface PaymentSignaturePayload {
  /** CAIP-2 chain identifier (e.g. "eip155:8453") or internal chain name (e.g. "base") */
  chain?: string;
  network?: string;
  /** Transaction hash */
  tx_hash?: string;
  txHash?: string;
  transaction?: string;
  /** Payer address (optional, derived from tx if not provided) */
  from?: string;
  payer?: string;
  /** Email for account binding (optional) */
  email?: string;
}

// --- Middleware factory ---

export interface X402MiddlewareOptions {
  db: Database.Database;
  baseUrl: string;
}

export function createX402Middleware(options: X402MiddlewareOptions) {
  const { db, baseUrl } = options;

  const paymentRequirements = buildPaymentRequirements(baseUrl);
  const paymentRequirementsBase64 = Buffer.from(
    JSON.stringify(paymentRequirements)
  ).toString("base64");

  // --- The middleware ---

  return async function x402Middleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Only intercept API routes that require auth
      const path = req.path;
      const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(prefix),
      );
      const isPublic = PUBLIC_PATHS.includes(path);

      if (!isProtected || isPublic) {
        next();
        return;
      }

      // --- Step 1: Check for valid API key (bypass payment) ---
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const apiKey = authHeader.slice(7).trim();
        const user = getUserByApiKey(db, apiKey);
        if (user) {
          // Valid API key — let the normal auth middleware handle it
          next();
          return;
        }
        // Invalid API key — fall through to payment flow
      }

      // --- Step 2: Check for payment proof ---
      const paymentSigHeader =
        req.headers["payment-signature"] ||
        req.headers["x-payment-signature"] ||
        req.headers["payment"];

      if (paymentSigHeader && typeof paymentSigHeader === "string") {
        await handlePaymentProof(req, res, next, db, baseUrl, paymentSigHeader);
        return;
      }

      // --- Step 3: No auth, no payment — return 402 ---
      res.status(402);
      res.setHeader("X-Payment-Required", paymentRequirementsBase64);
      res.setHeader("Content-Type", "application/json");
      res.json({
        status: 402,
        error: "PAYMENT_REQUIRED",
        message:
          "Payment required. Send a crypto payment and include the proof in the Payment-Signature header, or use a valid API key.",
        x402: paymentRequirements,
        howTo: {
          option1: {
            description: "Pay with crypto via confirm-payment endpoint",
            endpoint: `POST ${baseUrl}/api/v1/confirm-payment`,
            body: '{ "chain": "base", "tx_hash": "0x...", "email": "you@example.com" }',
          },
          option2: {
            description: "Pay inline via x402 Payment-Signature header",
            header: "Payment-Signature: base64({ chain: 'eip155:8453', tx_hash: '0x...' })",
            note: "Send USDC to the payTo address, then retry with the tx proof in the header.",
          },
          payTo: EVM_PAY_TO,
          acceptedNetworks: Object.keys(USDC_CONTRACTS).map((caip2) => ({
            network: caip2,
            chain: CAIP2_TO_CHAIN[caip2] || caip2,
            token: "USDC",
          })),
          minimumPayment: "$1.25 (provisions a subscription)",
        },
      });
    } catch (err) {
      console.error("x402 middleware error:", err);
      // Don't crash the server — let the request through to normal auth
      next();
    }
  };
}

// --- Payment proof handler ---

async function handlePaymentProof(
  req: Request,
  res: Response,
  next: NextFunction,
  db: Database.Database,
  baseUrl: string,
  paymentSigHeader: string,
): Promise<void> {
  let payload: PaymentSignaturePayload;

  // Decode the payment signature header
  try {
    const decoded = Buffer.from(paymentSigHeader, "base64").toString("utf-8");
    payload = JSON.parse(decoded) as PaymentSignaturePayload;
  } catch {
    // Maybe it's raw JSON (not base64)
    try {
      payload = JSON.parse(paymentSigHeader) as PaymentSignaturePayload;
    } catch {
      res.status(400).json({
        error: "INVALID_PAYMENT_SIGNATURE",
        message:
          "Payment-Signature header must be base64-encoded JSON or raw JSON with { chain, tx_hash }",
      });
      return;
    }
  }

  // Extract fields (support multiple naming conventions)
  const rawChain = payload.chain || payload.network || "";
  const txHash = payload.tx_hash || payload.txHash || payload.transaction || "";
  const email = payload.email;

  if (!rawChain || !txHash) {
    res.status(400).json({
      error: "INVALID_PAYMENT_SIGNATURE",
      message: "Payment-Signature must include chain (CAIP-2 or name) and tx_hash",
    });
    return;
  }

  // Resolve chain name — accept CAIP-2 (eip155:8453) or internal name (base)
  const chain = CAIP2_TO_CHAIN[rawChain] || rawChain.toLowerCase().trim();

  // Check idempotency — already processed?
  const existing = getCryptoPaymentByTxHash(db, txHash);
  if (existing && existing.status === "provisioned" && existing.user_id) {
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(existing.user_id) as User | undefined;

    if (user) {
      // Already provisioned — set API key header and let through
      const settlementProof = {
        success: true,
        txHash,
        chain,
        apiKey: user.api_key,
        message: "Payment already verified and provisioned",
      };

      res.setHeader(
        "X-Payment-Response",
        Buffer.from(JSON.stringify(settlementProof)).toString("base64"),
      );
      // Attach user for downstream auth middleware
      req.headers.authorization = `Bearer ${user.api_key}`;
      next();
      return;
    }
  }

  // Verify on-chain
  let verified;
  try {
    verified = await verifyPayment(chain, txHash);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`x402 payment verification failed: ${msg}`);
    res.status(402).json({
      error: "PAYMENT_VERIFICATION_FAILED",
      message: `Could not verify transaction: ${msg}`,
      chain,
      txHash,
    });
    return;
  }

  if (!verified.confirmed) {
    res.status(402).json({
      error: "PAYMENT_NOT_CONFIRMED",
      message: `Transaction not yet confirmed (${verified.confirmations} confirmations). Retry shortly.`,
      chain,
      txHash,
    });
    return;
  }

  // Convert to USD cents
  let usdCents: number;
  try {
    usdCents = await toUsdCents(
      verified.token,
      verified.amount,
      verified.contractAddress,
      verified.contractAddress ? getEvmChainCoingeckoId(verified.chain) : undefined,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`x402 USD conversion failed: ${msg}`);
    res.status(402).json({
      error: "PRICE_CONVERSION_FAILED",
      message: `Could not convert payment to USD: ${msg}`,
    });
    return;
  }

  if (usdCents < MIN_PAYMENT_USD_CENTS) {
    res.status(402).json({
      error: "PAYMENT_TOO_SMALL",
      message: `Payment too small: $${(usdCents / 100).toFixed(2)}. Minimum is $${(MIN_PAYMENT_USD_CENTS / 100).toFixed(2)}.`,
    });
    return;
  }

  // Record the payment
  const cryptoPayment = createCryptoPayment(db, {
    chain: verified.chain,
    tx_hash: verified.txHash,
    from_address: verified.fromAddress,
    token: verified.token,
    amount: verified.amount,
    usd_value_cents: usdCents,
  });

  // Find or create user
  const contactEmail =
    typeof email === "string" && email.includes("@")
      ? email.trim().toLowerCase()
      : null;

  let user: User | undefined;

  // Check if sender address already has an associated user
  if (verified.fromAddress) {
    const existingPayment = db
      .prepare(
        "SELECT user_id FROM crypto_payments WHERE from_address = ? AND user_id IS NOT NULL AND status = 'provisioned' LIMIT 1",
      )
      .get(verified.fromAddress) as { user_id: number } | undefined;

    if (existingPayment) {
      user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(existingPayment.user_id) as User | undefined;
    }
  }

  if (!user && contactEmail) {
    const { getUserByEmail } = await import("./db.js");
    user = getUserByEmail(db, contactEmail);
  }

  if (!user) {
    user = createUser(db, contactEmail, null);
  }

  // Calculate subscription duration (Agent rate: $5/mo)
  const monthlyRateCents = 500;
  const totalMonths = Math.max(1, Math.floor(usdCents / monthlyRateCents));
  const isLifetime = totalMonths >= 600;
  const subscriptionMonths = isLifetime ? 99999 : totalMonths;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + subscriptionMonths);

  const plan =
    usdCents >= 5000 ? "agent" : usdCents >= 2500 ? "builder" : "dabbler";
  const caip2Chain = CHAIN_TO_CAIP2[verified.chain] || verified.chain;
  const subId = `x402_${caip2Chain}_${verified.txHash.slice(0, 16)}`;

  // Check if subscriber already exists (idempotency)
  const existingSub = db
    .prepare("SELECT id FROM subscribers WHERE stripe_subscription_id = ?")
    .get(subId) as { id: number } | undefined;

  if (!existingSub) {
    const subscriber = createSubscriber(
      db,
      user.id,
      subId,
      plan,
      usdCents,
      now.toISOString(),
      periodEnd.toISOString(),
      "yearly",
    );

    // Derive Regen address
    let regenAddr: string | null = null;
    try {
      const existingSubs = getAllSubscribersByUserId(db, user.id);
      const existingAddr = existingSubs.find(
        (s) => s.regen_address && s.id !== subscriber.id,
      )?.regen_address;
      regenAddr = existingAddr ?? (await deriveSubscriberAddress(subscriber.id));
      db.prepare("UPDATE subscribers SET regen_address = ? WHERE id = ?").run(
        regenAddr,
        subscriber.id,
      );
    } catch {
      /* non-critical */
    }

    // Record as provisioned crypto payment
    try {
      updateCryptoPaymentStatus(
        db,
        cryptoPayment.id,
        "provisioned",
        subscriber.id,
        user.id,
      );
    } catch {
      /* may fail on unique constraint */
    }

    // Front-load burn budget (5% of payment)
    const burnBudgetCents = Math.max(1, Math.floor(usdCents * 0.05));
    try {
      db.prepare(
        "INSERT INTO burn_accumulator (amount_cents, source_type, subscriber_id) VALUES (?, 'crypto_payment', ?)",
      ).run(burnBudgetCents, subscriber.id);
    } catch {
      /* non-critical */
    }

    console.log(
      `x402 self-settled: ${verified.fromAddress} on ${verified.chain} tx ${verified.txHash.slice(0, 16)}... → user ${user.id} ($${(usdCents / 100).toFixed(2)})`,
    );
  }

  // Build settlement proof response header
  const settlementProof = {
    success: true,
    txHash: verified.txHash,
    chain: verified.chain,
    network: caip2Chain,
    payer: verified.fromAddress,
    amount: verified.amount,
    token: verified.token,
    usdValue: (usdCents / 100).toFixed(2),
    apiKey: user.api_key,
    plan,
    expiresAt: isLifetime ? "never" : periodEnd.toISOString().split("T")[0],
  };

  res.setHeader(
    "X-Payment-Response",
    Buffer.from(JSON.stringify(settlementProof)).toString("base64"),
  );

  // Set the API key header so downstream auth middleware recognizes the user
  req.headers.authorization = `Bearer ${user.api_key}`;
  next();
}
