import { estimateFootprint, estimateMonthlyFootprint } from "../services/estimator.js";

export async function estimateSessionFootprint(
  sessionMinutes: number,
  toolCalls?: number
) {
  const estimate = estimateFootprint(sessionMinutes, toolCalls);

  const text = [
    `## Estimated Session Ecological Footprint`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Session duration | ${estimate.session_minutes} minutes |`,
    `| Estimated queries | ~${estimate.estimated_queries} |`,
    `| Energy consumption | ~${estimate.energy_kwh} kWh |`,
    `| CO2 equivalent | ~${estimate.co2_kg} kg |`,
    `| Equivalent carbon credits | ~${estimate.equivalent_carbon_credits} credits |`,
    `| Estimated retirement cost | ~$${estimate.equivalent_cost_usd} |`,
    ``,
    `> **Note**: ${estimate.methodology_note}`,
    ``,
    `To fund ecological regeneration equivalent to this session's footprint, `,
    `use the \`retire_credits\` tool to retire ecocredits on Regen Network.`,
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}

export async function estimateMonthlyFootprintTool(
  hoursPerDay: number,
  location?: string,
  aiProducts?: string[]
) {
  const estimate = estimateMonthlyFootprint({ hoursPerDay, location, aiProducts });

  const text = [
    `## Personalized Monthly Footprint Estimate`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Hours per day | ${estimate.hours_per_day} |`,
    `| Location | ${estimate.location} (${estimate.grid_intensity_kg_per_kwh} kg CO2/kWh) |`,
    `| AI products | ${estimate.ai_products.join(", ")} (${estimate.energy_multiplier}x multiplier) |`,
    `| Monthly queries | ~${estimate.monthly_queries.toLocaleString()} |`,
    `| Monthly energy | ~${estimate.monthly_energy_kwh} kWh |`,
    `| Monthly CO2 | ~${estimate.monthly_co2_kg} kg |`,
    ``,
    `### Recommended Monthly Contribution`,
    ``,
    `| Level | Coverage | Amount |`,
    `|-------|----------|--------|`,
    `| **Dabbler** | Casual AI use | **$${estimate.dabbler_amount_usd}/mo** |`,
    `| **Builder** | Regular AI use | **$${estimate.builder_amount_usd}/mo** |`,
    `| **Maximalist** | AI power user | **$${estimate.maximalist_amount_usd}/mo** |`,
    ``,
    `> ${estimate.methodology_note}`,
    ``,
    `Subscribe at your recommended level: https://compute.regen.network`,
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}
