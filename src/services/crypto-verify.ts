/**
 * Cryptocurrency transaction verification service
 *
 * Verifies payments on Ethereum, Bitcoin, Solana, and Tron by querying
 * public RPCs / APIs. Each verifier checks that the tx sent funds to
 * our receive address and returns structured payment details.
 */

// --- Type definitions ---

export interface VerifiedPayment {
  chain: "ethereum" | "bitcoin" | "solana" | "tron";
  txHash: string;
  fromAddress: string;
  token: string; // "ETH", "USDC", "USDT", "BTC", "SOL", "TRX"
  amount: string; // standard units (e.g. "0.5" ETH, "100" USDC)
  confirmed: boolean;
  confirmations: number;
}

// --- Receive addresses ---

const ADDRESSES = {
  ethereum: "0x0687cC26060FE12Fd4A6210c2f30Cf24a9853C6b",
  bitcoin: "bc1qa2wlapdsmf0pp8x3gamp6elaaehkarpgdre5vq",
  solana: "9npQZwDxDAcbnpVpQKzKYtLDKN8xpAMfE5FSAuSGsaJh",
  tron: "TRNx7dZXm2HNqaUp9oLTSLBhN4tHmsyUfL",
};

// --- ERC-20 constants ---

const ERC20_CONTRACTS: Record<string, { token: string; decimals: number }> = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    token: "USDC",
    decimals: 6,
  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    token: "USDT",
    decimals: 6,
  },
};

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// --- Ethereum RPCs (fallback list) ---

const ETH_RPCS = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
];

// --- Helpers ---

function hexToDecimal(hex: string): bigint {
  return BigInt(hex);
}

function weiToEth(wei: bigint): string {
  const whole = wei / 1000000000000000000n;
  const frac = wei % 1000000000000000000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function tokenUnits(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function addressFromTopic(topic: string): string {
  // topics[1] and topics[2] are 32-byte padded addresses
  return "0x" + topic.slice(26).toLowerCase();
}

// --- Ethereum verification ---

async function ethRpcCall(
  method: string,
  params: unknown[],
): Promise<unknown> {
  let lastError: Error | null = null;
  for (const rpc of ETH_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      });
      const json = (await res.json()) as {
        result?: unknown;
        error?: { message: string };
      };
      if (json.error) throw new Error(`RPC error: ${json.error.message}`);
      return json.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("All Ethereum RPCs failed");
}

export async function verifyEthereumTx(
  txHash: string,
): Promise<VerifiedPayment> {
  // Fetch tx and receipt in parallel
  const [txRaw, receiptRaw, blockNumRaw] = await Promise.all([
    ethRpcCall("eth_getTransactionByHash", [txHash]),
    ethRpcCall("eth_getTransactionReceipt", [txHash]),
    ethRpcCall("eth_blockNumber", []),
  ]);

  const tx = txRaw as {
    from: string;
    to: string | null;
    value: string;
    blockNumber: string | null;
  } | null;

  const receipt = receiptRaw as {
    status: string;
    blockNumber: string;
    logs: Array<{
      address: string;
      topics: string[];
      data: string;
    }>;
  } | null;

  if (!tx) throw new Error(`Ethereum tx not found: ${txHash}`);
  if (!receipt) throw new Error(`Ethereum tx receipt not found (pending?): ${txHash}`);

  const currentBlock = hexToDecimal(blockNumRaw as string);
  const txBlock = hexToDecimal(receipt.blockNumber);
  const confirmations = Number(currentBlock - txBlock);
  const ourAddr = ADDRESSES.ethereum.toLowerCase();

  // Check for ERC-20 Transfer events to our address first
  for (const log of receipt.logs) {
    const contractAddr = log.address.toLowerCase();
    const erc20 = ERC20_CONTRACTS[contractAddr];
    if (!erc20) continue;
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;

    const toAddr = addressFromTopic(log.topics[2]);
    if (toAddr !== ourAddr) continue;

    const amount = hexToDecimal(log.data);

    if (confirmations < 1) {
      throw new Error(
        `Ethereum ${erc20.token} tx has ${confirmations} confirmations (need ≥1)`,
      );
    }

    return {
      chain: "ethereum",
      txHash,
      fromAddress: tx.from,
      token: erc20.token,
      amount: tokenUnits(amount, erc20.decimals),
      confirmed: true,
      confirmations,
    };
  }

  // Native ETH transfer
  if (!tx.to || tx.to.toLowerCase() !== ourAddr) {
    throw new Error(
      `Ethereum tx recipient ${tx.to} does not match our address ${ADDRESSES.ethereum}`,
    );
  }

  const value = hexToDecimal(tx.value);
  if (value === 0n) {
    throw new Error("Ethereum tx has zero value and no matching ERC-20 transfer");
  }

  if (confirmations < 12) {
    throw new Error(
      `Ethereum ETH tx has ${confirmations} confirmations (need ≥12)`,
    );
  }

  return {
    chain: "ethereum",
    txHash,
    fromAddress: tx.from,
    token: "ETH",
    amount: weiToEth(value),
    confirmed: true,
    confirmations,
  };
}

// --- Bitcoin verification ---

export async function verifyBitcoinTx(
  txHash: string,
): Promise<VerifiedPayment> {
  const res = await fetch(`https://mempool.space/api/tx/${txHash}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Bitcoin tx not found: ${txHash}`);
    throw new Error(`mempool.space API error: ${res.status} ${res.statusText}`);
  }

  const tx = (await res.json()) as {
    txid: string;
    vin: Array<{ prevout: { scriptpubkey_address?: string } }>;
    vout: Array<{ scriptpubkey_address?: string; value: number }>;
    status: { confirmed: boolean; block_height?: number };
  };

  // Find matching output
  const ourAddr = ADDRESSES.bitcoin;
  const matchingVout = tx.vout.find(
    (v) => v.scriptpubkey_address === ourAddr,
  );

  if (!matchingVout) {
    throw new Error(
      `Bitcoin tx has no output to our address ${ourAddr}`,
    );
  }

  const satoshis = matchingVout.value;
  const btcAmount = (satoshis / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

  let confirmations = 0;
  if (tx.status.confirmed && tx.status.block_height != null) {
    const tipRes = await fetch("https://mempool.space/api/blocks/tip/height");
    if (tipRes.ok) {
      const tipHeight = Number(await tipRes.text());
      confirmations = tipHeight - tx.status.block_height + 1;
    }
  }

  if (!tx.status.confirmed) {
    throw new Error("Bitcoin tx is not yet confirmed (still in mempool)");
  }

  // Derive sender from first input
  const fromAddress = tx.vin[0]?.prevout?.scriptpubkey_address ?? "unknown";

  return {
    chain: "bitcoin",
    txHash,
    fromAddress,
    token: "BTC",
    amount: btcAmount,
    confirmed: true,
    confirmations,
  };
}

// --- Solana verification ---

async function solanaRpcCall(
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as {
    result?: unknown;
    error?: { message: string };
  };
  if (json.error) throw new Error(`Solana RPC error: ${json.error.message}`);
  return json.result;
}

const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function verifySolanaTx(
  txHash: string,
): Promise<VerifiedPayment> {
  const result = (await solanaRpcCall("getTransaction", [
    txHash,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ])) as {
    slot: number;
    meta: {
      err: unknown;
      preBalances: number[];
      postBalances: number[];
      preTokenBalances: Array<{
        accountIndex: number;
        mint: string;
        owner: string;
        uiTokenAmount: { uiAmountString: string };
      }>;
      postTokenBalances: Array<{
        accountIndex: number;
        mint: string;
        owner: string;
        uiTokenAmount: { uiAmountString: string };
      }>;
    };
    transaction: {
      message: {
        accountKeys: Array<{ pubkey: string }>;
      };
    };
  } | null;

  if (!result) throw new Error(`Solana tx not found: ${txHash}`);
  if (result.meta.err) {
    throw new Error(`Solana tx failed: ${JSON.stringify(result.meta.err)}`);
  }

  const ourAddr = ADDRESSES.solana;
  const accountKeys = result.transaction.message.accountKeys;

  // Check for SPL USDC transfer
  const preUsdc = result.meta.preTokenBalances.find(
    (b) => b.owner === ourAddr && b.mint === USDC_MINT_SOLANA,
  );
  const postUsdc = result.meta.postTokenBalances.find(
    (b) => b.owner === ourAddr && b.mint === USDC_MINT_SOLANA,
  );

  if (postUsdc) {
    const preBal = preUsdc
      ? parseFloat(preUsdc.uiTokenAmount.uiAmountString)
      : 0;
    const postBal = parseFloat(postUsdc.uiTokenAmount.uiAmountString);
    const diff = postBal - preBal;

    if (diff > 0) {
      // Find sender: any account key that isn't ours and signed the tx
      const fromAddress =
        accountKeys.find((k) => k.pubkey !== ourAddr)?.pubkey ?? "unknown";

      return {
        chain: "solana",
        txHash,
        fromAddress,
        token: "USDC",
        amount: diff.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
        confirmed: true,
        confirmations: 0, // Solana finalized = confirmed
      };
    }
  }

  // Check for native SOL transfer
  const ourIndex = accountKeys.findIndex((k) => k.pubkey === ourAddr);
  if (ourIndex === -1) {
    throw new Error(
      `Solana tx does not involve our address ${ourAddr}`,
    );
  }

  const preSol = result.meta.preBalances[ourIndex];
  const postSol = result.meta.postBalances[ourIndex];
  const diffLamports = postSol - preSol;

  if (diffLamports <= 0) {
    throw new Error(
      `Solana tx did not send funds to our address ${ourAddr}`,
    );
  }

  // Convert lamports to SOL (1 SOL = 1e9 lamports)
  const solAmount = (diffLamports / 1e9)
    .toFixed(9)
    .replace(/0+$/, "")
    .replace(/\.$/, "");

  const fromAddress =
    accountKeys.find((k) => k.pubkey !== ourAddr)?.pubkey ?? "unknown";

  return {
    chain: "solana",
    txHash,
    fromAddress,
    token: "SOL",
    amount: solAmount,
    confirmed: true,
    confirmations: 0,
  };
}

// --- Tron verification ---

/** Convert base58 Tron address to hex (41-prefixed) */
function tronAddressToHex(base58Addr: string): string {
  // Base58 decode table
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const char of base58Addr) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * 58n + BigInt(idx);
  }
  // Convert to hex, strip 4-byte checksum (8 hex chars)
  const hex = num.toString(16).padStart(50, "0"); // 25 bytes = 50 hex
  return hex.slice(0, 42); // 21 bytes = 42 hex (41 prefix + 20 byte address)
}

const USDT_CONTRACT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function verifyTronTx(
  txHash: string,
): Promise<VerifiedPayment> {
  // Fetch transaction info
  const txRes = await fetch(
    `https://api.trongrid.io/v1/transactions/${txHash}`,
  );
  if (!txRes.ok) {
    throw new Error(`TronGrid API error: ${txRes.status} ${txRes.statusText}`);
  }
  const txData = (await txRes.json()) as {
    data?: Array<{
      txID: string;
      ret: Array<{ contractRet: string }>;
      raw_data: {
        contract: Array<{
          type: string;
          parameter: {
            value: {
              to_address?: string;
              owner_address?: string;
              amount?: number;
              contract_address?: string;
              data?: string;
            };
          };
        }>;
      };
    }>;
  };

  if (!txData.data || txData.data.length === 0) {
    throw new Error(`Tron tx not found: ${txHash}`);
  }

  const tx = txData.data[0];
  const contractRet = tx.ret?.[0]?.contractRet;

  if (contractRet !== "SUCCESS") {
    throw new Error(`Tron tx not confirmed (status: ${contractRet})`);
  }

  const contract = tx.raw_data.contract[0];
  const ourHex = tronAddressToHex(ADDRESSES.tron).toLowerCase();

  // Check for TRC-20 USDT via events
  const eventsRes = await fetch(
    `https://api.trongrid.io/v1/transactions/${txHash}/events`,
  );
  if (eventsRes.ok) {
    const eventsData = (await eventsRes.json()) as {
      data?: Array<{
        event_name: string;
        contract_address: string;
        result: Record<string, string>;
      }>;
    };

    if (eventsData.data) {
      for (const event of eventsData.data) {
        if (event.event_name !== "Transfer") continue;
        if (event.contract_address !== USDT_CONTRACT_TRON) continue;

        const toHex = event.result["to"] || event.result["1"];
        const amountStr = event.result["value"] || event.result["2"];

        if (!toHex || !amountStr) continue;

        // TronGrid event results may have hex or base58 addresses
        const toNorm = toHex.toLowerCase().startsWith("41")
          ? toHex.toLowerCase()
          : toHex.toLowerCase();

        if (toNorm === ourHex || toHex === ADDRESSES.tron) {
          const amount = tokenUnits(BigInt(amountStr), 6);
          const fromHex = event.result["from"] || event.result["0"] || "unknown";

          return {
            chain: "tron",
            txHash,
            fromAddress: fromHex,
            token: "USDT",
            amount,
            confirmed: true,
            confirmations: 0,
          };
        }
      }
    }
  }

  // Native TRX transfer
  if (contract.type !== "TransferContract") {
    throw new Error(
      `Tron tx is not a transfer (type: ${contract.type}) and no matching TRC-20 event found`,
    );
  }

  const toAddr = contract.parameter.value.to_address?.toLowerCase();
  if (toAddr !== ourHex) {
    throw new Error(
      `Tron tx recipient does not match our address ${ADDRESSES.tron}`,
    );
  }

  // Amount in sun → TRX (1 TRX = 1e6 sun)
  const sunAmount = contract.parameter.value.amount ?? 0;
  const trxAmount = (sunAmount / 1e6)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");

  const fromAddress = contract.parameter.value.owner_address ?? "unknown";

  return {
    chain: "tron",
    txHash,
    fromAddress,
    token: "TRX",
    amount: trxAmount,
    confirmed: true,
    confirmations: 0,
  };
}

// --- Main dispatcher ---

export async function verifyPayment(
  chain: string,
  txHash: string,
): Promise<VerifiedPayment> {
  const normalizedChain = chain.toLowerCase().trim();

  switch (normalizedChain) {
    case "ethereum":
    case "eth":
      return verifyEthereumTx(txHash);
    case "bitcoin":
    case "btc":
      return verifyBitcoinTx(txHash);
    case "solana":
    case "sol":
      return verifySolanaTx(txHash);
    case "tron":
    case "trx":
      return verifyTronTx(txHash);
    default:
      throw new Error(
        `Unknown chain "${chain}". Supported: ethereum, bitcoin, solana, tron`,
      );
  }
}
