/**
 * Retirement orchestration service.
 *
 * Extracts the core retirement flow from tools/retire.ts into a reusable service
 * that returns structured results. Both the MCP tool and REST API call this.
 */

import { loadConfig, isWalletConfigured } from "../config.js";
import { initWallet, signAndBroadcast } from "./wallet.js";
import { selectBestOrders } from "./order-selector.js";
import { waitForRetirement } from "./indexer.js";
import { CryptoPaymentProvider } from "./payment/crypto.js";
import { StripePaymentProvider } from "./payment/stripe-stub.js";
import type { PaymentProvider } from "./payment/types.js";

export interface RetirementParams {
  creditClass?: string;
  quantity?: number;
  beneficiaryName?: string;
  jurisdiction?: string;
  reason?: string;
}

export interface RetirementResult {
  status: "success" | "marketplace_fallback";
  txHash?: string;
  creditsRetired?: string;
  cost?: string;
  blockHeight?: number;
  certificateId?: string;
  marketplaceUrl?: string;
  message?: string;
  remainingBalanceCents?: number;
  jurisdiction?: string;
  reason?: string;
  beneficiaryName?: string;
}

async function checkPrepaidBalance(): Promise<{ available: boolean; balance_cents: number; topup_url?: string } | null> {
  const config = loadConfig();
  if (!config.balanceApiKey || !config.balanceUrl) return null;

  try {
    const res = await fetch(`${config.balanceUrl}/balance`, {
      headers: { Authorization: `Bearer ${config.balanceApiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { balance_cents: number; topup_url?: string };
    return { available: data.balance_cents > 0, balance_cents: data.balance_cents, topup_url: data.topup_url };
  } catch {
    return null;
  }
}

async function debitPrepaidBalance(
  amountCents: number,
  description: string,
  retirementTxHash?: string,
  creditClass?: string,
  creditsRetired?: number
): Promise<{ success: boolean; balance_cents: number; topup_url?: string }> {
  const config = loadConfig();
  if (!config.balanceApiKey || !config.balanceUrl) {
    return { success: false, balance_cents: 0 };
  }

  try {
    const res = await fetch(`${config.balanceUrl}/debit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.balanceApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount_cents: amountCents,
        description,
        retirement_tx_hash: retirementTxHash,
        credit_class: creditClass,
        credits_retired: creditsRetired,
      }),
    });
    return await res.json() as { success: boolean; balance_cents: number; topup_url?: string };
  } catch {
    return { success: false, balance_cents: 0 };
  }
}

function getMarketplaceLink(): string {
  const config = loadConfig();
  return `${config.marketplaceUrl}/projects/1?buying_options_filters=credit_card`;
}

function getPaymentProvider(): PaymentProvider {
  const config = loadConfig();
  if (config.paymentProvider === "stripe") {
    return new StripePaymentProvider();
  }
  return new CryptoPaymentProvider();
}

export function formatAmount(
  amountMicro: bigint,
  exponent: number,
  displayDenom: string
): string {
  const divisor = 10 ** exponent;
  const whole = amountMicro / BigInt(divisor);
  const frac = amountMicro % BigInt(divisor);
  const fracStr = frac.toString().padStart(exponent, "0").replace(/0+$/, "");
  if (fracStr) {
    return `${whole}.${fracStr} ${displayDenom}`;
  }
  return `${whole} ${displayDenom}`;
}

function fallback(message: string, params: RetirementParams): RetirementResult {
  return {
    status: "marketplace_fallback",
    marketplaceUrl: getMarketplaceLink(),
    message,
    beneficiaryName: params.beneficiaryName,
  };
}

/**
 * Execute a credit retirement. Returns a structured result that both
 * the MCP tool (markdown) and REST API (JSON) can consume.
 */
export async function executeRetirement(params: RetirementParams): Promise<RetirementResult> {
  const { creditClass, beneficiaryName } = params;

  // Path A: No wallet -> marketplace link
  if (!isWalletConfigured()) {
    const balance = await checkPrepaidBalance();
    if (balance && balance.available) {
      return fallback(
        `You have a prepaid balance of $${(balance.balance_cents / 100).toFixed(2)}, ` +
        `but no REGEN wallet is configured for on-chain retirement. ` +
        `Set REGEN_WALLET_MNEMONIC in your .env to enable automatic retirement from your balance.`,
        params
      );
    }
    return fallback("No wallet configured for on-chain retirement.", params);
  }

  // Path B: Direct on-chain retirement
  const config = loadConfig();
  const usePrepaid = !!(config.balanceApiKey && config.balanceUrl);
  const retireJurisdiction = params.jurisdiction || config.defaultJurisdiction;
  const retireReason = params.reason || "Regenerative contribution via Regenerative Compute";
  const retireQuantity = params.quantity || 1;

  try {
    const { address } = await initWallet();

    const selection = await selectBestOrders(
      creditClass ? (creditClass.startsWith("C") ? "carbon" : "biodiversity") : undefined,
      retireQuantity
    );

    if (selection.orders.length === 0) {
      return fallback("No matching sell orders found on-chain. Try the marketplace instead.", params);
    }

    if (selection.insufficientSupply) {
      const available = parseFloat(selection.totalQuantity);
      return fallback(
        `Only ${available.toFixed(4)} credits available on-chain (requested ${retireQuantity}). ` +
        `You can try a smaller quantity or use the marketplace.`,
        params
      );
    }

    const costCents = Number(selection.totalCostMicro / BigInt(10 ** (selection.exponent - 2)));
    if (usePrepaid) {
      const balance = await checkPrepaidBalance();
      if (!balance || !balance.available || balance.balance_cents < costCents) {
        const displayCost = formatAmount(selection.totalCostMicro, selection.exponent, selection.displayDenom);
        const balanceStr = balance ? `$${(balance.balance_cents / 100).toFixed(2)}` : "$0.00";
        const topupNote = balance?.topup_url ? ` Top up your balance: ${balance.topup_url}` : "";
        return fallback(
          `Insufficient prepaid balance. Need ${displayCost} but balance is ${balanceStr}.${topupNote}`,
          params
        );
      }
    }

    const provider = getPaymentProvider();
    const auth = await provider.authorizePayment(
      selection.totalCostMicro,
      selection.paymentDenom,
      { buyer: address, creditClass: creditClass || "any" }
    );

    if (auth.status === "failed") {
      const displayCost = formatAmount(selection.totalCostMicro, selection.exponent, selection.displayDenom);
      return fallback(
        auth.message || `Insufficient wallet balance. Need ${displayCost} to purchase ${retireQuantity} credits.`,
        params
      );
    }

    const buyOrders = selection.orders.map((order) => ({
      sellOrderId: BigInt(order.sellOrderId),
      quantity: order.quantity,
      bidPrice: {
        denom: order.askDenom,
        amount: order.askAmount,
      },
      disableAutoRetire: false,
      retirementJurisdiction: retireJurisdiction,
      retirementReason: retireReason,
    }));

    const msg = {
      typeUrl: "/regen.ecocredit.marketplace.v1.MsgBuyDirect",
      value: {
        buyer: address,
        orders: buyOrders,
      },
    };

    let txResult;
    try {
      txResult = await signAndBroadcast([msg]);
    } catch (err) {
      try { await provider.refundPayment(auth.id); } catch { /* ignore */ }
      const errMsg = err instanceof Error ? err.message : String(err);
      return fallback(`Transaction broadcast failed: ${errMsg}`, params);
    }

    if (txResult.code !== 0) {
      try { await provider.refundPayment(auth.id); } catch { /* ignore */ }
      return fallback(
        `Transaction rejected (code ${txResult.code}): ${txResult.rawLog || "unknown error"}`,
        params
      );
    }

    await provider.capturePayment(auth.id);

    if (usePrepaid) {
      await debitPrepaidBalance(
        costCents,
        `Retired ${selection.totalQuantity} credits (${creditClass || "mixed"})`,
        txResult.transactionHash,
        creditClass,
        parseFloat(selection.totalQuantity)
      );
    }

    const retirement = await waitForRetirement(txResult.transactionHash);

    const displayCost = formatAmount(selection.totalCostMicro, selection.exponent, selection.displayDenom);

    const result: RetirementResult = {
      status: "success",
      txHash: txResult.transactionHash,
      creditsRetired: selection.totalQuantity,
      cost: displayCost,
      blockHeight: txResult.height,
      jurisdiction: retireJurisdiction,
      reason: retireReason,
      beneficiaryName,
    };

    if (retirement) {
      result.certificateId = retirement.nodeId;
    }

    if (usePrepaid) {
      const remaining = await checkPrepaidBalance();
      if (remaining) {
        result.remainingBalanceCents = remaining.balance_cents;
      }
    }

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return fallback(`Direct retirement failed: ${errMsg}`, params);
  }
}
