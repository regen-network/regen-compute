/**
 * One-off script: Retry 5 failed retirement batches for subscriber 3.
 *
 * Background (Mar 12, 2026):
 *   Retirements 1, 2, 3 each attempted 3 batches (C02-004, USS01-002, BT01).
 *   BT01 succeeded on all 3. USS01-002 succeeded on retirement 3 only.
 *   The failures:
 *     - 3x C02-004 (batch IDs 1, 4, 7): "insufficient funds" — wallet had 0 USDC
 *     - 2x USS01-002 (batch IDs 2, 5): "cannot disable auto-retire" — sell order didn't allow it
 *
 *   Both issues are now resolved:
 *     - Wallet funded with USDC (IBC denom on Regen)
 *     - Sell order #328 (USS01-002) now has disable_auto_retire=true
 *
 * Approach:
 *   For each failed batch, execute buy+send-retire on-chain, then update the
 *   DB record (clear error, set tx hash, credits_retired, spent_cents).
 *   Also update the parent retirement's totals.
 *
 * Usage: node dist/scripts/retry-failed-batches.js [--dry-run]
 */

import { initWallet, signAndBroadcast } from "../services/wallet.js";
import { listSellOrders, getAllowedDenoms, type SellOrder } from "../services/ledger.js";
import { loadConfig } from "../config.js";
import { getDb, getUserDisplayNameBySubscriberId } from "../server/db.js";

const dryRun = process.argv.includes("--dry-run");

/** The 5 failed batch records to retry */
const FAILED_BATCHES = [
  { batchId: 1, retirementId: 1, batchDenom: "C02-004-20210102-20211207-001", budgetCents: 24 },
  { batchId: 2, retirementId: 1, batchDenom: "USS01-002-20230901-20241231-001", budgetCents: 22 },
  { batchId: 4, retirementId: 2, batchDenom: "C02-004-20210102-20211207-001", budgetCents: 24 },
  { batchId: 5, retirementId: 2, batchDenom: "USS01-002-20230901-20241231-001", budgetCents: 22 },
  { batchId: 7, retirementId: 3, batchDenom: "C02-004-20210102-20211207-001", budgetCents: 24 },
];

const SUBSCRIBER_ID = 3;
const SUBSCRIBER_REGEN_ADDRESS = "regen1vqrvsdn6usryjmg2qwyjzy55tdfky744c5wrnx";

/** USDC IBC denom on Regen */
const USDC_DENOM = "ibc/334740505537E9894A64E8561030695016481830D7B36E6A9B6D13C608B55653";
const DENOM_EXPONENT = 6;

async function main() {
  console.log(`=== Retry 5 failed retirement batches (subscriber ${SUBSCRIBER_ID}) ===`);
  console.log(`Dry run: ${dryRun}\n`);

  const db = getDb();
  const config = loadConfig();

  // Verify the failed batches still have errors
  for (const fb of FAILED_BATCHES) {
    const row = db.prepare(
      "SELECT id, error, credits_retired FROM subscriber_retirement_batches WHERE id = ?"
    ).get(fb.batchId) as { id: number; error: string | null; credits_retired: number } | undefined;

    if (!row) {
      console.error(`Batch ${fb.batchId} not found in DB — aborting`);
      process.exit(1);
    }
    if (!row.error) {
      console.log(`Batch ${fb.batchId} (${fb.batchDenom}) already succeeded (${row.credits_retired} credits) — skipping`);
      FAILED_BATCHES.splice(FAILED_BATCHES.indexOf(fb), 1);
    }
  }

  if (FAILED_BATCHES.length === 0) {
    console.log("No failed batches to retry — all already succeeded!");
    return;
  }

  console.log(`Retrying ${FAILED_BATCHES.length} failed batches:\n`);
  for (const fb of FAILED_BATCHES) {
    console.log(`  Batch #${fb.batchId}: ${fb.batchDenom} (budget: $${(fb.budgetCents / 100).toFixed(2)})`);
  }

  // Init wallet
  let walletAddress: string | undefined;
  if (!dryRun) {
    const { address } = await initWallet();
    walletAddress = address;
    console.log(`\nWallet: ${walletAddress}`);

    // Check balance
    const balRes = await fetch(`https://lcd-regen.keplr.app/cosmos/bank/v1beta1/balances/${walletAddress}`);
    const balData = await balRes.json() as { balances: { denom: string; amount: string }[] };
    const usdcBal = balData.balances.find((b: { denom: string }) => b.denom === USDC_DENOM);
    console.log(`USDC balance: ${usdcBal ? (Number(usdcBal.amount) / 1_000_000).toFixed(2) : "0"}`);
  }

  // Fetch sell orders for both batch denoms
  const sellOrders = await listSellOrders();
  const targetDenoms = new Set(FAILED_BATCHES.map((fb) => fb.batchDenom));

  const eligibleOrders = sellOrders.filter((order) => {
    if (!targetDenoms.has(order.batch_denom)) return false;
    if (order.expiration && new Date(order.expiration) <= new Date()) return false;
    if (parseFloat(order.quantity) <= 0) return false;
    if (!order.disable_auto_retire) return false;
    // Only USDC-priced orders (our wallet has USDC)
    if (order.ask_denom !== USDC_DENOM) return false;
    return true;
  });

  // Group by batch denom
  const ordersByDenom = new Map<string, SellOrder[]>();
  for (const order of eligibleOrders) {
    const existing = ordersByDenom.get(order.batch_denom) ?? [];
    existing.push(order);
    ordersByDenom.set(order.batch_denom, existing);
  }

  for (const denom of targetDenoms) {
    const orders = ordersByDenom.get(denom);
    if (!orders || orders.length === 0) {
      console.error(`\nNo tradable USDC sell orders found for ${denom} — cannot proceed`);
      process.exit(1);
    }
    // Sort cheapest first
    orders.sort((a, b) => {
      const diff = BigInt(a.ask_amount) - BigInt(b.ask_amount);
      return diff < 0n ? -1 : diff > 0n ? 1 : 0;
    });
    console.log(`\n${denom}: ${orders.length} eligible sell order(s)`);
    for (const o of orders) {
      console.log(`  Order #${o.id}: ${o.quantity} credits @ $${(Number(o.ask_amount) / 1_000_000).toFixed(2)}/credit`);
    }
  }

  // Look up display name for retirement reason
  const displayName = getUserDisplayNameBySubscriberId(db, SUBSCRIBER_ID);

  // Process each failed batch
  console.log("\n--- Processing batches ---\n");

  for (const fb of FAILED_BATCHES) {
    console.log(`Batch #${fb.batchId} (${fb.batchDenom}, budget $${(fb.budgetCents / 100).toFixed(2)}):`);

    const orders = ordersByDenom.get(fb.batchDenom)!;
    const budgetMicro = BigInt(fb.budgetCents) * BigInt(10 ** (DENOM_EXPONENT - 2)); // cents → micro

    // Greedy fill (same logic as retire-subscriber.ts)
    let remainingBudget = budgetMicro;
    let totalCredits = 0;
    let totalCostMicro = 0n;
    const selectedOrders: { order: SellOrder; quantity: string; costMicro: bigint }[] = [];

    for (const order of orders) {
      if (remainingBudget <= 0n) break;
      const available = parseFloat(order.quantity);
      if (available <= 0) continue;
      const pricePerCredit = BigInt(order.ask_amount);
      if (pricePerCredit <= 0n) continue;

      const maxAffordable = Number(remainingBudget) / Number(pricePerCredit);
      const take = Math.min(maxAffordable, available);
      if (take < 0.000001) continue;

      const costMicro = (pricePerCredit * BigInt(Math.ceil(take * 1_000_000))) / 1_000_000n;
      selectedOrders.push({ order, quantity: take.toFixed(6), costMicro });
      totalCredits += take;
      totalCostMicro += costMicro;
      remainingBudget -= costMicro;
    }

    const spentCents = Number(totalCostMicro / BigInt(10 ** (DENOM_EXPONENT - 2)));

    console.log(`  Will buy: ${totalCredits.toFixed(6)} credits for $${(spentCents / 100).toFixed(2)}`);
    for (const s of selectedOrders) {
      console.log(`    Order #${s.order.id}: ${s.quantity} credits @ $${(Number(s.order.ask_amount) / 1_000_000).toFixed(2)}`);
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would execute buy + send-retire\n`);
      continue;
    }

    // Build messages
    const buyOrders = selectedOrders.map((s) => ({
      sellOrderId: BigInt(s.order.id),
      quantity: s.quantity,
      bidPrice: { denom: s.order.ask_denom, amount: s.order.ask_amount },
      disableAutoRetire: true,
      retirementJurisdiction: "",
      retirementReason: "",
    }));

    const sendCredits = selectedOrders.map((s) => ({
      batchDenom: s.order.batch_denom,
      tradableAmount: "0",
      retiredAmount: s.quantity,
      retirementJurisdiction: config.defaultJurisdiction,
      retirementReason: displayName
        ? `Regen Compute — ${displayName}'s monthly ecological contribution`
        : "Regen Compute subscription — ecological accountability for AI",
    }));

    const msgs = [
      {
        typeUrl: "/regen.ecocredit.marketplace.v1.MsgBuyDirect",
        value: { buyer: walletAddress, orders: buyOrders },
      },
      {
        typeUrl: "/regen.ecocredit.v1.MsgSend",
        value: {
          sender: walletAddress,
          recipient: SUBSCRIBER_REGEN_ADDRESS,
          credits: sendCredits,
        },
      },
    ];

    try {
      const txResult = await signAndBroadcast(msgs);

      if (txResult.code !== 0) {
        console.error(`  TX FAILED (code ${txResult.code}): ${txResult.rawLog}`);
        continue;
      }

      console.log(`  TX SUCCESS: ${txResult.transactionHash}`);

      // Update the batch record in DB
      db.prepare(`
        UPDATE subscriber_retirement_batches
        SET error = NULL,
            credits_retired = ?,
            spent_cents = ?,
            buy_tx_hash = ?,
            send_retire_tx_hash = ?
        WHERE id = ?
      `).run(totalCredits, spentCents, txResult.transactionHash, txResult.transactionHash, fb.batchId);

      // Update parent retirement totals
      db.prepare(`
        UPDATE subscriber_retirements
        SET total_credits_retired = total_credits_retired + ?,
            total_spent_cents = total_spent_cents + ?
        WHERE id = ?
      `).run(totalCredits, spentCents, fb.retirementId);

      console.log(`  DB updated: batch #${fb.batchId}, retirement #${fb.retirementId}\n`);

      // Brief pause between transactions to avoid sequence mismatch
      await new Promise((resolve) => setTimeout(resolve, 3000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg}\n`);
    }
  }

  // Final summary
  console.log("=== Summary ===");
  const updatedBatches = db.prepare(
    "SELECT id, batch_denom, credits_retired, spent_cents, error FROM subscriber_retirement_batches WHERE id IN (1, 2, 4, 5, 7)"
  ).all() as Array<{ id: number; batch_denom: string; credits_retired: number; spent_cents: number; error: string | null }>;

  for (const b of updatedBatches) {
    const status = b.error ? "FAILED" : "OK";
    console.log(`  Batch #${b.id} (${b.batch_denom}): ${status} — ${b.credits_retired.toFixed(6)} credits, $${(b.spent_cents / 100).toFixed(2)}`);
    if (b.error) console.log(`    Error: ${b.error.slice(0, 100)}...`);
  }

  if (dryRun) console.log("\n(DRY RUN — no changes made)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
