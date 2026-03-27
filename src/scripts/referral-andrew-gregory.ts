/**
 * One-off script: Execute Andrew McCue's free-month retirement + Gregory's referral bonus.
 *
 * Andrew (subscriber 19): $5 Agent plan, free-month referral → retire as $5 gross
 * Gregory (subscriber 5): Referral bonus → retire $2.50 gross (half of $5, capped)
 *
 * Usage: node dist/scripts/referral-andrew-gregory.js [--dry-run]
 */

import {
  getDb,
  insertReferralBonusTransaction,
  fulfillReferralReward,
  getPendingReferralRewardForReferred,
} from "../server/db.js";
import {
  retireForSubscriber,
  calculateNetAfterStripe,
  accumulateBurnBudget,
} from "../services/retire-subscriber.js";
import { sendFirstRetirementEmail, sendReferralBonusEmail } from "../services/email.js";
import { getProjectForBatch } from "../server/project-metadata.js";

const dryRun = process.argv.includes("--dry-run");
const BASE_URL = "https://compute.regen.network";

async function main() {
  const db = getDb();

  // ===== Andrew (subscriber 19, user 16): Free-month retirement =====
  console.log("=== Andrew McCue — Free-month retirement ($5 gross) ===");
  const andrewGross = 500; // $5 capped
  const andrewResult = await retireForSubscriber({
    subscriberId: 19,
    grossAmountCents: andrewGross,
    billingInterval: "monthly",
    paymentId: "manual-free-month-andrew",
    dryRun,
  });
  console.log(`  Status: ${andrewResult.status}`);
  console.log(`  Net: $${(andrewResult.netAmountCents / 100).toFixed(2)}`);
  console.log(`  Credits retired: ${andrewResult.totalCreditsRetired}`);
  console.log(`  Spent: $${(andrewResult.totalSpentCents / 100).toFixed(2)}`);
  for (const b of andrewResult.batches) {
    console.log(`    ${b.batchDenom}: ${b.creditsRetired} credits`);
    if (b.sendRetireTxHash) console.log(`      tx: ${b.sendRetireTxHash}`);
    if (b.error) console.log(`      error: ${b.error}`);
  }

  // Accumulate Andrew's burn
  if (!dryRun && andrewResult.burnBudgetCents > 0) {
    accumulateBurnBudget(db, andrewResult.burnBudgetCents, "free_month_referral", 19);
    console.log(`  Burn accumulated: $${(andrewResult.burnBudgetCents / 100).toFixed(2)}`);
  }

  // Send Andrew his first retirement email
  if (!dryRun && andrewResult.status === "success") {
    const batchSummaries = andrewResult.batches
      .filter(b => b.creditsRetired > 0)
      .map(b => {
        const project = getProjectForBatch(b.batchDenom);
        return {
          projectName: project?.name ?? b.creditClassId,
          credits: b.creditsRetired,
          creditType: project?.creditTypeLabel ?? b.creditTypeAbbrev,
        };
      });
    const portfolioUrl = andrewResult.regenAddress
      ? `https://app.regen.network/profiles/${andrewResult.regenAddress}/portfolio`
      : null;
    try {
      await sendFirstRetirementEmail(
        "andrew.mccue426@gmail.com",
        `${BASE_URL}/dashboard/login`,
        andrewResult.totalCreditsRetired,
        portfolioUrl,
        batchSummaries,
      );
      console.log("  ✓ First retirement email sent to Andrew");
    } catch (err) {
      console.error("  ✗ Email to Andrew failed:", err instanceof Error ? err.message : err);
    }
  }

  // ===== Gregory (subscriber 5, user 5): Referral bonus =====
  console.log("\n=== Gregory — Referral bonus ($2.50 gross) ===");
  const gregoryGross = 250; // half of $5, capped at $2.50
  const gregoryResult = await retireForSubscriber({
    subscriberId: 5,
    grossAmountCents: gregoryGross,
    billingInterval: "monthly",
    paymentId: "manual-referral-bonus-gregory",
    dryRun,
  });
  console.log(`  Status: ${gregoryResult.status}`);
  console.log(`  Net: $${(gregoryResult.netAmountCents / 100).toFixed(2)}`);
  console.log(`  Credits retired: ${gregoryResult.totalCreditsRetired}`);
  console.log(`  Spent: $${(gregoryResult.totalSpentCents / 100).toFixed(2)}`);
  for (const b of gregoryResult.batches) {
    console.log(`    ${b.batchDenom}: ${b.creditsRetired} credits`);
    if (b.sendRetireTxHash) console.log(`      tx: ${b.sendRetireTxHash}`);
    if (b.error) console.log(`      error: ${b.error}`);
  }

  // Gregory's burn: half of Andrew's burn portion
  if (!dryRun) {
    const andrewNet = calculateNetAfterStripe(andrewGross);
    const andrewBurn = Math.floor(andrewNet * 0.05);
    const gregoryBonusBurn = Math.floor(andrewBurn / 2);
    if (gregoryBonusBurn > 0) {
      accumulateBurnBudget(db, gregoryBonusBurn, "referral_bonus", 5);
      console.log(`  Bonus burn accumulated: $${(gregoryBonusBurn / 100).toFixed(2)}`);
    }

    // Record transaction for Gregory's dashboard
    const firstTxHash = gregoryResult.batches.find(b => b.buyTxHash)?.buyTxHash ?? null;
    insertReferralBonusTransaction(db, 5, gregoryGross, firstTxHash, gregoryResult.totalCreditsRetired);
    console.log("  ✓ Transaction recorded for dashboard");

    // Fulfill the referral reward
    const reward = getPendingReferralRewardForReferred(db, 16); // Andrew's user_id
    if (reward) {
      fulfillReferralReward(db, reward.id, `manual-referral-bonus-gregory`);
      console.log(`  ✓ Referral reward ${reward.id} marked fulfilled`);
    } else {
      console.log("  ⚠ No pending referral reward found for user 16");
    }
  }

  // Send Gregory the referral bonus email
  if (!dryRun && gregoryResult.status === "success") {
    const batchSummaries = gregoryResult.batches
      .filter(b => b.creditsRetired > 0)
      .map(b => {
        const project = getProjectForBatch(b.batchDenom);
        return {
          projectName: project?.name ?? b.creditClassId,
          credits: b.creditsRetired,
          creditType: project?.creditTypeLabel ?? b.creditTypeAbbrev,
        };
      });
    try {
      await sendReferralBonusEmail(
        "gregory@regen.network",
        `${BASE_URL}/dashboard/login`,
        `${BASE_URL}/r/ref_3e9332e3eefc7838`,
        gregoryResult.totalCreditsRetired,
        batchSummaries,
      );
      console.log("  ✓ Referral bonus email sent to Gregory");
    } catch (err) {
      console.error("  ✗ Email to Gregory failed:", err instanceof Error ? err.message : err);
    }
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
