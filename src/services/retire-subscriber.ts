/**
 * Per-subscriber retirement service.
 *
 * Triggered on each subscription payment. Buys credits from the marketplace
 * with disableAutoRetire, then sends them to the subscriber's derived Regen
 * address using MsgSend with retiredAmount — credits arrive already retired.
 *
 * This replaces the monthly pool run batch system.
 */

import { loadConfig } from "../config.js";
import { initWallet, signAndBroadcast } from "./wallet.js";
import { deriveSubscriberAddress } from "./subscriber-wallet.js";
import { listSellOrders, listCreditClasses, getAllowedDenoms, type SellOrder } from "./ledger.js";
import {
  getDb,
  getSubscriberByStripeId,
  getMonthlyCreditSelection,
  type Subscriber,
  type MonthlyCreditSelection,
} from "../server/db.js";
import type Database from "better-sqlite3";

/** Revenue splits by billing interval (applied to NET after Stripe fees) */
const REVENUE_SPLIT_MONTHLY = { credits: 0.75, burn: 0.05, operations: 0.20 } as const;
const REVENUE_SPLIT_YEARLY = { credits: 0.85, burn: 0.05, operations: 0.10 } as const;

/** Stripe fee model: 2.9% + $0.30 */
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

/** Batches excluded beyond class-level filtering in ledger.ts */
const EXCLUDED_BATCHES = new Set<string>([]);

export interface SubscriberRetirementResult {
  subscriberId: number;
  regenAddress: string;
  status: "success" | "partial" | "failed" | "skipped";
  grossAmountCents: number;
  netAmountCents: number;
  creditsBudgetCents: number;
  burnBudgetCents: number;
  opsBudgetCents: number;
  batches: BatchRetirementResult[];
  totalCreditsRetired: number;
  totalSpentCents: number;
  errors: string[];
}

export interface BatchRetirementResult {
  batchDenom: string;
  creditClassId: string;
  creditTypeAbbrev: string;
  budgetCents: number;
  spentCents: number;
  creditsRetired: number;
  buyTxHash: string | null;
  sendRetireTxHash: string | null;
  error: string | null;
}

/** Calculate net amount after Stripe fees */
export function calculateNetAfterStripe(grossCents: number): number {
  const stripeFee = Math.round(grossCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
  return Math.max(grossCents - stripeFee, 0);
}

/**
 * Execute retirement for a single subscriber payment.
 * Called when Stripe confirms payment (invoice.paid webhook).
 */
/**
 * Execute retirement for a single subscriber payment.
 *
 * For monthly subscribers, called once per invoice with the full gross amount.
 * For yearly subscribers, called 12 times with pre-computed monthly portions
 * (Stripe fees deducted once upfront, then net divided by 12).
 *
 * When `precomputedNetCents` is provided, Stripe fee deduction is skipped
 * (caller already handled it). This is used for yearly monthly portions.
 */
export async function retireForSubscriber(options: {
  subscriberId: number;
  grossAmountCents: number;
  billingInterval: "monthly" | "yearly";
  precomputedNetCents?: number;
  dbPath?: string;
  dryRun?: boolean;
}): Promise<SubscriberRetirementResult> {
  const { subscriberId, grossAmountCents, billingInterval, dryRun = false } = options;
  const db = getDb(options.dbPath);
  const config = loadConfig();
  const errors: string[] = [];

  // 1. Derive subscriber address
  let regenAddress: string;
  try {
    regenAddress = await deriveSubscriberAddress(subscriberId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      subscriberId, regenAddress: "", status: "failed",
      grossAmountCents, netAmountCents: 0, creditsBudgetCents: 0,
      burnBudgetCents: 0, opsBudgetCents: 0,
      batches: [], totalCreditsRetired: 0, totalSpentCents: 0,
      errors: [`Address derivation failed: ${msg}`],
    };
  }

  // 2. Calculate net and apply revenue split
  // If precomputedNetCents is provided (yearly monthly portions), skip Stripe fee deduction
  const netAmountCents = options.precomputedNetCents ?? calculateNetAfterStripe(grossAmountCents);
  const split = billingInterval === "yearly" ? REVENUE_SPLIT_YEARLY : REVENUE_SPLIT_MONTHLY;
  const creditsBudgetCents = Math.floor(netAmountCents * split.credits);
  const burnBudgetCents = Math.floor(netAmountCents * split.burn);
  const opsBudgetCents = netAmountCents - creditsBudgetCents - burnBudgetCents;

  if (creditsBudgetCents <= 0) {
    return {
      subscriberId, regenAddress, status: "skipped",
      grossAmountCents, netAmountCents, creditsBudgetCents,
      burnBudgetCents, opsBudgetCents,
      batches: [], totalCreditsRetired: 0, totalSpentCents: 0,
      errors: ["Credits budget is zero after fees and split"],
    };
  }

  // 3. Init wallet (unless dry run)
  let walletAddress: string | undefined;
  if (!dryRun) {
    try {
      const { address } = await initWallet();
      walletAddress = address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        subscriberId, regenAddress, status: "failed",
        grossAmountCents, netAmountCents, creditsBudgetCents,
        burnBudgetCents, opsBudgetCents,
        batches: [], totalCreditsRetired: 0, totalSpentCents: 0,
        errors: [`Wallet init failed: ${msg}`],
      };
    }
  }

  // 4. Get this month's credit selection
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const selection = getMonthlyCreditSelection(db, currentMonth);

  if (!selection) {
    return {
      subscriberId, regenAddress, status: "failed",
      grossAmountCents, netAmountCents, creditsBudgetCents,
      burnBudgetCents, opsBudgetCents,
      batches: [], totalCreditsRetired: 0, totalSpentCents: 0,
      errors: ["No monthly credit selection configured for " + currentMonth],
    };
  }

  // The 3 selected batches for this month
  const selectedBatchDenoms = [selection.batch1_denom, selection.batch2_denom, selection.batch3_denom];

  // 5. Fetch sell orders for the selected batches
  const [sellOrders, classes, allowedDenoms] = await Promise.all([
    listSellOrders(),
    listCreditClasses(),
    getAllowedDenoms(),
  ]);

  const classTypeMap = new Map<string, string>();
  for (const cls of classes) {
    classTypeMap.set(cls.id, cls.credit_type_abbrev);
  }

  const now = new Date();
  const eligibleOrders = sellOrders.filter((order) => {
    if (!selectedBatchDenoms.includes(order.batch_denom)) return false;
    if (order.expiration && new Date(order.expiration) <= now) return false;
    if (parseFloat(order.quantity) <= 0) return false;
    return true;
  });

  // Group by batch
  const batchOrdersMap = new Map<string, SellOrder[]>();
  for (const order of eligibleOrders) {
    const existing = batchOrdersMap.get(order.batch_denom) ?? [];
    existing.push(order);
    batchOrdersMap.set(order.batch_denom, existing);
  }

  // Only include batches that have sell orders
  const batchDenoms = selectedBatchDenoms.filter((d) => batchOrdersMap.has(d));
  if (batchDenoms.length === 0) {
    return {
      subscriberId, regenAddress, status: "failed",
      grossAmountCents, netAmountCents, creditsBudgetCents,
      burnBudgetCents, opsBudgetCents,
      batches: [], totalCreditsRetired: 0, totalSpentCents: 0,
      errors: [`No sell orders found for this month's selected batches: ${selectedBatchDenoms.join(", ")}`],
    };
  }

  // 6. Equal dollar allocation across the selected batches (typically 3)
  const perBatchBudget = Math.floor(creditsBudgetCents / batchDenoms.length);
  const budgetRemainder = creditsBudgetCents - (perBatchBudget * batchDenoms.length);

  // Payment denom preference
  const usdcDenom = allowedDenoms.find(
    (d) => d.display_denom === "USDC" || d.display_denom === "eUSDC" ||
           d.bank_denom.includes("usdc") || d.bank_denom.includes("erc20")
  );
  const regenDenom = allowedDenoms.find(
    (d) => d.display_denom === "REGEN" || d.bank_denom === "uregen"
  );
  const paymentDenom = usdcDenom ?? regenDenom ?? allowedDenoms[0];
  const denomExponent = paymentDenom?.exponent ?? 6;
  const denomBankDenom = paymentDenom?.bank_denom ?? "uregen";

  // 6. Buy and send-retire for each batch
  const batchResults: BatchRetirementResult[] = [];

  for (let i = 0; i < batchDenoms.length; i++) {
    const batchDenom = batchDenoms[i];
    const orders = batchOrdersMap.get(batchDenom)!;
    const classId = batchDenom.replace(/-\d.*$/, "");
    const typeAbbrev = classTypeMap.get(classId) ?? "?";
    const thisBudget = perBatchBudget + (i === 0 ? budgetRemainder : 0);

    const result: BatchRetirementResult = {
      batchDenom, creditClassId: classId, creditTypeAbbrev: typeAbbrev,
      budgetCents: thisBudget, spentCents: 0, creditsRetired: 0,
      buyTxHash: null, sendRetireTxHash: null, error: null,
    };

    if (thisBudget <= 0) {
      result.error = "No budget allocated";
      batchResults.push(result);
      continue;
    }

    try {
      // Filter and sort orders
      let batchOrders = orders.filter((o) => o.ask_denom === denomBankDenom);
      if (batchOrders.length === 0) batchOrders = orders;
      batchOrders.sort((a, b) => {
        const diff = BigInt(a.ask_amount) - BigInt(b.ask_amount);
        return diff < 0n ? -1 : diff > 0n ? 1 : 0;
      });

      // Greedy fill
      const budgetMicro = BigInt(thisBudget) * BigInt(10 ** Math.max(denomExponent - 2, 0));
      let remainingBudget = budgetMicro;
      let totalCredits = 0;
      let totalCostMicro = 0n;
      const selectedOrders: { order: SellOrder; quantity: string; costMicro: bigint }[] = [];

      for (const order of batchOrders) {
        if (remainingBudget <= 0n) break;
        const available = parseFloat(order.quantity);
        if (available <= 0) continue;
        const pricePerCredit = BigInt(order.ask_amount);
        if (pricePerCredit <= 0n) continue;

        const maxAffordable = Number(remainingBudget) / Number(pricePerCredit);
        const take = Math.min(maxAffordable, available);
        if (take < 0.000001) continue;

        const costMicro = (pricePerCredit * BigInt(Math.ceil(take * 1_000_000))) / 1_000_000n;
        selectedOrders.push({ order, quantity: take.toFixed(6), costMicro });
        totalCredits += take;
        totalCostMicro += costMicro;
        remainingBudget -= costMicro;
      }

      if (selectedOrders.length === 0) {
        result.error = `No affordable orders for batch ${batchDenom}`;
        errors.push(result.error);
        batchResults.push(result);
        continue;
      }

      result.creditsRetired = totalCredits;
      result.spentCents = Number(totalCostMicro / BigInt(10 ** Math.max(denomExponent - 2, 0)));

      if (dryRun) {
        batchResults.push(result);
        continue;
      }

      // Step A: MsgBuyDirect with disableAutoRetire: true
      const buyOrders = selectedOrders.map((s) => ({
        sellOrderId: BigInt(s.order.id),
        quantity: s.quantity,
        bidPrice: { denom: s.order.ask_denom, amount: s.order.ask_amount },
        disableAutoRetire: true,
        retirementJurisdiction: "",
        retirementReason: "",
      }));

      const buyMsg = {
        typeUrl: "/regen.ecocredit.marketplace.v1.MsgBuyDirect",
        value: { buyer: walletAddress, orders: buyOrders },
      };

      // Step B: MsgSend with retiredAmount to subscriber address
      const sendCredits = selectedOrders.map((s) => ({
        batchDenom: s.order.batch_denom,
        tradableAmount: "0",
        retiredAmount: s.quantity,
        retirementJurisdiction: config.defaultJurisdiction,
        retirementReason: "Regenerative Compute subscription — ecological accountability for AI",
      }));

      const sendMsg = {
        typeUrl: "/regen.ecocredit.v1.MsgSend",
        value: {
          sender: walletAddress,
          recipient: regenAddress,
          credits: sendCredits,
        },
      };

      // Execute both messages atomically in one transaction
      const txResult = await signAndBroadcast([buyMsg, sendMsg]);

      if (txResult.code !== 0) {
        result.error = `Tx failed (code ${txResult.code}): ${txResult.rawLog || "unknown"}`;
        result.creditsRetired = 0;
        result.spentCents = 0;
        errors.push(`${batchDenom}: ${result.error}`);
      } else {
        result.buyTxHash = txResult.transactionHash;
        result.sendRetireTxHash = txResult.transactionHash; // Same tx for both msgs
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.error = `${batchDenom}: ${msg}`;
      result.creditsRetired = 0;
      result.spentCents = 0;
      errors.push(result.error);
    }

    batchResults.push(result);
  }

  // 7. Record results in DB
  const totalCreditsRetired = batchResults.reduce((sum, b) => sum + b.creditsRetired, 0);
  const totalSpentCents = batchResults.reduce((sum, b) => sum + b.spentCents, 0);

  if (!dryRun) {
    recordSubscriberRetirement(db, {
      subscriberId, regenAddress, grossAmountCents, netAmountCents,
      creditsBudgetCents, burnBudgetCents, opsBudgetCents,
      batches: batchResults, totalCreditsRetired, totalSpentCents,
    });
  }

  // Determine status
  const anySuccess = batchResults.some((b) => b.creditsRetired > 0);
  const allSuccess = batchResults.every((b) => b.error === null);
  let status: "success" | "partial" | "failed";
  if (dryRun || (allSuccess && anySuccess)) status = "success";
  else if (anySuccess) status = "partial";
  else status = "failed";

  console.log(
    `Subscriber retirement: id=${subscriberId} addr=${regenAddress} ` +
    `gross=$${(grossAmountCents / 100).toFixed(2)} net=$${(netAmountCents / 100).toFixed(2)} ` +
    `credits=${totalCreditsRetired.toFixed(6)} status=${status}` +
    (errors.length > 0 ? ` errors=${errors.length}` : "")
  );

  return {
    subscriberId, regenAddress, status,
    grossAmountCents, netAmountCents, creditsBudgetCents,
    burnBudgetCents, opsBudgetCents,
    batches: batchResults, totalCreditsRetired, totalSpentCents, errors,
  };
}

/** Record retirement details in the subscriber_retirements table */
function recordSubscriberRetirement(
  db: Database.Database,
  data: {
    subscriberId: number;
    regenAddress: string;
    grossAmountCents: number;
    netAmountCents: number;
    creditsBudgetCents: number;
    burnBudgetCents: number;
    opsBudgetCents: number;
    batches: BatchRetirementResult[];
    totalCreditsRetired: number;
    totalSpentCents: number;
  }
): void {
  const txn = db.transaction(() => {
    // Insert main retirement record
    const result = db.prepare(`
      INSERT INTO subscriber_retirements (
        subscriber_id, regen_address, gross_amount_cents, net_amount_cents,
        credits_budget_cents, burn_budget_cents, ops_budget_cents,
        total_credits_retired, total_spent_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.subscriberId, data.regenAddress, data.grossAmountCents,
      data.netAmountCents, data.creditsBudgetCents, data.burnBudgetCents,
      data.opsBudgetCents, data.totalCreditsRetired, data.totalSpentCents
    );

    const retirementId = result.lastInsertRowid;

    // Insert per-batch records
    for (const batch of data.batches) {
      db.prepare(`
        INSERT INTO subscriber_retirement_batches (
          retirement_id, batch_denom, credit_class_id, credit_type_abbrev,
          budget_cents, spent_cents, credits_retired,
          buy_tx_hash, send_retire_tx_hash, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        retirementId, batch.batchDenom, batch.creditClassId, batch.creditTypeAbbrev,
        batch.budgetCents, batch.spentCents, batch.creditsRetired,
        batch.buyTxHash, batch.sendRetireTxHash, batch.error
      );
    }
  });
  txn();
}

/**
 * Accumulate burn budget from subscriber retirements.
 * Burns are executed separately (periodically) from the master wallet.
 */
export function accumulateBurnBudget(db: Database.Database, amountCents: number): void {
  db.prepare(`
    INSERT INTO burn_accumulator (amount_cents)
    VALUES (?)
  `).run(amountCents);
}

/** Get total accumulated burn budget that hasn't been executed yet */
export function getPendingBurnBudget(db: Database.Database): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total
    FROM burn_accumulator
    WHERE executed = 0
  `).get() as { total: number } | undefined;
  return row?.total ?? 0;
}

/** Mark accumulated burn entries as executed */
export function markBurnExecuted(db: Database.Database, upToId: number): void {
  db.prepare(`
    UPDATE burn_accumulator SET executed = 1 WHERE id <= ? AND executed = 0
  `).run(upToId);
}
