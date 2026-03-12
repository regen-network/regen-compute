/**
 * Telegram admin notifications for Regen Compute.
 *
 * Sends monthly credit selection reminders and other admin alerts
 * via a dedicated Telegram bot.
 */

import {
  getDb,
  getMonthlyCreditSelection,
  confirmMonthlyCreditSelection,
  getAllMonthlyCreditSelections,
  getActiveCommunityGoal,
  getCommunityTotalCreditsRetired,
  getCommunitySubscriberCount,
} from "../server/db.js";

const ADMIN_BOT_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;

async function sendTelegram(text: string, parseMode: string = "Markdown"): Promise<boolean> {
  if (!ADMIN_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn("Admin Telegram not configured (ADMIN_TELEGRAM_BOT_TOKEN / ADMIN_TELEGRAM_CHAT_ID)");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: parseMode,
      }),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch (err) {
    console.error("Telegram send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Send the monthly credit selection reminder.
 * Called on the 25th of each month (or first of the month as fallback).
 */
export async function sendMonthlyCreditReminder(dbPath?: string): Promise<void> {
  const db = getDb(dbPath);

  // Get next month's selection
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = nextMonth.toISOString().slice(0, 7);
  const monthName = nextMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  const selection = getMonthlyCreditSelection(db, nextMonthStr);

  if (!selection) {
    await sendTelegram(
      `⚠️ *Regen Compute — No credits selected for ${monthName}*\n\n` +
      `There is no credit selection configured for next month. ` +
      `Retirements will fall back to the most recent month's selection.\n\n` +
      `Please configure credits for ${nextMonthStr}.`
    );
    return;
  }

  const featuredNum = selection.featured_batch;
  const batches = [
    { num: 1, denom: selection.batch1_denom, name: selection.batch1_name },
    { num: 2, denom: selection.batch2_denom, name: selection.batch2_name },
    { num: 3, denom: selection.batch3_denom, name: selection.batch3_name },
  ];

  const batchLines = batches.map((b) => {
    const star = b.num === featuredNum ? " ⭐ FEATURED" : "";
    return `${b.num}. *${b.name}*${star}\n   \`${b.denom}\``;
  }).join("\n");

  const confirmed = selection.confirmed ? "✅ Confirmed" : "⏳ Not yet confirmed";

  await sendTelegram(
    `🌱 *Regen Compute — Credits of the Month*\n` +
    `*${monthName}*\n\n` +
    `${batchLines}\n\n` +
    `Status: ${confirmed}\n\n` +
    `Reply "confirm" to keep this selection, or let me know what changes you'd like to make.`
  );
}

/**
 * Send a retirement success notification.
 */
export async function sendRetirementNotification(
  subscriberId: number,
  creditsRetired: number,
  regenAddress: string,
  batchSummary: string
): Promise<void> {
  await sendTelegram(
    `🌿 *Retirement Executed*\n` +
    `Subscriber: #${subscriberId}\n` +
    `Credits: ${creditsRetired.toFixed(6)}\n` +
    `Address: \`${regenAddress}\`\n` +
    `Batches: ${batchSummary}`
  );
}

/**
 * Check if monthly reminder should be sent.
 * Runs daily — sends on the 25th of each month.
 */
export async function checkAndSendMonthlyReminder(dbPath?: string): Promise<void> {
  const today = new Date();
  const dayOfMonth = today.getDate();

  // Send reminder on the 25th
  if (dayOfMonth === 25) {
    await sendMonthlyCreditReminder(dbPath);
  }

  // Send community goal check on the 15th
  if (dayOfMonth === 15) {
    await sendCommunityGoalReminder(dbPath);
  }

  // Also send on the 1st if next month is still unconfirmed
  if (dayOfMonth === 1) {
    const db = getDb(dbPath);
    const currentMonth = today.toISOString().slice(0, 7);
    const selection = getMonthlyCreditSelection(db, currentMonth);
    if (selection && !selection.confirmed) {
      await sendTelegram(
        `📋 *Reminder: ${currentMonth} credit selection is not confirmed*\n\n` +
        `Retirements this month will use the current preset. ` +
        `Reply "confirm" to lock it in, or let me know if you want changes.`
      );
    }
  }
}

/**
 * Send a community goal status update and prompt for new goal if needed.
 * Runs on the 15th of each month.
 */
export async function sendCommunityGoalReminder(dbPath?: string): Promise<void> {
  const db = getDb(dbPath);
  const goal = getActiveCommunityGoal(db);
  const totalCredits = getCommunityTotalCreditsRetired(db);
  const subscriberCount = getCommunitySubscriberCount(db);

  if (!goal) {
    await sendTelegram(
      `🎯 *Regen Compute — Community Goal*\n\n` +
      `No active community goal is set.\n` +
      `Community total: ${totalCredits.toFixed(2)} credits retired\n` +
      `Active subscribers: ${subscriberCount}\n\n` +
      `Would you like to set a goal? Reply with something like:\n` +
      `"Set goal: 100 credits by Earth Day 2026"`
    );
    return;
  }

  const progress = totalCredits / goal.goal_credits;
  const pct = Math.min(progress * 100, 100).toFixed(1);
  const remaining = Math.max(goal.goal_credits - totalCredits, 0).toFixed(2);
  const isComplete = totalCredits >= goal.goal_credits;

  if (isComplete) {
    await sendTelegram(
      `🎉 *Regen Compute — Goal Reached!*\n\n` +
      `"${goal.goal_label}" — *COMPLETE*\n` +
      `${totalCredits.toFixed(2)} / ${goal.goal_credits} credits (${pct}%)\n` +
      `Active subscribers: ${subscriberCount}\n\n` +
      `Time to set a new goal! Reply with something like:\n` +
      `"Set goal: 250 credits by World Environment Day"`
    );
  } else {
    const deadlineStr = goal.goal_deadline
      ? `\nDeadline: ${goal.goal_deadline}`
      : "";

    await sendTelegram(
      `🎯 *Regen Compute — Community Goal Update*\n\n` +
      `"${goal.goal_label}"\n` +
      `Progress: ${totalCredits.toFixed(2)} / ${goal.goal_credits} credits (${pct}%)${deadlineStr}\n` +
      `Remaining: ${remaining} credits\n` +
      `Active subscribers: ${subscriberCount}\n\n` +
      `Want to adjust this goal or set a new one? Reply here.`
    );
  }
}

/**
 * Alert admin when credits auto-retired to master wallet instead of subscriber.
 * This happens when no sell orders with disable_auto_retire=true are available.
 */
export async function sendAutoRetireAlert(
  subscriberId: number,
  subscriberAddress: string,
  batchDenom: string,
  creditsAmount: number,
  sellOrderIds: string
): Promise<void> {
  await sendTelegram(
    `⚠️ *Auto-Retire Fallback Alert*\n\n` +
    `Credits retired to *master wallet* instead of subscriber's address.\n` +
    `No \`disable_auto_retire=true\` sell orders were available.\n\n` +
    `Subscriber: #${subscriberId}\n` +
    `Their address: \`${subscriberAddress}\`\n` +
    `Batch: \`${batchDenom}\`\n` +
    `Credits: ${creditsAmount.toFixed(6)}\n` +
    `Sell orders used: ${sellOrderIds}\n\n` +
    `*Action needed:* Create a sell order with \`disable_auto_retire=true\` ` +
    `for this batch to prevent this in future retirements.`
  );
}
