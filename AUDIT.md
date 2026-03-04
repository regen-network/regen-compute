# Regen Compute — Developer Audit

**Auditor:** Darren Zal (Regen AI)
**Date:** 2026-03-03
**Repo:** regen-compute v0.3.0
**Scope:** Full codebase review (~4,500 LOC + ~1,000 LOC tests)

---

## Executive Summary

**Overall assessment: Solid foundation, well-structured, thoughtful design — but has several issues that need fixing before real money flows through.**

What's good:
- Clean TypeScript, strict mode, ESM — no legacy JS patterns
- Two-phase payment provider abstraction (authorize → capture → refund) is well-designed
- Graceful degradation everywhere — every error falls back to marketplace links
- Database schema is well-normalized with proper FK constraints, WAL mode, transactions
- Revenue split math (85/5/10) handles rounding correctly — remainders go to ops/USS
- Good MCP server patterns — conditional tool registration, proper annotations, server instructions
- Comprehensive subscription flow (Stripe webhooks, referrals, magic links, customer portal)

What needs work:
- **3 security issues** that could cause real problems in production
- **Floating-point arithmetic** used for financial calculations throughout
- **No idempotency protection** on on-chain transactions
- **Dependency vulnerabilities** (cosmjs/elliptic) with known advisories
- **No rate limiting** despite config field for it

---

## Security Findings

### S1 — CRITICAL: Webhook Signature Bypass

**File:** `src/server/routes.ts:570-573`
**Severity:** Critical

When `STRIPE_WEBHOOK_SECRET` is not configured, the webhook endpoint accepts **any** POST body as a valid Stripe event, with no verification:

```typescript
// In test mode without webhook secret, parse the raw body
const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
event = (typeof body === "string" ? JSON.parse(body) : body) as Stripe.Event;
```

**Impact:** An attacker can POST fake `checkout.session.completed` events to credit arbitrary balances, create subscribers, or trigger referral rewards. This is fine for local dev but **must not reach production without the webhook secret**.

**Fix:** Either:
1. Require `STRIPE_WEBHOOK_SECRET` in production (fail startup without it), or
2. Only accept unverified webhooks when `NODE_ENV === "development"`

### S2 — HIGH: No Rate Limiting

**File:** `src/config.ts:122` (config exists), no middleware applied
**Severity:** High

`apiRateLimit: 100` is configured but never used. No rate limiting middleware exists on any route. The `/debit`, `/checkout`, `/subscribe`, and `/webhook` endpoints are all unprotected.

**Impact:** Financial endpoints can be hammered. The `/subscribe` endpoint creates Stripe Checkout Sessions, which have API costs. The `/debit` endpoint, while auth-protected, could be abused with a stolen API key.

**Fix:** Add express-rate-limit middleware, at minimum on `/webhook`, `/checkout`, `/subscribe`, `/debit`.

### S3 — MEDIUM: Magic Link TOCTOU Race

**File:** `src/server/db.ts:717-727`
**Severity:** Medium

`verifyMagicLinkToken()` performs SELECT then UPDATE as separate statements, not wrapped in a transaction:

```typescript
const row = db.prepare("SELECT * FROM magic_links WHERE token = ? AND used = 0").get(token);
if (!row) return null;
if (new Date(row.expires_at) < new Date()) return null;
db.prepare("UPDATE magic_links SET used = 1 WHERE token = ?").run(token);
```

**Impact:** Two concurrent requests with the same token could both pass the SELECT check. Use a single atomic UPDATE with a WHERE clause, or wrap in a transaction.

**Fix:**
```typescript
const row = db.prepare(
  "UPDATE magic_links SET used = 1 WHERE token = ? AND used = 0 AND expires_at > datetime('now') RETURNING email"
).get(token) as { email: string } | undefined;
return row?.email ?? null;
```

### S4 — HIGH: Dependency Vulnerabilities

**npm audit:** 9 vulnerabilities (4 low, 5 high)

| Package | Issue | Severity |
|---------|-------|----------|
| `@cosmjs/crypto` <=0.33.1 | Uses `elliptic` with risky crypto implementation | High |
| `axios` (transitive) | CSRF, SSRF, DoS vulnerabilities | High |
| `@confio/ics23` | Unmaintained | Low |

The `@cosmjs/crypto` issue is the most concerning — it handles wallet key derivation. The `@regen-network/api` package pins old `@cosmjs` versions. Fix requires either:
1. Upgrading `@regen-network/api` to a version using `@cosmjs` >=0.34.0, or
2. Replacing the wallet code with direct `@cosmjs` >=0.34.0 imports

### S5 — LOW: Wallet Mnemonics in Memory

**Files:** `src/services/wallet.ts:16`, `src/services/evm-wallet.ts:39`

Both wallet services cache mnemonics as module-level singletons (`let _wallet`). This is standard for CosmJS but means the mnemonic lives in plaintext in process memory for the entire server lifetime.

**Mitigation:** Acceptable for an MCP server (short-lived), but for the HTTP payment server (long-lived), consider using a KMS or at least zeroing the mnemonic after wallet init.

---

## Correctness Issues

### C1 — HIGH: Floating-Point Financial Math

Multiple files use `parseFloat()` and floating-point arithmetic for amounts that represent real money:

| Location | Code | Issue |
|----------|------|-------|
| `order-selector.ts:124` | `parseFloat(order.quantity)` | Sell order quantities are strings; float conversion loses precision |
| `order-selector.ts:127` | `Math.min(remaining, available)` | Float subtraction accumulates errors across iterations |
| `order-selector.ts:131` | `BigInt(Math.ceil(take * 1_000_000))` | Float multiply before BigInt — e.g., `0.1 * 1000000 = 100000.00000000001` |
| `retirement.ts:169` | `parseFloat(selection.totalQuantity)` | String → float for display |
| `pool.ts:388` | `sub.amount_cents / totalRevenueCents` | Integer division gives float fraction |
| `pool.ts:324` | `parseFloat(finalSelection.totalQuantity)` | Same pattern |
| `evm-wallet.ts:110` | `Math.round(amountUsdc * 10 ** decimals)` | Float multiply for token amounts |

**Impact:** Over many orders, the greedy fill loop in order-selector accumulates rounding errors. For small quantities, users might overpay or underpay by fractions of a micro-unit. For pool runs with many subscribers, attribution fractions may not sum to exactly 1.0.

**Fix:** Use a decimal library (e.g., `decimal.js`) or keep all amounts as BigInt micro-units throughout. The `totalCostMicro` field already uses BigInt correctly — extend this pattern to quantities.

### C2 — MEDIUM: No Idempotency on On-Chain Transactions

**File:** `src/services/retirement.ts`

`executeRetirement()` has no mechanism to prevent double-execution. If called twice in quick succession:
1. Both calls pass `checkPrepaidBalance()`
2. Both calls pass `provider.authorizePayment()` (crypto provider just checks balance)
3. Both calls `signAndBroadcast()` — two transactions hit the chain

**Impact:** Double-spend of user's wallet funds. The prepaid balance would be debited twice as well.

**Fix:** Use a nonce/mutex pattern — either:
- A local lock (mutex) around the retirement flow
- An idempotency key passed by the caller, checked against recent tx hashes
- At minimum, re-check balance after acquiring a lock

### C3 — MEDIUM: Hardcoded Marketplace Project Link

**File:** `src/services/retirement.ts:89-91`

```typescript
return `${config.marketplaceUrl}/projects/1?buying_options_filters=credit_card`;
```

Always links to project ID "1" regardless of the credit class being retired. If the user asked to retire biodiversity credits (BT01), they'd get a link to project 1 (likely a carbon project).

**Fix:** Either make the project ID dynamic based on `creditClass`, or link to the marketplace search page with a credit type filter.

### C4 — LOW: formatBurnResult Label Error

**File:** `src/services/pool.ts:241`

```typescript
`--- REGEN Burn (10%) ---`
```

The burn allocation is actually **5%** of revenue (`REVENUE_SPLIT.burn = 0.05`). The 10% is operations. This is a display-only bug but could confuse auditors.

### C5 — LOW: Gas Price Hardcoded

**File:** `src/services/wallet.ts:50`

```typescript
gasPrice: GasPrice.fromString("0.025uregen"),
```

Gas is set to `auto` for estimation multiplier but the base gas price is hardcoded. During network congestion or governance-changed gas minimums, transactions could fail.

**Fix:** Make configurable via `REGEN_GAS_PRICE` env var, with 0.025uregen as default.

---

## Code Quality Issues

### Q1 — No Structured Logging

All logging uses `console.log`/`console.error` with string interpolation. No log levels, no structured JSON, no request correlation IDs.

For a production payment server, structured logging (e.g., pino or winston) would help with debugging, monitoring, and audit trails.

### Q2 — Error Swallowing

Several catch blocks silently discard errors:

| Location | Pattern |
|----------|---------|
| `retirement.ts:253` | `try { await provider.refundPayment(auth.id); } catch { /* ignore */ }` |
| `retirement.ts:50` | `catch { return null; }` |
| `wallet.ts:41` | `regenProtoRegistry as ReadonlyArray<[string, any]>` |

While graceful degradation is the right pattern for an MCP tool, the payment server should log these. A failed refund is something you want to know about.

### Q3 — HTML Templates in Route Handlers

`src/server/routes.ts` contains ~500 lines of inline HTML template strings. This is functional but makes the code hard to maintain and increases XSS surface area. The HTML rendering works but mixing presentation with business logic creates a large file.

Consider: Extract to a simple template engine, or use a static HTML file served separately.

### Q4 — Test Coverage Gaps

The 3 test files cover ecobridge, pool, and evm-wallet — all with mocked dependencies. No tests exist for:
- `retirement.ts` (core business logic)
- `order-selector.ts` (financial routing)
- `routes.ts` (HTTP API)
- `wallet.ts` (signing)

The most critical untested code is `order-selector.ts` — the greedy fill algorithm with floating-point math.

---

## Phase 2 Blockers

### P1 — Stripe PaymentIntents Stub

**File:** `src/services/payment/stripe-stub.ts` (45 LOC)

Three methods return "not implemented":
- `authorizePayment()` → should create a Stripe PaymentIntent with `capture_method: "manual"`
- `capturePayment()` → should call `stripe.paymentIntents.capture()`
- `refundPayment()` → should call `stripe.paymentIntents.cancel()` or `stripe.refunds.create()`

The `PaymentProvider` interface is well-designed for this. The gap is wiring it to the Stripe SDK.

### P2 — No Pool-Run Scheduler

The CLI `npx regen-compute pool-run` works, but there's no automated trigger. Options:
1. External cron job (simplest): `0 0 1 * * npx regen-compute pool-run`
2. Internal scheduler (node-cron)
3. Cloud scheduler (AWS EventBridge, GCP Cloud Scheduler)

### P3 — No Dashboard Authentication

The dashboard routes use magic link auth, but the actual dashboard implementation isn't in the reviewed code. The magic link flow exists in db.ts but the dashboard route handler would need to verify sessions.

---

## Recommended PRs (Priority Order)

### PR 1: Fix Webhook Signature Bypass (Critical)
- Add `NODE_ENV` check — reject unverified webhooks in production
- Add startup validation: warn or fail if `STRIPE_WEBHOOK_SECRET` not set in production
- ~20 lines changed in `routes.ts`

### PR 2: Fix Floating-Point Financial Math (High)
- Replace `parseFloat()` with string-based decimal math in `order-selector.ts`
- Use BigInt consistently for all quantity calculations
- Add unit tests for edge cases (exact amounts, tiny fractions, multi-order fill)
- ~100 lines changed across `order-selector.ts`, `pool.ts`

### PR 3: Add Rate Limiting (High)
- `npm install express-rate-limit`
- Apply rate limiter to `/webhook`, `/checkout`, `/subscribe`, `/debit`
- Use the existing `apiRateLimit` config value
- ~30 lines in `server/index.ts` or `routes.ts`

### PR 4: Fix Magic Link Race Condition (Medium)
- Replace SELECT+UPDATE with atomic UPDATE in `verifyMagicLinkToken`
- ~10 lines in `db.ts`

### PR 5: Fix Minor Bugs (Low)
- Fix burn percentage label (5% not 10%)
- Make gas price configurable
- Fix hardcoded marketplace project link
- ~15 lines across 3 files

---

## Summary for Christian

Your codebase is well-structured and shows good engineering judgment. The MCP server design, payment provider abstraction, and graceful degradation patterns are solid. The architecture will scale to Phase 2 and 3 cleanly.

The items that need attention before real money flows:
1. **Set `STRIPE_WEBHOOK_SECRET` in production** — without it, anyone can fake payment events
2. **Add rate limiting** — your config has the field, just needs middleware
3. **Be careful with floating-point math in order-selector** — consider using a decimal library for financial calculations
4. **Upgrade `@cosmjs` dependencies** when `@regen-network/api` releases a version with `@cosmjs` >=0.34.0

Everything else is polish. The Stripe stub, pool scheduler, and dashboard are known Phase 2 items.
