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

function renderLoginPage(error?: string, success?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Login - Regenerative Compute</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
      margin: 0; padding: 0;
      color: #1a1a1a; line-height: 1.6;
      background: #fafcfb;
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      max-width: 420px; width: 100%; margin: 24px;
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 16px; padding: 40px 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .brand {
      font-size: 13px; font-weight: 600; letter-spacing: 0.05em;
      text-transform: uppercase; color: #2d6a4f;
      text-align: center; margin-bottom: 8px;
    }
    h1 {
      font-size: 24px; font-weight: 700; text-align: center;
      margin: 0 0 8px; color: #1a1a1a;
    }
    .subtitle {
      font-size: 14px; color: #6b7280; text-align: center; margin: 0 0 28px;
    }
    label { font-size: 14px; font-weight: 600; color: #374151; display: block; margin-bottom: 6px; }
    input[type="email"] {
      width: 100%; padding: 12px 14px;
      border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 15px; color: #1a1a1a;
      outline: none; transition: border-color 0.2s;
    }
    input[type="email"]:focus { border-color: #2d6a4f; }
    .btn {
      display: block; width: 100%; padding: 14px;
      background: #2d6a4f; color: #fff;
      font-size: 16px; font-weight: 600;
      border: none; border-radius: 8px; cursor: pointer;
      margin-top: 16px; transition: background 0.2s;
    }
    .btn:hover { background: #1b4332; }
    .error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; padding: 12px; font-size: 14px; margin-bottom: 16px; }
    .success { background: #f0f7f4; border: 1px solid #d1e7dd; color: #2d6a4f; border-radius: 8px; padding: 12px; font-size: 14px; margin-bottom: 16px; }
    .footer { text-align: center; margin-top: 24px; font-size: 13px; color: #9ca3af; }
    .footer a { color: #2d6a4f; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Regenerative Compute</div>
    <h1>Dashboard Login</h1>
    <p class="subtitle">Enter your subscriber email to receive a login link.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    ${success ? `<div class="success">${escapeHtml(success)}</div>` : ""}
    <form method="POST" action="/dashboard/login">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
      <button type="submit" class="btn">Send Login Link</button>
    </form>
    <div class="footer">
      <a href="/">Back to Regenerative Compute</a>
    </div>
  </div>
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
      <div class="badge" style="opacity: ${opacity}; background: ${bgColor}; border-color: ${borderColor};">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" style="color: ${svgColor};">${badge.icon}</svg>
        <div class="badge-name">${escapeHtml(badge.name)}</div>
        <div class="badge-desc">${escapeHtml(statusText)}</div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Impact Dashboard - Regenerative Compute</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
      margin: 0; padding: 0;
      color: #1a1a1a; line-height: 1.6;
      background: #fafcfb;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

    /* Header */
    .header {
      padding: 24px 0;
      border-bottom: 1px solid #e8e8e8;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-brand {
      font-size: 14px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: #2d6a4f;
    }
    .plan-badge {
      font-size: 12px; font-weight: 600; color: #2d6a4f;
      background: #f0f7f4; padding: 4px 10px; border-radius: 12px;
    }
    .header-right a {
      font-size: 13px; color: #6b7280; text-decoration: none;
    }
    .header-right a:hover { color: #2d6a4f; text-decoration: underline; }

    /* Hero */
    .hero {
      padding: 32px 0 24px;
      text-align: center;
    }
    .hero h1 {
      font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #1a1a1a;
    }
    .hero p { font-size: 14px; color: #6b7280; margin: 0; }

    /* Stat cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .stat-card {
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 12px; padding: 20px; text-align: center;
    }
    .stat-card.carbon { border-left: 4px solid #2d6a4f; }
    .stat-card.biodiversity { border-left: 4px solid #1e5fa8; }
    .stat-card.uss { border-left: 4px solid #b5651d; }
    .stat-card.total { border-left: 4px solid #374151; }
    .stat-card.contributed { border-left: 4px solid #6b7280; }
    .stat-card.months { border-left: 4px solid #9ca3af; }
    .stat-value {
      font-size: 28px; font-weight: 800; color: #1a1a1a;
      letter-spacing: -0.02em;
    }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }

    /* Section titles */
    .section-title {
      font-size: 20px; font-weight: 700; color: #1a1a1a;
      margin: 0 0 16px; padding-top: 8px;
    }

    /* Chart */
    .chart-section { margin-bottom: 32px; }
    .chart-container {
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 12px; padding: 24px;
    }
    canvas { max-height: 300px; }
    .chart-empty {
      text-align: center; padding: 48px 0; color: #9ca3af; font-size: 15px;
    }

    /* Table */
    .table-section { margin-bottom: 32px; }
    .table-wrapper {
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 12px; overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: 11px; font-weight: 700; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.05em;
      text-align: left; padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    td {
      font-size: 14px; padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
    }
    tr:last-child td { border-bottom: none; }
    td a { color: #2d6a4f; text-decoration: none; font-weight: 600; }
    td a:hover { text-decoration: underline; }

    /* Badges */
    .badges-section { margin-bottom: 32px; }
    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .badge {
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 12px; padding: 16px; text-align: center;
      transition: transform 0.2s;
    }
    .badge:hover { transform: translateY(-2px); }
    .badge svg { margin-bottom: 8px; }
    .badge-name { font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
    .badge-desc { font-size: 11px; color: #6b7280; }

    /* Export placeholder */
    .export-section {
      margin-bottom: 32px;
      background: #f9fafb; border: 1px dashed #d1d5db;
      border-radius: 12px; padding: 24px; text-align: center;
    }
    .export-section p { margin: 0; color: #9ca3af; font-size: 14px; }
    .coming-soon {
      display: inline-block; font-size: 11px; font-weight: 600;
      color: #9ca3af; background: #f3f4f6;
      padding: 3px 8px; border-radius: 4px; margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* Footer */
    .footer {
      padding: 32px 0; text-align: center;
      border-top: 1px solid #e8e8e8;
    }
    .footer a { color: #2d6a4f; text-decoration: none; font-size: 14px; }
    .footer a:hover { text-decoration: underline; }
    .footer p { font-size: 13px; color: #9ca3af; margin: 8px 0 0; }

    /* Mobile */
    @media (max-width: 640px) {
      .hero h1 { font-size: 22px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .stat-value { font-size: 22px; }
      .badges-grid { grid-template-columns: repeat(2, 1fr); }
      th, td { padding: 10px 12px; font-size: 13px; }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <span class="header-brand">Regenerative Compute</span>
        <span class="plan-badge">${escapeHtml(planName)} Plan</span>
      </div>
      <div class="header-right">
        <a href="/dashboard/logout">Log out</a>
      </div>
    </div>

    <!-- Hero -->
    <div class="hero">
      <h1>Your Ecological Impact</h1>
      <p>Member since ${escapeHtml(memberSince)}</p>
    </div>

    <!-- Cumulative stats -->
    <div class="stats-grid">
      <div class="stat-card carbon">
        <div class="stat-value">${escapeHtml(formatCredits(cumulative.total_carbon))}</div>
        <div class="stat-label">Carbon Credits</div>
      </div>
      <div class="stat-card biodiversity">
        <div class="stat-value">${escapeHtml(formatCredits(cumulative.total_biodiversity))}</div>
        <div class="stat-label">Biodiversity Credits</div>
      </div>
      <div class="stat-card uss">
        <div class="stat-value">${escapeHtml(formatCredits(cumulative.total_uss))}</div>
        <div class="stat-label">USS/Marine Credits</div>
      </div>
      <div class="stat-card total">
        <div class="stat-value">${escapeHtml(formatCredits(totalCredits))}</div>
        <div class="stat-label">Total Credits</div>
      </div>
      <div class="stat-card contributed">
        <div class="stat-value">$${escapeHtml((cumulative.total_contribution_cents / 100).toFixed(2))}</div>
        <div class="stat-label">Contributed</div>
      </div>
      <div class="stat-card months">
        <div class="stat-value">${cumulative.months_active}</div>
        <div class="stat-label">Months Active</div>
      </div>
    </div>

    <!-- Monthly chart -->
    <div class="chart-section">
      <h2 class="section-title">Monthly Breakdown</h2>
      <div class="chart-container">
        ${monthly.length > 0
          ? `<canvas id="impactChart"></canvas>
             <script type="application/json" id="chart-data">${chartData}</script>`
          : `<div class="chart-empty">No retirements yet. Your first monthly report will appear here.</div>`
        }
      </div>
    </div>

    <!-- Monthly history table -->
    <div class="table-section">
      <h2 class="section-title">History</h2>
      <div class="table-wrapper">
        ${monthly.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Carbon</th>
              <th>Biodiversity</th>
              <th>USS</th>
              <th>Total</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyRows}
          </tbody>
        </table>
        ` : `<div class="chart-empty">No history yet.</div>`}
      </div>
    </div>

    <!-- Badges -->
    <div class="badges-section">
      <h2 class="section-title">Achievements</h2>
      <div class="badges-grid">
        ${badgeHtml}
      </div>
    </div>

    <!-- Export placeholder -->
    <div class="export-section">
      <p>Export Impact Report (PDF) <span class="coming-soon">Coming Soon</span></p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <a href="${escapeHtml(manageUrl)}">Manage Subscription</a>
      <p>Powered by <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a></p>
    </div>
  </div>

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
            {
              label: 'Carbon',
              data: raw.carbon,
              backgroundColor: '#2d6a4f',
              borderRadius: 4,
            },
            {
              label: 'Biodiversity',
              data: raw.biodiversity,
              backgroundColor: '#1e5fa8',
              borderRadius: 4,
            },
            {
              label: 'USS/Marine',
              data: raw.uss,
              backgroundColor: '#b5651d',
              borderRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Credits Retired' } }
          }
        }
      });
    })();
  </script>
  ` : ""}

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
      // Show same success message to prevent email enumeration
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(undefined, "If an account exists for that email, a login link has been sent. Check your inbox."));
      return;
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    if (!subscriber) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderLoginPage(undefined, "If an account exists for that email, a login link has been sent. Check your inbox."));
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
