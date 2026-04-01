/**
 * Accounting service for Regen Compute.
 *
 * Provides a unified financial summary across all revenue streams,
 * credit purchases, REGEN burns, and operational allocations.
 *
 * Data sources:
 * - subscriber_retirements: per-payment revenue splits
 * - subscriber_retirement_batches: per-batch credit purchase details
 * - burn_accumulator: pending burn budget
 * - burns: executed REGEN burns
 * - transactions: payment history
 * - subscribers: active subscription state
 */

import type Database from "better-sqlite3";
import { calculateNetAfterStripe } from "./retire-subscriber.js";

// --- Types ---

export interface FinancialSummary {
  // Revenue
  totalGrossRevenueCents: number;
  totalStripeFeesCents: number;
  totalNetRevenueCents: number;

  // Allocation splits (from net revenue)
  totalCreditsBudgetCents: number;
  totalBurnBudgetCents: number;
  totalOpsBudgetCents: number;

  // Actual credit spending
  totalCreditsSpentCents: number;
  totalCreditsUnspentCents: number; // budget minus spent
  totalCreditsRetired: number;
  avgCostPerCredit: number | null; // cents per credit

  // REGEN burns
  totalBurnsPendingCents: number;
  totalBurnsExecutedCents: number;
  totalRegenBurned: number;
  totalBurnTxCount: number;
  avgRegenPriceAtBurn: number | null;

  // Operations
  totalOpsAvailableCents: number; // ops budget (not separately tracked as "spent")

  // Subscriber stats
  activeSubscriberCount: number;
  totalRetirementCount: number;
  monthlyRecurringRevenueCents: number; // MRR from active subs

  // Per-month breakdown
  monthlyBreakdown: MonthlyFinancials[];
}

export interface MonthlyFinancials {
  month: string; // YYYY-MM
  grossRevenueCents: number;
  netRevenueCents: number;
  creditsBudgetCents: number;
  creditsSpentCents: number;
  burnBudgetCents: number;
  opsBudgetCents: number;
  creditsRetired: number;
  retirementCount: number;
}

export interface BurnLedgerEntry {
  id: number;
  date: string;
  allocationCents: number;
  regenBurned: number;
  regenPriceUsd: number | null;
  txHash: string | null;
  status: string;
  source: "pool_run" | "swap_and_burn";
}

// --- Summary functions ---

/** Generate a full financial summary from all accounting data. */
export function getFinancialSummary(db: Database.Database): FinancialSummary {
  // Revenue totals from subscriber_retirements
  const revenueTotals = db.prepare(`
    SELECT
      COALESCE(SUM(gross_amount_cents), 0) AS total_gross,
      COALESCE(SUM(net_amount_cents), 0) AS total_net,
      COALESCE(SUM(credits_budget_cents), 0) AS total_credits_budget,
      COALESCE(SUM(burn_budget_cents), 0) AS total_burn_budget,
      COALESCE(SUM(ops_budget_cents), 0) AS total_ops_budget,
      COALESCE(SUM(total_spent_cents), 0) AS total_credits_spent,
      COALESCE(SUM(total_credits_retired), 0) AS total_credits_retired,
      COUNT(*) AS retirement_count
    FROM subscriber_retirements
  `).get() as any;

  const totalGross = revenueTotals.total_gross;
  const totalNet = revenueTotals.total_net;
  const totalFees = totalGross - totalNet;
  const totalCreditsSpent = revenueTotals.total_credits_spent;
  const totalCreditsRetired = revenueTotals.total_credits_retired;

  // Burn status
  const pendingBurn = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total
    FROM burn_accumulator WHERE executed = 0
  `).get() as { total: number };

  const executedBurns = db.prepare(`
    SELECT
      COALESCE(SUM(allocation_cents), 0) AS total_cents,
      COALESCE(SUM(amount_regen), 0) AS total_regen,
      COUNT(*) AS burn_count,
      AVG(regen_price_usd) AS avg_price
    FROM burns WHERE status = 'completed'
  `).get() as any;

  // Active subscribers and MRR
  const subStats = db.prepare(`
    SELECT
      COUNT(*) AS active_count,
      COALESCE(SUM(CASE WHEN billing_interval = 'yearly'
        THEN CAST(amount_cents AS REAL) / 12
        ELSE amount_cents END), 0) AS mrr
    FROM subscribers WHERE status = 'active'
  `).get() as { active_count: number; mrr: number };

  // Monthly breakdown
  const monthlyRows = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      SUM(gross_amount_cents) AS gross,
      SUM(net_amount_cents) AS net,
      SUM(credits_budget_cents) AS credits_budget,
      SUM(total_spent_cents) AS credits_spent,
      SUM(burn_budget_cents) AS burn_budget,
      SUM(ops_budget_cents) AS ops_budget,
      SUM(total_credits_retired) AS credits_retired,
      COUNT(*) AS retirement_count
    FROM subscriber_retirements
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month
  `).all() as any[];

  const monthlyBreakdown: MonthlyFinancials[] = monthlyRows.map((r) => ({
    month: r.month,
    grossRevenueCents: r.gross,
    netRevenueCents: r.net,
    creditsBudgetCents: r.credits_budget,
    creditsSpentCents: r.credits_spent,
    burnBudgetCents: r.burn_budget,
    opsBudgetCents: r.ops_budget,
    creditsRetired: r.credits_retired,
    retirementCount: r.retirement_count,
  }));

  return {
    totalGrossRevenueCents: totalGross,
    totalStripeFeesCents: totalFees,
    totalNetRevenueCents: totalNet,

    totalCreditsBudgetCents: revenueTotals.total_credits_budget,
    totalBurnBudgetCents: revenueTotals.total_burn_budget,
    totalOpsBudgetCents: revenueTotals.total_ops_budget,

    totalCreditsSpentCents: totalCreditsSpent,
    totalCreditsUnspentCents: revenueTotals.total_credits_budget - totalCreditsSpent,
    totalCreditsRetired: totalCreditsRetired,
    avgCostPerCredit: totalCreditsRetired > 0
      ? Math.round(totalCreditsSpent / totalCreditsRetired)
      : null,

    totalBurnsPendingCents: pendingBurn.total,
    totalBurnsExecutedCents: executedBurns.total_cents,
    totalRegenBurned: executedBurns.total_regen,
    totalBurnTxCount: executedBurns.burn_count,
    avgRegenPriceAtBurn: executedBurns.avg_price,

    totalOpsAvailableCents: revenueTotals.total_ops_budget,

    activeSubscriberCount: subStats.active_count,
    totalRetirementCount: revenueTotals.retirement_count,
    monthlyRecurringRevenueCents: Math.round(subStats.mrr),

    monthlyBreakdown,
  };
}

/** Get the full burn ledger (all burn records). */
export function getBurnLedger(db: Database.Database): BurnLedgerEntry[] {
  return db.prepare(`
    SELECT id, created_at AS date, allocation_cents, amount_regen,
           regen_price_usd, tx_hash, status
    FROM burns ORDER BY created_at DESC
  `).all().map((r: any) => ({
    id: r.id,
    date: r.date,
    allocationCents: r.allocation_cents,
    regenBurned: r.amount_regen || 0,
    regenPriceUsd: r.regen_price_usd,
    txHash: r.tx_hash,
    status: r.status,
    source: "pool_run" as const,
  }));
}

/** Format financial summary as a text report. */
export function formatFinancialReport(summary: FinancialSummary): string {
  const $ = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const pct = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

  const lines = [
    `═══════════════════════════════════════════════════`,
    `  REGENERATIVE COMPUTE — FINANCIAL SUMMARY`,
    `═══════════════════════════════════════════════════`,
    ``,
    `REVENUE`,
    `  Gross revenue (Stripe):     ${$(summary.totalGrossRevenueCents)}`,
    `  Stripe fees:               -${$(summary.totalStripeFeesCents)}`,
    `  Net revenue:                ${$(summary.totalNetRevenueCents)}`,
    ``,
    `ALLOCATION (of net revenue)`,
    `  Ecological credits (${pct(summary.totalCreditsBudgetCents, summary.totalNetRevenueCents)}):  ${$(summary.totalCreditsBudgetCents)}`,
    `  REGEN burn (${pct(summary.totalBurnBudgetCents, summary.totalNetRevenueCents)}):         ${$(summary.totalBurnBudgetCents)}`,
    `  Operations (${pct(summary.totalOpsBudgetCents, summary.totalNetRevenueCents)}):       ${$(summary.totalOpsBudgetCents)}`,
    ``,
    `ECOLOGICAL CREDITS`,
    `  Budget allocated:           ${$(summary.totalCreditsBudgetCents)}`,
    `  Actually spent:             ${$(summary.totalCreditsSpentCents)}`,
    `  Unspent (in wallet):        ${$(summary.totalCreditsUnspentCents)}`,
    `  Credits retired:            ${summary.totalCreditsRetired.toFixed(6)}`,
    summary.avgCostPerCredit !== null
      ? `  Avg cost per credit:        ${$(summary.avgCostPerCredit)}`
      : `  Avg cost per credit:        —`,
    ``,
    `REGEN BURN`,
    `  Total budget:               ${$(summary.totalBurnBudgetCents)}`,
    `  Pending (awaiting burn):    ${$(summary.totalBurnsPendingCents)}`,
    `  Executed:                   ${$(summary.totalBurnsExecutedCents)}`,
    `  REGEN burned:               ${summary.totalRegenBurned.toFixed(6)} REGEN`,
    `  Burn transactions:          ${summary.totalBurnTxCount}`,
    summary.avgRegenPriceAtBurn !== null
      ? `  Avg REGEN price at burn:    $${summary.avgRegenPriceAtBurn.toFixed(6)}`
      : ``,
    ``,
    `SUBSCRIBERS`,
    `  Active subscribers:         ${summary.activeSubscriberCount}`,
    `  Total retirements:          ${summary.totalRetirementCount}`,
    `  Monthly recurring revenue:  ${$(summary.monthlyRecurringRevenueCents)}/mo`,
  ];

  if (summary.monthlyBreakdown.length > 0) {
    lines.push(``);
    lines.push(`MONTHLY BREAKDOWN`);
    lines.push(`  Month      Gross     Net    Credits   Burn    Ops    Retired`);
    lines.push(`  ─────────  ────────  ──────  ────────  ──────  ──────  ───────`);
    for (const m of summary.monthlyBreakdown) {
      lines.push(
        `  ${m.month}    ${$(m.grossRevenueCents).padStart(8)}  ${$(m.netRevenueCents).padStart(6)}  ` +
        `${$(m.creditsBudgetCents).padStart(8)}  ${$(m.burnBudgetCents).padStart(6)}  ` +
        `${$(m.opsBudgetCents).padStart(6)}  ${m.creditsRetired.toFixed(4).padStart(7)}`
      );
    }
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════`);

  return lines.filter(l => l !== undefined).join("\n");
}
