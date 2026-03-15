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
import { listSellOrders } from "./ledger.js";

const ADMIN_BOT_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;

export async function sendTelegram(text: string, parseMode: string = "Markdown"): Promise<boolean> {
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
 * Alert admin when no tradable sell orders exist for a batch.
 * Retirement for this batch will be skipped until tradable orders are created.
 */
export async function sendNoTradableOrdersAlert(
  batchDenom: string,
  subscriberId: number
): Promise<void> {
  await sendTelegram(
    `🚫 *No Tradable Orders Available*\n\n` +
    `Batch: \`${batchDenom}\`\n` +
    `Subscriber #${subscriberId} retirement *skipped* for this batch.\n\n` +
    `*Action needed:* Create a sell order with \`disable_auto_retire=true\` ` +
    `for this batch so credits can be sent to subscriber addresses.`
  );
}

/**
 * Alert admin when tradable supply for a batch drops below 10 credits.
 */
export async function sendLowStockAlert(
  batchDenom: string,
  remainingCredits: number
): Promise<void> {
  const urgency = remainingCredits < 1 ? "🔴 CRITICAL" : remainingCredits < 5 ? "🟠 LOW" : "🟡 Getting Low";
  await sendTelegram(
    `${urgency} *— Tradable Credit Supply*\n\n` +
    `Batch: \`${batchDenom}\`\n` +
    `Remaining tradable supply: *${remainingCredits.toFixed(2)} credits*\n\n` +
    `*Action needed:* Create more sell orders with \`disable_auto_retire=true\` ` +
    `for this batch to ensure upcoming retirements can proceed.`
  );
}

const LOW_STOCK_THRESHOLD = 10;

/**
 * Daily stock check for all batches in the current month's credit selection.
 * Alerts via Telegram if any batch has < 10 tradable credits remaining.
 * Called alongside the daily monthly reminder check.
 */
export async function checkTradableStock(dbPath?: string): Promise<void> {
  const db = getDb(dbPath);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const selection = getMonthlyCreditSelection(db, currentMonth);
  if (!selection) return;

  const batchDenoms = [selection.batch1_denom, selection.batch2_denom, selection.batch3_denom];

  try {
    const sellOrders = await listSellOrders();
    for (const batchDenom of batchDenoms) {
      const tradableOrders = sellOrders.filter(
        (o) => o.batch_denom === batchDenom &&
               o.disable_auto_retire === true &&
               parseFloat(o.quantity) > 0 &&
               (!o.expiration || new Date(o.expiration) > new Date())
      );
      const totalTradable = tradableOrders.reduce((sum, o) => sum + parseFloat(o.quantity), 0);

      if (totalTradable < LOW_STOCK_THRESHOLD) {
        await sendLowStockAlert(batchDenom, totalTradable);
      }
    }
  } catch (err) {
    console.error("Stock check failed:", err instanceof Error ? err.message : err);
  }
}
