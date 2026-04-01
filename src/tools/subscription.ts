/**
 * MCP tool: check_subscription_status
 *
 * Calls GET /api/v1/subscription to show the user's subscription state,
 * cumulative impact, and referral link.
 */

import { loadConfig } from "../config.js";

interface SubscriptionResponse {
  subscribed: boolean;
  plan?: string;
  status?: string;
  amount_dollars?: string;
  next_renewal?: string | null;
  cumulative_carbon_credits?: number;
  cumulative_biodiversity_credits?: number;
  cumulative_uss_credits?: number;
  cumulative_contribution_dollars?: string;
  months_active?: number;
  referral_link?: string | null;
  referral_count?: number;
  subscribe_url?: string;
  manage_url?: string;
  plans?: Array<{ name: string; price: string; description: string }>;
}

function formatCredits(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export async function checkSubscriptionStatus(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const config = loadConfig();

  if (!config.balanceApiKey || !config.balanceUrl) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            "## Regen Compute — Subscription Status",
            "",
            "No API key configured. To check your subscription or subscribe:",
            "",
            "1. Visit the Regen Compute landing page to subscribe",
            "2. After subscribing, set your API key:",
            "   ```",
            "   export REGEN_API_KEY=rfa_your_key_here",
            "   export REGEN_BALANCE_URL=https://your-server.com",
            "   ```",
            "",
            "Use `estimate_session_footprint` to see your AI session's ecological impact.",
          ].join("\n"),
        },
      ],
    };
  }

  try {
    const response = await fetch(`${config.balanceUrl}/api/v1/subscription`, {
      headers: {
        Authorization: `Bearer ${config.balanceApiKey}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to check subscription status (${response.status}): ${errText}`,
          },
        ],
      };
    }

    const data = (await response.json()) as SubscriptionResponse;

    if (data.subscribed) {
      const planName = data.plan
        ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1)
        : "Unknown";
      const totalCredits =
        (data.cumulative_carbon_credits ?? 0) +
        (data.cumulative_biodiversity_credits ?? 0) +
        (data.cumulative_uss_credits ?? 0);

      const lines: string[] = [
        `## Regen Compute — Active Subscription`,
        ``,
        `You're covered! Your **${planName}** plan ($${data.amount_dollars}/mo) funds verified ecological regeneration every month.`,
        ``,
        `### Cumulative Impact`,
        ``,
        `| Credit Type | Credits Retired |`,
        `|-------------|----------------|`,
        `| Carbon | ${formatCredits(data.cumulative_carbon_credits ?? 0)} |`,
        `| Biodiversity | ${formatCredits(data.cumulative_biodiversity_credits ?? 0)} |`,
        `| USS/Marine | ${formatCredits(data.cumulative_uss_credits ?? 0)} |`,
        `| **Total** | **${formatCredits(totalCredits)}** |`,
        ``,
        `| Stat | Value |`,
        `|------|-------|`,
        `| Total contributed | $${data.cumulative_contribution_dollars ?? "0.00"} |`,
        `| Months active | ${data.months_active ?? 0} |`,
        `| Next renewal | ${data.next_renewal ? new Date(data.next_renewal).toLocaleDateString() : "—"} |`,
      ];

      if (data.referral_link) {
        lines.push(
          ``,
          `### Refer a Friend`,
          ``,
          `Give a friend their first month free and earn bonus credit retirements:`,
          ``,
          `**${data.referral_link}**`,
          ``,
          `Referrals so far: ${data.referral_count ?? 0}`
        );
      }

      if (data.manage_url) {
        lines.push(
          ``,
          `[Manage subscription](${data.manage_url})`
        );
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } else {
      // Not subscribed
      const lines: string[] = [
        `## Regen Compute — Not Subscribed`,
        ``,
        `You don't have an active subscription yet. Subscribe to fund verified ecological regeneration from your AI sessions:`,
        ``,
        `### Plans`,
        ``,
        `| Plan | Price | Impact |`,
        `|------|-------|--------|`,
      ];

      if (data.plans) {
        for (const plan of data.plans) {
          lines.push(`| ${plan.name} | ${plan.price} | ${plan.description} |`);
        }
      } else {
        lines.push(
          `| Dabbler | $1.25/mo | I chat with AI sometimes |`,
          `| Builder | $2.50/mo | I regularly use AI for work |`,
          `| Agent | $5/mo | For autonomous agents and power users |`
        );
      }

      if (data.subscribe_url) {
        lines.push(
          ``,
          `**[Subscribe now](${data.subscribe_url})**`
        );
      }

      if (data.referral_link) {
        lines.push(
          ``,
          `Already know someone who uses AI? Share your referral link to give them a free first month:`,
          `**${data.referral_link}**`
        );
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to check subscription status: ${errMsg}`,
        },
      ],
    };
  }
}
