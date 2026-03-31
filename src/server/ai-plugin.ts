/**
 * GET /ai-plugin — AI Plugin installation & reference page.
 *
 * Everything a user or AI assistant needs to know about the regen-compute
 * MCP server: what it is, how to install it, available tools, supported
 * credit types, and verification.
 */

import { Router, Request, Response } from "express";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";

export function createAiPluginRoutes(baseUrl: string): Router {
  const router = Router();

  router.get("/ai-plugin", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Plugin — Regenerative Compute</title>
  <meta name="description" content="Install the Regenerative Compute MCP plugin for Claude Code, Cursor, and other AI assistants. Estimate your AI footprint and fund verified ecological regeneration.">
  <meta property="og:title" content="AI Plugin — Regenerative Compute">
  <meta property="og:description" content="One command to connect your AI assistant to verified ecological regeneration on Regen Network.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/ai-plugin">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenChristian">
  <meta name="twitter:title" content="AI Plugin — Regenerative Compute">
  <meta name="twitter:description" content="One command to connect your AI assistant to verified ecological regeneration on Regen Network.">
  <meta name="twitter:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .plugin-hero {
      padding: 64px 0 48px;
      text-align: center;
      border-bottom: 1px solid var(--color-border);
    }
    .plugin-hero h1 {
      font-family: var(--font-display);
      font-size: 36px; font-weight: 800; color: var(--color-cream);
      margin: 0 0 12px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .plugin-hero h1 span {
      background: linear-gradient(180deg, var(--color-emerald-bright), var(--color-emerald));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .plugin-hero p {
      font-family: var(--font-body);
      font-size: 18px; color: var(--color-muted);
      max-width: 560px; margin: 0 auto;
    }

    .plugin-section {
      padding: 48px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .plugin-section:last-of-type { border-bottom: none; }

    .plugin-section h2 {
      font-family: var(--font-display);
      font-size: 24px; font-weight: 800; color: var(--color-cream);
      margin: 0 0 16px; letter-spacing: -0.01em;
    }
    .plugin-section h3 {
      font-family: var(--font-display);
      font-size: 16px; font-weight: 700; color: var(--color-cream);
      margin: 16px 0 8px;
    }
    .plugin-section p, .plugin-section li {
      font-family: var(--font-body);
      font-size: 15px; color: var(--color-cream-soft); line-height: 1.7;
    }
    .plugin-section ul { padding-left: 20px; margin: 8px 0 16px; }
    .plugin-section li { margin-bottom: 6px; }

    /* Install blocks */
    .install-block {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius);
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .install-block__label {
      font-family: var(--font-ui);
      font-size: 13px; font-weight: 700; color: var(--color-emerald);
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .install-block__cmd {
      position: relative;
    }
    .install-block__cmd pre {
      background: var(--color-void); color: var(--color-cream-soft);
      padding: 14px 16px; border-radius: 8px;
      overflow-x: auto; font-size: 13px; margin: 0;
      font-family: var(--font-mono);
      border: 1px solid var(--color-border);
    }
    .install-block__cmd button {
      position: absolute; top: 8px; right: 8px;
      background: var(--color-emerald); color: var(--color-void); border: none;
      border-radius: 6px; padding: 4px 10px; font-size: 11px;
      font-weight: 600; cursor: pointer;
    }

    /* Tools table */
    .tools-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .tools-table th {
      font-family: var(--font-ui);
      font-size: 11px; font-weight: 700; color: var(--color-muted);
      text-transform: uppercase; letter-spacing: 0.05em;
      text-align: left; padding: 10px 14px;
      border-bottom: 2px solid var(--color-border);
      background: var(--color-surface);
    }
    .tools-table td {
      font-family: var(--font-body);
      font-size: 14px; padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      vertical-align: top;
      color: var(--color-cream-soft);
    }
    .tools-table tr:last-child td { border-bottom: none; }
    .tools-table code {
      background: var(--color-surface); padding: 2px 6px; border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 12px; color: var(--color-cream); white-space: nowrap;
    }
    .tools-table .badge-ro {
      display: inline-block; font-size: 10px; font-weight: 700;
      background: var(--color-emerald-dim); color: var(--color-emerald-bright);
      padding: 2px 8px; border-radius: 10px; text-transform: uppercase;
    }
    .tools-table .badge-write {
      display: inline-block; font-size: 10px; font-weight: 700;
      background: rgba(251,191,36,0.1); color: #FBBF24;
      padding: 2px 8px; border-radius: 10px; text-transform: uppercase;
    }

    /* Credit types grid */
    .credit-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px; margin: 16px 0;
    }
    .credit-card {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius); padding: 18px 20px;
      transition: border-color 0.2s;
    }
    .credit-card:hover {
      border-color: var(--color-border-light);
    }
    .credit-card__code {
      font-family: var(--font-mono);
      font-size: 12px; font-weight: 700; color: var(--color-emerald);
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .credit-card__name {
      font-family: var(--font-display);
      font-size: 15px; font-weight: 700; color: var(--color-cream); margin-bottom: 4px;
    }
    .credit-card__desc {
      font-family: var(--font-body);
      font-size: 13px; color: var(--color-muted); line-height: 1.5;
    }

    /* Supported tools logos */
    .supported-tools {
      display: flex; gap: 24px; flex-wrap: wrap;
      align-items: center; margin: 16px 0;
    }
    .supported-tool {
      display: flex; align-items: center; gap: 10px;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius); padding: 12px 20px;
      font-family: var(--font-ui);
      font-size: 15px; font-weight: 600; color: var(--color-cream);
      transition: border-color 0.2s;
    }
    .supported-tool:hover {
      border-color: var(--color-border-light);
    }
    .supported-tool__icon {
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; color: var(--color-void);
    }

    /* Try-it prompt */
    .try-prompt {
      background: var(--color-emerald-dim);
      border: 1px solid var(--color-border-emerald);
      border-radius: var(--regen-radius-lg);
      padding: 24px; margin: 16px 0;
    }
    .try-prompt__label {
      font-family: var(--font-ui);
      font-size: 13px; font-weight: 700; color: var(--color-emerald-bright);
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .try-prompt__text {
      position: relative;
    }
    .try-prompt__text code {
      display: block; font-size: 14px; color: var(--color-cream);
      white-space: pre-wrap; line-height: 1.6;
      font-family: var(--font-mono);
      padding-right: 64px;
    }
    .try-prompt__text button {
      position: absolute; top: 0; right: 0;
      background: var(--color-emerald); color: var(--color-void); border: none;
      border-radius: 6px; padding: 4px 10px; font-size: 11px;
      font-weight: 600; cursor: pointer;
    }

    @media (max-width: 640px) {
      .plugin-hero h1 { font-size: 28px; }
      .plugin-hero p { font-size: 16px; }
      .tools-table { font-size: 13px; }
      .tools-table th, .tools-table td { padding: 8px 10px; }
      .credit-grid { grid-template-columns: 1fr; }
      .supported-tools { flex-direction: column; align-items: stretch; }
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({ nav: [{ label: "Home", href: "/" }, { label: "Research", href: "/research" }, { label: "About", href: "/about" }, { label: "Dashboard", href: "/dashboard/login" }] })}

  <!-- Hero -->
  <section class="plugin-hero">
    <div class="regen-container">
      <div class="regen-hero__label">MCP Plugin</div>
      <h1>Regenerative Compute <span>AI Plugin</span></h1>
      <p>A plugin for AI coding assistants that estimates your session's ecological footprint and channels contributions into verified regeneration projects on Regen Network.</p>
    </div>
  </section>

  <div class="regen-container--narrow">

    <!-- What It Is -->
    <section class="plugin-section">
      <h2>What It Is</h2>
      <p>Regenerative Compute is an <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">MCP (Model Context Protocol)</a> server that gives your AI assistant ecological awareness. It can:</p>
      <ul>
        <li>Estimate the energy and CO2 footprint of your AI sessions</li>
        <li>Browse live ecological credit inventory from Regen Network's on-chain marketplace</li>
        <li>Retire verified credits (carbon, biodiversity, marine, and more) with permanent on-chain proof</li>
        <li>Generate shareable retirement certificates</li>
        <li>Accept payment via credit card, USDC, ETH, and 50+ tokens across 10+ blockchains</li>
      </ul>
      <p>This is <strong>regenerative contribution</strong>, not carbon offsetting. We fund verified ecological regeneration with immutable, publicly auditable proof. No neutrality claims.</p>
    </section>

    <!-- Supported AI Tools -->
    <section class="plugin-section">
      <h2>Supported AI Tools</h2>
      <p>Any AI assistant that supports the Model Context Protocol can use Regenerative Compute:</p>
      <div class="supported-tools">
        <div class="supported-tool">
          <div class="supported-tool__icon" style="background:#D97757;">C</div>
          Claude Code
        </div>
        <div class="supported-tool">
          <div class="supported-tool__icon" style="background:var(--color-cream);">C</div>
          Cursor
        </div>
        <div class="supported-tool">
          <div class="supported-tool__icon" style="background:var(--color-dim);">W</div>
          Windsurf
        </div>
        <div class="supported-tool">
          <div class="supported-tool__icon" style="background:linear-gradient(135deg,var(--color-emerald),var(--color-emerald-bright));">+</div>
          Any MCP Client
        </div>
      </div>
    </section>

    <!-- Installation -->
    <section class="plugin-section">
      <h2>Installation</h2>
      <p>One command. No wallet, no crypto, no configuration required.</p>

      <div class="install-block">
        <div class="install-block__label">Claude Code</div>
        <div class="install-block__cmd">
          <pre id="install-claude">claude mcp add -s user regen-compute -- npx regen-compute</pre>
          <button onclick="copyText('install-claude', this)">Copy</button>
        </div>
      </div>

      <div class="install-block">
        <div class="install-block__label">Cursor / Windsurf / Other MCP Clients</div>
        <p style="font-size:14px;color:var(--color-muted);margin:0 0 8px;">Add to your MCP settings JSON:</p>
        <div class="install-block__cmd">
          <pre id="install-cursor">{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}</pre>
          <button onclick="copyText('install-cursor', this)">Copy</button>
        </div>
      </div>

      <div class="install-block">
        <div class="install-block__label">npm (Global Install)</div>
        <div class="install-block__cmd">
          <pre id="install-npm">npm install -g regen-compute</pre>
          <button onclick="copyText('install-npm', this)">Copy</button>
        </div>
      </div>
    </section>

    <!-- Available Tools -->
    <section class="plugin-section">
      <h2>Available Tools</h2>
      <p>The plugin exposes 7 tools to your AI assistant. Read-only tools are safe to call anytime. The retire tool executes real on-chain transactions when a wallet is configured.</p>

      <table class="tools-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Description</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>estimate_session_footprint</code></td>
            <td>Estimate energy usage and CO2 for your current AI session based on duration and tool calls</td>
            <td><span class="badge-ro">Read</span></td>
          </tr>
          <tr>
            <td><code>browse_available_credits</code></td>
            <td>Browse live ecological credit inventory with prices, aggregated from Regen Ledger sell orders</td>
            <td><span class="badge-ro">Read</span></td>
          </tr>
          <tr>
            <td><code>retire_credits</code></td>
            <td>Retire ecological credits on-chain (with wallet) or get a marketplace purchase link (without wallet)</td>
            <td><span class="badge-write">Write</span></td>
          </tr>
          <tr>
            <td><code>get_retirement_certificate</code></td>
            <td>Look up an on-chain retirement and get a shareable certificate link</td>
            <td><span class="badge-ro">Read</span></td>
          </tr>
          <tr>
            <td><code>get_impact_summary</code></td>
            <td>Network-wide ecological impact statistics from Regen Network</td>
            <td><span class="badge-ro">Read</span></td>
          </tr>
          <tr>
            <td><code>browse_ecobridge_tokens</code></td>
            <td>List supported tokens and blockchains for cross-chain credit retirement</td>
            <td><span class="badge-ro">Read</span></td>
          </tr>
          <tr>
            <td><code>retire_via_ecobridge</code></td>
            <td>Retire credits using USDC, ETH, or 50+ tokens across Ethereum, Polygon, Base, Solana, and more</td>
            <td><span class="badge-write">Write</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Try It -->
    <section class="plugin-section">
      <h2>Try It</h2>
      <p>After installing, paste one of these prompts into your AI assistant:</p>

      <div class="try-prompt">
        <div class="try-prompt__label">Explore Your Footprint</div>
        <div class="try-prompt__text">
          <code id="prompt-explore">Estimate my AI session's ecological footprint, then show me what credits are available to retire on Regen Network.</code>
          <button onclick="copyText('prompt-explore', this)">Copy</button>
        </div>
      </div>

      <div class="try-prompt">
        <div class="try-prompt__label">Browse & Retire</div>
        <div class="try-prompt__text">
          <code id="prompt-retire">Show me the cheapest carbon credits available on Regen Network and help me retire one to offset my AI usage this month.</code>
          <button onclick="copyText('prompt-retire', this)">Copy</button>
        </div>
      </div>

      <div class="try-prompt">
        <div class="try-prompt__label">Check Network Impact</div>
        <div class="try-prompt__text">
          <code id="prompt-impact">What's the total ecological impact of Regen Network? Show me retirement stats and what credit types are available.</code>
          <button onclick="copyText('prompt-impact', this)">Copy</button>
        </div>
      </div>
    </section>

    <!-- Credit Types -->
    <section class="plugin-section">
      <h2>Ecological Credit Types</h2>
      <p>Regen Network hosts multiple types of verified ecological credits, each representing a different form of measurable environmental benefit:</p>

      <div class="credit-grid">
        <div class="credit-card">
          <div class="credit-card__code">C</div>
          <div class="credit-card__name">Carbon Credits</div>
          <div class="credit-card__desc">Verified carbon removal and avoidance from forestry, soil, and land management projects.</div>
        </div>
        <div class="credit-card">
          <div class="credit-card__code">BT</div>
          <div class="credit-card__name">Biodiversity (Terrasos)</div>
          <div class="credit-card__desc">Habitat conservation units from Colombia's Terrasos biodiversity credit program.</div>
        </div>
        <div class="credit-card">
          <div class="credit-card__code">MBS</div>
          <div class="credit-card__name">Marine Biodiversity</div>
          <div class="credit-card__desc">Marine ecosystem stewardship credits protecting ocean biodiversity.</div>
        </div>
        <div class="credit-card">
          <div class="credit-card__code">USS</div>
          <div class="credit-card__name">Umbrella Species</div>
          <div class="credit-card__desc">Conservation credits protecting umbrella species whose habitat preservation benefits entire ecosystems.</div>
        </div>
        <div class="credit-card">
          <div class="credit-card__code">KSH</div>
          <div class="credit-card__name">Kilo-Sheep-Hour</div>
          <div class="credit-card__desc">Regenerative grazing credits measuring holistic land management through livestock integration.</div>
        </div>
      </div>
    </section>

    <!-- Verification -->
    <section class="plugin-section">
      <h2>On-Chain Verification</h2>
      <p>Every credit retirement is permanently recorded on <a href="https://regen.network" target="_blank" rel="noopener">Regen Network's</a> public ledger. This means:</p>
      <ul>
        <li><strong>Immutable</strong> &mdash; Once retired, a credit cannot be un-retired, double-counted, or tampered with</li>
        <li><strong>Publicly auditable</strong> &mdash; Anyone can verify any retirement using the transaction hash or certificate link</li>
        <li><strong>Shareable</strong> &mdash; Each retirement generates a certificate page you can share as proof of your contribution</li>
      </ul>
      <p>Example certificate: <a href="${baseUrl}/impact/example" target="_blank" rel="noopener">${baseUrl}/impact/[nodeId]</a></p>
    </section>

    <!-- Subscription vs One-Time -->
    <section class="plugin-section">
      <h2>Subscription vs One-Time</h2>
      <p>There are two ways to fund ecological regeneration through Regenerative Compute:</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;">
        <div class="install-block" style="margin:0;">
          <div class="install-block__label">Subscription</div>
          <p style="font-size:14px;color:var(--color-cream-soft);margin:0 0 8px;">From $1.25/month or $12.50/year (save 17%). Automatic credit retirements with attribution. Yearly subscribers get 85% of their payment funding ecology (vs 75% monthly).</p>
          <a class="regen-btn regen-btn--solid regen-btn--sm" href="/#pricing">See Plans</a>
        </div>
        <div class="install-block" style="margin:0;">
          <div class="install-block__label">One-Time Purchase</div>
          <p style="font-size:14px;color:var(--color-cream-soft);margin:0 0 8px;">Browse credits on Regen Marketplace and choose exactly which projects to support. Pay with credit card or crypto.</p>
          <a class="regen-btn regen-btn--outline regen-btn--sm" href="https://app.regen.network" target="_blank" rel="noopener">Marketplace</a>
        </div>
      </div>
    </section>

    <!-- Open Source -->
    <section class="plugin-section">
      <h2>Open Source</h2>
      <p>Regenerative Compute is open source. Inspect the code, contribute, or fork it.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;">
        <a class="regen-btn regen-btn--outline regen-btn--sm" href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">GitHub</a>
        <a class="regen-btn regen-btn--outline regen-btn--sm" href="https://www.npmjs.com/package/regen-compute" target="_blank" rel="noopener">npm</a>
      </div>
      <p style="font-size:13px;color:var(--color-muted);">Current version: <code class="regen-code">v0.3.4</code> &middot; License: MIT &middot; Node.js &ge; 20</p>
    </section>

  </div>

  ${brandFooter({ showInstall: true, links: [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research" },
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
    { label: "GitHub", href: "https://github.com/regen-network/regen-compute" },
  ] })}

  <script>
    function copyText(id, btn) {
      var el = document.getElementById(id);
      navigator.clipboard.writeText(el.textContent).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
      });
    }
  </script>

  ${betaBannerJS()}
</body>
</html>`);
  });

  return router;
}
