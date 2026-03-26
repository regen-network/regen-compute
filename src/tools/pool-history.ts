/**
 * MCP tool: get_pool_history
 *
 * Exposes pool_run history and per-subscriber attributions from
 * the pool_runs and attributions tables.
 */

import { getDb } from "../server/db.js";
import {
  getAttributionsByRun,
  getPoolRunBatches,
  type PoolRun,
  type Attribution,
  type PoolRunBatch,
} from "../server/db.js";

export async function getPoolHistory(
  limit: number = 5
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const db = getDb(process.env.REGEN_DB_PATH ?? "data/regen-compute.db");

    const runs = db.prepare(
      "SELECT * FROM pool_runs ORDER BY id DESC LIMIT ?"
    ).all(limit) as PoolRun[];

    if (runs.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "## Pool Run History\n\nNo pool runs have been executed yet.",
        }],
      };
    }

    const lines: string[] = [
      `## Pool Run History`,
      ``,
      `Monthly pool retirements aggregate subscription revenue and retire credits on behalf of all subscribers.`,
      ``,
      `### Recent Runs`,
      ``,
      `| # | Date | Status | Subscribers | Revenue | Spent | Credits | Burn |`,
      `|---|------|--------|-------------|---------|-------|---------|------|`,
    ];

    for (const run of runs) {
      const totalCredits =
        run.carbon_credits_retired +
        run.biodiversity_credits_retired +
        run.uss_credits_retired;
      const dryTag = run.dry_run ? " (dry)" : "";
      lines.push(
        `| ${run.id} | ${run.run_date} | ${run.status}${dryTag} | ${run.subscriber_count} | $${(run.total_revenue_cents / 100).toFixed(2)} | $${(run.total_spent_cents / 100).toFixed(2)} | ${totalCredits.toFixed(4)} | $${(run.burn_allocation_cents / 100).toFixed(2)} |`
      );
    }

    // Show detail for the most recent run
    const latest = runs[0];
    const batches = getPoolRunBatches(db, latest.id);
    const attributions = getAttributionsByRun(db, latest.id);

    if (batches.length > 0) {
      lines.push(
        ``,
        `### Run #${latest.id} — Batch Breakdown`,
        ``,
        `| Batch | Type | Budget | Spent | Credits | Tx |`,
        `|-------|------|--------|-------|---------|-----|`,
      );
      for (const b of batches) {
        const tx = b.tx_hash ? `\`${b.tx_hash.slice(0, 12)}...\`` : (b.error ? `err: ${b.error.slice(0, 30)}` : "—");
        lines.push(
          `| ${b.batch_denom} | ${b.credit_type_abbrev} | $${(b.budget_cents / 100).toFixed(2)} | $${(b.spent_cents / 100).toFixed(2)} | ${b.credits_retired.toFixed(4)} | ${tx} |`
        );
      }
    }

    if (attributions.length > 0) {
      lines.push(
        ``,
        `### Run #${latest.id} — Subscriber Attributions (${attributions.length} subscribers)`,
        ``,
        `| Subscriber | Contribution | Carbon | Biodiversity | USS |`,
        `|------------|-------------|--------|-------------|-----|`,
      );
      for (const a of attributions.slice(0, 20)) {
        lines.push(
          `| #${a.subscriber_id} | $${(a.contribution_cents / 100).toFixed(2)} | ${a.carbon_credits.toFixed(4)} | ${a.biodiversity_credits.toFixed(4)} | ${a.uss_credits.toFixed(4)} |`
        );
      }
      if (attributions.length > 20) {
        lines.push(`| ... | *${attributions.length - 20} more* | | | |`);
      }
    }

    if (latest.error_log) {
      lines.push(``, `> **Errors:** ${latest.error_log}`);
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `Error fetching pool history: ${message}` }],
    };
  }
}
