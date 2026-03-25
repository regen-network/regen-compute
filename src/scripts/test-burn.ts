/**
 * Manual $1.00 burn test.
 * Usage: npx tsx src/scripts/test-burn.ts [--live]
 */
import { swapAndBurn, checkOsmosisReadiness } from "../services/swap-and-burn.js";

const live = process.argv.includes("--live");

async function main() {
  console.log(`\n=== REGEN Buy & Burn Test ($1.00) — ${live ? "LIVE" : "DRY RUN"} ===\n`);

  const readiness = await checkOsmosisReadiness();
  console.log("Osmosis readiness:", JSON.stringify(readiness, null, 2));

  if (!readiness.ready) {
    console.error("Osmosis wallet not ready:", readiness.issues);
    process.exit(1);
  }

  const result = await swapAndBurn({
    allocationCents: 100, // $1.00
    swapDenom: "atom",
    dryRun: !live,
  });

  console.log("\nResult:", JSON.stringify(result, null, 2));

  if (result.status === "completed") {
    console.log("\n✅ Burn complete!");
    console.log(`  Swap tx: ${result.swapTxHash}`);
    console.log(`  IBC tx: ${result.ibcTxHash}`);
    console.log(`  Burn tx: ${result.burnTxHash}`);
    console.log(`  REGEN burned: ${Number(result.burnAmountUregen) / 1e6}`);
  } else if (result.status === "partial") {
    console.log("\n⚠️  Partial — swap succeeded but IBC/burn may need manual completion");
  } else {
    console.log("\n❌ Failed:", result.errors);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
