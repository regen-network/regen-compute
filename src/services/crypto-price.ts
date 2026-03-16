/**
 * Cryptocurrency price service
 *
 * Fetches USD prices from CoinGecko's free API with a 60-second cache.
 * Used to convert crypto payment amounts to USD cents for accounting.
 */

// --- Cache ---

let cache: { prices: Record<string, number>; fetchedAt: number } | null = null;

const CACHE_TTL_MS = 60_000;

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana,tron&vs_currencies=usd";

const ID_TO_SYMBOL: Record<string, string> = {
  ethereum: "ETH",
  bitcoin: "BTC",
  solana: "SOL",
  tron: "TRX",
};

// --- Price fetching ---

export async function getUsdPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prices;
  }

  const res = await fetch(COINGECKO_URL);
  if (!res.ok) {
    // If we have stale cache, return it rather than failing
    if (cache) return cache.prices;
    throw new Error(
      `CoinGecko API error: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as Record<
    string,
    { usd?: number }
  >;

  const prices: Record<string, number> = {
    USDC: 1,
    USDT: 1,
  };

  for (const [id, symbol] of Object.entries(ID_TO_SYMBOL)) {
    const price = data[id]?.usd;
    if (price != null) {
      prices[symbol] = price;
    }
  }

  cache = { prices, fetchedAt: now };
  return prices;
}

// --- USD conversion ---

export async function toUsdCents(
  token: string,
  amount: string,
): Promise<number> {
  const normalizedToken = token.toUpperCase().trim();
  const parsedAmount = parseFloat(amount);

  if (isNaN(parsedAmount) || parsedAmount < 0) {
    throw new Error(`Invalid amount: "${amount}"`);
  }

  // Stablecoins are always $1
  if (normalizedToken === "USDC" || normalizedToken === "USDT") {
    return Math.round(parsedAmount * 100);
  }

  const prices = await getUsdPrices();
  const price = prices[normalizedToken];

  if (price == null) {
    throw new Error(
      `No price available for token "${token}". Supported: ETH, BTC, SOL, TRX, USDC, USDT`,
    );
  }

  const usd = parsedAmount * price;
  return Math.round(usd * 100);
}
