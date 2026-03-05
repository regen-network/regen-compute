/**
 * Subscriber dashboard routes.
 *
 * Routes:
 *   GET  /dashboard/login   — Email form page
 *   POST /dashboard/login   — Send magic link email
 *   GET  /dashboard/verify  — Verify magic link token, set session cookie
 *   GET  /dashboard         — Main dashboard (authenticated)
 *   GET  /dashboard/logout  — Clear session cookie
 *
 * Auth: Magic link email -> signed session cookie (HMAC-SHA256, 24h TTL).
 * HTML: Server-rendered with inline CSS, Chart.js via CDN for charts.
 */

import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import {
  getUserByEmail,
  getSubscriberByUserId,
  getCumulativeAttribution,
  getMonthlyAttributions,
  createMagicLinkToken,
  verifyMagicLinkToken,
  type CumulativeAttribution,
  type MonthlyAttribution,
} from "./db.js";
import { createSessionToken, getSessionEmail } from "./magic-link.js";
import { sendMagicLinkEmail } from "../services/email.js";

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

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return dateStr;
  }
}

// --- Rate limiting for login attempts ---
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 3600_000; // 1 hour

function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const existing = loginAttempts.get(key);
  if (!existing || now - existing.windowStart >= LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (existing.count >= LOGIN_RATE_LIMIT) return false;
  existing.count++;
  return true;
}

// Clean up stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now - val.windowStart > LOGIN_RATE_WINDOW_MS) loginAttempts.delete(key);
  }
}, 600_000);

// --- Badge system ---

interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string; // SVG content
  color: string;
}

function computeBadges(cumulative: CumulativeAttribution): Badge[] {
  return [
    {
      id: "first-retirement",
      name: "First Retirement",
      description: "Your first month with credits retired",
      earned: cumulative.months_active >= 1,
      icon: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      color: "#2d6a4f",
    },
    {
      id: "carbon-pioneer",
      name: "Carbon Pioneer",
      description: "1 carbon credit retired (1 tonne CO2e)",
      earned: cumulative.total_carbon >= 1.0,
      icon: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1-1c-2.5-2.4-4-3.9-4-5.5C6 8.6 7.6 7 9.5 7c1.1 0 2.1.5 2.5 1.3.4-.8 1.4-1.3 2.5-1.3C16.4 7 18 8.6 18 10.5c0 1.6-1.5 3.1-4 5.5l-1 1h-2z" fill="currentColor"/>`,
      color: "#2d6a4f",
    },
    {
      id: "biodiversity-guardian",
      name: "Biodiversity Guardian",
      description: "1 biodiversity credit retired",
      earned: cumulative.total_biodiversity >= 1.0,
      icon: `<path d="M12 2C8 2 4 4 4 8c0 3 2 5 4 6.5V22l4-2 4 2v-7.5c2-1.5 4-3.5 4-6.5 0-4-4-6-8-6zm0 2c2.5 0 5 1.5 5 4s-2 4-5 5c-3-1-5-2.5-5-5s2.5-4 5-4z" fill="currentColor"/>`,
      color: "#1e5fa8",
    },
    {
      id: "six-month-streak",
      name: "Six-Month Streak",
      description: "6 consecutive months subscribed",
      earned: cumulative.months_active >= 6,
      icon: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>`,
      color: "#d4a853",
    },
    {
      id: "one-tonne-club",
      name: "1 Tonne Club",
      description: "1 tonne of CO2e retired cumulative",
      earned: cumulative.total_carbon >= 1.0,
      icon: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>`,
      color: "#b5651d",
    },
  ];
}

// --- HTML rendering ---

function renderLoginPage(error?: string, success?: string, info?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Login - Regenerative Compute</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
    body {
      background: var(--regen-gray-50);
      min-height: 100vh;
      display: flex; flex-direction: column;
    }
    .login-wrapper {
      flex: 1; display: flex; align-items: center; justify-content: center;
    }
    .login-card {
      max-width: 420px; width: 100%; margin: 24px;
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg); padding: 40px 32px;
      box-shadow: var(--regen-shadow-card);
    }
    .login-card h1 {
      font-size: 24px; font-weight: 800; text-align: center;
      margin: 0 0 8px; color: var(--regen-navy);
    }
    .login-subtitle {
      font-size: 14px; color: var(--regen-gray-500); text-align: center; margin: 0 0 28px;
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}
  ${brandHeader()}
  <div class="login-wrapper">
    <div class="login-card">
      <h1>Dashboard Login</h1>
      <p class="login-subtitle">Enter your subscriber email to receive a login link.</p>
      ${error ? `<div class="regen-alert regen-alert--error">${escapeHtml(error)}</div>` : ""}
      ${success ? `<div class="regen-alert regen-alert--success">${escapeHtml(success)}</div>` : ""}
      ${info ? `<div class="regen-alert regen-alert--info">${info}</div>` : ""}
      <form method="POST" action="/dashboard/login">
        <label class="regen-label" for="email">Email address</label>
        <input class="regen-input" type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
        <button type="submit" class="regen-btn regen-btn--solid regen-btn--block" style="margin-top:16px;">Send Login Link</button>
      </form>
      <div style="text-align:center;margin-top:24px;font-size:13px;">
        <a href="/">Back to Regenerative Compute</a>
      </div>
    </div>
  </div>
${betaBannerJS()}
</body>
</html>`;
}

function renderDashboardPage(
  email: string,
  plan: string,
  memberSince: string,
  cumulative: CumulativeAttribution,
  monthly: MonthlyAttribution[],
  badges: Badge[],
  manageUrl: string,
): string {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const totalCredits = cumulative.total_carbon + cumulative.total_biodiversity + cumulative.total_uss;

  // Prepare chart data as JSON
  const chartData = JSON.stringify({
    labels: monthly.map(m => {
      const d = new Date(m.run_date);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }),
    carbon: monthly.map(m => m.carbon_credits),
    biodiversity: monthly.map(m => m.biodiversity_credits),
    uss: monthly.map(m => m.uss_credits),
  });

  // Render monthly history rows
  let monthlyRows = "";
  for (const m of [...monthly].reverse()) {
    const total = m.carbon_credits + m.biodiversity_credits + m.uss_credits;
    const dateLabel = formatDate(m.run_date);
    const certLink = m.carbon_tx_hash
      ? `<a href="https://www.mintscan.io/regen/tx/${escapeHtml(m.carbon_tx_hash)}" target="_blank" rel="noopener">View</a>`
      : m.biodiversity_tx_hash
        ? `<a href="https://www.mintscan.io/regen/tx/${escapeHtml(m.biodiversity_tx_hash)}" target="_blank" rel="noopener">View</a>`
        : "--";
    monthlyRows += `<tr>
      <td>${escapeHtml(dateLabel)}</td>
      <td>${escapeHtml(formatCredits(m.carbon_credits))}</td>
      <td>${escapeHtml(formatCredits(m.biodiversity_credits))}</td>
      <td>${escapeHtml(formatCredits(m.uss_credits))}</td>
      <td><strong>${escapeHtml(formatCredits(total))}</strong></td>
      <td>${certLink}</td>
    </tr>`;
  }

  // Render badges
  let badgeHtml = "";
  for (const badge of badges) {
    const opacity = badge.earned ? "1" : "0.35";
    const bgColor = badge.earned ? badge.color + "15" : "#f3f4f6";
    const borderColor = badge.earned ? badge.color : "#e5e7eb";
    const svgColor = badge.earned ? badge.color : "#9ca3af";
    const statusText = badge.earned ? badge.description : "Keep going!";
    badgeHtml += `
      <div class="regen-badge" style="opacity: ${opacity}; background: ${bgColor}; border-color: ${borderColor};">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" style="color: ${svgColor};">${badge.icon}</svg>
        <div class="regen-badge__name">${escapeHtml(badge.name)}</div>
        <div class="regen-badge__desc">${escapeHtml(statusText)}</div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Impact Dashboard - Regenerative Compute</title>
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}
    body { background: var(--regen-gray-50); }

    /* Chart */
    .dash-chart-section { margin-bottom: 32px; }
    .dash-chart-container {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); padding: 24px;
    }
    canvas { max-height: 300px; }
    .dash-empty {
      text-align: center; padding: 48px 0; color: var(--regen-gray-500); font-size: 15px;
    }

    /* Table */
    .dash-table-section { margin-bottom: 32px; }
    .dash-table-wrapper {
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius); overflow-x: auto;
    }

    /* Export */
    .dash-export {
      margin-bottom: 32px;
      background: var(--regen-gray-50); border: 1px dashed var(--regen-gray-300);
      border-radius: var(--regen-radius); padding: 24px; text-align: center;
    }
    .dash-export p { margin: 0; color: var(--regen-gray-500); font-size: 14px; }
    .dash-coming-soon {
      display: inline-block; font-size: 11px; font-weight: 700;
      color: var(--regen-gray-500); background: var(--regen-gray-100);
      padding: 3px 8px; border-radius: 4px; margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({
    badge: planName + " Plan",
    nav: [{ label: "Log out", href: "/dashboard/logout" }],
  })}

  <div class="regen-container">
    <!-- Hero -->
    <div style="padding:32px 0 24px;text-align:center;">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;color:var(--regen-navy);">Your Ecological Impact</h1>
      <p style="font-size:14px;color:var(--regen-gray-500);margin:0;">Member since ${escapeHtml(memberSince)}</p>
    </div>

    <!-- Cumulative stats -->
    <div class="regen-stats-grid">
      <div class="regen-stat-card regen-stat-card--green">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_carbon))}</div>
        <div class="regen-stat-label">Carbon Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--teal">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_biodiversity))}</div>
        <div class="regen-stat-label">Biodiversity Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--sage">
        <div class="regen-stat-value">${escapeHtml(formatCredits(cumulative.total_uss))}</div>
        <div class="regen-stat-label">USS/Marine Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--navy">
        <div class="regen-stat-value">${escapeHtml(formatCredits(totalCredits))}</div>
        <div class="regen-stat-label">Total Credits</div>
      </div>
      <div class="regen-stat-card regen-stat-card--muted">
        <div class="regen-stat-value">$${escapeHtml((cumulative.total_contribution_cents / 100).toFixed(2))}</div>
        <div class="regen-stat-label">Contributed</div>
      </div>
      <div class="regen-stat-card regen-stat-card--muted">
        <div class="regen-stat-value">${cumulative.months_active}</div>
        <div class="regen-stat-label">Months Active</div>
      </div>
    </div>

    <!-- Monthly chart -->
    <div class="dash-chart-section">
      <h2 class="regen-section-title" style="font-size:20px;">Monthly Breakdown</h2>
      <div class="dash-chart-container">
        ${monthly.length > 0
          ? `<canvas id="impactChart"></canvas>
             <script type="application/json" id="chart-data">${chartData}</script>`
          : `<div class="dash-empty">No retirements yet. Your first monthly report will appear here.</div>`
        }
      </div>
    </div>

    <!-- Monthly history table -->
    <div class="dash-table-section">
      <h2 class="regen-section-title" style="font-size:20px;">History</h2>
      <div class="dash-table-wrapper">
        ${monthly.length > 0 ? `
        <table class="regen-table">
          <thead><tr>
            <th>Month</th><th>Carbon</th><th>Biodiversity</th><th>USS</th><th>Total</th><th>Proof</th>
          </tr></thead>
          <tbody>${monthlyRows}</tbody>
        </table>
        ` : `<div class="dash-empty">No history yet.</div>`}
      </div>
    </div>

    <!-- Badges -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Achievements</h2>
      <div class="regen-badges-grid">
        ${badgeHtml}
      </div>
    </div>

    <!-- Subscription management -->
    <div style="margin-bottom:32px;">
      <h2 class="regen-section-title" style="font-size:20px;">Subscription</h2>
      <div style="background:var(--regen-white);border:1px solid var(--regen-gray-200);border-radius:var(--regen-radius);padding:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--regen-navy);">${escapeHtml(planName)} Plan</div>
          <div style="font-size:13px;color:var(--regen-gray-500);margin-top:4px;">Member since ${escapeHtml(memberSince)}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a class="regen-btn regen-btn--outline regen-btn--sm" href="${escapeHtml(manageUrl)}">Manage Subscription</a>
          <a class="regen-btn regen-btn--sm" href="${escapeHtml(manageUrl)}" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;">Cancel Subscription</a>
        </div>
      </div>
    </div>

    <!-- Export placeholder -->
    <div class="dash-export">
      <p>Export Impact Report (PDF) <span class="dash-coming-soon">Coming Soon</span></p>
    </div>
  </div>

  ${brandFooter({ links: [
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ] })}

  ${monthly.length > 0 ? `
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script>
    (function() {
      var raw = JSON.parse(document.getElementById('chart-data').textContent);
      var ctx = document.getElementById('impactChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: raw.labels,
          datasets: [
            { label: 'Carbon', data: raw.carbon, backgroundColor: '#4FB573', borderRadius: 4 },
            { label: 'Biodiversity', data: raw.biodiversity, backgroundColor: '#527984', borderRadius: 4 },
            { label: 'USS/Marine', data: raw.uss, backgroundColor: '#79C6AA', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Credits Retired' } }
          }
        }
      });
    })();
  </script>
  ` : ""}

${betaBannerJS()}
</body>
</html>`;
}

// --- Express router ---

export function createDashboardRoutes(
  db: Database.Database,
  baseUrl: string,
  config: Config,
): Router {
  const router = Router();

  // GET /dashboard/login
  router.get("/dashboard/login", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(renderLoginPage());
  });

  // POST /dashboard/login — send magic link email
  router.post("/dashboard/login", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Please enter a valid email address."));
      return;
    }

    // Rate limit
    if (!checkLoginRateLimit(email)) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Too many login attempts. Please try again in an hour."));
      return;
    }

    // Check that this email has a subscriber account
    const user = getUserByEmail(db, email);
    if (!user) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(
        undefined,
        undefined,
        `No subscription found for <strong>${escapeHtml(email)}</strong>. <a href="/#pricing">Subscribe</a> to get started, or try another email you may have used at checkout.`,
      ));
      return;
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(
        undefined,
        undefined,
        `No active subscription found for <strong>${escapeHtml(email)}</strong>. <a href="/#pricing">Subscribe</a> to get started, or try another email you may have used at checkout.`,
      ));
      return;
    }

    // Create magic link token
    const token = createMagicLinkToken(db, email, config.magicLinkTtlMinutes);
    const verifyUrl = `${baseUrl}/dashboard/verify?token=${token}`;

    // Send email
    try {
      await sendMagicLinkEmail(email, verifyUrl, config.magicLinkTtlMinutes);
    } catch (err) {
      console.error("Failed to send magic link email:", err instanceof Error ? err.message : err);
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Failed to send email. Please try again."));
      return;
    }

    res.setHeader("Content-Type", "text/html");
    res.send(renderLoginPage(undefined, "If an account exists for that email, a login link has been sent. Check your inbox."));
  });

  // GET /dashboard/verify?token=...
  router.get("/dashboard/verify", (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      res.redirect("/dashboard/login");
      return;
    }

    const email = verifyMagicLinkToken(db, token);
    if (!email) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("Invalid or expired login link. Please request a new one."));
      return;
    }

    // Create session token and set cookie
    const sessionToken = createSessionToken(email, config.sessionSecret);
    const isProduction = baseUrl.startsWith("https");

    res.setHeader("Set-Cookie", [
      `rfa_session=${sessionToken}; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=86400${isProduction ? "; Secure" : ""}`
    ]);
    res.redirect("/dashboard");
  });

  // GET /dashboard — main dashboard (authenticated)
  router.get("/dashboard", (req: Request, res: Response) => {
    const email = getSessionEmail(req.headers.cookie, config.sessionSecret);
    if (!email) {
      res.redirect("/dashboard/login");
      return;
    }

    const user = getUserByEmail(db, email);
    if (!user) {
      res.redirect("/dashboard/login");
      return;
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage("No active subscription found for this email."));
      return;
    }

    const cumulative = getCumulativeAttribution(db, subscriber.id);
    const monthly = getMonthlyAttributions(db, subscriber.id);
    const badges = computeBadges(cumulative);
    const memberSince = formatDate(subscriber.created_at);
    const manageUrl = `${baseUrl}/manage?email=${encodeURIComponent(email)}`;

    res.setHeader("Content-Type", "text/html");
    res.send(renderDashboardPage(
      email,
      subscriber.plan,
      memberSince,
      cumulative,
      monthly,
      badges,
      manageUrl,
    ));
  });

  // GET /dashboard/logout
  router.get("/dashboard/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", [
      "rfa_session=; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=0"
    ]);
    res.redirect("/dashboard/login");
  });

  return router;
}
