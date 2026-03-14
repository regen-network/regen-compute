/**
 * One-off script: Execute Todd's 3 subscription retirements.
 *
 * - Sub 7:  $2.50/mo monthly → 1 retirement
 * - Sub 14: $50/yr yearly → month 1 retirement + 11 scheduled
 * - Sub 15: $50/yr yearly → month 1 retirement + 11 scheduled
 *
 * All retire to subscriber 7's derived address.
 *
 * Usage: node --loader ts-node/esm scripts/retire-todd.ts [--dry-run]
 *    or: node dist/scripts/retire-todd.js [--dry-run]
 */

import { getDb, setSubscriberRegenAddress, createScheduledRetirement } from "../server/db.js";
import { retireForSubscriber, calculateNetAfterStripe, accumulateBurnBudget } from "../services/retire-subscriber.js";
import { deriveSubscriberAddress } from "../services/subscriber-wallet.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();

  // 1. Derive address from subscriber 7 (Todd's original) and set on all 3
  const toddAddress = await deriveSubscriberAddress(7);
  console.log(`Todd's Regen address (from sub 7): ${toddAddress}`);

  for (const subId of [7, 14, 15]) {
    setSubscriberRegenAddress(db, subId, toddAddress);
    console.log(`  Set regen_address on subscriber ${subId}`);
  }

  // 2. Retire monthly sub 7: $2.50 gross
  console.log("\n=== Subscriber 7: $2.50 monthly ===");
  const result7 = await retireForSubscriber({
    subscriberId: 7,
    grossAmountCents: 250,
    billingInterval: "monthly",
    paymentId: "manual-todd-sub7",
    dryRun,
  });
  console.log(`  Status: ${result7.status}`);
  console.log(`  Net: $${(result7.netAmountCents / 100).toFixed(2)}`);
  console.log(`  Credits budget: $${(result7.creditsBudgetCents / 100).toFixed(2)}`);
  console.log(`  Burn budget: $${(result7.burnBudgetCents / 100).toFixed(2)}`);
  console.log(`  Ops budget: $${(result7.opsBudgetCents / 100).toFixed(2)}`);
  console.log(`  Credits retired: ${result7.totalCreditsRetired}`);
  console.log(`  Spent: $${(result7.totalSpentCents / 100).toFixed(2)}`);
  if (result7.errors && result7.errors.length > 0) console.log(`  Errors: ${result7.errors.join(", ")}`);
  for (const b of result7.batches) {
    console.log(`    ${b.batchDenom}: ${b.creditsRetired} credits, $${(b.spentCents / 100).toFixed(2)} spent`);
    if (b.sendRetireTxHash) console.log(`      tx: ${b.sendRetireTxHash}`);
    if (b.error) console.log(`      error: ${b.error}`);
  }

  // Accumulate burn budget for sub 7
  if (!dryRun && result7.burnBudgetCents > 0) {
    accumulateBurnBudget(db, result7.burnBudgetCents);
    console.log(`  Burn accumulated: $${(result7.burnBudgetCents / 100).toFixed(2)}`);
  }

  // 3. Yearly subs 14 and 15: each $50/yr
  for (const subId of [14, 15]) {
    console.log(`\n=== Subscriber ${subId}: $50.00 yearly ===`);
    const grossAmount = 5000;
    const netTotal = calculateNetAfterStripe(grossAmount);
    const monthlyNet = Math.floor(netTotal / 12);
    const firstMonthNet = netTotal - (monthlyNet * 11);
    const monthlyGross = Math.floor(grossAmount / 12);
    const firstMonthGross = grossAmount - (monthlyGross * 11);

    console.log(`  Net total (after Stripe): $${(netTotal / 100).toFixed(2)}`);
    console.log(`  Month 1: gross=$${(firstMonthGross / 100).toFixed(2)} net=$${(firstMonthNet / 100).toFixed(2)}`);
    console.log(`  Months 2-12: gross=$${(monthlyGross / 100).toFixed(2)} net=$${(monthlyNet / 100).toFixed(2)} each`);

    // Schedule months 2-12
    if (!dryRun) {
      const now = new Date();
      for (let month = 1; month <= 11; month++) {
        const scheduledDate = new Date(now);
        scheduledDate.setMonth(scheduledDate.getMonth() + month);
        createScheduledRetirement(
          db, subId, monthlyGross, monthlyNet,
          scheduledDate.toISOString().split("T")[0],
          "yearly"
        );
      }
      console.log(`  Scheduled 11 future monthly retirements`);
    } else {
      console.log(`  [DRY RUN] Would schedule 11 future monthly retirements`);
    }

    // Execute month 1
    const result = await retireForSubscriber({
      subscriberId: subId,
      grossAmountCents: firstMonthGross,
      billingInterval: "yearly",
      precomputedNetCents: firstMonthNet,
      paymentId: `manual-todd-sub${subId}-m1`,
      dryRun,
    });
    console.log(`  Status: ${result.status}`);
    console.log(`  Credits budget: $${(result.creditsBudgetCents / 100).toFixed(2)}`);
    console.log(`  Burn budget: $${(result.burnBudgetCents / 100).toFixed(2)}`);
    console.log(`  Ops budget: $${(result.opsBudgetCents / 100).toFixed(2)}`);
    console.log(`  Credits retired: ${result.totalCreditsRetired}`);
    console.log(`  Spent: $${(result.totalSpentCents / 100).toFixed(2)}`);
    if (result.errors && result.errors.length > 0) console.log(`  Errors: ${result.errors.join(", ")}`);
    for (const b of result.batches) {
      console.log(`    ${b.batchDenom}: ${b.creditsRetired} credits, $${(b.spentCents / 100).toFixed(2)} spent`);
      if (b.sendRetireTxHash) console.log(`      tx: ${b.sendRetireTxHash}`);
      if (b.error) console.log(`      error: ${b.error}`);
    }

    // Accumulate burn budget
    if (!dryRun && result.burnBudgetCents > 0) {
      accumulateBurnBudget(db, result.burnBudgetCents);
      console.log(`  Burn accumulated: $${(result.burnBudgetCents / 100).toFixed(2)}`);
    }
  }

  console.log("\n=== Done ===");
  if (dryRun) console.log("(DRY RUN — no on-chain transactions executed)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
