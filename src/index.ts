import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { estimateSessionFootprint, estimateMonthlyFootprintTool } from "./tools/footprint.js";
import { browseAvailableCredits } from "./tools/credits.js";
import { getRetirementCertificate } from "./tools/certificates.js";
import { getImpactSummary } from "./tools/impact.js";
import { retireCredits } from "./tools/retire.js";
import { checkSubscriptionStatus } from "./tools/subscription.js";
import { getRetirementReasonTool } from "./tools/retirement-reason.js";
import { getBurnStatus } from "./tools/burn-status.js";
import { getPoolHistory } from "./tools/pool-history.js";
import { checkSupplyHealth } from "./tools/supply.js";
import { getRegenPriceTool } from "./tools/regen-price.js";
import { verifyPaymentTool } from "./tools/verify-payment.js";
import { getCommunityGoals } from "./tools/community-goals.js";
import { loadConfig, isWalletConfigured } from "./config.js";
import {
  fetchRegistry,
  getSupportedTokens,
  getTokenPrice,
  getProject,
  getProjects,
  pollTransaction,
  buildRetirementUrl,
} from "./services/ecobridge.js";
import {
  sendUsdc,
  isEvmWalletConfigured,
  getEvmAddress,
} from "./services/evm-wallet.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Handle --help and --version before starting the server
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Regenerative Compute — Verified ecological accountability for AI compute

USAGE:
  npx regen-compute              Start the MCP server (stdio transport)
  npx regen-compute serve        Start the payment & balance web server
  npx regen-compute pool-run     Execute monthly pool retirement batch
  npx regen-compute accounting   Show financial summary report
  npx regen-compute swap-and-burn Execute REGEN buy-back-and-burn pipeline
  regen-compute --help           Show this help message
  regen-compute --version        Show version

INSTALL (Claude Code):
  claude mcp add -s user regen-compute -- npx regen-compute

MCP TOOLS:
  estimate_session_footprint    Estimate your AI session's ecological footprint
  browse_available_credits      Browse ecocredits on Regen Marketplace
  retire_credits                Retire credits (on-chain or marketplace link)
  get_retirement_certificate    Verify a retirement on-chain
  get_impact_summary            Regen Network aggregate impact stats
  browse_ecobridge_tokens       List cross-chain payment tokens (when enabled)
  retire_via_ecobridge          Pay with any token via ecoBridge (when enabled)

PAYMENT SERVER:
  npx regen-compute serve [--port 3141]
  Runs the Stripe Checkout + balance API server.
  Requires STRIPE_SECRET_KEY in environment.

POOL RETIREMENT:
  npx regen-compute pool-run [--dry-run]
  Executes monthly batch retirement from subscription pool.
  Use --dry-run to calculate without broadcasting transactions.
  Requires REGEN_WALLET_MNEMONIC for live runs.

ACCOUNTING:
  npx regen-compute accounting [--json] [--month 2026-03]
  Shows financial summary: revenue, credit spending, burns, subscribers.
  Use --json for machine-readable output.
  Use --month to filter to a specific month.

SWAP AND BURN:
  npx regen-compute swap-and-burn [--dry-run] [--denom usdc|osmo|atom] [--check]
  Executes REGEN buy-back-and-burn: Osmosis swap → IBC transfer → burn.
  Use --check to verify Osmosis wallet readiness without executing.
  Use --dry-run to simulate without broadcasting transactions.
  Requires REGEN_WALLET_MNEMONIC and funded Osmosis wallet.

CONFIGURATION:
  Copy .env.example to .env to customize. The server works without any
  configuration — read-only tools (footprint, browsing, impact) need no keys.

  Optional:
    REGEN_WALLET_MNEMONIC       Enable direct on-chain retirement
    REGEN_API_KEY               Prepaid balance API key (from payment server)
    REGEN_BALANCE_URL           Payment server URL (e.g. https://your-server.com)
    ECOBRIDGE_EVM_MNEMONIC      Enable cross-chain payment via ecoBridge
    ECOBRIDGE_ENABLED=false     Disable ecoBridge tools

  See .env.example for all options.

DOCUMENTATION:
  https://github.com/regen-network/regen-compute`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    console.log(pkg.version);
  } catch {
    console.log("0.3.0");
  }
  process.exit(0);
}

// Handle "serve" subcommand — start the payment/balance web server
if (args[0] === "serve") {
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : undefined;
  import("./server/index.js").then(({ startServer }) => startServer({ port }));
} else if (args[0] === "pool-run") {
  // Handle "pool-run" subcommand — execute monthly pool retirement
  const dryRun = args.includes("--dry-run");
  import("./services/pool.js").then(async ({ executePoolRun, formatPoolRunResult }) => {
    try {
      console.log(dryRun ? "Executing pool run (DRY RUN)..." : "Executing pool run...");
      const result = await executePoolRun({ dryRun });
      console.log(formatPoolRunResult(result));
      console.log("\nJSON output:");
      console.log(JSON.stringify(result, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
      process.exit(result.status === "failed" ? 1 : 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Pool run failed: ${msg}`);
      process.exit(1);
    }
  });
} else if (args[0] === "accounting") {
  // Handle "accounting" subcommand — show financial summary
  const jsonOutput = args.includes("--json");
  const monthIdx = args.indexOf("--month");
  const month = monthIdx !== -1 ? args[monthIdx + 1] : undefined;
  (async () => {
    const { getFinancialSummary, formatFinancialReport } = await import("./services/accounting.js");
    const { getDb } = await import("./server/db.js");
    try {
      const db = getDb(process.env.REGEN_DB_PATH ?? "data/regen-compute.db");
      const summary = getFinancialSummary(db);

      if (month) {
        // Filter monthly breakdown to the requested month
        summary.monthlyBreakdown = summary.monthlyBreakdown.filter(
          (m) => m.month === month
        );
      }

      if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(formatFinancialReport(summary));
      }
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Accounting report failed: ${msg}`);
      process.exit(1);
    }
  })();
} else if (args[0] === "swap-and-burn") {
  // Handle "swap-and-burn" subcommand — execute REGEN buy-back-and-burn
  const checkOnly = args.includes("--check");
  const dryRun = args.includes("--dry-run");
  const denomIdx = args.indexOf("--denom");
  const validDenoms = ["usdc", "osmo", "atom"] as const;
  const denomArg = denomIdx !== -1 ? args[denomIdx + 1] : "usdc";
  if (!validDenoms.includes(denomArg as any)) {
    console.error(`Invalid denom: ${denomArg}. Must be one of: ${validDenoms.join(", ")}`);
    process.exit(1);
  }
  const swapDenom = denomArg as "usdc" | "osmo" | "atom";

  (async () => {
    const { swapAndBurn, checkOsmosisReadiness, formatSwapAndBurnResult } = await import("./services/swap-and-burn.js");
    const { getPendingBurnBudget } = await import("./services/retire-subscriber.js");
    const { getDb } = await import("./server/db.js");
    try {
      if (checkOnly) {
        console.log("Checking Osmosis wallet readiness...");
        const readiness = await checkOsmosisReadiness();
        console.log(`  Osmosis address: ${readiness.osmoAddress}`);
        console.log(`  OSMO balance:    ${readiness.osmoBalance.toFixed(6)} OSMO`);
        console.log(`  USDC balance:    ${readiness.usdcBalance.toFixed(6)} USDC`);
        console.log(`  ATOM balance:    ${readiness.atomBalance.toFixed(6)} ATOM`);
        console.log(`  REGEN on Osmo:   ${readiness.regenOnOsmosisBalance.toFixed(6)} REGEN`);
        console.log(`  Ready: ${readiness.ready ? "YES" : "NO"}`);
        if (readiness.issues.length > 0) {
          console.log(`  Issues:`);
          for (const issue of readiness.issues) {
            console.log(`    - ${issue}`);
          }
        }
        process.exit(readiness.ready ? 0 : 1);
      }

      // Get pending burn budget from DB
      const db = getDb(process.env.REGEN_DB_PATH ?? "data/regen-compute.db");
      const pendingCents = getPendingBurnBudget(db);

      if (pendingCents <= 0) {
        console.log("No pending burn budget. Nothing to do.");
        process.exit(0);
      }

      console.log(dryRun ? `Swap-and-burn (DRY RUN): $${(pendingCents / 100).toFixed(2)} allocation` : `Swap-and-burn: $${(pendingCents / 100).toFixed(2)} allocation`);
      const result = await swapAndBurn({
        allocationCents: pendingCents,
        dryRun,
        swapDenom,
      });
      console.log(formatSwapAndBurnResult(result));
      console.log("\nJSON output:");
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "failed" ? 1 : 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Swap-and-burn failed: ${msg}`);
      process.exit(1);
    }
  })();
} else {

// Load config early so isWalletConfigured() is available for annotations
loadConfig();

const walletMode = isWalletConfigured();
const config = loadConfig();
const ecoBridgeEnabled = config.ecoBridgeEnabled;

const server = new McpServer(
  {
    name: "regen-compute",
    version: "0.3.0",
  },
  {
    instructions: [
      "Regenerative Compute connects AI compute usage to verified ecological credit retirement on Regen Network.",
      "",
      "USE THIS SERVER WHEN:",
      "- The user asks about the environmental or ecological impact of their AI usage",
      "- The user wants to offset, compensate, or account for their AI session's carbon footprint",
      "- The user asks about ecological credits, carbon credits, or biodiversity credits on Regen Network",
      "- The user wants to retire ecocredits or fund ecological regeneration",
      "- The user asks about Regen Network's impact, projects, or retirement certificates",
      "- The user mentions sustainability, climate action, or regenerative ecology in the context of AI",
      ...(ecoBridgeEnabled
        ? [
            "- The user wants to pay for credit retirement using tokens from other blockchains (USDC, ETH, etc. on Ethereum, Polygon, etc.)",
          ]
        : []),
      "",
      "KEY CONCEPTS:",
      "- This is 'regenerative contribution,' NOT 'carbon offset.' We fund verified ecological regeneration.",
      "- Credits are retired on-chain on Regen Ledger — immutable, verifiable, non-reversible.",
      ...(walletMode
        ? [
            "- A wallet is configured. The retire_credits tool can execute purchases and retirements directly on-chain.",
            "- No extra steps needed — just call retire_credits with a quantity and credits will be retired automatically.",
          ]
        : [
            "- No crypto wallet needed. Purchase via credit card on Regen Marketplace.",
          ]),
      ...(ecoBridgeEnabled
        ? [
            "- ecoBridge integration enables payment with 50+ tokens across 10+ blockchains for credit retirement.",
            "- ecoBridge enables cross-chain payment for all Regen credit types.",
          ]
        : []),
      "- Credit types: Carbon (C), Biodiversity/Terrasos (BT), Kilo-Sheep-Hour (KSH), Marine Biodiversity (MBS), Umbrella Species Stewardship (USS).",
      "",
      "TYPICAL WORKFLOW:",
      "1. estimate_session_footprint — see the ecological cost of this AI session",
      "2. browse_available_credits — explore what credits are available",
      ...(walletMode
        ? [
            "3. retire_credits — directly purchase and retire credits on-chain (returns a retirement certificate)",
          ]
        : [
            "3. retire_credits — get a purchase link to retire credits via credit card",
          ]),
      "4. get_retirement_certificate — verify an on-chain retirement",
      ...(ecoBridgeEnabled
        ? [
            "",
            "CROSS-CHAIN PAYMENT WORKFLOW (via ecoBridge):",
            "1. browse_ecobridge_tokens — list all supported tokens and chains",
            "2. retire_via_ecobridge — generate a payment link using USDC, ETH, or any supported token",
          ]
        : []),
      "",
      ...(walletMode
        ? [
            "The retire_credits tool executes real on-chain transactions. Credits are permanently retired.",
          ]
        : [
            "All tools in this server are read-only and safe to call at any time.",
          ]),
      "",
      "SUBSCRIPTION AWARENESS:",
      "- Use check_subscription_status to see if the user has an active subscription",
      "- Subscribed users are already funding monthly regeneration — show their cumulative impact",
      "- Non-subscribed users should see subscription options with a subscribe link",
      "- Always share the user's referral link when showing subscription status — referrals give friends a free first month",
    ].join("\n"),
  }
);

// Tool: Estimate the ecological footprint of the current AI session
server.tool(
  "estimate_session_footprint",
  "Estimates the ecological footprint of the current AI session. Use this when the user asks about the environmental cost of their AI usage, wants to know their carbon footprint, or is considering offsetting their compute impact. Returns energy consumption (kWh), CO2 equivalent (kg), and suggested credit retirement quantity. The estimate is heuristic-based and clearly labeled as approximate.",
  {
    session_minutes: z
      .number()
      .describe("Approximate session duration in minutes"),
    tool_calls: z
      .number()
      .optional()
      .describe("Number of tool calls made in session (improves estimate accuracy)"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ session_minutes, tool_calls }) => {
    return estimateSessionFootprint(session_minutes, tool_calls);
  }
);

// Tool: Estimate personalized monthly footprint
server.tool(
  "estimate_monthly_footprint",
  "Estimates a personalized monthly ecological footprint based on daily AI usage hours, location, and AI products used. Returns recommended contribution amounts at three levels (Partial ~50%, Full ~100%, Regenerate! ~200%). Use this when the user wants a personalized recommendation for their subscription amount.",
  {
    hours_per_day: z
      .number()
      .describe("Average hours per day spent using AI tools"),
    location: z
      .string()
      .optional()
      .describe("Country code for grid carbon intensity (e.g., 'us', 'de', 'in'). Defaults to global average."),
    ai_products: z
      .array(z.string())
      .optional()
      .describe("List of AI products used (e.g., ['claude code', 'copilot', 'chatgpt'])"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ hours_per_day, location, ai_products }) => {
    return estimateMonthlyFootprintTool(hours_per_day, location, ai_products);
  }
);

// Tool: Browse available ecocredits on Regen Marketplace
server.tool(
  "browse_available_credits",
  "Lists ecocredits currently available for purchase on Regen Network marketplace. Use this when the user asks what credits exist, wants to compare carbon vs. biodiversity credits, or is exploring options before retiring. Shows live sell orders, recent marketplace activity, credit classes, and project details.",
  {
    credit_type: z
      .enum(["carbon", "biodiversity", "all"])
      .optional()
      .default("all")
      .describe("Filter by credit type: 'carbon' for CO2 credits, 'biodiversity' for ecological stewardship credits, 'all' for everything"),
    max_results: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of credit classes to return"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async ({ credit_type, max_results }) => {
    return browseAvailableCredits(credit_type, max_results);
  }
);

// Tool: Get a verifiable retirement certificate
server.tool(
  "get_retirement_certificate",
  "Retrieves a verifiable ecocredit retirement certificate from Regen Network. Use this when the user has a retirement transaction hash or certificate ID and wants to verify it, or when showing proof of a completed retirement. Returns the project funded, credits retired, beneficiary, jurisdiction, and on-chain transaction proof.",
  {
    retirement_id: z
      .string()
      .describe("The retirement certificate nodeId (starts with 'Wy') or the on-chain transaction hash"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async ({ retirement_id }) => {
    return getRetirementCertificate(retirement_id);
  }
);

// Tool: Get aggregate impact summary
server.tool(
  "get_impact_summary",
  "Shows aggregate ecological impact statistics from Regen Network. Use this when the user asks about the overall scale of Regen Network, wants context on how many credits have been retired network-wide, or needs background on available credit types and project coverage. Returns live on-chain counts of retirements, orders, projects, and jurisdictions.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async () => {
    return getImpactSummary();
  }
);

// Tool: Retire credits — either direct on-chain execution or marketplace link
server.tool(
  "retire_credits",
  walletMode
    ? "Purchases and retires ecocredits directly on-chain on Regen Network. Use this when the user wants to take action — offset their footprint, fund ecological regeneration, or retire credits. Credits are permanently retired on-chain in a single transaction. Returns a retirement certificate with on-chain proof."
    : "Generates a link to retire ecocredits on Regen Network marketplace via credit card. Use this when the user wants to take action — offset their footprint, fund ecological regeneration, or retire credits for any reason. Credits are permanently retired on-chain with the user's name as beneficiary. No crypto wallet needed. Returns a direct marketplace link and step-by-step instructions.",
  {
    credit_class: z
      .string()
      .optional()
      .describe(
        "Credit class to retire (e.g., 'C01' for carbon, 'BT01' for biodiversity). Omit to browse all."
      ),
    quantity: z
      .number()
      .optional()
      .describe("Number of credits to retire"),
    beneficiary_name: z
      .string()
      .optional()
      .describe("Name to appear on the retirement certificate"),
    jurisdiction: z
      .string()
      .optional()
      .describe(
        "Retirement jurisdiction (ISO 3166-1 alpha-2 country code, e.g., 'US', 'DE', or sub-national like 'US-OR')"
      ),
    reason: z
      .string()
      .optional()
      .describe("Reason for retiring credits (recorded on-chain)"),
  },
  {
    readOnlyHint: !walletMode,
    destructiveHint: walletMode,
    idempotentHint: !walletMode,
    openWorldHint: walletMode,
  },
  async ({ credit_class, quantity, beneficiary_name, jurisdiction, reason }) => {
    return retireCredits(credit_class, quantity, beneficiary_name, jurisdiction, reason);
  }
);

// Tool: Check subscription status and referral link
server.tool(
  "check_subscription_status",
  "Check your Regenerative Compute subscription status, cumulative ecological impact, and referral link. Use this when the user asks about their subscription, wants to see their impact over time, or wants their referral link to share with friends. Also useful at the end of a session to remind users about their ecological contribution.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async () => {
    return checkSubscriptionStatus();
  }
);

// Tool: Show the JSON-LD structured retirement reason format
server.tool(
  "get_retirement_reason",
  "Shows the structured JSON-LD retirement reason format that gets written on-chain for every credit retirement. Use this when a developer or agent wants to understand the on-chain attribution schema, see example payloads, or build a custom reason string. Includes methodology references, version tracking, and source attribution.",
  {
    source: z
      .enum(["mcp_tool", "subscription"])
      .optional()
      .describe("Source context for the retirement reason"),
    note: z
      .string()
      .optional()
      .describe("Human-readable note to include in the reason"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ source, note }) => {
    return getRetirementReasonTool(source, note);
  }
);

// Tool: REGEN burn status and accumulator
server.tool(
  "get_burn_status",
  "Shows the current REGEN burn accumulator balance, total REGEN burned to date, and recent burn transactions. Use this when the user asks about the REGEN burn flywheel, wants to see how much REGEN has been burned from subscriptions, or is curious about the deflationary mechanism. The 5% burn allocation from each subscription payment buys and burns REGEN tokens on-chain.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async () => {
    return getBurnStatus();
  }
);

// Tool: Pool run history and attributions
server.tool(
  "get_pool_history",
  "Shows the history of monthly pool retirement runs and per-subscriber credit attributions. Use this when the user asks about past retirement batches, wants to see how subscription revenue was deployed, or needs to understand the pool retirement mechanism. Each pool run aggregates subscriber revenue and retires credits across multiple batches.",
  {
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of recent pool runs to show (default: 5)"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ limit }) => {
    return getPoolHistory(limit);
  }
);

// Tool: Check tradable supply health across batches
server.tool(
  "check_supply_health",
  "Shows the tradable credit supply per batch on Regen Marketplace. Use this when the user asks about credit availability, wants to know if specific batches are running low, or needs to understand what's available for retirement. Returns live sell order data grouped by batch with tradable vs total quantities and low-stock alerts.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async () => {
    return checkSupplyHealth();
  }
);

// Tool: REGEN token price from CoinGecko
server.tool(
  "get_regen_price",
  "Shows the current REGEN token price in USD from CoinGecko, alongside other tracked crypto prices. Use this when the user asks about REGEN price, wants to understand burn economics, or needs to estimate how much REGEN their subscription buys. Prices are cached for 60 seconds.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async () => {
    return getRegenPriceTool();
  }
);

// Tool: Verify on-chain payment across 19 chains
server.tool(
  "verify_payment",
  "Verifies an on-chain payment transaction across any supported chain (16 EVM chains, Bitcoin, Solana, Tron). Use this when an agent or user wants to confirm a crypto payment was received before attempting a retirement or subscription provisioning. Returns sender, token, amount, USD value, and confirmation status.",
  {
    chain: z
      .string()
      .describe(
        "Blockchain name: ethereum, base, polygon, arbitrum, optimism, avalanche, bnb, linea, zksync, scroll, mantle, blast, celo, gnosis, fantom, mode, bitcoin, solana, tron. Aliases: eth, btc, sol, trx, bsc, matic, avax, op, arb, ftm"
      ),
    tx_hash: z
      .string()
      .describe("The on-chain transaction hash to verify"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async ({ chain, tx_hash }) => {
    return verifyPaymentTool(chain, tx_hash);
  }
);

// Tool: Community goals and progress
server.tool(
  "get_community_goals",
  "Shows the current community retirement goal, progress toward it, subscriber count, and total credits retired. Use this when the user asks about community milestones, collective impact, or wants to see how close the community is to its target.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async () => {
    return getCommunityGoals();
  }
);

// Tools: ecoBridge cross-chain payment (conditionally registered)
if (ecoBridgeEnabled) {
  // Tool: Browse all tokens/chains supported by ecoBridge
  server.tool(
    "browse_ecobridge_tokens",
    "Lists all tokens and chains supported by ecoBridge for retiring credits on Regen Network. Use this when the user wants to pay for credit retirement using tokens from other chains (e.g., USDC on Ethereum, ETH on Arbitrum, etc.) rather than native REGEN tokens.",
    {
      chain: z
        .string()
        .optional()
        .describe(
          "Filter by chain name (e.g., 'ethereum', 'polygon', 'arbitrum')"
        ),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ chain }) => {
      try {
        const tokens = await getSupportedTokens(chain);

        if (tokens.length === 0) {
          const msg = chain
            ? `No tokens found for chain "${chain}". Use \`browse_ecobridge_tokens\` without a chain filter to see all supported chains.`
            : "No tokens found in the ecoBridge registry. The service may be temporarily unavailable.";
          return { content: [{ type: "text" as const, text: msg }] };
        }

        // Group by chain for display
        const byChain = new Map<
          string,
          Array<(typeof tokens)[0]>
        >();
        for (const t of tokens) {
          const key = t.chainName || t.chainId;
          if (!byChain.has(key)) byChain.set(key, []);
          byChain.get(key)!.push(t);
        }

        const lines: string[] = [
          `## ecoBridge Supported Tokens`,
          ``,
          `Pay for Regen Network credit retirements using any of the tokens below.`,
          `Use \`retire_via_ecobridge\` to generate a payment link.`,
          ``,
        ];

        for (const [chainName, chainTokens] of byChain) {
          lines.push(`### ${chainName}`);
          lines.push(`| Token | Symbol | Price (USD) |`);
          lines.push(`|-------|--------|------------|`);
          for (const t of chainTokens) {
            const price =
              t.priceUsd != null ? `$${t.priceUsd.toFixed(2)}` : "—";
            lines.push(`| ${t.name} | ${t.symbol} | ${price} |`);
          }
          lines.push(``);
        }

        lines.push(
          `*Prices updated approximately every 60 seconds via CoinGecko Pro.*`
        );

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to fetch ecoBridge token list: ${errMsg}`,
            },
          ],
        };
      }
    }
  );

  // Tool: Retire credits via ecoBridge by sending tokens to project wallet
  server.tool(
    "retire_via_ecobridge",
    isEvmWalletConfigured()
      ? "Sends USDC on an EVM chain (Base, Ethereum, etc.) to an ecoBridge project wallet to retire ecocredits on Regen Network. Executes a real on-chain token transfer and polls bridge.eco until the retirement is confirmed. This is a destructive action — tokens are spent permanently."
      : "Lists ecoBridge projects available for credit retirement. An EVM wallet must be configured (ECOBRIDGE_EVM_MNEMONIC) to execute transactions.",
    {
      project_id: z
        .union([z.string(), z.number()])
        .describe("Project ID (number) or partial name match (e.g., 'mongolia', 'kasigau')"),
      chain: z
        .string()
        .default("base")
        .describe("Chain to send payment from (default: 'base')"),
      amount_usdc: z
        .number()
        .describe("Amount of USDC to send (e.g., 0.1 for a test, 1.5 for 1 tCO2e of Inner Mongolia)"),
      wait_for_retirement: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, polls bridge.eco API until retirement is confirmed (up to 5 min). If false, returns immediately after tx is sent."),
    },
    {
      readOnlyHint: !isEvmWalletConfigured(),
      destructiveHint: isEvmWalletConfigured(),
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ project_id, chain, amount_usdc, wait_for_retirement }) => {
      try {
        // 1. Look up the project
        const project = await getProject(project_id);
        if (!project) {
          const allProjects = await getProjects();
          const list = allProjects
            .map((p) => `  ${p.id}: ${p.name} ($${p.price}/${p.unit || "unit"}) — ${p.location}`)
            .join("\n");
          return {
            content: [{
              type: "text" as const,
              text: `Project "${project_id}" not found.\n\nAvailable projects:\n${list}`,
            }],
          };
        }

        if (!project.evmWallet) {
          return {
            content: [{
              type: "text" as const,
              text: `Project "${project.name}" does not have an EVM wallet configured. Cannot send payment.`,
            }],
          };
        }

        // 2. Check wallet is configured
        if (!isEvmWalletConfigured()) {
          return {
            content: [{
              type: "text" as const,
              text: `EVM wallet not configured. Set ECOBRIDGE_EVM_MNEMONIC in .env to enable cross-chain retirement.\n\nProject: ${project.name}\nEVM Wallet: ${project.evmWallet}\nPrice: $${project.price}/${project.unit || "unit"}`,
            }],
          };
        }

        const fromAddress = getEvmAddress();
        const estimatedCredits = project.price
          ? (amount_usdc / project.price).toFixed(4)
          : "unknown";

        const lines: string[] = [
          `## ecoBridge Retirement: ${project.name}`,
          ``,
          `| Field | Value |`,
          `|-------|-------|`,
          `| Project | ${project.name} |`,
          `| Location | ${project.location || "—"} |`,
          `| Type | ${project.type || "—"} |`,
          `| Price | $${project.price}/${project.unit || "unit"} |`,
          `| Payment | ${amount_usdc} USDC on ${chain} |`,
          `| Est. Credits | ~${estimatedCredits} ${project.unit || "units"} |`,
          `| From | ${fromAddress} |`,
          `| To | ${project.evmWallet} |`,
          ``,
        ];

        // 3. Send USDC
        lines.push(`### Sending USDC...`);
        const result = await sendUsdc(chain, project.evmWallet, amount_usdc);
        lines.push(
          ``,
          `**Transaction sent!**`,
          `| Field | Value |`,
          `|-------|-------|`,
          `| Tx Hash | \`${result.txHash}\` |`,
          `| Amount | ${result.amountUsdc} USDC |`,
          `| Chain | ${result.chain} |`,
          ``,
        );

        // 4. Optionally poll for retirement
        if (wait_for_retirement) {
          lines.push(`### Polling bridge.eco for retirement status...`);
          try {
            const tx = await pollTransaction(result.txHash, 60, 5000);
            lines.push(
              ``,
              `**Retirement status: ${tx.status}**`,
              ``,
            );
            if (tx.status === "RETIRED" || tx.status === "RWI_MINTED" || tx.status === "FEE_CALCULATED") {
              lines.push(
                `Credits successfully retired on Regen Network!`,
                ``,
                `Use \`get_retirement_certificate\` with the transaction hash to retrieve your verifiable certificate.`,
              );
            }
            if (tx.retirementDetails) {
              lines.push(``, `**Retirement details:** ${JSON.stringify(tx.retirementDetails, null, 2)}`);
            }
          } catch (pollErr) {
            const pollMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
            lines.push(
              ``,
              `Polling timed out: ${pollMsg}`,
              ``,
              `The transaction was sent successfully. bridge.eco may still be processing it.`,
              `Check status manually: \`GET https://api.bridge.eco/transactions/${result.txHash}\``,
            );
          }
        } else {
          lines.push(
            `Transaction sent. To check retirement status later:`,
            `\`GET https://api.bridge.eco/transactions/${result.txHash}\``,
          );
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: "text" as const,
            text: `ecoBridge retirement failed: ${errMsg}`,
          }],
        };
      }
    }
  );
}

// Prompt: Offset my AI session
server.prompt(
  "offset_my_session",
  walletMode
    ? "Estimate the ecological footprint of your current AI session and directly retire ecocredits on-chain to fund regeneration."
    : "Estimate the ecological footprint of your current AI session and get a link to retire ecocredits to fund regeneration.",
  {
    session_minutes: z
      .string()
      .describe("How long this session has been running, in minutes"),
    tool_calls: z
      .string()
      .optional()
      .describe("Approximate number of tool calls made this session"),
  },
  ({ session_minutes, tool_calls }) => {
    const mins = session_minutes || "30";
    const calls = tool_calls ? `, and approximately ${tool_calls} tool calls have been made` : "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `I'd like to understand and offset the ecological footprint of this AI session.`,
              `This session has been running for about ${mins} minutes${calls}.`,
              ``,
              `Please:`,
              `1. Use check_subscription_status to see if I already have an active subscription`,
              `2. Use estimate_session_footprint to calculate my session's footprint`,
              `3. If I have an active subscription, let me know I'm already covered and show my cumulative impact`,
              `4. If I don't have a subscription, use browse_available_credits to show options, then:`,
              ...(walletMode
                ? [`   - Use retire_credits to directly retire enough credits to cover my session's impact`]
                : [`   - Use retire_credits to give me a link to retire enough credits to cover my session's impact`]),
              `   - Suggest subscribing for ongoing coverage`,
              `5. Share my referral link if available`,
              ``,
              `Frame this as funding ecological regeneration, not just carbon offsetting.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

// Prompt: Show Regen Network impact
server.prompt(
  "show_regen_impact",
  "See the aggregate ecological impact of Regen Network — retirements, projects, credit types, and global coverage.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Show me the ecological impact of Regen Network.`,
              ``,
              `Please use get_impact_summary to pull live on-chain statistics,`,
              `then summarize the scale of ecological regeneration happening on the network.`,
              `Include how many credits have been retired, how many projects are active,`,
              `and what types of ecological credits are available.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

// Prompt: Personalize your subscription
server.prompt(
  "personalize_subscription",
  "Get a personalized recommendation for your Regenerative Compute subscription based on your actual AI usage, location, and tools.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `I'd like to figure out the right Regenerative Compute subscription amount for me.`,
              ``,
              `Please walk me through this step by step:`,
              ``,
              `1. **Ask me** roughly how many hours per day I spend using AI tools (coding assistants, chat, etc.)`,
              `2. **Ask me** what country I'm in (for grid carbon intensity — it's fine to skip if I'm not sure)`,
              `3. **Ask me** which AI products I use regularly (Claude, Claude Code, ChatGPT, Copilot, Cursor, Gemini, etc.)`,
              `4. **Call** \`estimate_monthly_footprint\` with my answers`,
              `5. **Present** the three recommendation levels:`,
              `   - **Dabbler** — "I chat with AI sometimes" (~casual usage coverage)`,
              `   - **Builder** — "I regularly use AI for work" (~full usage coverage)`,
              `   - **Agent** — "For autonomous agents and power users" (~maximum autonomy, maximum impact)`,
              `6. **Share** the link to subscribe: the Regenerative Compute landing page`,
              ``,
              `Keep the tone encouraging and informative — this is about empowering the user, not guilt-tripping them.`,
              `Explain that these are estimates based on published research, and any level of contribution matters.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

// Prompt: Retire with any token via ecoBridge
if (ecoBridgeEnabled) {
  server.prompt(
    "retire_with_any_token",
    "Explore cross-chain payment options and retire ecocredits using any supported token via ecoBridge.",
    {
      chain: z
        .string()
        .optional()
        .describe("Preferred blockchain (e.g., 'ethereum', 'polygon')"),
      token: z
        .string()
        .optional()
        .describe("Preferred token (e.g., 'USDC', 'ETH')"),
    },
    ({ chain, token }) => {
      const chainNote = chain ? ` on ${chain}` : "";
      const tokenNote = token ? ` using ${token}` : "";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `I'd like to retire ecocredits on Regen Network${tokenNote}${chainNote}.`,
                ``,
                `Please:`,
                `1. Use browse_ecobridge_tokens${chain ? ` with chain="${chain}"` : ""} to show me available tokens and their current prices`,
                `2. Help me choose a token and chain that works for me`,
                `3. Use retire_via_ecobridge to generate a payment link with my chosen token`,
                ``,
                `Frame this as funding ecological regeneration across chains.`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );
}

// Prompt: Check burn impact
server.prompt(
  "check_my_burn_impact",
  "See how the REGEN burn flywheel works — pending burn budget, total REGEN burned, and recent burn transactions.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `I'd like to understand the REGEN burn mechanism and see its impact.`,
              ``,
              `Please:`,
              `1. Use get_burn_status to show the current burn accumulator and history`,
              `2. Explain how the 5% burn allocation works (subscription revenue → buy REGEN → burn on-chain)`,
              `3. Summarize the total REGEN burned and what that means for the network`,
              `4. If there's a pending burn budget, mention when the next burn is expected`,
              ``,
              `Frame this as the deflationary flywheel that makes every subscription more impactful over time.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

// Prompt: Explore pool history
server.prompt(
  "explore_pool_history",
  "Review the history of monthly pool retirement runs — how subscription revenue was deployed into ecological credits.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Show me the history of Regenerative Compute pool retirements.`,
              ``,
              `Please:`,
              `1. Use get_pool_history to pull recent pool runs`,
              `2. Summarize how much revenue was collected and how many credits were retired`,
              `3. Show the batch breakdown for the most recent run`,
              `4. If subscriber attributions are available, explain how individual contributions are tracked`,
              `5. Use get_impact_summary for broader network context`,
              ``,
              `Frame this as transparent accounting — every dollar traceable from subscription to on-chain retirement.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

// Prompt: Check supply and retire
server.prompt(
  "check_supply_and_retire",
  "Check what credits are available on the marketplace, assess supply health, and retire credits to fund regeneration.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `I'd like to check what ecological credits are available and potentially retire some.`,
              ``,
              `Please:`,
              `1. Use browse_available_credits to show the current marketplace inventory`,
              `2. Summarize the available credit types and pricing`,
              `3. Use retire_credits to help me retire credits (on-chain or via marketplace link)`,
              `4. After retirement, use get_retirement_certificate to retrieve the proof`,
              ``,
              `Help me choose based on impact and availability. Frame as funding ecological regeneration.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Regenerative Compute MCP server running (wallet mode: ${walletMode ? "enabled" : "disabled"}, ecoBridge: ${ecoBridgeEnabled ? "enabled" : "disabled"}, prepaid: ${config.balanceApiKey ? "enabled" : "disabled"})`
  );
}

main().catch(console.error);

} // end else (serve subcommand)
