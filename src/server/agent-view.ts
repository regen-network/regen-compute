/**
 * Agent View — terminal-style interface showing what AI agents see.
 *
 * When any page is loaded with ?view=agent, this middleware intercepts
 * the request and renders a machine-readable, terminal-aesthetic view
 * of Regen Compute's capabilities, endpoints, and live stats.
 */

import { Router, Request, Response } from "express";
import { getDb } from "./db.js";
import { PROJECTS } from "./project-metadata.js";

export function createAgentViewRoutes(baseUrl: string): Router {
  const router = Router();

  // Middleware: if ?view=agent on any page, render agent view instead
  router.use((req: Request, res: Response, next) => {
    if (req.query.view !== "agent") return next();

    const db = getDb();

    // Get live stats
    const subCount = (db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'").get() as any)?.count ?? 0;
    const retCount = (db.prepare("SELECT COUNT(*) as count FROM subscriber_retirements").get() as any)?.count ?? 0;
    const totalRetired = (db.prepare("SELECT COALESCE(SUM(total_credits_retired), 0) as total FROM subscriber_retirements").get() as any)?.total ?? 0;

    const page = req.path === "/" ? "landing" : req.path.replace(/^\//, "").replace(/\//g, "_") || "landing";

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent View — Regen Compute</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a1a; color: #4FB573;
      font-family: 'JetBrains Mono', monospace; font-size: 14px;
      line-height: 1.6; padding: 32px; min-height: 100vh;
      position: relative; overflow-x: hidden;
    }
    /* Scanline effect */
    body::after {
      content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
      pointer-events: none; z-index: 1000;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #4FB573; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .dim { color: #374151; }
    .bright { color: #86efac; }
    .white { color: #e5e7eb; }
    .yellow { color: #fbbf24; }
    .red { color: #f87171; }
    .cyan { color: #67e8f9; }
    .section { margin: 24px 0; }
    .section-header {
      color: #86efac; font-weight: 700; font-size: 13px;
      text-transform: uppercase; letter-spacing: 0.1em;
      border-bottom: 1px solid #1e3a2a; padding-bottom: 4px;
      margin-bottom: 12px;
    }
    .kv { display: flex; gap: 12px; margin: 2px 0; }
    .kv .key { color: #6b7280; min-width: 240px; }
    .kv .val { color: #e5e7eb; }
    .json-block {
      background: #0d1117; border: 1px solid #1e3a2a; border-radius: 6px;
      padding: 16px; margin: 8px 0; overflow-x: auto; font-size: 13px;
    }
    .json-key { color: #6b7280; }
    .json-str { color: #4FB573; }
    .json-num { color: #67e8f9; }
    .json-bool { color: #fbbf24; }
    a { color: #4FB573; text-decoration: underline; }
    a:hover { color: #86efac; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    th { text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase;
         letter-spacing: 0.05em; border-bottom: 1px solid #1e3a2a; padding: 6px 12px; }
    td { padding: 6px 12px; border-bottom: 1px solid #111827; color: #e5e7eb; font-size: 13px; }
    .toggle-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #4FB573; color: #0a0a1a; border: none; border-radius: 8px;
      padding: 10px 18px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
      font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(79,181,115,0.3);
    }
    .toggle-btn:hover { background: #86efac; }
    .cursor { animation: blink 1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .prompt { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div style="margin-bottom: 24px;">
      <span class="dim">$</span> <span class="bright">regen-compute</span> <span class="dim">--interface agent --page ${page}</span>
      <h1>> REGENERATIVE COMPUTE v0.3.4 — AGENT INTERFACE</h1>
      <span class="dim">  Ecological accountability for AI compute via Regen Network</span>
    </div>

    <div class="section">
      <div class="section-header">System Status</div>
      <div class="kv"><span class="key">active_subscribers</span><span class="val">${subCount}</span></div>
      <div class="kv"><span class="key">total_retirements</span><span class="val">${retCount}</span></div>
      <div class="kv"><span class="key">total_credits_retired</span><span class="val">${totalRetired.toFixed(6)}</span></div>
      <div class="kv"><span class="key">server_status</span><span class="val bright">operational</span></div>
    </div>

    <div class="section">
      <div class="section-header">MCP Server</div>
      <div class="kv"><span class="key">install</span><span class="val"><span class="cyan">npx regen-compute</span></span></div>
      <div class="kv"><span class="key">claude_code</span><span class="val"><span class="cyan">claude mcp add -s user regen-compute -- npx regen-compute</span></span></div>
      <div class="kv"><span class="key">npm</span><span class="val"><a href="https://www.npmjs.com/package/regen-compute">npmjs.com/package/regen-compute</a></span></div>
      <div class="kv"><span class="key">source</span><span class="val"><a href="https://github.com/regen-network/regen-compute">github.com/regen-network/regen-compute</a></span></div>
    </div>

    <div class="section">
      <div class="section-header">Discovery Endpoints</div>
      <div class="kv"><span class="key">openapi</span><span class="val"><a href="${baseUrl}/api/v1/openapi.json">/api/v1/openapi.json</a></span></div>
      <div class="kv"><span class="key">mcp_server_card</span><span class="val"><a href="${baseUrl}/.well-known/mcp/server-card.json">/.well-known/mcp/server-card.json</a></span></div>
      <div class="kv"><span class="key">a2a_agent_card</span><span class="val"><a href="${baseUrl}/.well-known/agent.json">/.well-known/agent.json</a></span></div>
      <div class="kv"><span class="key">agent_flows</span><span class="val"><a href="${baseUrl}/.well-known/agents.json">/.well-known/agents.json</a></span></div>
    </div>

    <div class="section">
      <div class="section-header">Available Tools (MCP)</div>
      <table>
        <tr><th>Tool</th><th>Mode</th><th>Auth</th><th>Description</th></tr>
        <tr><td class="bright">estimate_session_footprint</td><td>read</td><td class="dim">none</td><td>Estimate ecological footprint of an AI session</td></tr>
        <tr><td class="bright">estimate_monthly_footprint</td><td>read</td><td class="dim">none</td><td>Personalized monthly footprint estimate</td></tr>
        <tr><td class="bright">browse_available_credits</td><td>read</td><td class="dim">none</td><td>Live marketplace snapshot with pricing</td></tr>
        <tr><td class="bright">retire_credits</td><td class="yellow">write</td><td class="yellow">wallet</td><td>Permanently retire ecological credits on-chain</td></tr>
        <tr><td class="bright">get_retirement_certificate</td><td>read</td><td class="dim">none</td><td>On-chain certificate lookup by nodeId or txHash</td></tr>
        <tr><td class="bright">get_impact_summary</td><td>read</td><td class="dim">none</td><td>Regen Network aggregate impact stats</td></tr>
        <tr><td class="bright">check_subscription_status</td><td>read</td><td class="cyan">api_key</td><td>Subscription status and referral info</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-header">REST API Endpoints</div>
      <table>
        <tr><th>Method</th><th>Endpoint</th><th>Auth</th><th>Description</th></tr>
        <tr><td class="cyan">GET</td><td>/api/v1/footprint</td><td>bearer</td><td>Estimate session footprint</td></tr>
        <tr><td class="cyan">GET</td><td>/api/v1/credits</td><td>bearer</td><td>Browse available credits</td></tr>
        <tr><td class="yellow">POST</td><td>/api/v1/retire</td><td>bearer</td><td>Retire ecological credits</td></tr>
        <tr><td class="cyan">GET</td><td>/api/v1/certificates/:id</td><td>bearer</td><td>Get retirement certificate</td></tr>
        <tr><td class="cyan">GET</td><td>/api/v1/impact</td><td>bearer</td><td>Network impact summary</td></tr>
        <tr><td class="cyan">GET</td><td>/api/v1/subscription</td><td>bearer</td><td>Subscription status</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-header">Pricing (Agent-Readable)</div>
      <div class="json-block"><span class="json-key">"plans"</span>: [
  { <span class="json-key">"id"</span>: <span class="json-str">"dabbler"</span>, <span class="json-key">"monthly_usd"</span>: <span class="json-num">1.25</span>, <span class="json-key">"yearly_usd"</span>: <span class="json-num">12.50</span> },
  { <span class="json-key">"id"</span>: <span class="json-str">"builder"</span>, <span class="json-key">"monthly_usd"</span>: <span class="json-num">2.50</span> },
  { <span class="json-key">"id"</span>: <span class="json-str">"agent"</span>, <span class="json-key">"yearly_usd"</span>: <span class="json-num">50.00</span> }
],
<span class="json-key">"subscribe_endpoint"</span>: <span class="json-str">"POST /subscribe"</span>,
<span class="json-key">"revenue_split"</span>: {
  <span class="json-key">"monthly"</span>: { <span class="json-key">"credits"</span>: <span class="json-num">0.75</span>, <span class="json-key">"burn"</span>: <span class="json-num">0.05</span>, <span class="json-key">"operations"</span>: <span class="json-num">0.20</span> },
  <span class="json-key">"yearly"</span>: { <span class="json-key">"credits"</span>: <span class="json-num">0.85</span>, <span class="json-key">"burn"</span>: <span class="json-num">0.05</span>, <span class="json-key">"operations"</span>: <span class="json-num">0.10</span> }
}</div>
    </div>

    <div class="section">
      <div class="section-header">Available Ecological Credits (${PROJECTS.length} projects)</div>
${PROJECTS.map(p => `
      <div style="margin: 16px 0; padding: 16px; background: #0d1117; border: 1px solid #1e3a2a; border-radius: 6px;">
        <div style="margin-bottom: 8px;">
          <span class="bright" style="font-size: 15px; font-weight: 700;">${p.name}</span>
          <span class="dim" style="margin-left: 8px;">${p.location}</span>
        </div>
        <div class="kv"><span class="key" style="min-width: 180px;">project_id</span><span class="val">${p.projectId}</span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">credit_class</span><span class="val">${p.creditClassId} — ${p.creditTypeLabel} (${p.creditType})</span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">description</span><span class="val" style="max-width: 600px;">${p.description.length > 160 ? p.description.slice(0, 160) + '...' : p.description}</span></div>
        <div style="margin-top: 8px;">
          <span class="dim">links:</span>
          <a href="${p.projectPageUrl}" style="margin-left: 8px;">project page</a>
          <span class="dim"> | </span>
          <a href="https://app.regen.network/credit-classes/${p.creditClassId}">credit class</a>
          <span class="dim"> | </span>
          <a href="https://lcd-regen.keplr.app/regen/ecocredit/marketplace/v1/sell-orders-by-batch/${p.projectId}">sell orders (LCD)</a>
          <span class="dim"> | </span>
          <a href="https://api.regen.network/indexer/v1/graphql">query indexer</a>
        </div>
      </div>`).join('')}

      <div style="margin-top: 16px;">
        <div class="section-header" style="font-size: 11px;">Audit & Verification</div>
        <div class="kv"><span class="key" style="min-width: 180px;">all_credit_classes</span><span class="val"><a href="https://lcd-regen.keplr.app/regen/ecocredit/v1/classes">lcd-regen.keplr.app/regen/ecocredit/v1/classes</a></span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">all_projects</span><span class="val"><a href="https://lcd-regen.keplr.app/regen/ecocredit/v1/projects">lcd-regen.keplr.app/regen/ecocredit/v1/projects</a></span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">all_batches</span><span class="val"><a href="https://lcd-regen.keplr.app/regen/ecocredit/v1/batches">lcd-regen.keplr.app/regen/ecocredit/v1/batches</a></span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">all_sell_orders</span><span class="val"><a href="https://lcd-regen.keplr.app/regen/ecocredit/marketplace/v1/sell-orders">lcd-regen.keplr.app/.../sell-orders</a></span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">marketplace</span><span class="val"><a href="https://app.regen.network">app.regen.network</a> (browse all projects)</span></div>
        <div class="kv"><span class="key" style="min-width: 180px;">registry</span><span class="val"><a href="https://registry.regen.network">registry.regen.network</a> (methodology docs)</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Verification</div>
      <div class="kv"><span class="key">ledger</span><span class="val">Regen Network (Cosmos SDK)</span></div>
      <div class="kv"><span class="key">lcd_endpoint</span><span class="val"><a href="https://lcd-regen.keplr.app">lcd-regen.keplr.app</a></span></div>
      <div class="kv"><span class="key">indexer_graphql</span><span class="val"><a href="https://api.regen.network/indexer/v1/graphql">api.regen.network/indexer/v1/graphql</a></span></div>
      <div class="kv"><span class="key">marketplace</span><span class="val"><a href="https://app.regen.network">app.regen.network</a></span></div>
    </div>

    <div style="margin-top: 32px; color: #374151;">
      <span class="prompt">$</span> <span class="cursor">_</span>
    </div>
  </div>

  <button class="toggle-btn" onclick="window.location.href=window.location.pathname">&#128100; Human View</button>
</body>
</html>`);
  });

  return router;
}
