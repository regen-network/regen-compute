#!/bin/bash
# Regenerative Compute — Production Health Query
# Runs on the DO server via SSH, outputs JSON health report

cd /opt/regen-compute

# Master wallet balance (USDC + REGEN) via LCD — the Aug 2026 incident root cause
# was this wallet running dry with no alert. Non-fatal if the LCD is down.
LCD_URL=$(grep -E "^REGEN_LCD_URL=" .env 2>/dev/null | cut -d= -f2-)
LCD_URL=${LCD_URL:-https://rest-regen.ecostake.com}
MASTER_ADDR=${MASTER_WALLET_ADDRESS:-regen13hdw80n5c9yueg4mgvap82v2dcsl8dq50j00dh}
export WALLET_JSON=$(curl -s -m 10 "$LCD_URL/cosmos/bank/v1beta1/balances/$MASTER_ADDR" 2>/dev/null)
export MASTER_ADDR

node -e '
const Database = require("better-sqlite3");
const db = new Database("data/regen-compute.db");

// ─── Helpers ───
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;
function stripeFee(gross) { return Math.round(gross * STRIPE_PERCENT) + STRIPE_FIXED_CENTS; }

// ─── Queries ───
const subscribers = db.prepare(`
  SELECT s.*, u.email FROM subscribers s JOIN users u ON s.user_id = u.id ORDER BY s.id
`).all();

const retirements = db.prepare(`SELECT * FROM subscriber_retirements ORDER BY id`).all();

const batches = db.prepare(`SELECT * FROM subscriber_retirement_batches ORDER BY id`).all();

const burnAcc = db.prepare(`SELECT * FROM burn_accumulator ORDER BY id`).all();

const scheduled = db.prepare(`SELECT * FROM scheduled_retirements ORDER BY id`).all();
const schedById = new Map(scheduled.map(s => [s.id, s]));
const batchesByRet = new Map();
batches.forEach(b => { if (!batchesByRet.has(b.retirement_id)) batchesByRet.set(b.retirement_id, []); batchesByRet.get(b.retirement_id).push(b); });

// ─── Classification ───
// Since the Sep 2026 prepaid ledger (subscribers.prepaid_credits_cents), a recurring
// cycle whose credits budget is covered by a subscriber prepaid over-retirement
// balance is recorded with budget > 0, $0 spent and NO batches — that is success,
// not failure. Separately, cycles that failed during the Aug 2026 wallet drain and
// were later completed (their scheduled row is now "completed") are resolved.
function linkedSched(r) {
  const m = /^scheduled-(\d+)$/.exec(r.payment_id || "");
  return m ? schedById.get(Number(m[1])) : undefined;
}
function isPrepaidCovered(r) {
  return r.credits_budget_cents > 0 && r.total_spent_cents === 0 &&
    r.total_credits_retired === 0 && (batchesByRet.get(r.id) || []).length === 0;
}
function isResolvedFailure(r) {
  if (r.total_credits_retired !== 0) return false;
  const sr = linkedSched(r);
  return !!sr && sr.status === "completed";
}
const prepaidCovered = retirements.filter(isPrepaidCovered);
const resolvedIds = new Set(retirements.filter(r => isPrepaidCovered(r) || isResolvedFailure(r)).map(r => r.id));
const prepaidRemainingCents = subscribers.reduce((s, x) => s + (x.prepaid_credits_cents || 0), 0);
const nowIso = new Date().toISOString();
const activeYearlySubs = subscribers.filter(s => s.billing_interval === "yearly" && s.status === "active" &&
  (!s.current_period_end || s.current_period_end > nowIso));

// ─── Master wallet ───
let wallet = { usdc: null, regen: null, error: null };
try {
  const wj = JSON.parse(process.env.WALLET_JSON || "");
  const find = d => wj.balances.find(b => d(b.denom));
  const usdc = find(d => d.startsWith("ibc/334740505537E9894A64E8561030695016481830D7B36E6A9B6D13C608B55653"));
  const regen = find(d => d === "uregen");
  wallet = { usdc: usdc ? Number(usdc.amount) / 1e6 : 0, regen: regen ? Number(regen.amount) / 1e6 : 0, error: null };
} catch (e) { wallet.error = "LCD unavailable"; }

// ─── Compute metrics ───
const totalGross = retirements.reduce((s, r) => s + r.gross_amount_cents, 0);
const totalNet = retirements.reduce((s, r) => s + r.net_amount_cents, 0);
const totalCreditsBudget = retirements.reduce((s, r) => s + r.credits_budget_cents, 0);
const totalCreditsSpent = retirements.reduce((s, r) => s + r.total_spent_cents, 0);
const totalBurnBudget = retirements.reduce((s, r) => s + r.burn_budget_cents, 0);
const totalOps = retirements.reduce((s, r) => s + r.ops_budget_cents, 0);
const totalRetired = retirements.reduce((s, r) => s + r.total_credits_retired, 0);
const totalBurnAcc = burnAcc.reduce((s, e) => s + e.amount_cents, 0);
const burnPending = burnAcc.filter(e => !e.executed).reduce((s, e) => s + e.amount_cents, 0);
const burnExecuted = burnAcc.filter(e => e.executed).reduce((s, e) => s + e.amount_cents, 0);

// ─── Reconciliation checks ───
const checks = [];

// C: Split integrity
let splitErrors = 0;
retirements.forEach(r => {
  if (Math.abs((r.credits_budget_cents + r.burn_budget_cents + r.ops_budget_cents) - r.net_amount_cents) > 1)
    splitErrors++;
});
checks.push({ id: "C", name: "Split Integrity", pass: splitErrors === 0,
  detail: splitErrors ? splitErrors + " failures" : "All " + retirements.length + " pass" });

// D: Credits budget flow
const batchBudget = batches.reduce((s, b) => s + b.budget_cents, 0);
const prepaidBudget = prepaidCovered.reduce((s, r) => s + r.credits_budget_cents, 0);
const onChainBudget = totalCreditsBudget - prepaidBudget;
// Per-retirement mismatches. Rows created before the 2026-09-03 merged-batch fix
// can have legs whose batch rows were overwritten by the old replace bug (known,
// e.g. #182); those are reported but do not fail the check. Anything newer does.
const BATCH_FIX_DATE = "2026-09-03";
const budgetMismatches = retirements.filter(r => !isPrepaidCovered(r)).map(r => {
  const bb = (batchesByRet.get(r.id) || []).reduce((s, b) => s + b.budget_cents, 0);
  return { id: r.id, created: r.created_at, gapCents: r.credits_budget_cents - bb };
}).filter(m => Math.abs(m.gapCents) >= 2);
const legacyGaps = budgetMismatches.filter(m => m.created < BATCH_FIX_DATE);
const newGaps = budgetMismatches.filter(m => m.created >= BATCH_FIX_DATE);
const fmtGaps = g => g.map(m => "#" + m.id + " $" + (m.gapCents/100).toFixed(2)).join(", ");
checks.push({ id: "D", name: "Credits Budget Flow", pass: newGaps.length === 0,
  detail: "On-chain budget: $" + (onChainBudget/100).toFixed(2) + " (excl. $" + (prepaidBudget/100).toFixed(2) +
    " prepaid-covered), Batches: $" + (batchBudget/100).toFixed(2) +
    (newGaps.length ? " — MISMATCH " + fmtGaps(newGaps) : "") +
    (legacyGaps.length ? " (legacy pre-fix gaps: " + fmtGaps(legacyGaps) + ")" : "") });

// E: Spend <= Budget
checks.push({ id: "E", name: "Credits Spend <= Budget", pass: totalCreditsSpent <= totalCreditsBudget + 1,
  detail: "Spent: $" + (totalCreditsSpent/100).toFixed(2) + " / Budget: $" + (totalCreditsBudget/100).toFixed(2) });

// I: Cash conservation
const splitSum = totalCreditsBudget + totalBurnBudget + totalOps;
checks.push({ id: "I", name: "Cash Conservation", pass: Math.abs(splitSum - totalNet) < 10,
  detail: "Net: $" + (totalNet/100).toFixed(2) + ", Split sum: $" + (splitSum/100).toFixed(2) });

// M: Scheduled retirements for yearly subs
const yearlySubs = activeYearlySubs;
const schedIssues = [];
yearlySubs.forEach(s => {
  const count = scheduled.filter(sr => sr.subscriber_id === s.id).length;
  if (count !== 11) schedIssues.push("Sub " + s.id + ": " + count + "/11");
});
checks.push({ id: "M", name: "Yearly Scheduled Retirements", pass: schedIssues.length === 0,
  detail: schedIssues.length ? schedIssues.join(", ") : "All " + yearlySubs.length + " active yearly subs have 11 scheduled" });

// ─── Alerts ───
const alerts = [];

// Failed retirements with $0 credits
retirements.forEach(r => {
  if (r.total_credits_retired === 0 && r.credits_budget_cents > 0 && !resolvedIds.has(r.id)) {
    const sub = subscribers.find(s => s.id === r.subscriber_id);
    alerts.push({ priority: "HIGH", category: "Failed Retirement",
      detail: "Ret #" + r.id + " for Sub " + r.subscriber_id + " (" + (sub?.email||"?") + "): $" +
        (r.credits_budget_cents/100).toFixed(2) + " credits budget, $0 spent" });
  }
});

// Yearly subs missing scheduled retirements
yearlySubs.forEach(s => {
  const count = scheduled.filter(sr => sr.subscriber_id === s.id).length;
  const rets = retirements.filter(r => r.subscriber_id === s.id);
  if (count === 0 && rets.length <= 1) {
    const yearlyNet = s.amount_cents - stripeFee(s.amount_cents);
    const delivered = rets.reduce((sum, r) => sum + r.net_amount_cents, 0);
    const owed = (yearlyNet - delivered) / 100;
    alerts.push({ priority: "CRITICAL", category: "Missing Scheduled",
      detail: "Sub " + s.id + " (" + s.email + "): yearly " + s.plan + " with 0 scheduled rets. $" + owed.toFixed(2) + " owed" });
  }
});

// Failed scheduled retirements
const failedScheds = scheduled.filter(s => s.status === "failed");
if (failedScheds.length > 0) {
  alerts.push({ priority: "HIGH", category: "Failed Scheduled",
    detail: failedScheds.length + " scheduled retirements in failed status" });
}

// Subscribers with no retirements at all
subscribers.forEach(s => {
  if (!retirements.some(r => r.subscriber_id === s.id)) {
    alerts.push({ priority: "HIGH", category: "No Retirements",
      detail: "Sub " + s.id + " (" + s.email + "): active since " + s.created_at.slice(0,10) + " but 0 retirements" });
  }
});

// Unspent budget from failed batches
const openFailedBatches = batches.filter(b => b.error && !resolvedIds.has(b.retirement_id));
const unspentCents = openFailedBatches.reduce((s, b) => s + (b.budget_cents - b.spent_cents), 0);
if (unspentCents > 0) {
  alerts.push({ priority: "MEDIUM", category: "Unspent Budget",
    detail: "$" + (unspentCents/100).toFixed(2) + " credits budget unspent from " +
      openFailedBatches.length + " failed batches" });
}

// Master wallet low balance (Aug 2026 root cause)
if (wallet.error) {
  alerts.push({ priority: "MEDIUM", category: "Wallet Check", detail: "Could not read master wallet balance (" + wallet.error + ")" });
} else {
  if (wallet.usdc < 10) alerts.push({ priority: "CRITICAL", category: "Wallet USDC", detail: "Master wallet USDC $" + wallet.usdc.toFixed(2) + " — retirements will fail. Refill from MarketPlace2." });
  else if (wallet.usdc < 50) alerts.push({ priority: "HIGH", category: "Wallet USDC", detail: "Master wallet USDC $" + wallet.usdc.toFixed(2) + " — refill soon." });
  if (wallet.regen < 200) alerts.push({ priority: "HIGH", category: "Wallet REGEN", detail: "Master wallet REGEN " + wallet.regen.toFixed(0) + " — gas running low." });
}

// Burn never executed
if (burnPending > 0 && burnExecuted === 0) {
  alerts.push({ priority: "MEDIUM", category: "Burn Pending",
    detail: "$" + (burnPending/100).toFixed(2) + " accumulated, $0 burned" });
}

// ─── MRR / ARR ───
const monthlyRev = subscribers.filter(s => s.billing_interval === "monthly" && s.status === "active")
  .reduce((sum, s) => sum + s.amount_cents, 0);
const yearlyRev = subscribers.filter(s => s.billing_interval === "yearly" && s.status === "active")
  .reduce((sum, s) => sum + s.amount_cents, 0);
const mrr = (monthlyRev + Math.round(yearlyRev / 12)) / 100;
const arr = mrr * 12;

// ─── Output ───
const report = {
  timestamp: new Date().toISOString(),
  metrics: {
    subscribers: { total: subscribers.length, active: subscribers.filter(s => s.status === "active").length,
      monthly: subscribers.filter(s => s.billing_interval === "monthly").length,
      yearly: subscribers.filter(s => s.billing_interval === "yearly").length },
    revenue: { grossCents: totalGross, netCents: totalNet, mrr, arr },
    credits: { budgetCents: totalCreditsBudget, spentCents: totalCreditsSpent,
      retired: totalRetired, unspentCents: totalCreditsBudget - totalCreditsSpent },
    burn: { accumulatedCents: totalBurnAcc, pendingCents: burnPending, executedCents: burnExecuted },
    ops: { totalCents: totalOps },
    prepaid: { coveredCycles: prepaidCovered.length, coveredCents: prepaidBudget, remainingCents: prepaidRemainingCents,
      subsWithBalance: subscribers.filter(s => (s.prepaid_credits_cents || 0) > 0).length },
    wallet: { address: process.env.MASTER_ADDR, usdc: wallet.usdc, regen: wallet.regen, error: wallet.error },
    retirements: { total: retirements.length, batchesTotal: batches.length,
      failedBatches: batches.filter(b => b.error).length,
      scheduledPending: scheduled.filter(s => s.status === "pending").length,
      scheduledFailed: scheduled.filter(s => s.status === "failed").length }
  },
  checks,
  alerts: alerts.sort((a, b) => {
    const p = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (p[a.priority] || 4) - (p[b.priority] || 4);
  }),
  subscribers: subscribers.map(s => ({
    id: s.id, email: s.email, plan: s.plan, billing: s.billing_interval,
    status: s.status, regen_address: s.regen_address,
    retirements: retirements.filter(r => r.subscriber_id === s.id).length,
    creditsRetired: retirements.filter(r => r.subscriber_id === s.id)
      .reduce((sum, r) => sum + r.total_credits_retired, 0),
    scheduledPending: scheduled.filter(sr => sr.subscriber_id === s.id && sr.status === "pending").length
  }))
};

console.log(JSON.stringify(report));

db.close();
'
