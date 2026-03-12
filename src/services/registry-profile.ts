/**
 * Registry profile service.
 *
 * Authenticates to the Regen Network registry server (api.regen.network)
 * using a subscriber's derived wallet key, then updates their profile
 * (name, description) via the GraphQL API.
 *
 * Auth flow (replicating what app.regen.network does via Keplr):
 * 1. GET  /marketplace/v1/csrfToken             → CSRF token + session cookie
 * 2. GET  /marketplace/v1/wallet-auth/nonce      → nonce for signing
 * 3. Sign ADR-036 arbitrary message with derived key
 * 4. POST /marketplace/v1/wallet-auth/login      → session established
 * 5. POST /marketplace/v1/graphql                → updateAccountById mutation
 */

import { Secp256k1HdWallet, makeSignDoc, serializeSignDoc } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { stringToPath } from "@cosmjs/crypto";
import { loadConfig } from "../config.js";

const REGISTRY_API = process.env.REGEN_REGISTRY_API_URL || "https://api.regen.network";

/**
 * Derive an Amino signer for a subscriber's Regen address.
 * Same HD path as subscriber-wallet.ts but returns the full signer.
 */
async function deriveSubscriberSigner(subscriberId: number): Promise<Secp256k1HdWallet> {
  const config = loadConfig();
  if (!config.walletMnemonic) {
    throw new Error("REGEN_WALLET_MNEMONIC is not configured");
  }
  const hdPath = stringToPath(`m/44'/118'/0'/0/${subscriberId}`);
  return Secp256k1HdWallet.fromMnemonic(config.walletMnemonic, {
    prefix: "regen",
    hdPaths: [hdPath],
  });
}

/**
 * Produce a Keplr-compatible signArbitrary signature (ADR-036).
 *
 * Keplr's signArbitrary signs an Amino StdSignDoc with:
 * - account_number: "0", sequence: "0", chain_id: ""
 * - fee: { gas: "0", amount: [] }
 * - msgs: [{ type: "sign/MsgSignData", value: { signer, data: base64(message) } }]
 * - memo: ""
 */
async function signArbitrary(
  signer: Secp256k1HdWallet,
  signerAddress: string,
  data: string,
): Promise<{ pub_key: { type: string; value: string }; signature: string }> {
  const base64Data = toBase64(new TextEncoder().encode(data));

  const signDoc = makeSignDoc(
    [
      {
        type: "sign/MsgSignData",
        value: {
          signer: signerAddress,
          data: base64Data,
        },
      },
    ],
    { gas: "0", amount: [] },
    "",  // chain_id
    "",  // memo
    "0", // account_number
    "0", // sequence
  );

  const { signed, signature } = await signer.signAmino(signerAddress, signDoc);
  return signature;
}

/** A minimal cookie jar for managing session cookies across requests. */
class CookieJar {
  private cookies = new Map<string, string>();

  addFromResponse(res: Response): void {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        this.cookies.set(pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1).trim());
      }
    }
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

export interface ProfileUpdateResult {
  success: boolean;
  accountId?: string;
  error?: string;
}

/**
 * Authenticate as a subscriber and update their profile on app.regen.network.
 *
 * This replicates the Keplr wallet login flow server-side using the
 * subscriber's derived HD wallet key.
 */
export async function updateRegistryProfile(
  subscriberId: number,
  profile: { name: string; description?: string; image?: string; bgImage?: string },
): Promise<ProfileUpdateResult> {
  const jar = new CookieJar();

  try {
    // 0. Derive signer and address
    const signer = await deriveSubscriberSigner(subscriberId);
    const [account] = await signer.getAccounts();
    const address = account.address;

    // 1. Get CSRF token
    const csrfRes = await fetch(`${REGISTRY_API}/marketplace/v1/csrfToken`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    jar.addFromResponse(csrfRes);
    const { token: csrfToken } = await csrfRes.json() as { token: string };
    if (!csrfToken) throw new Error("Failed to get CSRF token");

    // 2. Get nonce (may need to create account first)
    const description = profile.description ??
      "Regenerative Compute subscriber — funding verified ecological regeneration through AI";

    let nonceRes = await fetch(
      `${REGISTRY_API}/marketplace/v1/wallet-auth/nonce?` +
        new URLSearchParams({ userAddress: address }),
      {
        method: "GET",
        headers: {
          "X-CSRF-TOKEN": csrfToken,
          Cookie: jar.toString(),
        },
      },
    );
    jar.addFromResponse(nonceRes);
    let nonceData = await nonceRes.json() as { nonce?: string; error?: string };

    // Account doesn't exist yet — create it via GraphQL, then retry nonce
    if (nonceRes.status === 404 || !nonceData.nonce) {
      console.log(`Registry: creating account for ${address}...`);
      const createRes = await fetch(`${REGISTRY_API}/marketplace/v1/graphql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          Cookie: jar.toString(),
        },
        body: JSON.stringify({
          query: `mutation CreateAccount($input: CreateAccountInput!) {
            createAccount(input: $input) { account { id } }
          }`,
          variables: {
            input: {
              account: {
                type: "USER",
                addr: address,
                name: profile.name,
                description,
                ...(profile.image && { image: profile.image }),
                ...(profile.bgImage && { bgImage: profile.bgImage }),
              },
            },
          },
        }),
      });
      jar.addFromResponse(createRes);
      const createData = await createRes.json() as {
        data?: { createAccount?: { account?: { id: string } } };
        errors?: Array<{ message: string }>;
      };
      if (createData.errors?.length) {
        throw new Error(`CreateAccount failed: ${createData.errors.map((e) => e.message).join(", ")}`);
      }
      const createdId = createData.data?.createAccount?.account?.id;
      if (!createdId) throw new Error("CreateAccount returned no account ID");
      console.log(`Registry: account created (id=${createdId}), retrying nonce...`);

      // Retry nonce
      nonceRes = await fetch(
        `${REGISTRY_API}/marketplace/v1/wallet-auth/nonce?` +
          new URLSearchParams({ userAddress: address }),
        {
          method: "GET",
          headers: {
            "X-CSRF-TOKEN": csrfToken,
            Cookie: jar.toString(),
          },
        },
      );
      jar.addFromResponse(nonceRes);
      nonceData = await nonceRes.json() as { nonce?: string };
    }

    const nonce = nonceData.nonce;
    if (!nonce) throw new Error("Failed to get nonce after account creation");

    // 3. Sign the login message (same format as Keplr signArbitrary)
    const arbitraryData = JSON.stringify({
      title: "Regen Network Login",
      description: "This is a transaction that allows Regen Network to authenticate you with our application.",
      nonce,
    });
    const signature = await signArbitrary(signer, address, arbitraryData);

    // 4. Login
    const loginRes = await fetch(`${REGISTRY_API}/marketplace/v1/wallet-auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        Cookie: jar.toString(),
      },
      body: JSON.stringify({ signature }),
    });
    jar.addFromResponse(loginRes);
    const loginData = await loginRes.json() as { user?: { accountId: string }; error?: string };
    if (loginData.error || !loginData.user?.accountId) {
      throw new Error(`Login failed: ${loginData.error || "no accountId returned"}`);
    }
    const accountId = loginData.user.accountId;

    // 5. Update profile via GraphQL mutation
    const gqlRes = await fetch(`${REGISTRY_API}/marketplace/v1/graphql`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        Cookie: jar.toString(),
      },
      body: JSON.stringify({
        query: `mutation UpdateAccountById($input: UpdateAccountByIdInput!) {
          updateAccountById(input: $input) {
            account { id name description }
          }
        }`,
        variables: {
          input: {
            id: accountId,
            accountPatch: {
              name: profile.name,
              description,
              ...(profile.image && { image: profile.image }),
              ...(profile.bgImage && { bgImage: profile.bgImage }),
            },
          },
        },
      }),
    });
    const gqlData = await gqlRes.json() as {
      data?: { updateAccountById?: { account?: { id: string; name: string } } };
      errors?: Array<{ message: string }>;
    };

    if (gqlData.errors?.length) {
      throw new Error(`GraphQL error: ${gqlData.errors.map((e) => e.message).join(", ")}`);
    }

    console.log(
      `Registry profile updated: subscriber=${subscriberId} addr=${address} ` +
      `accountId=${accountId} name="${profile.name}"`
    );

    return { success: true, accountId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Registry profile update failed: subscriber=${subscriberId} error=${msg}`);
    return { success: false, error: msg };
  }
}
