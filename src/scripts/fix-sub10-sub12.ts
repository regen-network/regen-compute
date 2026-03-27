/**
 * One-off script: Fix Sub 10 and Sub 12 retirements.
 *
 * Sub 10 (waheedz706@gmail.com) — yearly dabbler $12.50/yr:
 *   - Has 1 retirement (month 1) but 0 scheduled retirements
 *   - Backfill 11 scheduled retirements for months 2-12
 *   - Uses same math as retire-todd.ts for yearly subs
 *
 * Sub 12 (meyersconsult@yahoo.com) — monthly builder $2.50/mo:
 *   - Retirement #14 failed: all 3 batches hit "account sequence mismatch"
 *   - Retry with same payment_id (idempotency will skip any that already succeeded)
 *
 * Usage: node dist/scripts/fix-sub10-sub12.js [--dry-run]
 */

import { getDb, createScheduledRetirement } from "../server/db.js";
import { retireForSubscriber, calculateNetAfterStripe } from "../services/retire-subscriber.js";
import { deriveSubscriberAddress } from "../services/subscriber-wallet.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();

  // ═══════════════════════════════════════════════════
  // SUB 10: Backfill 11 scheduled retirements
  // ═══════════════════════════════════════════════════
  console.log("=== Subscriber 10: yearly dabbler $12.50/yr ===");
  console.log("  Issue: 0 scheduled retirements — $10.86 owed for months 2-12");

  const sub10Gross = 1250; // $12.50
  const sub10NetTotal = calculateNetAfterStripe(sub10Gross);
  const sub10MonthlyNet = Math.floor(sub10NetTotal / 12);
  const sub10MonthlyGross = Math.floor(sub10Gross / 12);

  console.log(`  Yearly net (after Stripe): $${(sub10NetTotal / 100).toFixed(2)}`);
  console.log(`  Monthly portion: gross=$${(sub10MonthlyGross / 100).toFixed(2)} net=$${(sub10MonthlyNet / 100).toFixed(2)}`);

  // Original retirement was 2026-03-12. Schedule months 2-12 starting April 2026.
  const sub10StartDate = new Date("2026-03-12T00:00:00Z");

  if (!dryRun) {
    // Verify no scheduled retirements exist yet
    const existing = db.prepare(
      "SELECT COUNT(*) as count FROM scheduled_retirements WHERE subscriber_id = 10"
    ).get() as { count: number };

    if (existing.count > 0) {
      console.log(`  ⚠️ Sub 10 already has ${existing.count} scheduled retirements — skipping backfill`);
    } else {
      for (let month = 1; month <= 11; month++) {
        const scheduledDate = new Date(sub10StartDate);
        scheduledDate.setMonth(scheduledDate.getMonth() + month);
        const dateStr = scheduledDate.toISOString().split("T")[0];

        createScheduledRetirement(
          db, 10, sub10MonthlyGross, sub10MonthlyNet,
          dateStr,
          "yearly"
        );
        console.log(`  Scheduled month ${month + 1}: ${dateStr} → gross=$${(sub10MonthlyGross / 100).toFixed(2)} net=$${(sub10MonthlyNet / 100).toFixed(2)}`);
      }
      console.log(`  ✅ Created 11 scheduled retirements for Sub 10`);
    }
  } else {
    console.log("  [DRY RUN] Would create 11 scheduled retirements:");
    for (let month = 1; month <= 11; month++) {
      const scheduledDate = new Date(sub10StartDate);
      scheduledDate.setMonth(scheduledDate.getMonth() + month);
      console.log(`    Month ${month + 1}: ${scheduledDate.toISOString().split("T")[0]}`);
    }
  }

  // Verify Sub 10's Regen address is set
  const sub10Address = await deriveSubscriberAddress(10);
  console.log(`  Regen address: ${sub10Address}`);

  // ═══════════════════════════════════════════════════
  // SUB 12: Retry failed retirement
  // ═══════════════════════════════════════════════════
  console.log("\n=== Subscriber 12: monthly builder $2.50/mo ===");
  console.log("  Issue: Retirement #14 failed — all 3 batches hit sequence mismatch");

  // Use the original Stripe invoice payment_id for idempotency
  const sub12PaymentId = "in_1TAX9eJol3OwGs5e4yLdGXO5";
  console.log(`  Retrying with original payment_id: ${sub12PaymentId}`);
  console.log(`  (Idempotency: any previously succeeded batches will be skipped)`);

  const result12 = await retireForSubscriber({
    subscriberId: 12,
    grossAmountCents: 250,
    billingInterval: "monthly",
    paymentId: sub12PaymentId,
    dryRun,
  });

  console.log(`  Status: ${result12.status}`);
  console.log(`  Net: $${(result12.netAmountCents / 100).toFixed(2)}`);
  console.log(`  Credits budget: $${(result12.creditsBudgetCents / 100).toFixed(2)}`);
  console.log(`  Credits retired: ${result12.totalCreditsRetired}`);
  console.log(`  Spent: $${(result12.totalSpentCents / 100).toFixed(2)}`);
  if (result12.errors && result12.errors.length > 0) {
    console.log(`  Errors: ${result12.errors.join(", ")}`);
  }
  for (const b of result12.batches) {
    console.log(`    ${b.batchDenom}: ${b.creditsRetired} credits, $${(b.spentCents / 100).toFixed(2)} spent`);
    if (b.sendRetireTxHash) console.log(`      tx: ${b.sendRetireTxHash}`);
    if (b.error) console.log(`      error: ${b.error}`);
  }

  if (result12.status === "success" || result12.status === "partial") {
    console.log(`  ✅ Sub 12 retirement retry: ${result12.totalCreditsRetired} credits retired`);
  } else {
    console.log(`  ❌ Sub 12 retirement retry failed — manual intervention needed`);
  }

  // ═══════════════════════════════════════════════════
  console.log("\n=== Done ===");
  if (dryRun) console.log("(DRY RUN — no changes made)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
