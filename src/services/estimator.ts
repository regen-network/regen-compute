/**
 * AI Compute Ecological Footprint Estimator
 *
 * Provides heuristic estimates of the ecological footprint of AI sessions.
 * These are approximate — MCP servers cannot access internal compute metrics.
 *
 * Methodology sources:
 * - IEA: Data centres and AI are driving a surge in global electricity demand (2024)
 * - Luccioni et al.: "Power Hungry Processing" — energy and carbon costs of AI (2023)
 * - de Vries: "The growing energy footprint of artificial intelligence" (2023)
 *
 * Key assumptions:
 * - Average AI query energy: ~0.01 kWh (GPT-4 class, incl. data center overhead)
 * - Grid carbon intensity: ~0.4 kg CO2/kWh (global average, IEA 2023)
 * - Tool calls are a rough proxy for compute intensity
 * - A "session" of moderate use ≈ 20-50 queries
 */

// Energy per AI interaction (kWh) — conservative estimate for LLM inference
// Includes PUE (Power Usage Effectiveness) overhead of ~1.2x
const KWH_PER_QUERY = 0.01;

// Estimated queries per minute of active AI session
const QUERIES_PER_MINUTE = 1.5;

// Global average grid carbon intensity (kg CO2 per kWh)
// Source: IEA 2023 global average
const KG_CO2_PER_KWH = 0.4;

// Average price per tonne CO2 for Regen carbon credits (USD)
const USD_PER_TONNE_CO2 = 40;

// Average price per biodiversity credit (USD)
const USD_PER_BIO_CREDIT = 26;

export interface FootprintEstimate {
  session_minutes: number;
  estimated_queries: number;
  energy_kwh: number;
  co2_kg: number;
  co2_tonnes: number;
  equivalent_carbon_credits: number;
  equivalent_cost_usd: number;
  methodology_note: string;
}

// --- Monthly footprint estimation (personalized) ---

// Regional grid carbon intensity (kg CO2 per kWh)
// Source: IEA Electricity Information 2023, Ember Global Electricity Review 2024
const GRID_INTENSITY: Record<string, number> = {
  global: 0.4,
  us: 0.37,
  uk: 0.21,
  de: 0.35,
  fr: 0.06,
  se: 0.04,
  no: 0.02,
  ca: 0.12,
  au: 0.56,
  jp: 0.46,
  cn: 0.54,
  in: 0.71,
  br: 0.07,
  za: 0.87,
  kr: 0.42,
  pl: 0.63,
};

// AI product relative energy multipliers (base = 1.0 for Claude/GPT-4 class)
// Accounts for model size, inference strategy, and typical session patterns
const AI_PRODUCT_MULTIPLIER: Record<string, number> = {
  claude: 1.0,
  "claude code": 1.3,
  chatgpt: 1.0,
  "gpt-4": 1.1,
  copilot: 0.7,
  cursor: 1.2,
  gemini: 0.9,
  "gemini pro": 1.0,
  llama: 0.8,
  mistral: 0.7,
  perplexity: 0.8,
  windsurf: 1.1,
};

export interface MonthlyFootprintEstimate {
  hours_per_day: number;
  location: string;
  grid_intensity_kg_per_kwh: number;
  ai_products: string[];
  energy_multiplier: number;
  monthly_queries: number;
  monthly_energy_kwh: number;
  monthly_co2_kg: number;
  dabbler_amount_usd: number;
  builder_amount_usd: number;
  maximalist_amount_usd: number;
  methodology_note: string;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

export function estimateMonthlyFootprint(params: {
  hoursPerDay: number;
  location?: string;
  aiProducts?: string[];
}): MonthlyFootprintEstimate {
  const { hoursPerDay } = params;
  const location = (params.location ?? "global").toLowerCase().trim();
  const aiProducts = (params.aiProducts ?? ["claude"]).map((p) => p.toLowerCase().trim());

  // Resolve grid intensity
  const gridIntensity = GRID_INTENSITY[location] ?? GRID_INTENSITY.global;

  // Resolve energy multiplier (take max across all products)
  const multiplier = aiProducts.length > 0
    ? Math.max(...aiProducts.map((p) => AI_PRODUCT_MULTIPLIER[p] ?? 1.0))
    : 1.0;

  // Queries: hoursPerDay * 60min * QUERIES_PER_MINUTE * 30 days
  const monthlyQueries = hoursPerDay * 60 * QUERIES_PER_MINUTE * 30;
  const monthlyEnergyKwh = monthlyQueries * KWH_PER_QUERY * multiplier;
  const monthlyCo2Kg = monthlyEnergyKwh * gridIntensity;
  const monthlyCo2Tonnes = monthlyCo2Kg / 1000;

  // Cost at $40/tonne, with 50%, 100%, 200% coverage
  const baseCost = monthlyCo2Tonnes * USD_PER_TONNE_CO2;
  const dabbler = Math.max(2.5, round(baseCost * 0.5, 2));
  const builder = Math.max(2.5, round(baseCost * 1.0, 2));
  const maximalist = Math.max(2.5, round(baseCost * 2.0, 2));

  return {
    hours_per_day: hoursPerDay,
    location: location,
    grid_intensity_kg_per_kwh: gridIntensity,
    ai_products: aiProducts,
    energy_multiplier: multiplier,
    monthly_queries: Math.round(monthlyQueries),
    monthly_energy_kwh: round(monthlyEnergyKwh, 3),
    monthly_co2_kg: round(monthlyCo2Kg, 3),
    dabbler_amount_usd: dabbler,
    builder_amount_usd: builder,
    maximalist_amount_usd: maximalist,
    methodology_note:
      "Estimate based on AI energy research (IEA 2024, Luccioni et al. 2023) " +
      "with regional grid intensity from IEA/Ember 2024. Your actual footprint " +
      "depends on model, data center location, and usage patterns.",
  };
}

export function estimateFootprint(
  sessionMinutes: number,
  toolCalls?: number
): FootprintEstimate {
  // Estimate query count from session duration, with tool calls as a floor
  const estimatedFromDuration = sessionMinutes * QUERIES_PER_MINUTE;
  const estimatedQueries = toolCalls
    ? Math.max(toolCalls * 2, estimatedFromDuration) // Each tool call likely involves ~2 LLM round-trips
    : estimatedFromDuration;

  const energyKwh = estimatedQueries * KWH_PER_QUERY;
  const co2Kg = energyKwh * KG_CO2_PER_KWH;
  const co2Tonnes = co2Kg / 1000;
  const equivalentCredits = co2Tonnes; // 1 carbon credit = 1 tonne CO2
  const equivalentCostUsd = co2Tonnes * USD_PER_TONNE_CO2;

  return {
    session_minutes: sessionMinutes,
    estimated_queries: Math.round(estimatedQueries),
    energy_kwh: Math.round(energyKwh * 10000) / 10000,
    co2_kg: Math.round(co2Kg * 1000) / 1000,
    co2_tonnes: Math.round(co2Tonnes * 100000) / 100000,
    equivalent_carbon_credits: Math.round(co2Tonnes * 100000) / 100000,
    equivalent_cost_usd: Math.round(equivalentCostUsd * 100) / 100,
    methodology_note:
      "This is an approximate estimate based on published research on AI energy consumption " +
      "(IEA 2024, Luccioni et al. 2023). Actual energy use varies by model, data center, " +
      "and grid energy mix. This estimate uses global averages and should be treated as " +
      "directional, not precise.",
  };
}
