# Regen Compute — Accounting System Spec

**Purpose:** Build a Google Sheets accounting workbook and a matching `/admin/accounting` endpoint that serve as the financial source of truth for Regen Compute. This spec contains everything needed to build both.

**Audience for the spreadsheet:** Christian Shearer (co-founder) and his CFO. Must be human-readable, not just machine-parseable.

**Audience for this spec:** An autonomous Claude Code instance that will implement both the spreadsheet template and the admin endpoint. Read this entire document before writing any code.

---

## 1. System Overview

Regen Compute is a subscription service. Subscribers pay via Stripe. Revenue is split three ways:
1. **Credits** — buy and retire ecological credits on Regen Ledger
2. **Burn** — buy REGEN tokens on Osmosis DEX and burn them on Regen Network
3. **Operations** — retained by the company

### Revenue Split Rules
- **Monthly subscribers:** 75% credits / 5% burn / 20% operations (applied to net after Stripe fees)
- **Yearly subscribers:** 85% credits / 5% burn / 10% operations (applied to net after Stripe fees)
- **Stripe fees:** 2.9% + $0.30 per payment
- **Yearly burn is front-loaded:** When a yearly subscriber pays, the FULL burn budget (5% of total net) is accumulated immediately. Credit retirements are spread over 12 months.

### Key Invariant
For every dollar of net revenue:
```
credits_budget + burn_budget + ops_budget = net_revenue
```
This must hold for every single payment, no exceptions.

---

## 2. Data Sources

### 2.1 Internal Database (SQLite — `data/regen-compute.db`)

The production database is on Digital Ocean at `137.184.182.54`, path `/opt/regen-compute/data/regen-compute.db`. Access via:
```bash
ssh root@137.184.182.54 "cd /opt/regen-compute && set -a && source .env && set +a && node -e '
const Database = require(\"better-sqlite3\");
const db = new Database(\"data/regen-compute.db\");
// ... queries ...
db.close();
'"
```

**Key tables and their roles:**

#### `subscribers`
Each row = one subscription. Links to `users` table for email.
```
id, user_id, stripe_subscription_id, plan, amount_cents, billing_interval, status, created_at
```
- `amount_cents`: Monthly price for monthly subs, YEARLY price for yearly subs
- `plan`: seedling ($1.25/mo), grove ($2.50/mo), forest ($5/mo), dabbler ($1.25/mo or $12.50/yr), builder ($2.50/mo), agent ($50/yr)
- `billing_interval`: "monthly" or "yearly"

#### `subscriber_retirements`
Each row = one retirement execution (triggered by Stripe payment or scheduled monthly portion).
```
id, subscriber_id, gross_amount_cents, net_amount_cents, credits_budget_cents, burn_budget_cents,
ops_budget_cents, total_credits_retired, total_spent_cents, payment_id, created_at
```
- For monthly subs: `gross_amount_cents` = subscriber's `amount_cents`
- For yearly subs: first month shows the original yearly gross, subsequent months show the monthly portion gross (~yearly/12)
- `payment_id`: Stripe invoice ID, "manual-..." for manual triggers, "scheduled-..." for scheduled monthly portions
- `total_credits_retired`: may be less than what credits_budget_cents could buy (if orders failed)
- `total_spent_cents`: actual cents spent on credit purchases (may be less than credits_budget_cents)

#### `subscriber_retirement_batches`
Per-batch detail for each retirement. Each retirement targets 3 credit batches (set by `monthly_credit_selection`).
```
id, retirement_id, batch_denom, credit_class_id, credit_type_abbrev,
budget_cents, spent_cents, credits_retired, buy_tx_hash, send_retire_tx_hash, error
```
- `buy_tx_hash` and `send_retire_tx_hash` are the same (atomic tx) when successful
- `error` is non-null when a batch purchase failed
- Credit types: C (carbon), BT (biodiversity/Terrasos), USS (umbrella species stewardship)

#### `scheduled_retirements`
For yearly subscribers — 11 future monthly portions (months 2-12).
```
id, subscriber_id, gross_amount_cents, net_amount_cents, billing_interval,
scheduled_date, status, error, executed_at
```
- `status`: pending, running, completed, partial, failed
- `scheduled_date`: "YYYY-MM-DD" — processed daily when date <= today
- `net_amount_cents`: pre-computed monthly net (yearly net / 12, no double Stripe fee)

#### `burn_accumulator`
Each row = one burn budget deposit. Summed to get pending burn total.
```
id, amount_cents, executed, created_at
```
- `executed`: 0 = pending, 1 = swap-and-burn completed
- Sources: per-retirement burn allocation (monthly subs), or front-loaded full-year burn (yearly subs)
- Backfill entries exist for 4 yearly subs that were under-accumulated (ids 6-9, created 2026-03-14)

#### `monthly_credit_selection`
Which 3 credit batches are targeted each month.
```
month, batch1_denom, batch1_name, batch2_denom, batch2_name, batch3_denom, batch3_name, featured_batch
```

#### `transactions`
Stripe payment records. Currently type="subscription" for subscription payments.
```
id, user_id, type, amount_cents, description, stripe_session_id, stripe_subscription_id,
billing_interval, retirement_tx_hash, credit_class, credits_retired, created_at
```

#### `burns` (legacy — from pool_runs era, before subscriber_retirements)
```
id, pool_run_id, allocation_cents, amount_uregen, amount_regen, regen_price_usd, tx_hash, status, error
```
- May have historical data from before the current system

### 2.2 Stripe
- Stripe dashboard: `dashboard.stripe.com` (Regen Network account)
- Key data: gross revenue, fees, net payouts, individual invoices
- Cross-check: Stripe's "Gross volume" should match SUM(gross_amount_cents) from subscriber_retirements + any unprocessed payments
- Stripe subscription IDs are in `subscribers.stripe_subscription_id`

### 2.3 Regen Ledger (On-Chain)
- **LCD endpoint:** `https://lcd-regen.keplr.app`
- **Indexer GraphQL:** `https://api.regen.network/indexer/v1/graphql`
- **Master wallet address:** `regen13hdw80n5c9yueg4mgvap82v2dcsl8dq50j00dh`
- **Subscriber addresses:** Derived via HD path `m/44'/118'/0'/0/{subscriberId}` from same mnemonic

Queryable:
- Retirement records: `allRetirements(condition: { owner: "regen13hdw80n5c9yueg4mgvap82v2dcsl8dq50j00dh" })` — every credit retired by our wallet
- Balances: `GET /cosmos/bank/v1beta1/balances/{address}` — current wallet holdings
- Transaction details: search by tx hash for each retirement

### 2.4 Osmosis (On-Chain)
- **Osmosis wallet address:** `osmo13hdw80n5c9yueg4mgvap82v2dcsl8dq5cthrdp` (same mnemonic, different prefix)
- **RPC:** `https://rpc.osmosis.zone`
- Queryable: swap transactions, IBC transfers, current balances (ATOM, OSMO, REGEN IBC)

---

## 3. Spreadsheet Architecture — 7 Tabs

### Tab 1: Revenue Ledger

**One row per Stripe payment received.** This is the top of the funnel.

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Payment Date | date | `subscriber_retirements.created_at` or Stripe invoice date | |
| Subscriber ID | int | `subscriber_retirements.subscriber_id` | |
| Email | string | `users.email` via subscribers.user_id | |
| Plan | string | `subscribers.plan` | seedling/grove/forest/dabbler/builder/agent |
| Billing Interval | string | `subscribers.billing_interval` | monthly/yearly |
| Payment ID | string | `subscriber_retirements.payment_id` | Stripe invoice ID or manual/scheduled ID |
| Gross Amount ($) | currency | `subscriber_retirements.gross_amount_cents / 100` | What customer paid |
| Stripe Fee ($) | currency | Calculated: `round(gross * 0.029) + 0.30` | For monthly & first yearly payment only |
| Net Amount ($) | currency | `subscriber_retirements.net_amount_cents / 100` | Cross-check: gross - stripe_fee = net (for non-precomputed) |
| Is Yearly Monthly Portion | boolean | True if `payment_id` starts with "scheduled-" | These have precomputed net, no additional Stripe fee |

**Totals row:**
- Total Gross, Total Stripe Fees, Total Net
- **Cross-check A:** Total Gross should match Stripe dashboard "Gross volume" for the period
- **Cross-check B:** For non-scheduled payments: Net = Gross - Stripe Fee (within rounding)

**Special handling for yearly subscribers:**
- Row 1 (payment month): Shows full yearly gross in Gross column, but Net = precomputed yearly net / 12 (first month's portion)
- Rows 2-12 (scheduled months): Gross = yearly/12, Net = precomputed monthly net, Stripe Fee = $0 (already deducted)
- A separate "Yearly Summary" section should show: Full Gross, Full Stripe Fee, Full Net, confirming the 12 monthly portions sum to the correct total

### Tab 2: Revenue Split

**One row per retirement execution, showing the 3-way split.** Mirrors subscriber_retirements.

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Date | date | `subscriber_retirements.created_at` | |
| Subscriber ID | int | | |
| Email | string | | |
| Billing Interval | string | | |
| Net Revenue ($) | currency | `net_amount_cents / 100` | From Tab 1 |
| Split Rule | string | "75/5/20" or "85/5/10" | Based on billing_interval |
| Credits Budget ($) | currency | `credits_budget_cents / 100` | |
| Burn Budget ($) | currency | `burn_budget_cents / 100` | |
| Ops Budget ($) | currency | `ops_budget_cents / 100` | |
| Split Check | formula | `credits + burn + ops = net?` | Must be TRUE for every row |

**Totals row:**
- Total Net, Total Credits Budget, Total Burn Budget, Total Ops Budget
- **Cross-check C:** Sum of all three budgets = Total Net (zero tolerance)
- **Cross-check D:** Total Credits Budget here = Total Credits Budget on Tab 3

**IMPORTANT — Yearly Burn Front-Loading:**
A separate section on this tab should show:

| Subscriber ID | Email | Yearly Gross | Yearly Net | Full Burn (5%) | Accumulated in burn_accumulator | Delta |
|--|--|--|--|--|--|--|
| 10 | waheedz706@gmail.com | $12.50 | $11.84 | $0.59 | $0.59 | $0.00 |
| 13 | durgadas@mac.com | $50.00 | $48.25 | $2.41 | $2.41 | $0.00 |
| 14 | todd.y@roots.coop | $50.00 | $48.25 | $2.41 | $2.41 | $0.00 |
| 15 | todd.y@roots.coop | $50.00 | $48.25 | $2.41 | $2.41 | $0.00 |

Delta must be $0.00 for all. If not, a backfill is needed.

### Tab 3: Credit Retirements

**One row per batch purchase attempt.** Maps from subscriber_retirement_batches.

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Date | date | `subscriber_retirement_batches.created_at` | |
| Subscriber ID | int | via retirement_id → subscriber_retirements | |
| Email | string | | |
| Retirement ID | int | `retirement_id` | Links to Tab 2 |
| Batch Denom | string | `batch_denom` | e.g., "C02-004-20210102-20211207-001" |
| Credit Class | string | `credit_class_id` | C02, BT01, USS01, etc. |
| Credit Type | string | `credit_type_abbrev` | C, BT, USS |
| Budget ($) | currency | `budget_cents / 100` | What was allocated to this batch |
| Spent ($) | currency | `spent_cents / 100` | What was actually spent |
| Unspent ($) | currency | `budget - spent` | Rounding remainder or failed purchase |
| Credits Retired | decimal | `credits_retired` | Quantity of ecological credits |
| Tx Hash | string | `buy_tx_hash` | Regen Ledger transaction hash |
| Error | string | `error` | Non-null = this batch failed |
| On-Chain Verified | boolean | **To be filled by reconciliation** | Query indexer for this tx hash |

**Totals row:**
- Total Budget, Total Spent, Total Unspent, Total Credits Retired
- **Cross-check E:** Total Budget = Total Credits Budget from Tab 2
- **Cross-check F:** Total Spent ≤ Total Budget
- **Cross-check G:** Every successful tx hash (error is null) should be verifiable on-chain

**Per-credit-type subtotals:**
| Credit Type | Credits Retired | Spent ($) |
|--|--|--|
| C (Carbon) | sum | sum |
| BT (Biodiversity) | sum | sum |
| USS (Umbrella Species) | sum | sum |

### Tab 4: Burn Ledger

**Two sections:** Accumulation (what's been deposited) and Execution (what's been swapped and burned).

**Section A — Accumulation:**
One row per `burn_accumulator` entry.

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| ID | int | `burn_accumulator.id` | |
| Date | date | `created_at` | |
| Amount ($) | currency | `amount_cents / 100` | |
| Source | string | Derived | "Subscriber X retirement" or "Yearly backfill — Sub X" |
| Executed | boolean | `executed` | 0 = pending, 1 = burned |

**Totals:**
- Total Accumulated, Total Executed, Total Pending
- **Cross-check H:** Total Accumulated (where executed=0) = Pending Burn Budget
- **Cross-check I:** Total Accumulated (all) should = Sum of all burn_budget_cents from subscriber_retirements + backfill entries

**Section B — Execution:**
One row per swap-and-burn execution.

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Execution Date | date | From swap-and-burn log | |
| Allocation ($) | currency | Input to swapAndBurn() | |
| REGEN Price (USD) | decimal | CoinGecko at time of swap | |
| Swap Input | string | Amount + denom (e.g., "4.87 ATOM") | |
| Swap Tx (Osmosis) | string | Osmosis tx hash | |
| REGEN Received | decimal | Actual output from swap | |
| IBC Tx | string | Osmosis tx hash | |
| Burn Tx (Regen) | string | Regen Ledger tx hash | |
| REGEN Burned | decimal | Actual amount burned | |
| Status | string | completed/partial/failed | |

**Cross-check J:** Sum of Allocation in Section B (status=completed) should = Sum of Accumulated (executed=1) in Section A
**Cross-check K:** Burn Tx hashes should be verifiable on Regen Ledger

### Tab 5: Operations

**One row per retirement's ops allocation.**

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Date | date | `subscriber_retirements.created_at` | |
| Subscriber ID | int | | |
| Ops Amount ($) | currency | `ops_budget_cents / 100` | |
| Cumulative Total ($) | currency | Running sum | |

**Totals:**
- Total Ops = Sum of all ops_budget_cents
- **Cross-check L:** Total Ops = Total Net Revenue - Total Credits Budget - Total Burn Budget

### Tab 6: Reconciliation Dashboard

**This is the "does everything add up?" tab.** Each row is a check with pass/fail.

| # | Check | Formula | Expected | Actual | Status |
|---|-------|---------|----------|--------|--------|
| A | Stripe Gross Match | Stripe dashboard gross = Tab 1 total gross | match | | ✅/❌ |
| B | Stripe Fee Calc | Each non-scheduled: net = gross - round(gross*0.029) - 0.30 | all match | | ✅/❌ |
| C | Split Integrity | Every row: credits + burn + ops = net | all TRUE | | ✅/❌ |
| D | Credits Budget Flow | Tab 2 total credits budget = Tab 3 total budget | match | | ✅/❌ |
| E | Credits Spend ≤ Budget | Tab 3 total spent ≤ Tab 3 total budget | TRUE | | ✅/❌ |
| F | Burn Accumulation Match | Sum(burn_budget from retirements) + backfills = Sum(burn_accumulator) | match | | ✅/❌ |
| G | Burn Pending Calc | Sum(burn_accumulator where executed=0) = stated pending | match | | ✅/❌ |
| H | Burn Execution Match | Sum(burn_accumulator where executed=1) = Sum(execution allocations) | match | | ✅/❌ |
| I | Cash Conservation | Net = Credits Spent + Burn Executed + Ops + Unallocated | match | | ✅/❌ |
| J | On-Chain Retirements | Indexer retirement count for our wallet = DB successful batch count | match | | ✅/❌ |
| K | On-Chain Burns | Ledger burn total for our wallet = DB burn total | match | | ✅/❌ |
| L | Yearly Burn Front-Load | Each yearly sub: full burn in accumulator = 5% of yearly net | all match | | ✅/❌ |
| M | Scheduled Retirements | For each yearly sub: 11 pending/completed scheduled = months 2-12 | all present | | ✅/❌ |

### Tab 7: Subscriber Summary

**One row per subscriber — lifetime view.**

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| Subscriber ID | int | `subscribers.id` | |
| Email | string | `users.email` | |
| Plan | string | `subscribers.plan` | |
| Billing | string | `billing_interval` | |
| Status | string | `subscribers.status` | |
| Sign-up Date | date | `subscribers.created_at` | |
| Monthly Price ($) | currency | For monthly: amount_cents/100. For yearly: amount_cents/1200 | |
| Total Paid (Gross) | currency | Sum of gross from Tab 1 for this sub | |
| Total Net | currency | Sum of net from Tab 1 for this sub | |
| → Credits Budget | currency | Sum from Tab 2 | |
| → Burn Budget | currency | Sum from Tab 2 | |
| → Ops Budget | currency | Sum from Tab 2 | |
| Credits Retired | decimal | Sum from Tab 3 (successful only) | |
| Credits Spent ($) | currency | Sum from Tab 3 | |
| Regen Address | string | Derived: `m/44'/118'/0'/0/{subscriberId}` | |
| Scheduled Remaining | int | Count of pending scheduled_retirements | |
| Retirement Count | int | Count of subscriber_retirements for this sub | |

---

## 4. Implementation: `/admin/accounting` Endpoint

Build a new route at `GET /admin/accounting` (authenticated via existing admin auth) that generates a JSON response with all 7 tabs' data, plus the reconciliation checks run automatically.

### Response structure:
```typescript
interface AccountingReport {
  generatedAt: string; // ISO timestamp
  period: { from: string; to: string }; // date range covered

  revenueLedger: RevenueLedgerRow[];
  revenueSplit: RevenueSplitRow[];
  creditRetirements: CreditRetirementRow[];
  burnLedger: {
    accumulation: BurnAccumulationRow[];
    executions: BurnExecutionRow[];
  };
  operations: OpsRow[];
  reconciliation: ReconciliationCheck[];
  subscriberSummary: SubscriberSummaryRow[];

  totals: {
    grossRevenue: number;
    stripeFees: number;
    netRevenue: number;
    creditsBudget: number;
    creditsSpent: number;
    burnBudget: number;
    burnExecuted: number;
    burnPending: number;
    opsBudget: number;
    totalCreditsRetired: number;
  };
}
```

### Implementation location:
Create a new file `src/server/accounting.ts` with the report generation logic. Register the route in `src/server/routes.ts`. The accounting module should:

1. Query all relevant DB tables
2. Calculate all derived fields (Stripe fees, split checks, etc.)
3. Run all reconciliation checks
4. Optionally query on-chain data (Regen indexer) for cross-checks J and K — this can be behind a `?onchain=true` query param since it's slower

### On-chain verification queries:

**Regen Indexer — all retirements by our wallet:**
```graphql
query {
  allRetirements(condition: { owner: "regen13hdw80n5c9yueg4mgvap82v2dcsl8dq50j00dh" }) {
    nodes {
      nodeId
      amount
      batchDenom
      jurisdiction
      reason
      txHash
      blockHeight
      timestamp
    }
  }
}
```

**Regen LCD — wallet balances:**
```
GET https://lcd-regen.keplr.app/cosmos/bank/v1beta1/balances/regen13hdw80n5c9yueg4mgvap82v2dcsl8dq50j00dh
```

---

## 5. Implementation: SQS Quote Sanity Check

**Separate from the spreadsheet but must be done in the same session.**

In `src/services/swap-and-burn.ts`, after receiving the SQS router quote, add a sanity check:

```typescript
// After: swapRoute = await getSwapRoute(...)
const quotedRegen = Number(swapRoute.amount_out) / 1_000_000;
const targetRegen = result.targetRegenAmount; // from CoinGecko price

if (quotedRegen > targetRegen * 2) {
  result.errors.push(
    `SQS quote looks wrong: quoted ${quotedRegen.toFixed(2)} REGEN but target is ` +
    `${targetRegen.toFixed(2)} REGEN (${(quotedRegen / targetRegen).toFixed(1)}x). ` +
    `Using target-based amount instead.`
  );
  // Fall back to target with 20% buffer for slippage
  swapRoute.amount_out = Math.floor(targetRegen * 1.2 * 1_000_000).toString();
}
```

And update the `minAmountOut` calculation:
```typescript
// Instead of just 97% of (potentially inflated) quote,
// use the lower of: 97% of quote OR 80% of target
const quoteBased = BigInt(swapRoute.amount_out) * 97n / 100n;
const targetBased = BigInt(Math.floor(targetRegen * 0.8 * 1_000_000));
const minAmountOut = (quoteBased < targetBased ? quoteBased : targetBased).toString();
```

This ensures:
- If the SQS quote is reasonable (~1-2x target), we use it with 3% slippage
- If the SQS quote is wildly inflated (>2x target), we cap it and use target-based slippage
- The minimum output never requires more than the market should deliver

---

## 6. Current Production Data Snapshot (as of 2026-03-14)

Include this in the spec so the implementer can validate their queries against known values.

### Subscribers: 15 active
| ID | Email | Plan | Amount | Interval |
|----|-------|------|--------|----------|
| 1 | samueljuliusbarnes@gmail.com | grove | $2.50 | monthly |
| 2 | ecowe@pm.me | seedling | $1.25 | monthly |
| 3 | christian@regen.network | seedling | $1.25 | monthly |
| 4 | loatree@gmail.com | grove | $2.50 | monthly |
| 5 | gregory@regen.network | forest | $5.00 | monthly |
| 6 | jeancarlobarrios@gmail.com | forest | $5.00 | monthly |
| 7 | todd.y@roots.coop | builder | $2.50 | monthly |
| 8 | matt@hydrex.fi | builder | $2.50 | monthly |
| 9 | mark.derugeriis@regen.network | dabbler | $1.25 | monthly |
| 10 | waheedz706@gmail.com | dabbler | $12.50 | yearly |
| 11 | christianshearer1@gmail.com | dabbler | $1.25 | monthly |
| 12 | meyersconsult@yahoo.com | builder | $2.50 | monthly |
| 13 | durgadas@mac.com | agent | $50.00 | yearly |
| 14 | todd.y@roots.coop | agent | $50.00 | yearly |
| 15 | todd.y@roots.coop | agent | $50.00 | yearly |

### Financial Summary
- Total Gross Processed: $57.72 (19 retirements)
- Total Net Processed: $40.10
- Total Credits Budget: $28.55
- Total Credits Spent: $28.55
- Total Credits Retired: ~1.011 credits
- Total Burn Budget (accumulated): $9.08 (includes $7.18 backfill for yearly subs)
- Burn Executed: $0.00 (pending — swap-and-burn not yet run)
- Total Ops Budget: $6.67
- Scheduled Retirements Pending: 33 (11 each for subs 13, 14, 15)

### Known Issues in Current Data
1. **Subscriber 3 (christian@regen.network)** has 5 retirements — some are test runs during development. Payment IDs are null for the first 4, "test-idempotent-real-001" for the 5th.
2. **Subscriber 12 (meyersconsult@yahoo.com)** retirement #14 shows 0 credits retired, 0 spent — the batch purchases all failed (no tradable orders available at the time).
3. **Early retirement batches** for C02 and USS01 have errors about insufficient funds (uusdc) and auto-retire conflicts — these were fixed by creating dedicated tradable sell orders (#322, #327, #328).
4. **Burn accumulator entries 6-9** are backfill entries added 2026-03-14 to correct under-accumulated yearly burn budgets.

---

## 7. Implementation Order

1. **SQS sanity check** (swap-and-burn.ts) — quick fix, do first
2. **`src/server/accounting.ts`** — the report generation module
3. **Register route** in routes.ts — `GET /admin/accounting` and `GET /admin/accounting.csv` (CSV export for Google Sheets import)
4. **HTML view** — `GET /admin/accounting` renders a styled HTML page with all 7 tabs as sections, using the existing brand.ts header/footer
5. **Test** — Run against production data, verify all cross-checks pass

### CSV Export Format
For Google Sheets import, generate one CSV per tab:
- `/admin/accounting/revenue-ledger.csv`
- `/admin/accounting/revenue-split.csv`
- `/admin/accounting/credit-retirements.csv`
- `/admin/accounting/burn-ledger.csv`
- `/admin/accounting/operations.csv`
- `/admin/accounting/reconciliation.csv`
- `/admin/accounting/subscriber-summary.csv`

Or a single endpoint that returns a ZIP of all CSVs: `/admin/accounting/export.zip`

---

## 8. Files to Read Before Starting

1. `CLAUDE.md` — project overview, tech stack, conventions
2. `src/server/db.ts` — full schema (lines 30-280)
3. `src/services/retire-subscriber.ts` — revenue split logic, Stripe fee calc, accumulateBurnBudget
4. `src/services/swap-and-burn.ts` — burn pipeline, SQS router, Osmosis swap
5. `src/server/routes.ts` — Stripe webhook handler (~line 1700+), scheduled retirement processor (~line 1950+), auto-burn trigger (~line 2020+)
6. `src/server/brand.ts` — HTML template components (header, footer, CSS)
7. `src/services/indexer.ts` — GraphQL client for on-chain queries

---

## 9. Deployment

After implementing, deploy to production:
```bash
scp <changed-files> root@137.184.182.54:/opt/regen-compute/<path>/
ssh root@137.184.182.54 "cd /opt/regen-compute && NODE_OPTIONS='--max-old-space-size=1024' npm run build && systemctl restart regen-compute"
```

Then verify: `curl https://compute.regen.network/admin/accounting` should return the report.

Note: The small droplet needs `NODE_OPTIONS='--max-old-space-size=1024'` for tsc builds.
