/**
 * MCP tool: get_regen_price
 *
 * Exposes CoinGecko price data from services/crypto-price.ts.
 * Shows REGEN/USD price alongside other tracked tokens and cache status.
 */

import { getUsdPrices } from "../services/crypto-price.js";
import { getRegenPrice } from "../services/burn.js";

export async function getRegenPriceTool(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const [regenPrice, allPrices] = await Promise.all([
      getRegenPrice().catch(() => null),
      getUsdPrices(),
    ]);

    const lines: string[] = [
      `## REGEN Token Price`,
      ``,
    ];

    if (regenPrice !== null) {
      lines.push(`**REGEN/USD: $${regenPrice.toFixed(6)}**`);
      lines.push(``);
    } else {
      lines.push(`**REGEN/USD:** Price unavailable (CoinGecko rate limit or API error)`);
      lines.push(``);
    }

    lines.push(
      `### All Tracked Prices`,
      ``,
      `| Token | USD Price |`,
      `|-------|-----------|`,
    );

    // Sort by symbol
    const sorted = Object.entries(allPrices).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [symbol, price] of sorted) {
      lines.push(`| ${symbol} | $${price.toFixed(6)} |`);
    }
    if (regenPrice !== null) {
      lines.push(`| REGEN | $${regenPrice.toFixed(6)} |`);
    }

    lines.push(
      ``,
      `*Prices from CoinGecko free API with 60-second cache. Stablecoins (USDC, USDT, xDAI) hardcoded at $1.00.*`,
    );

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `Error fetching prices: ${message}` }],
    };
  }
}
