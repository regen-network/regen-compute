/**
 * MCP tool: get_retirement_reason
 *
 * Exposes the JSON-LD structured retirement reason format from
 * services/retirement-reason.ts. Shows developers exactly what
 * gets written on-chain for any retirement.
 */

import { buildRetirementReason } from "../services/retirement-reason.js";

export async function getRetirementReasonTool(
  source?: "mcp_tool" | "subscription",
  note?: string,
  subscriberId?: number,
  period?: string,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    // Build example reasons for each source type
    const mcpExample = buildRetirementReason({
      note: note || "Regenerative contribution via Regenerative Compute",
      source: "mcp_tool",
    });
    const subExample = buildRetirementReason({
      note: "Monthly ecological contribution",
      subscriberId: subscriberId || 42,
      period: period || new Date().toISOString().slice(0, 7),
      source: "subscription",
    });

    // Build a custom one if source was specified
    let customExample: string | null = null;
    if (source || note) {
      customExample = buildRetirementReason({
        note,
        subscriberId,
        period,
        source,
      });
    }

    const lines: string[] = [
      `## Structured Retirement Reason Format`,
      ``,
      `Every credit retirement on Regen Network includes a \`reason\` field written on-chain.`,
      `Regenerative Compute uses a JSON-LD-compatible structure for machine-readable attribution.`,
      ``,
      `### Schema`,
      ``,
      `| Field | Type | Description |`,
      `|-------|------|-------------|`,
      `| \`@context\` | string | JSON-LD context URL (\`https://schema.regen.network/v1\`) |`,
      `| \`type\` | string | Always \`ComputeFootprintRetirement\` |`,
      `| \`tool\` | string | Always \`regen-compute\` |`,
      `| \`version\` | string | Package version at time of retirement |`,
      `| \`methodology\` | string | Footprint estimation methodology reference |`,
      `| \`uncertaintyRange\` | string | Acknowledged uncertainty range (\`10x\`) |`,
      `| \`note\` | string? | Human-readable context (subscriber name, purpose) |`,
      `| \`period\` | string? | Billing period (\`YYYY-MM\`) for subscription retirements |`,
      `| \`source\` | string? | \`mcp_tool\` for direct retirements, \`subscription\` for scheduled |`,
      ``,
      `### Example: MCP Tool Retirement`,
      ``,
      "```json",
      JSON.stringify(JSON.parse(mcpExample), null, 2),
      "```",
      ``,
      `### Example: Subscription Retirement`,
      ``,
      "```json",
      JSON.stringify(JSON.parse(subExample), null, 2),
      "```",
    ];

    if (customExample) {
      lines.push(
        ``,
        `### Your Custom Reason`,
        ``,
        "```json",
        JSON.stringify(JSON.parse(customExample), null, 2),
        "```",
      );
    }

    lines.push(
      ``,
      `### How It Works`,
      ``,
      `1. The \`reason\` string is passed to \`MsgRetire\` or \`MsgSend\` (retiredAmount) on Regen Ledger`,
      `2. It is stored permanently on-chain in the retirement record`,
      `3. Indexers and the claims engine can parse the JSON for structured attribution`,
      `4. Older consumers that treat \`reason\` as plain text see valid JSON (backward-compatible)`,
      ``,
      `The \`methodology\` field references Luccioni et al. 2023 ("Power Hungry Processing")`,
      `and IEA 2024 data on AI energy consumption. The \`uncertaintyRange: "10x"\` acknowledges`,
      `that heuristic estimates may be off by an order of magnitude — this is regenerative`,
      `contribution, not precise carbon accounting.`,
    );

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `Error building retirement reason: ${message}` }],
    };
  }
}
