/**
 * Magic link authentication for the subscriber dashboard.
 *
 * Flow:
 *   1. Subscriber enters email on /dashboard/login
 *   2. Server generates token, stores in magic_links table, emails link
 *   3. Subscriber clicks link → /dashboard/verify?token=...
 *   4. Server verifies token (single-use, time-limited), sets session cookie
 *   5. Session cookie is HMAC-signed, self-contained (no server session store)
 */

import { createHmac } from "crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a signed session token containing the subscriber's email and expiry.
 * Format: base64(email|expiryMs|hmac)
 */
export function createSessionToken(email: string, secret: string): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${email}|${expiry}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

/**
 * Verify a session token. Returns the email if valid, null otherwise.
 */
export function verifySessionToken(token: string, secret: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;

    const [email, expiryStr, providedHmac] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return null;

    const expectedHmac = createHmac("sha256", secret)
      .update(`${email}|${expiryStr}`)
      .digest("hex");

    // Constant-time comparison
    if (expectedHmac.length !== providedHmac.length) return null;
    let diff = 0;
    for (let i = 0; i < expectedHmac.length; i++) {
      diff |= expectedHmac.charCodeAt(i) ^ providedHmac.charCodeAt(i);
    }
    if (diff !== 0) return null;

    return email;
  } catch {
    return null;
  }
}

/**
 * Parse the session cookie from a cookie header string.
 */
export function getSessionEmail(cookieHeader: string | undefined, secret: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("rfa_session="));
  if (!match) return null;
  const token = match.slice("rfa_session=".length);
  return verifySessionToken(token, secret);
}
