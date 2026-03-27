/**
 * MCP tool: check_supply_health
 *
 * Exposes tradable sell order supply per batch plus the current month's
 * credit selection. Data sourced from listSellOrders() in ledger.ts and
 * monthly_credit_selections in the database.
 */

import { listSellOrders, listCreditClasses } from "../services/ledger.js";

const LOW_STOCK_THRESHOLD = 10;

export async function checkSupplyHealth(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const [sellOrders, classes] = await Promise.all([
      listSellOrders(),
      listCreditClasses(),
    ]);

    const classTypeMap = new Map<string, string>();
    for (const cls of classes) {
      classTypeMap.set(cls.id, cls.credit_type_abbrev);
    }

    // Group sell orders by batch denom
    const now = new Date();
    const batchStats = new Map<
      string,
      { totalQuantity: number; tradableQuantity: number; orderCount: number; tradableOrders: number; classId: string; typeAbbrev: string }
    >();

    for (const order of sellOrders) {
      const expired = order.expiration && new Date(order.expiration) <= now;
      if (expired) continue;

      const qty = parseFloat(order.quantity);
      if (qty <= 0) continue;

      const classId = order.batch_denom.replace(/-\d.*$/, "");
      const typeAbbrev = classTypeMap.get(classId) ?? "?";

      const existing = batchStats.get(order.batch_denom) ?? {
        totalQuantity: 0,
        tradableQuantity: 0,
        orderCount: 0,
        tradableOrders: 0,
        classId,
        typeAbbrev,
      };

      existing.totalQuantity += qty;
      existing.orderCount += 1;

      if (order.disable_auto_retire) {
        existing.tradableQuantity += qty;
        existing.tradableOrders += 1;
      }

      batchStats.set(order.batch_denom, existing);
    }

    // Build output
    const lines: string[] = [
      `## Credit Supply Health`,
      ``,
      `Live tradable supply from Regen Ledger sell orders.`,
      ``,
    ];

    // Alerts for low-stock batches
    const lowStockBatches: string[] = [];
    for (const [denom, stats] of batchStats) {
      if (stats.tradableQuantity < LOW_STOCK_THRESHOLD) {
        lowStockBatches.push(denom);
      }
    }

    if (lowStockBatches.length > 0) {
      lines.push(`### Alerts`);
      for (const denom of lowStockBatches) {
        const stats = batchStats.get(denom)!;
        lines.push(
          `- **${denom}** — ${stats.tradableQuantity.toFixed(2)} tradable credits remaining (threshold: ${LOW_STOCK_THRESHOLD})`
        );
      }
      lines.push(``);
    }

    // Summary table
    lines.push(`### Supply by Batch`);
    lines.push(`| Batch | Type | Total Credits | Tradable Credits | Orders | Tradable Orders |`);
    lines.push(`|-------|------|--------------|-----------------|--------|----------------|`);

    const sorted = [...batchStats.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [denom, stats] of sorted) {
      const flag = stats.tradableQuantity < LOW_STOCK_THRESHOLD ? " ⚠" : "";
      lines.push(
        `| ${denom} | ${stats.typeAbbrev} | ${stats.totalQuantity.toFixed(2)} | ${stats.tradableQuantity.toFixed(2)}${flag} | ${stats.orderCount} | ${stats.tradableOrders} |`
      );
    }

    lines.push(``);
    lines.push(`*${batchStats.size} batches with active sell orders. Tradable = disable_auto_retire orders (required for subscription retirements).*`);

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text" as const,
          text: `Error checking supply health: ${message}`,
        },
      ],
    };
  }
}
