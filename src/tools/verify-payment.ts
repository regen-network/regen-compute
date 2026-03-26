/**
 * MCP tool: verify_payment
 *
 * Exposes services/crypto-verify.ts to let agents verify any on-chain
 * payment transaction across all supported chains before attempting
 * a retirement or subscription provisioning.
 */

import {
  verifyPayment,
  SUPPORTED_EVM_CHAINS,
  type VerifiedPayment,
} from "../services/crypto-verify.js";
import { toUsdCents } from "../services/crypto-price.js";

export async function verifyPaymentTool(
  chain: string,
  txHash: string,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const result: VerifiedPayment = await verifyPayment(chain, txHash);

    // Try to convert to USD
    let usdValue: string | null = null;
    try {
      const cents = await toUsdCents(result.token, result.amount, result.contractAddress);
      usdValue = `$${(cents / 100).toFixed(2)}`;
    } catch {
      // USD conversion not available for this token
    }

    const lines: string[] = [
      `## Payment Verification`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| Status | ${result.confirmed ? "Confirmed" : "Pending"} |`,
      `| Chain | ${result.chain} |`,
      `| Tx hash | \`${result.txHash}\` |`,
      `| From | \`${result.fromAddress}\` |`,
      `| Token | ${result.token} |`,
      `| Amount | ${result.amount} ${result.token} |`,
    ];

    if (usdValue) {
      lines.push(`| USD value | ${usdValue} |`);
    }

    lines.push(`| Confirmations | ${result.confirmations} |`);

    if (result.contractAddress) {
      lines.push(`| Contract | \`${result.contractAddress}\` |`);
    }

    lines.push(
      ``,
      `*This transaction ${result.confirmed ? "is confirmed and can be used" : "is not yet confirmed — wait"} for credit retirement or subscription provisioning.*`,
    );

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    const supportedChains = [
      ...SUPPORTED_EVM_CHAINS,
      "bitcoin",
      "solana",
      "tron",
    ].join(", ");

    return {
      content: [{
        type: "text" as const,
        text: `## Payment Verification Failed\n\n${message}\n\n**Supported chains:** ${supportedChains}`,
      }],
    };
  }
}
