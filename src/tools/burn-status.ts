/**
 * MCP tool: get_burn_status
 *
 * Exposes REGEN burn accumulator state, total burned to date, and
 * last burn transaction from the burns table and burn_accumulator.
 */

import { getDb } from "../server/db.js";
import { getTotalBurnedRegen, type Burn } from "../server/db.js";

export async function getBurnStatus(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const db = getDb(process.env.REGEN_DB_PATH ?? "data/regen-compute.db");

    // Pending burn budget (unexecuted accumulator entries)
    const pendingRow = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) AS total
      FROM burn_accumulator WHERE executed = 0
    `).get() as { total: number } | undefined;
    const pendingCents = pendingRow?.total ?? 0;

    // Total burned to date
    const { total_regen, total_burns } = getTotalBurnedRegen(db);

    // Last completed burn
    const lastBurn = db.prepare(`
      SELECT * FROM burns WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1
    `).get() as Burn | undefined;

    // All-time burn allocation total
    const allocationRow = db.prepare(`
      SELECT COALESCE(SUM(allocation_cents), 0) AS total FROM burns
    `).get() as { total: number } | undefined;
    const totalAllocationCents = allocationRow?.total ?? 0;

    // Recent burns (last 5)
    const recentBurns = db.prepare(`
      SELECT * FROM burns ORDER BY created_at DESC LIMIT 5
    `).all() as Burn[];

    const lines: string[] = [
      `## REGEN Burn Status`,
      ``,
      `The 5% burn allocation from each subscription payment buys and burns REGEN tokens,`,
      `creating a deflationary flywheel: retirements → burns → token scarcity → more retirements.`,
      ``,
      `### Summary`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Pending burn budget | $${(pendingCents / 100).toFixed(2)} |`,
      `| Total REGEN burned | ${total_regen.toFixed(6)} REGEN |`,
      `| Completed burn transactions | ${total_burns} |`,
      `| Total burn allocation (all time) | $${(totalAllocationCents / 100).toFixed(2)} |`,
    ];

    if (lastBurn) {
      lines.push(
        ``,
        `### Last Burn`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Date | ${lastBurn.created_at} |`,
        `| REGEN burned | ${lastBurn.amount_regen.toFixed(6)} |`,
        `| Allocation | $${(lastBurn.allocation_cents / 100).toFixed(2)} |`,
        `| REGEN price | ${lastBurn.regen_price_usd !== null ? `$${lastBurn.regen_price_usd.toFixed(6)}` : "—"} |`,
        `| Tx hash | ${lastBurn.tx_hash ? `\`${lastBurn.tx_hash}\`` : "—"} |`,
      );
    }

    if (recentBurns.length > 0) {
      lines.push(
        ``,
        `### Recent Burns`,
        ``,
        `| Date | Status | REGEN | Allocation | Tx |`,
        `|------|--------|-------|------------|-----|`,
      );
      for (const b of recentBurns) {
        const tx = b.tx_hash ? `\`${b.tx_hash.slice(0, 12)}...\`` : "—";
        lines.push(
          `| ${b.created_at.split("T")[0]} | ${b.status} | ${b.amount_regen.toFixed(4)} | $${(b.allocation_cents / 100).toFixed(2)} | ${tx} |`
        );
      }
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `Error fetching burn status: ${message}` }],
    };
  }
}
