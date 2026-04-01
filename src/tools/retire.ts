/**
 * Retire ecocredits on Regen Network.
 *
 * Two execution paths:
 *   Path A (no wallet configured): Return marketplace link (backward compatible)
 *   Path B (wallet configured): Execute on-chain MsgBuyDirect with auto-retire
 *
 * Every error in Path B returns a fallback marketplace link so the user is never stuck.
 *
 * Core orchestration lives in services/retirement.ts. This file wraps the
 * structured result into MCP-style markdown content.
 */

import { loadConfig } from "../config.js";
import { executeRetirement, type RetirementResult } from "../services/retirement.js";

function resultToMarkdown(result: RetirementResult): { content: Array<{ type: "text"; text: string }> } {
  if (result.status === "marketplace_fallback") {
    return marketplaceFallback(
      result.message || "",
      result.beneficiaryName
    );
  }

  // Success path
  const lines: string[] = [
    `## Ecocredit Retirement Successful`,
    ``,
    `Credits have been permanently retired on Regen Ledger.`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Credits Retired | ${result.creditsRetired} |`,
    `| Cost | ${result.cost} |`,
    `| Jurisdiction | ${result.jurisdiction} |`,
    `| Reason | ${result.reason} |`,
    `| Transaction Hash | \`${result.txHash}\` |`,
    `| Block Height | ${result.blockHeight} |`,
  ];

  if (result.beneficiaryName) {
    lines.push(`| Beneficiary | ${result.beneficiaryName} |`);
  }

  if (result.certificateId) {
    lines.push(`| Certificate ID | ${result.certificateId} |`);
    lines.push(
      ``,
      `### Retirement Certificate`,
      ``,
      `Use \`get_retirement_certificate\` with ID \`${result.certificateId}\` to retrieve the full certificate.`
    );
  } else {
    lines.push(
      ``,
      `> The indexer is still processing this retirement. `,
      `> Use \`get_retirement_certificate\` with tx hash \`${result.txHash}\` to check later.`
    );
  }

  if (result.remainingBalanceCents !== undefined) {
    lines.push(
      `| Remaining Balance | $${(result.remainingBalanceCents / 100).toFixed(2)} |`
    );
  }

  lines.push(
    ``,
    `This retirement is permanently recorded on Regen Ledger and cannot be altered or reversed.`
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function marketplaceFallback(
  message: string,
  beneficiaryName?: string
): { content: Array<{ type: "text"; text: string }> } {
  const config = loadConfig();
  const url = `${config.marketplaceUrl}/projects/1?buying_options_filters=credit_card`;
  const subscribeUrl = config.balanceUrl ? `${config.balanceUrl}/#pricing` : null;
  const lines: string[] = [
    `## Retire Ecocredits on Regen Network`,
    ``,
  ];

  if (message) {
    lines.push(`> ${message}`, ``);
  }

  if (beneficiaryName) lines.push(`**Beneficiary**: ${beneficiaryName}`);

  // Primary option: subscribe for ongoing coverage
  if (subscribeUrl) {
    lines.push(
      ``,
      `### Subscribe for Ongoing Coverage`,
      ``,
      `The easiest way to fund ecological regeneration from your AI sessions:`,
      ``,
      `**[Subscribe to Regen Compute](${subscribeUrl})**`,
      ``,
      `Plans from $1.25/mo — credits retired on-chain monthly with verifiable proof. No crypto wallet needed.`,
      ``,
      `Use \`check_subscription_status\` to see your current plan and impact.`,
      ``,
      `### One-Time Purchase`,
      ``
    );
  } else {
    lines.push(
      ``,
      `### Purchase & Retire`,
      ``
    );
  }

  lines.push(
    `Visit the Regen Marketplace to retire credits directly:`,
    ``,
    `**[app.regen.network](${url})**`,
    ``,
    `**How it works:**`,
    `1. Browse available credits on the marketplace`,
    `2. Select credits and choose "Retire" at checkout`,
    `3. Pay with credit card (no crypto wallet needed)`,
    `4. Your name appears as beneficiary on the on-chain retirement certificate`,
    `5. Credits are permanently retired — verifiable, immutable, non-reversible`,
    ``,
    `Use \`browse_available_credits\` to see current pricing and availability.`,
    ...(config.ecoBridgeEnabled
      ? [
          ``,
          `**Cross-chain option:** Use \`retire_via_ecobridge\` to pay with tokens from other chains`,
          `(USDC, USDT, ETH, etc. on Ethereum, Polygon, Arbitrum, Base, and more).`,
          `Use \`browse_ecobridge_tokens\` to see all supported chains and tokens.`,
        ]
      : []),
    ``,
    `After retiring, use \`get_retirement_certificate\` to retrieve your verifiable certificate.`
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

export async function retireCredits(
  creditClass?: string,
  quantity?: number,
  beneficiaryName?: string,
  jurisdiction?: string,
  reason?: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = await executeRetirement({
    creditClass,
    quantity,
    beneficiaryName,
    jurisdiction,
    reason,
  });
  return resultToMarkdown(result);
}
