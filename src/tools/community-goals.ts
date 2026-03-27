/**
 * MCP tool: get_community_goals
 *
 * Exposes the community_goals table — current goal, progress toward
 * it, and completion status.
 */

import { getDb } from "../server/db.js";
import {
  getActiveCommunityGoal,
  getCommunityTotalCreditsRetired,
  getCommunitySubscriberCount,
  type CommunityGoal,
} from "../server/db.js";

export async function getCommunityGoals(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const db = getDb(process.env.REGEN_DB_PATH ?? "data/regen-compute.db");

    const activeGoal = getActiveCommunityGoal(db);
    const totalCredits = getCommunityTotalCreditsRetired(db);
    const subscriberCount = getCommunitySubscriberCount(db);

    // Also fetch all goals for historical context
    const allGoals = db.prepare(
      "SELECT * FROM community_goals ORDER BY id DESC"
    ).all() as CommunityGoal[];

    const lines: string[] = [
      `## Community Goals`,
      ``,
      `### Current Status`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Active subscribers | ${subscriberCount} |`,
      `| Total credits retired | ${totalCredits.toFixed(4)} |`,
    ];

    if (activeGoal) {
      const progress = activeGoal.goal_credits > 0
        ? Math.min((totalCredits / activeGoal.goal_credits) * 100, 100)
        : 0;
      const completed = progress >= 100;

      lines.push(
        ``,
        `### Active Goal: ${activeGoal.goal_label}`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Target | ${activeGoal.goal_credits.toFixed(4)} credits |`,
        `| Progress | ${totalCredits.toFixed(4)} / ${activeGoal.goal_credits.toFixed(4)} (${progress.toFixed(1)}%) |`,
        `| Status | ${completed ? "Completed" : "In progress"} |`,
      );

      if (activeGoal.goal_deadline) {
        const deadlineDate = new Date(activeGoal.goal_deadline);
        const now = new Date();
        const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        lines.push(
          `| Deadline | ${activeGoal.goal_deadline} (${daysRemaining > 0 ? `${daysRemaining} days remaining` : "past deadline"}) |`,
        );
      }

      // Progress bar
      const barLength = 20;
      const filled = Math.round((progress / 100) * barLength);
      const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
      lines.push(``, `\`[${bar}]\` ${progress.toFixed(1)}%`);
    } else {
      lines.push(``, `*No active community goal set.*`);
    }

    if (allGoals.length > 1) {
      lines.push(
        ``,
        `### Goal History`,
        ``,
        `| Goal | Target | Active | Created |`,
        `|------|--------|--------|---------|`,
      );
      for (const g of allGoals) {
        lines.push(
          `| ${g.goal_label} | ${g.goal_credits.toFixed(4)} | ${g.active ? "Yes" : "No"} | ${g.created_at.split("T")[0]} |`,
        );
      }
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `Error fetching community goals: ${message}` }],
    };
  }
}
