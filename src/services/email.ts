/**
 * Monthly certificate email service.
 *
 * Sends personalized impact emails to subscribers after each pool retirement.
 * Uses Postmark HTTP API (no SDK dependency — native fetch).
 *
 * Flow:
 *   executePoolRun() → recordAttributions() → sendMonthlyEmails()
 *     → for each subscriber: render HTML → POST to Postmark
 */

import type Database from "better-sqlite3";
import { loadConfig } from "../config.js";
import {
  getAttributionsByRun,
  getSubscribersWithEmails,
  getCumulativeAttribution,
  type Attribution,
  type Subscriber,
  type SubscriberWithEmail,
  type CumulativeAttribution,
} from "../server/db.js";
import type { PoolRunResult, CreditTypeResult } from "./pool.js";

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";

// PNG logo — Gmail, Outlook, and most email clients block SVG images
const REGEN_LOGO_URL = "https://compute.regen.network/logo.png";

/** Shared email header: REGENERATIVE COMPUTE title + Powered by Regen Network */
function emailHeader(): string {
  return `
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 24px 24px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px; font-family: 'Mulish', Arial, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 0.02em; color: #101570;">REGENERATIVE COMPUTE</p>
              <p style="margin: 0 0 12px; font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">Powered by Regen Network</p>
              <img src="${REGEN_LOGO_URL}" alt="Regen Network" width="120" height="auto" style="display:block;margin:0 auto;max-width:120px;" />
            </td>
          </tr>`;
}

/** Shared email footer */
function emailFooter(manageUrl?: string, unsubscribeEmailUrl?: string): string {
  return `
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 13px; color: #6b7280;">
                      Powered by <a href="https://regen.network" style="color: #4FB573; text-decoration: none; font-weight: 600;">Regen Network</a>
                    </p>
                    <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
                      Every credit funds real ecological regeneration.
                    </p>
                    ${manageUrl ? `
                    <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
                      <a href="${escapeHtml(manageUrl)}" style="color: #6b7280; text-decoration: underline;">Manage subscription</a>
                      ${unsubscribeEmailUrl
                        ? `&nbsp;&middot;&nbsp;
                      <a href="${escapeHtml(unsubscribeEmailUrl)}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from emails</a>`
                        : `&nbsp;&middot;&nbsp;
                      <a href="${escapeHtml(manageUrl)}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>`
                      }
                    </p>
                    ` : ""}
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #d1d5db;">
                      Regen Compute &middot; Regenerative AI
                    </p>
                  </td>
                </tr>`;
}

/** Data needed to render one subscriber's email */
interface EmailData {
  email: string;
  plan: string;
  contributionDollars: string;
  thisMonth: {
    carbon: number;
    biodiversity: number;
    uss: number;
  };
  cumulative: CumulativeAttribution;
  certificateUrl: string | null;
  txHashes: { label: string; hash: string; url: string }[];
  manageUrl: string;
  dashboardUrl: string;
  unsubscribeEmailUrl: string;
  referralLink: string | null;
}

/** Pick the best certificate URL from the pool run result */
function pickCertificateUrl(result: PoolRunResult, baseUrl: string): string | null {
  // Prefer carbon tx (50% budget, most recognized), fall back to biodiversity, then USS
  const hash = result.carbon.txHash ?? result.biodiversity.txHash ?? result.uss.txHash;
  if (!hash) return null;
  // Certificate pages are keyed by retirement nodeId which we get from the indexer.
  // For now, link to the tx on Mintscan since we don't have the nodeId in the pool result.
  return `https://www.mintscan.io/regen/tx/${hash}`;
}

/** Collect non-null tx hashes with labels */
function collectTxHashes(result: PoolRunResult): { label: string; hash: string; url: string }[] {
  const hashes: { label: string; hash: string; url: string }[] = [];
  if (result.carbon.txHash) {
    hashes.push({
      label: "Carbon",
      hash: result.carbon.txHash,
      url: `https://www.mintscan.io/regen/tx/${result.carbon.txHash}`,
    });
  }
  if (result.biodiversity.txHash) {
    hashes.push({
      label: "Biodiversity",
      hash: result.biodiversity.txHash,
      url: `https://www.mintscan.io/regen/tx/${result.biodiversity.txHash}`,
    });
  }
  if (result.uss.txHash) {
    hashes.push({
      label: "USS/Marine",
      hash: result.uss.txHash,
      url: `https://www.mintscan.io/regen/tx/${result.uss.txHash}`,
    });
  }
  return hashes;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return hash.slice(0, 8) + "..." + hash.slice(-8);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCredits(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** Build a human-readable list of credit types retired this month */
function describeRetiredTypes(thisMonth: { carbon: number; biodiversity: number; uss: number }): string {
  const types: string[] = [];
  if (thisMonth.carbon > 0) types.push("carbon removal");
  if (thisMonth.biodiversity > 0) types.push("biodiversity protection");
  if (thisMonth.uss > 0) types.push("marine stewardship");
  if (types.length === 0) return "ecological regeneration";
  if (types.length === 1) return types[0];
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")}, and ${types[types.length - 1]}`;
}

/** Count distinct credit types retired this month */
function countProjectTypes(thisMonth: { carbon: number; biodiversity: number; uss: number }): number {
  let count = 0;
  if (thisMonth.carbon > 0) count++;
  if (thisMonth.biodiversity > 0) count++;
  if (thisMonth.uss > 0) count++;
  return count;
}

/** Render the full HTML email for one subscriber */
function renderEmailHtml(data: EmailData): string {
  const planName = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
  const totalThisMonth = data.thisMonth.carbon + data.thisMonth.biodiversity + data.thisMonth.uss;
  const totalCumulative = data.cumulative.total_carbon + data.cumulative.total_biodiversity + data.cumulative.total_uss;
  const projectCount = countProjectTypes(data.thisMonth);
  const impactDescription = describeRetiredTypes(data.thisMonth);

  const shareText = encodeURIComponent(
    `I just retired ecological credits through @Regen_compute to account for my AI usage. ${formatCredits(totalCumulative)} credits retired and counting. compute.regen.network`
  );
  const shareUrl = data.certificateUrl ? encodeURIComponent(data.certificateUrl) : "";

  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}${shareUrl ? `&url=${shareUrl}` : ""}`;
  const linkedinUrl = data.certificateUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`
    : "";

  // Build tx hash rows
  let txRows = "";
  for (const tx of data.txHashes) {
    txRows += `
              <tr>
                <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 13px; color: #6b7280;">${escapeHtml(tx.label)}</td>
                <td style="padding: 4px 0; font-family: 'Courier New', monospace; font-size: 12px; text-align: right;">
                  <a href="${escapeHtml(tx.url)}" style="color: #2d6a4f; text-decoration: none;">${escapeHtml(truncateHash(tx.hash))}</a>
                </td>
              </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your Monthly Impact Report - Regen Compute</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Mulish', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          ${emailHeader()}

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 0 0 12px 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: none;">

                <!-- Card header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #4FB573, #79C6AA); padding: 28px 32px; text-align: center;">
                    <p style="margin: 0 0 4px; font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.85);">MONTHLY IMPACT REPORT</p>
                    <p style="margin: 0; font-family: 'Mulish', Arial, sans-serif; font-size: 22px; font-weight: 800; color: #ffffff;">Your Latest Retirements Are In!</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 28px 32px;">

                    <!-- Greeting -->
                    <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.6;">
                      Your <strong>${escapeHtml(planName)}</strong> subscription ($${escapeHtml(data.contributionDollars)}/mo) funded verified ecological regeneration this month:
                    </p>

                    <!-- Inspiring copy -->
                    <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 15px; color: #374151; line-height: 1.6; font-style: italic;">
                      This month, your subscription retired ${escapeHtml(formatCredits(totalThisMonth))} credits${projectCount > 1 ? ` across ${projectCount} credit types` : ""}, funding ${escapeHtml(impactDescription)}.${data.cumulative.months_active > 1 ? ` Over ${data.cumulative.months_active} months, you've now retired ${escapeHtml(formatCredits(totalCumulative))} credits total.` : ""} Every credit is permanently recorded on-chain.
                    </p>

                    <!-- This Month box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f7f4; border-radius: 8px; border: 1px solid #d1e7dd; margin-bottom: 16px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2d6a4f;">This Month</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">Carbon Credits</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">${escapeHtml(formatCredits(data.thisMonth.carbon))}</td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">Biodiversity Credits</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">${escapeHtml(formatCredits(data.thisMonth.biodiversity))}</td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">USS/Marine Credits</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">${escapeHtml(formatCredits(data.thisMonth.uss))}</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding: 8px 0 0; border-top: 1px solid #d1e7dd;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                  <tr>
                                    <td style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #2d6a4f;">Total</td>
                                    <td style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #2d6a4f; text-align: right;">${escapeHtml(formatCredits(totalThisMonth))} credits</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Cumulative box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">Cumulative Impact</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">Total credits retired</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">${escapeHtml(formatCredits(totalCumulative))}</td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">Total contributed</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">$${escapeHtml((data.cumulative.total_contribution_cents / 100).toFixed(2))}</td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">Months active</td>
                              <td style="padding: 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right;">${data.cumulative.months_active}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA: View Dashboard -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(data.dashboardUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #4FB573; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">View Your Dashboard</a>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA: View Certificate -->
                    ${data.certificateUrl ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(data.certificateUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #2d6a4f; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">View Certificate</a>
                        </td>
                      </tr>
                    </table>
                    ` : ""}

                    <!-- Share buttons -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center" style="padding: 16px 0 8px;">
                          <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Share Your Impact</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 0 6px;">
                                <a href="${escapeHtml(twitterUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #1a1a1a; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px;">Post on X</a>
                              </td>
                              ${linkedinUrl ? `
                              <td style="padding: 0 6px;">
                                <a href="${escapeHtml(linkedinUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #0a66c2; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px;">Share on LinkedIn</a>
                              </td>
                              ` : ""}
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- On-chain proof -->
                    ${data.txHashes.length > 0 ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">On-Chain Proof</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            ${txRows}
                          </table>
                        </td>
                      </tr>
                    </table>
                    ` : ""}

                    ${data.referralLink ? `
                    <!-- Referral section -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf5ff; border-radius: 8px; border: 1px solid #d8b4fe; margin-top: 24px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 15px; font-weight: 700; color: #7c3aed;">Know someone who uses AI?</p>
                          <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 14px; color: #555; line-height: 1.5;">Give them their first month free and earn bonus credit retirements.</p>
                          <a href="${escapeHtml(data.referralLink)}" style="display: inline-block; padding: 12px 28px; background-color: #7c3aed; color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">Share Your Referral Link</a>
                        </td>
                      </tr>
                    </table>
                    ` : ""}

                  </td>
                </tr>

                ${emailFooter(data.manageUrl, data.unsubscribeEmailUrl)}

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Send a single email via Postmark HTTP API */
async function sendViaPostmark(
  token: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  manageUrl: string,
): Promise<void> {
  const config = loadConfig();
  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      ...(config.emailReplyToAddress ? { ReplyTo: config.emailReplyToAddress } : {}),
      Subject: subject,
      HtmlBody: htmlBody,
      MessageStream: "outbound",
      Headers: [
        {
          Name: "List-Unsubscribe",
          Value: `<${manageUrl}>`,
        },
        {
          Name: "List-Unsubscribe-Post",
          Value: "List-Unsubscribe=One-Click",
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark API error (${response.status}): ${body}`);
  }
}

/**
 * Send monthly impact emails to all subscribers after a pool run.
 *
 * Called from pool.ts after recordAttributions(). Non-blocking — errors
 * are collected and returned but do not throw.
 */
export async function sendMonthlyEmails(
  poolRunId: number,
  subscribers: Subscriber[],
  db: Database.Database,
  result: PoolRunResult,
  baseUrl?: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const config = loadConfig();
  const errors: string[] = [];

  if (!config.emailEnabled) {
    return { sent: 0, failed: 0, errors: ["Email disabled via EMAIL_ENABLED=false"] };
  }

  if (!config.postmarkServerToken) {
    return { sent: 0, failed: 0, errors: ["POSTMARK_SERVER_TOKEN not configured"] };
  }

  const serverUrl = baseUrl ?? config.balanceUrl ?? "https://compute.regen.network";

  // Get attributions for this pool run
  const attributions = getAttributionsByRun(db, poolRunId);
  const attrBySubscriber = new Map<number, Attribution>();
  for (const attr of attributions) {
    attrBySubscriber.set(attr.subscriber_id, attr);
  }

  // Get subscriber emails
  const subscriberIds = subscribers.map((s) => s.id);
  const subsWithEmails = getSubscribersWithEmails(db, subscriberIds);

  const certificateUrl = pickCertificateUrl(result, serverUrl);
  const txHashes = collectTxHashes(result);

  // Look up referral codes for each subscriber's user
  const userReferralCodes = new Map<number, string | null>();
  for (const sub of subsWithEmails) {
    const userRow = db.prepare("SELECT referral_code FROM users WHERE email = ?").get(sub.user_email) as { referral_code: string | null } | undefined;
    userReferralCodes.set(sub.subscriber_id, userRow?.referral_code ?? null);
  }

  const runDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subsWithEmails) {
    const attr = attrBySubscriber.get(sub.subscriber_id);
    if (!attr) continue;

    const cumulative = getCumulativeAttribution(db, sub.subscriber_id);
    const manageUrl = `${serverUrl}/manage?email=${encodeURIComponent(sub.user_email)}`;
    const dashboardUrl = `${serverUrl}/dashboard`;
    const unsubscribeEmailUrl = `${serverUrl}/manage?email=${encodeURIComponent(sub.user_email)}&section=emails`;

    const refCode = userReferralCodes.get(sub.subscriber_id);
    const referralLink = refCode ? `${serverUrl}/r/${refCode}` : null;

    const emailData: EmailData = {
      email: sub.user_email,
      plan: sub.plan,
      contributionDollars: (sub.amount_cents / 100).toFixed(2),
      thisMonth: {
        carbon: attr.carbon_credits,
        biodiversity: attr.biodiversity_credits,
        uss: attr.uss_credits,
      },
      cumulative,
      certificateUrl,
      txHashes,
      manageUrl,
      dashboardUrl,
      unsubscribeEmailUrl,
      referralLink,
    };

    const html = renderEmailHtml(emailData);
    const subject = `Your ${runDate} Impact Report - Regen Compute`;

    try {
      await sendViaPostmark(
        config.postmarkServerToken,
        config.emailFromAddress,
        sub.user_email,
        subject,
        html,
        unsubscribeEmailUrl,
      );
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to send to ${sub.user_email}: ${msg}`);
      failed++;
    }
  }

  console.log(`Monthly emails: sent=${sent} failed=${failed} pool_run=${poolRunId}`);
  return { sent, failed, errors };
}

/**
 * Send a magic link email for dashboard login.
 */
export async function sendMagicLinkEmail(
  email: string,
  verifyUrl: string,
  ttlMinutes: number,
): Promise<void> {
  const config = loadConfig();

  if (!config.postmarkServerToken) {
    throw new Error("POSTMARK_SERVER_TOKEN not configured");
  }

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Log in to Regen Compute</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Mulish', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%;">

          ${emailHeader()}

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 0 0 12px 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: none;">

                <!-- Green accent bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(135deg, #4FB573, #79C6AA);"></td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 36px 32px; text-align: center;">
                    <h1 style="margin: 0 0 16px; font-family: 'Mulish', Arial, sans-serif; font-size: 24px; font-weight: 800; color: #101570;">Log in to Your Dashboard</h1>
                    <p style="margin: 0 0 28px; font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #6b7280; line-height: 1.7;">Click the button below to access your ecological impact dashboard. This link expires in ${ttlMinutes} minutes.</p>
                    <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; padding: 14px 36px; background-color: #4FB573; color: #ffffff; font-family: 'Mulish', Arial, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">Log In to Dashboard</a>
                    <p style="margin: 28px 0 0; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #9ca3af; line-height: 1.5;">If you did not request this link, you can safely ignore this email.</p>
                  </td>
                </tr>

                ${emailFooter()}

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": config.postmarkServerToken,
    },
    body: JSON.stringify({
      From: config.emailFromAddress,
      To: email,
      ...(config.emailReplyToAddress ? { ReplyTo: config.emailReplyToAddress } : {}),
      Subject: "Log in to your Regen Compute Dashboard",
      HtmlBody: html,
      MessageStream: "outbound",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark API error (${response.status}): ${body}`);
  }
}

/**
 * Send a welcome email after a new subscription is created.
 */
export async function sendWelcomeEmail(
  email: string,
  plan: string,
  dashboardUrl: string,
): Promise<void> {
  const config = loadConfig();

  if (!config.postmarkServerToken) {
    throw new Error("POSTMARK_SERVER_TOKEN not configured");
  }

  if (!config.emailEnabled) return;

  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Regen Compute</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Mulish', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%;">

          ${emailHeader()}

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 0 0 12px 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: none;">

                <!-- Green accent bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(135deg, #4FB573, #79C6AA);"></td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 36px 32px;">
                    <h1 style="margin: 0 0 16px; font-family: 'Mulish', Arial, sans-serif; font-size: 24px; font-weight: 800; color: #101570; text-align: center;">Welcome to Regen Compute</h1>
                    <p style="margin: 0 0 20px; font-family: 'Inter', Arial, sans-serif; font-size: 15px; color: #374151; line-height: 1.7;">
                      You're now on the <strong style="color: #4FB573;">${escapeHtml(planName)}</strong> plan. Every month, your subscription funds verified ecological regeneration &mdash; carbon removal, biodiversity protection, and more &mdash; with permanent, on-chain proof.
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f7f2; border-radius: 8px; border: 1px solid #b9e1c7; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px; font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4FB573;">What happens next</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 4px 0; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
                                <strong style="color: #101570;">1.</strong> Your first monthly credit retirement will happen at the end of the billing cycle.
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
                                <strong style="color: #101570;">2.</strong> You'll receive an impact report email with on-chain proof.
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 4px 0; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
                                <strong style="color: #101570;">3.</strong> Track your cumulative impact anytime on your dashboard.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 14px 36px; background-color: #4FB573; color: #ffffff; font-family: 'Mulish', Arial, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">View Your Dashboard</a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="margin: 0 0 8px; font-family: 'Inter', Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">Connect your AI assistant</p>
                          <p style="margin: 0; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 12px; color: #101570; background: #f3f4f6; padding: 10px 12px; border-radius: 6px;">claude mcp add -s user regen-compute -- npx regen-compute</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                ${emailFooter()}

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": config.postmarkServerToken,
    },
    body: JSON.stringify({
      From: config.emailFromAddress,
      To: email,
      ...(config.emailReplyToAddress ? { ReplyTo: config.emailReplyToAddress } : {}),
      Subject: "Welcome to Regen Compute",
      HtmlBody: html,
      MessageStream: "outbound",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark API error (${response.status}): ${body}`);
  }
}

/**
 * Send the "first retirement" notification email.
 * Sent once — after a subscriber's very first retirement completes.
 */
export async function sendFirstRetirementEmail(
  email: string,
  dashboardUrl: string,
  totalCredits: number,
  portfolioUrl: string | null,
  batchSummaries: { projectName: string; credits: number; creditType: string }[],
): Promise<void> {
  const config = loadConfig();
  if (!config.postmarkServerToken || !config.emailEnabled) return;

  const batchRows = batchSummaries.map((b) =>
    `<tr>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.projectName)}</td>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.creditType)}</td>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${b.credits.toFixed(4)}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your first ecocredits have been retired</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Mulish',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
  ${emailHeader()}
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
      <tr><td style="height:4px;background:linear-gradient(135deg,#4FB573,#79C6AA);"></td></tr>
      <tr><td style="padding:36px 32px;">
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#101570;text-align:center;">Your First Ecocredits Are Live</h1>
        <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
          Your first ecological credit retirements have been executed on-chain. Verified credits from three different projects &mdash; spanning carbon, biodiversity, and species stewardship &mdash; have been permanently retired on your behalf on Regen Ledger.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border-radius:8px;border:1px solid #b9e1c7;margin-bottom:24px;">
          <tr><td style="padding:16px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <th style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:2px solid #b9e1c7;">Project</th>
                <th style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:2px solid #b9e1c7;">Type</th>
                <th style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:right;border-bottom:2px solid #b9e1c7;">Credits</th>
              </tr>
              ${batchRows}
            </table>
            <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#101570;text-align:right;padding:0 12px;">
              Total: ${totalCredits.toFixed(4)} credits retired
            </p>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td align="center">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 36px;background:#4FB573;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">View Your Dashboard &rarr;</a>
          </td></tr>
        </table>

        ${portfolioUrl ? `<p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.6;text-align:center;">
          You can also view your permanent on-chain portfolio on <a href="${escapeHtml(portfolioUrl)}" style="color:#4FB573;font-weight:600;">Regen Network</a>.
        </p>` : ""}

        <p style="margin:0 0 16px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
          Each month, new credits will be retired on your behalf and you'll receive an update. Your impact grows with every billing cycle.
        </p>

        <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
          We'd love your feedback &mdash; just reply to this email with any thoughts or suggestions.
        </p>
      </td></tr>
      ${emailFooter(`${dashboardUrl.replace("/login", "")}`)}
    </table>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  await sendViaPostmark(
    config.postmarkServerToken,
    config.emailFromAddress,
    email,
    "Your first ecocredits have been retired",
    html,
    dashboardUrl.replace("/login", ""),
  );
}

/**
 * Send a recurring retirement notification email.
 * Sent after each subsequent retirement (not the first one).
 */
export async function sendRetirementReceiptEmail(
  email: string,
  dashboardUrl: string,
  totalCredits: number,
  cumulativeCredits: number,
  monthsActive: number,
  portfolioUrl: string | null,
  batchSummaries: { projectName: string; credits: number; creditType: string }[],
): Promise<void> {
  const config = loadConfig();
  if (!config.postmarkServerToken || !config.emailEnabled) return;

  const batchRows = batchSummaries.map((b) =>
    `<tr>
      <td style="padding:6px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.projectName)}</td>
      <td style="padding:6px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.creditType)}</td>
      <td style="padding:6px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${b.credits.toFixed(4)}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New ecocredits retired on your behalf</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Mulish',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
  ${emailHeader()}
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
      <tr><td style="height:4px;background:linear-gradient(135deg,#4FB573,#79C6AA);"></td></tr>
      <tr><td style="padding:36px 32px;">
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#101570;text-align:center;">New Credits Retired</h1>
        <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
          Your latest ecological credit retirements have been executed on-chain. Here's what was retired this cycle:
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border-radius:8px;border:1px solid #b9e1c7;margin-bottom:24px;">
          <tr><td style="padding:16px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <th style="padding:6px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:2px solid #b9e1c7;">Project</th>
                <th style="padding:6px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:2px solid #b9e1c7;">Type</th>
                <th style="padding:6px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4FB573;text-transform:uppercase;letter-spacing:0.05em;text-align:right;border-bottom:2px solid #b9e1c7;">Credits</th>
              </tr>
              ${batchRows}
            </table>
            <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#101570;text-align:right;padding:0 12px;">
              This cycle: ${totalCredits.toFixed(4)} credits
            </p>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;text-align:center;">
            <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your cumulative impact</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#101570;">${cumulativeCredits.toFixed(4)} credits</p>
            <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;">${monthsActive} month${monthsActive !== 1 ? "s" : ""} of regeneration</p>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td align="center">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 36px;background:#4FB573;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">View Your Dashboard &rarr;</a>
          </td></tr>
        </table>

        ${portfolioUrl ? `<p style="margin:0 0 16px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.6;text-align:center;">
          On-chain proof: <a href="${escapeHtml(portfolioUrl)}" style="color:#4FB573;font-weight:600;">view your portfolio on Regen Network</a>
        </p>` : ""}
      </td></tr>
      ${emailFooter(`${dashboardUrl.replace("/login", "")}`)}
    </table>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  await sendViaPostmark(
    config.postmarkServerToken,
    config.emailFromAddress,
    email,
    "New ecocredits retired on your behalf",
    html,
    dashboardUrl.replace("/login", ""),
  );
}

/**
 * Send a referral bonus thank-you email to the referrer.
 */
export async function sendReferralBonusEmail(
  email: string,
  dashboardUrl: string,
  referralLink: string,
  totalCredits: number,
  batchSummaries: { projectName: string; credits: number; creditType: string }[],
): Promise<void> {
  const config = loadConfig();
  if (!config.postmarkServerToken || !config.emailEnabled) return;

  const batchRows = batchSummaries.map((b) =>
    `<tr>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.projectName)}</td>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${escapeHtml(b.creditType)}</td>
      <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${b.credits.toFixed(4)}</td>
    </tr>`
  ).join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          ${emailHeader()}

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin:0 0 16px;font-family:'Mulish',Arial,sans-serif;font-size:22px;font-weight:700;color:#101570;">
                Thank you for spreading the word!
              </h1>

              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6;">
                Someone signed up through your referral link, and as a thank you, we've retired bonus ecocredits in your name. These credits are now permanently attributed to your on-chain portfolio.
              </p>

              ${batchRows ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f0fdf4;">
                  <th style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#166534;text-align:left;">Project</th>
                  <th style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#166534;text-align:left;">Credit Type</th>
                  <th style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#166534;text-align:right;">Credits Retired</th>
                </tr>
                ${batchRows}
                <tr style="background:#f9fafb;">
                  <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#101570;">Total</td>
                  <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#101570;text-align:right;">${totalCredits.toFixed(4)}</td>
                </tr>
              </table>
              ` : ""}

              <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6;">
                Together, we're protecting jaguar habitat, supporting indigenous conservation efforts, and sequestering carbon. Every referral multiplies our collective impact.
              </p>

              <!-- Dashboard CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 32px;background:#4FB573;color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      View Your Impact Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Referral link -->
              <div style="margin:0 0 24px;padding:20px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
                <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#166534;">
                  Keep sharing — every referral grows the impact:
                </p>
                <p style="margin:0;font-family:'Courier New',monospace;font-size:14px;color:#101570;word-break:break-all;">
                  <a href="${escapeHtml(referralLink)}" style="color:#101570;text-decoration:underline;">${escapeHtml(referralLink)}</a>
                </p>
                <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;">
                  Your friend gets their first month free. You earn bonus retirements.
                </p>
              </div>
            </td>
          </tr>

          ${emailFooter(dashboardUrl.replace("/login", ""))}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendViaPostmark(
    config.postmarkServerToken,
    config.emailFromAddress,
    email,
    "Your referral bonus — ecocredits retired in your name!",
    html,
    dashboardUrl.replace("/login", ""),
  );
}

/**
 * Send a subscription renewal reminder email.
 * For crypto subs: "extend" language with crypto payment option.
 * For cancelled Stripe subs: "resubscribe" language with link to pricing.
 * Levels: 30d (1 month before), 14d (2 weeks), 5d (5 days), expired (day of)
 */
export async function sendRenewalReminderEmail(
  email: string,
  plan: string,
  expiresDate: string,
  level: "30d" | "14d" | "5d" | "expired",
  dashboardUrl: string,
  isCancelledStripe: boolean = false,
): Promise<void> {
  const config = loadConfig();
  if (!config.postmarkServerToken || !config.emailEnabled) return;

  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const formattedDate = new Date(expiresDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const levelMessages: Record<string, { subject: string; heading: string; urgency: string; color: string }> = {
    "30d": {
      subject: `Your ${planName} subscription expires in 1 month`,
      heading: "Your subscription is expiring soon",
      urgency: `Your <strong>${planName}</strong> plan expires on <strong>${formattedDate}</strong> — about 1 month from now.`,
      color: "#f59e0b",
    },
    "14d": {
      subject: `Action needed: ${planName} subscription expires in 2 weeks`,
      heading: "2 weeks until your subscription expires",
      urgency: `Your <strong>${planName}</strong> plan expires on <strong>${formattedDate}</strong>. Extend now to keep your ecological impact going.`,
      color: "#f59e0b",
    },
    "5d": {
      subject: `Expiring soon: ${planName} subscription — 5 days left`,
      heading: "5 days left on your subscription",
      urgency: `Your <strong>${planName}</strong> plan expires on <strong>${formattedDate}</strong>. Don't lose your streak!`,
      color: "#ef4444",
    },
    "expired": {
      subject: `Your ${planName} subscription has expired`,
      heading: "Your subscription has expired",
      urgency: `Your <strong>${planName}</strong> plan expired on <strong>${formattedDate}</strong>. Renew now to continue funding ecological regeneration.`,
      color: "#ef4444",
    },
  };

  const msg = levelMessages[level];

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          ${emailHeader()}

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin:0 0 16px;font-family:'Mulish',Arial,sans-serif;font-size:22px;font-weight:700;color:#101570;">
                ${msg.heading}
              </h1>
              <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6;">
                ${msg.urgency}
              </p>

              <!-- Status bar -->
              <div style="margin:0 0 24px;padding:16px 20px;background:#fefce8;border:1px solid ${msg.color}33;border-left:4px solid ${msg.color};border-radius:8px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">
                  ${level === "expired"
                    ? "Your credits are no longer being retired monthly. Renew to resume."
                    : "Your monthly credit retirements will stop when your subscription expires."}
                </p>
              </div>

              <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6;">
                ${isCancelledStripe
                  ? "Resubscribing takes just a minute — choose a plan and you're back."
                  : "Extending is easy — pay with crypto or credit card from your dashboard."}
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${escapeHtml(isCancelledStripe ? dashboardUrl.replace('/dashboard', '/#pricing') : dashboardUrl)}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#4FB573,#79C6AA);color:#ffffff;font-family:'Mulish',Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">
                  ${isCancelledStripe ? "Resubscribe Now" : "Extend My Subscription"}
                </a>
              </div>

              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#9ca3af;line-height:1.5;">
                Every dollar funds verified ecological regeneration — carbon sequestration, biodiversity protection, and species stewardship on Regen Network.
              </p>
            </td>
          </tr>

          ${emailFooter(dashboardUrl)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendViaPostmark(
    config.postmarkServerToken,
    config.emailFromAddress,
    email,
    msg.subject,
    html,
    dashboardUrl,
  );
}

// Export for testing
export { renderEmailHtml, type EmailData };
