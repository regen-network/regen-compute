/**
 * /developers — Developer documentation page
 *
 * Covers three tabs:
 *   1. MCP Server    — Claude / Cursor plugin (no code required)
 *   2. REST API      — Any app, agent framework, or backend
 *   3. API Reference — Full endpoint docs
 */

import { Router, Request, Response } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NAV = [
  { label: "AI Plugin", href: "/ai-plugin" },
  { label: "Research",  href: "/research" },
  { label: "About",     href: "/about" },
  { label: "Developers", href: "/developers" },
  { label: "Dashboard", href: "/dashboard/login" },
];

function developersPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Developers — Regen Compute</title>
  <meta name="description" content="Build on Regen Compute. MCP server, REST API, and API reference docs."/>
  ${brandFonts()}
  <style>
    ${brandCSS()}

    /* ---- page layout ---- */
    body { background: var(--color-void, #05060A); }

    .dev-hero {
      padding: 72px 24px 48px;
      text-align: center;
      background: url('/developers-hero.png') center center / cover no-repeat;
      position: relative;
      border-bottom: 1px solid var(--color-border, rgba(240,236,226,0.07));
    }
    .dev-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(5,6,10,0.7);
    }
    .dev-hero > * { position: relative; z-index: 1; }
    .dev-hero__eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-emerald-bright, #33b35c);
      margin-bottom: 16px;
      font-family: var(--font-ui, 'Lato'), sans-serif;
    }
    .dev-hero h1 {
      font-size: clamp(32px, 5vw, 52px);
      font-weight: 800;
      color: var(--color-cream, #F0ECE2);
      margin: 0 0 16px;
      line-height: 1.1;
      font-family: var(--font-display, 'Playfair Display'), serif;
    }
    .dev-hero p {
      font-size: 18px;
      color: var(--color-cream-soft, #D4D0C8);
      max-width: 600px;
      margin: 0 auto 32px;
      line-height: 1.6;
      font-family: var(--font-body, 'Source Serif 4'), serif;
    }
    .dev-hero__pills {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .dev-hero__pill {
      background: rgba(43,153,79,0.12);
      color: var(--color-emerald-bright, #33b35c);
      border: 1px solid rgba(43,153,79,0.3);
      border-radius: 999px;
      padding: 4px 14px;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-ui, 'Lato'), sans-serif;
    }

    /* ---- tab nav ---- */
    .dev-tabs {
      display: flex;
      justify-content: center;
      gap: 4px;
      padding: 32px 24px 0;
      border-bottom: 1px solid var(--color-border, rgba(240,236,226,0.07));
      background: var(--color-void, #05060A);
    }
    .dev-tab {
      padding: 10px 22px;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-muted, #8B90A0);
      border: none;
      background: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
      margin-bottom: -1px;
      font-family: var(--font-ui, 'Lato'), sans-serif;
    }
    .dev-tab:hover { color: var(--color-cream, #F0ECE2); }
    .dev-tab.active { color: var(--color-emerald-bright, #33b35c); border-bottom-color: var(--color-emerald, #2b994f); }

    /* ---- content panels ---- */
    .dev-panel { display: none; padding: 48px 24px 80px; max-width: 900px; margin: 0 auto; background: var(--color-void, #05060A); }
    .dev-panel.active { display: block; }

    /* ---- section headings ---- */
    .dev-h2 {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-cream, #F0ECE2);
      margin: 48px 0 12px;
      font-family: var(--font-display, 'Playfair Display'), serif;
    }
    .dev-h2:first-child { margin-top: 0; }
    .dev-h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-cream, #F0ECE2);
      margin: 32px 0 8px;
      font-family: var(--font-ui, 'Lato'), sans-serif;
    }
    .dev-lead {
      color: var(--color-cream-soft, #D4D0C8);
      line-height: 1.7;
      margin: 0 0 24px;
      font-family: var(--font-body, 'Source Serif 4'), serif;
    }

    /* ---- install block ---- */
    .dev-install {
      background: var(--color-surface, #0A0C12);
      border: 1px solid rgba(43,153,79,0.25);
      border-radius: 10px;
      padding: 20px 24px;
      font-family: var(--font-mono, 'JetBrains Mono'), 'Fira Code', monospace;
      font-size: 14px;
      color: var(--color-emerald-bright, #33b35c);
      position: relative;
      margin: 16px 0 24px;
      overflow-x: auto;
      white-space: pre;
    }
    .dev-install__copy {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(43,153,79,0.15);
      border: 1px solid rgba(43,153,79,0.3);
      color: var(--color-emerald-bright, #33b35c);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s;
    }
    .dev-install__copy:hover { background: rgba(43,153,79,0.25); }

    /* ---- step list ---- */
    .dev-steps { list-style: none; padding: 0; margin: 0 0 32px; }
    .dev-steps li {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 16px 0;
      border-bottom: 1px solid var(--color-border, rgba(240,236,226,0.07));
    }
    .dev-steps li:last-child { border-bottom: none; }
    .dev-step-num {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(43,153,79,0.1);
      border: 1px solid rgba(43,153,79,0.4);
      color: var(--color-emerald-bright, #33b35c);
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .dev-step-text { color: var(--color-cream-soft, #D4D0C8); line-height: 1.6; font-size: 15px; display: block; flex: 1; min-width: 0; }
    .dev-step-text strong { color: var(--color-cream, #F0ECE2); }
    .dev-step-text code { font-family: var(--font-mono, 'JetBrains Mono'), monospace; font-size: 13px; color: var(--color-emerald-bright, #33b35c); background: rgba(43,153,79,0.1); padding: 2px 6px; border-radius: 4px; }

    /* ---- endpoint cards ---- */
    .dev-endpoint {
      background: var(--color-card, #0E1018);
      border: 1px solid var(--color-border, rgba(240,236,226,0.07));
      border-radius: 10px;
      margin-bottom: 20px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .dev-endpoint__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      cursor: pointer;
      user-select: none;
    }
    .dev-endpoint__head:hover { background: var(--color-surface, #0A0C12); }
    .dev-method {
      font-family: var(--font-mono, 'JetBrains Mono'), monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .dev-method--get  { background: rgba(43,153,79,0.2); color: var(--color-emerald-bright, #33b35c); }
    .dev-method--post { background: rgba(99,102,241,0.2); color: #818cf8; }
    .dev-endpoint__path {
      font-family: var(--font-mono, 'JetBrains Mono'), monospace;
      font-size: 14px;
      color: var(--color-cream, #F0ECE2);
      flex: 1;
    }
    .dev-endpoint__desc { font-size: 13px; color: var(--color-muted, #8B90A0); }
    .dev-endpoint__auth {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .dev-endpoint__auth--required { background: rgba(251,191,36,0.15); color: #fbbf24; }
    .dev-endpoint__auth--public    { background: rgba(240,236,226,0.05); color: var(--color-muted, #8B90A0); }
    .dev-endpoint__body {
      display: none;
      padding: 0 20px 20px;
      border-top: 1px solid var(--color-border, rgba(240,236,226,0.07));
    }
    .dev-endpoint__body.open { display: block; }
    .dev-endpoint__body p { color: var(--color-cream-soft, #D4D0C8); font-size: 14px; margin: 12px 0 8px; line-height: 1.6; }
    .dev-code {
      background: var(--color-surface, #0A0C12);
      border: 1px solid var(--color-border, rgba(240,236,226,0.07));
      border-radius: 8px;
      padding: 16px;
      font-family: var(--font-mono, 'JetBrains Mono'), 'Fira Code', monospace;
      font-size: 12.5px;
      color: var(--color-cream-soft, #D4D0C8);
      overflow-x: auto;
      white-space: pre;
      margin: 8px 0;
    }
    .dev-code .cm  { color: var(--color-dim, #515868); }           /* comment */
    .dev-code .kw  { color: #818cf8; }                             /* keyword / method */
    .dev-code .st  { color: #fb923c; }                             /* string */
    .dev-code .nm  { color: var(--color-emerald-bright, #33b35c); } /* number / key */

    /* ---- auth box ---- */
    .dev-auth-box {
      background: rgba(251,191,36,0.06);
      border: 1px solid rgba(251,191,36,0.2);
      border-radius: 10px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .dev-auth-box h3 { font-size: 15px; font-weight: 700; color: #fbbf24; margin: 0 0 8px; }
    .dev-auth-box p { font-size: 14px; color: var(--color-cream-soft, #D4D0C8); margin: 0 0 12px; line-height: 1.6; }
    .dev-auth-box p:last-child { margin-bottom: 0; }

    /* ---- CTA ---- */
    .dev-cta {
      text-align: center;
      padding: 48px 24px;
      background: rgba(43,153,79,0.06);
      border: 1px solid rgba(43,153,79,0.2);
      border-radius: 16px;
      margin-top: 48px;
    }
    .dev-cta h2 { font-size: 24px; font-weight: 700; color: var(--color-cream, #F0ECE2); margin: 0 0 12px; font-family: var(--font-display, 'Playfair Display'), serif; }
    .dev-cta p { color: var(--color-cream-soft, #D4D0C8); margin: 0 0 24px; line-height: 1.6; }

    /* ---- table ---- */
    .dev-table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 12px 0 24px; }
    .dev-table th {
      text-align: left;
      padding: 10px 14px;
      color: var(--color-muted, #8B90A0);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px solid var(--color-border, rgba(240,236,226,0.07));
      font-family: var(--font-ui, 'Lato'), sans-serif;
    }
    .dev-table td {
      padding: 12px 14px;
      color: var(--color-cream-soft, #D4D0C8);
      border-bottom: 1px solid var(--color-border, rgba(240,236,226,0.07));
      vertical-align: top;
    }
    .dev-table td code {
      font-family: var(--font-mono, 'JetBrains Mono'), monospace;
      font-size: 12px;
      color: var(--color-emerald-bright, #33b35c);
      background: rgba(43,153,79,0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .dev-table tr:last-child td { border-bottom: none; }

    /* ---- badge ---- */
    .dev-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
    }
    .dev-badge--green { background: rgba(43,153,79,0.15); color: var(--color-emerald-bright, #33b35c); }
    .dev-badge--purple { background: rgba(139,92,246,0.15); color: #a78bfa; }
    .dev-badge--amber  { background: rgba(251,191,36,0.15);  color: #fbbf24; }

    /* ---- toggle chevron ---- */
    .dev-chevron {
      width: 16px; height: 16px;
      color: var(--color-muted, #8B90A0);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .dev-chevron.open { transform: rotate(180deg); }

    @media (max-width: 600px) {
      .dev-tabs { gap: 0; overflow-x: auto; justify-content: flex-start; padding: 24px 16px 0; }
      .dev-tab { padding: 10px 14px; font-size: 13px; white-space: nowrap; }
      .dev-panel { padding: 32px 16px 64px; }
    }
  </style>
</head>
<body>
${brandHeader({ nav: NAV })}

<!-- Hero -->
<section class="dev-hero">
  <span class="dev-hero__eyebrow">Developer Docs</span>
  <h1>Build on Regen Compute</h1>
  <p>Embed verified ecological credit retirement into any app, agent, or AI workflow. Three integration paths — pick the one that fits.</p>
  <div class="dev-hero__pills">
    <span class="dev-hero__pill">MCP Server</span>
    <span class="dev-hero__pill">REST API</span>
    <span class="dev-hero__pill">Regen Ledger</span>
    <span class="dev-hero__pill">On-chain certificates</span>
  </div>
</section>

<!-- Tab nav -->
<div class="dev-tabs">
  <button class="dev-tab active" data-tab="mcp">MCP Server</button>
  <button class="dev-tab" data-tab="api">REST API</button>
  <button class="dev-tab" data-tab="reference">API Reference</button>
</div>

<!-- ================================================================
     TAB 1 — MCP SERVER
================================================================ -->
<div class="dev-panel active" id="tab-mcp">

  <h2 class="dev-h2">MCP Server — zero-code integration</h2>
  <p class="dev-lead">
    The fastest path for Claude Code, Cursor, or any MCP-compatible agent. One command adds
    ecological footprint estimation, credit browsing, and on-chain retirement as native AI tools.
    No API key required for read-only use.
  </p>

  <h3 class="dev-h3">Install</h3>
  <div class="dev-install" id="mcp-cmd">claude mcp add -s user regen-compute -- npx regen-compute<button class="dev-install__copy" onclick="copyCode('mcp-cmd',this)">Copy</button></div>

  <h3 class="dev-h3">Or run the server manually</h3>
  <div class="dev-install" id="mcp-npx">npx regen-compute<button class="dev-install__copy" onclick="copyCode('mcp-npx',this)">Copy</button></div>

  <h3 class="dev-h3">Available tools</h3>
  <table class="dev-table">
    <thead><tr><th>Tool</th><th>Auth required</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><code>estimate_session_footprint</code></td><td><span class="dev-badge dev-badge--green">Public</span></td><td>Estimate the ecological footprint of the current session by duration and tool call count.</td></tr>
      <tr><td><code>browse_available_credits</code></td><td><span class="dev-badge dev-badge--green">Public</span></td><td>Live sell order snapshot from Regen Ledger — carbon, biodiversity, and more.</td></tr>
      <tr><td><code>get_impact_summary</code></td><td><span class="dev-badge dev-badge--green">Public</span></td><td>Network-wide stats: total retirements, active projects, credit types.</td></tr>
      <tr><td><code>get_retirement_certificate</code></td><td><span class="dev-badge dev-badge--green">Public</span></td><td>Look up an on-chain retirement certificate by node ID or tx hash.</td></tr>
      <tr><td><code>retire_credits</code></td><td><span class="dev-badge dev-badge--amber">Subscription</span></td><td>Execute an on-chain retirement or return a Marketplace purchase link.</td></tr>
      <tr><td><code>check_subscription_status</code></td><td><span class="dev-badge dev-badge--green">Public</span></td><td>Show the user's subscription tier, balance, impact, and referral link.</td></tr>
    </tbody>
  </table>

  <h3 class="dev-h3">Typical workflow (Claude will handle this automatically)</h3>
  <ol class="dev-steps">
    <li><span class="dev-step-num">1</span><span class="dev-step-text"><code>estimate_session_footprint</code> — Claude calls this at end of session to calculate ecological cost.</span></li>
    <li><span class="dev-step-num">2</span><span class="dev-step-text"><code>browse_available_credits</code> — Surfaces live credit options with real prices.</span></li>
    <li><span class="dev-step-num">3</span><span class="dev-step-text"><code>retire_credits</code> — Retires credits on-chain (subscribed users) or returns a Marketplace link.</span></li>
    <li><span class="dev-step-num">4</span><span class="dev-step-text"><code>get_retirement_certificate</code> — Returns a permanent, shareable certificate URL on Regen Network.</span></li>
  </ol>

  <h3 class="dev-h3">Agent framework integration (non-Claude)</h3>
  <p class="dev-lead">
    Any MCP-compatible framework can install the server. For frameworks that don't support MCP,
    use the REST API below instead.
  </p>
  <div class="dev-code"><span class="cm"># LangChain / CrewAI / custom agent</span>
<span class="cm"># Start the MCP server as a subprocess and connect via stdio transport</span>
npx regen-compute   <span class="cm"># listens on stdin/stdout per MCP spec</span></div>

  <div class="dev-cta">
    <h2>Get your API key</h2>
    <p>Subscribe to unlock <code>retire_credits</code> and the full REST API. Free tier includes all read-only tools.</p>
    <a href="/#pricing" class="regen-btn regen-btn--primary">View plans &amp; pricing</a>
  </div>
</div>

<!-- ================================================================
     TAB 2 — REST API
================================================================ -->
<div class="dev-panel" id="tab-api">

  <h2 class="dev-h2">REST API — embed retirement anywhere</h2>
  <p class="dev-lead">
    A JSON API at <code>/api/v1/</code> mirrors all MCP tools. Use it from any language, any
    framework. Perfect for web apps, agent pipelines, game backends, or serverless functions.
  </p>

  <div class="dev-auth-box">
    <h3>Authentication</h3>
    <p>Most endpoints require a valid API key. Include it as a Bearer token in every request:</p>
    <div class="dev-code">Authorization: Bearer rfa_your_api_key_here</div>
    <p>Get your key by subscribing at <a href="/#pricing" style="color:var(--color-emerald-bright, #33b35c)">/#pricing</a>. Your key appears in the Dashboard immediately after checkout.</p>
  </div>

  <h3 class="dev-h3">Quick start — Node.js</h3>
  <div class="dev-code" id="qs-node"><span class="kw">const</span> API  = <span class="st">"https://compute.regen.network/api/v1"</span>;
<span class="kw">const</span> KEY  = process.env.REGEN_API_KEY;
<span class="kw">const</span> hdrs = { <span class="st">Authorization</span>: <span class="st">\`Bearer \${KEY}\`</span>, <span class="st">"Content-Type"</span>: <span class="st">"application/json"</span> };

<span class="cm">// 1. Estimate footprint for a 30-minute session with 12 tool calls</span>
<span class="kw">const</span> fp = <span class="kw">await</span> fetch(<span class="st">\`\${API}/footprint?session_minutes=30&amp;tool_calls=12\`</span>, { headers: hdrs });
<span class="kw">const</span> { kg_co2e, suggested_credits } = <span class="kw">await</span> fp.json();

<span class="cm">// 2. Browse available credits</span>
<span class="kw">const</span> cr = <span class="kw">await</span> fetch(<span class="st">\`\${API}/credits\`</span>, { headers: hdrs });
<span class="kw">const</span> { credit_classes } = <span class="kw">await</span> cr.json();

<span class="cm">// 3. Retire credits on-chain</span>
<span class="kw">const</span> ret = <span class="kw">await</span> fetch(<span class="st">\`\${API}/retire\`</span>, {
  method: <span class="st">"POST"</span>, headers: hdrs,
  body: JSON.stringify({ quantity: suggested_credits, beneficiary_name: <span class="st">"My App"</span> })
});
<span class="kw">const</span> { tx_hash, certificate_url } = <span class="kw">await</span> ret.json();
console.log(<span class="st">"Certificate:"</span>, certificate_url);</div>
    <button class="dev-install__copy" style="position:static;margin-top:4px;" onclick="copyCode('qs-node',this)">Copy</button>

  <h3 class="dev-h3">Quick start — curl</h3>
  <div class="dev-code" id="qs-curl"><span class="cm"># Set your key</span>
export REGEN_API_KEY=rfa_your_api_key_here

<span class="cm"># Footprint estimate</span>
curl -H "Authorization: Bearer $REGEN_API_KEY" \
  "https://compute.regen.network/api/v1/footprint?session_minutes=30&amp;tool_calls=12"

<span class="cm"># Browse credits</span>
curl -H "Authorization: Bearer $REGEN_API_KEY" \
  "https://compute.regen.network/api/v1/credits"

<span class="cm"># Retire 0.5 credits</span>
curl -X POST -H "Authorization: Bearer $REGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"quantity":0.5,"beneficiary_name":"My App"}' \
  "https://compute.regen.network/api/v1/retire"</div>
    <button class="dev-install__copy" style="position:static;margin-top:4px;" onclick="copyCode('qs-curl',this)">Copy</button>

  <h3 class="dev-h3">Rate limits</h3>
  <table class="dev-table">
    <thead><tr><th>Tier</th><th>Requests / minute</th><th>Retire credits</th></tr></thead>
    <tbody>
      <tr><td>Public (no key)</td><td>—</td><td>No</td></tr>
      <tr><td>Dabbler</td><td>60 req/min</td><td>Yes</td></tr>
      <tr><td>Builder</td><td>60 req/min</td><td>Yes</td></tr>
      <tr><td>Agent</td><td>60 req/min</td><td>Yes</td></tr>
    </tbody>
  </table>

  <div class="dev-cta">
    <h2>OpenAPI spec</h2>
    <p>Full machine-readable spec. Import into Postman, Insomnia, or any OpenAPI client.</p>
    <a href="/api/v1/openapi.json" class="regen-btn regen-btn--primary" target="_blank">Download openapi.json</a>
  </div>
</div>


<!-- ================================================================
     TAB 3 — API REFERENCE
================================================================ -->
<div class="dev-panel" id="tab-reference">

  <h2 class="dev-h2">API Reference</h2>
  <p class="dev-lead">
    All endpoints are under <code>https://compute.regen.network/api/v1/</code>.
    Click any endpoint to expand the full request/response spec.
  </p>

  <div class="dev-auth-box">
    <h3>Base URL &amp; auth header</h3>
    <div class="dev-code">GET https://compute.regen.network/api/v1/{endpoint}
Authorization: Bearer rfa_your_api_key_here</div>
  </div>

  <!-- GET /footprint -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/footprint</span>
      <span class="dev-endpoint__desc">Estimate session footprint</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p><strong>Query parameters</strong></p>
      <table class="dev-table">
        <thead><tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>session_minutes</code></td><td>float</td><td>Yes</td><td>Duration of the AI session in minutes</td></tr>
          <tr><td><code>tool_calls</code></td><td>int</td><td>No</td><td>Number of tool invocations (improves estimate accuracy)</td></tr>
        </tbody>
      </table>
      <p><strong>Example response</strong></p>
      <div class="dev-code">{
  <span class="nm">"session_minutes"</span>: 30,
  <span class="nm">"tool_calls"</span>: 12,
  <span class="nm">"kg_co2e"</span>: 0.042,
  <span class="nm">"suggested_credits"</span>: 0.05,
  <span class="nm">"methodology"</span>: "Heuristic estimate based on session duration and tool usage.",
  <span class="nm">"disclaimer"</span>: "This is an estimate. Actual compute energy varies by model and datacenter."
}</div>
    </div>
  </div>

  <!-- GET /credits -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/credits</span>
      <span class="dev-endpoint__desc">Browse available credit classes &amp; sell orders</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p><strong>Query parameters</strong></p>
      <table class="dev-table">
        <thead><tr><th>Param</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>type</code></td><td>string</td><td><code>all</code></td><td><code>all</code> | <code>carbon</code> | <code>biodiversity</code></td></tr>
          <tr><td><code>max_results</code></td><td>int</td><td>10</td><td>Max credit classes to return (max 50)</td></tr>
        </tbody>
      </table>
      <p><strong>Example response (truncated)</strong></p>
      <div class="dev-code">{
  <span class="nm">"credit_classes"</span>: [
    {
      <span class="nm">"id"</span>: <span class="st">"C01"</span>,
      <span class="nm">"name"</span>: <span class="st">"Carbon Credit Class"</span>,
      <span class="nm">"credit_type"</span>: <span class="st">"Carbon"</span>,
      <span class="nm">"credit_type_abbreviation"</span>: <span class="st">"C"</span>,
      <span class="nm">"projects"</span>: [...],
      <span class="nm">"sell_orders"</span>: [...]
    }
  ],
  <span class="nm">"marketplace_snapshot"</span>: [
    { <span class="nm">"credit_type"</span>: <span class="st">"Carbon"</span>, <span class="nm">"available_credits"</span>: 1240.5, <span class="nm">"sell_orders"</span>: 8 }
  ],
  <span class="nm">"total_classes"</span>: 6,
  <span class="nm">"data_source"</span>: <span class="st">"Regen Ledger (live)"</span>
}</div>
    </div>
  </div>

  <!-- POST /retire -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--post">POST</span>
      <span class="dev-endpoint__path">/retire</span>
      <span class="dev-endpoint__desc">Execute an on-chain credit retirement</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p><strong>Request body</strong></p>
      <table class="dev-table">
        <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>credit_class</code></td><td>string</td><td>No</td><td>Class ID (e.g. <code>C01</code>). Defaults to lowest-cost available.</td></tr>
          <tr><td><code>quantity</code></td><td>float</td><td>No</td><td>Credits to retire. Defaults to session footprint suggestion.</td></tr>
          <tr><td><code>beneficiary_name</code></td><td>string</td><td>No</td><td>Name on the retirement certificate</td></tr>
          <tr><td><code>jurisdiction</code></td><td>string</td><td>No</td><td>ISO 3166-1 alpha-2 (e.g. <code>US</code>)</td></tr>
          <tr><td><code>reason</code></td><td>string</td><td>No</td><td>Reason string recorded on-chain</td></tr>
        </tbody>
      </table>
      <p><strong>Success response</strong></p>
      <div class="dev-code">{
  <span class="nm">"status"</span>: <span class="st">"success"</span>,
  <span class="nm">"tx_hash"</span>: <span class="st">"A3F2...9C1D"</span>,
  <span class="nm">"credits_retired"</span>: 0.5,
  <span class="nm">"cost"</span>: { <span class="nm">"amount"</span>: <span class="st">"2.50"</span>, <span class="nm">"denom"</span>: <span class="st">"USDC"</span> },
  <span class="nm">"certificate_url"</span>: <span class="st">"https://compute.regen.network/impact/bWVhbmluZ..."</span>,
  <span class="nm">"jurisdiction"</span>: <span class="st">"US"</span>
}</div>
      <p><strong>Fallback response</strong> (when wallet not configured — returns marketplace link)</p>
      <div class="dev-code">{
  <span class="nm">"status"</span>: <span class="st">"marketplace_link"</span>,
  <span class="nm">"marketplace_url"</span>: <span class="st">"https://app.regen.network/..."</span>,
  <span class="nm">"message"</span>: <span class="st">"Complete purchase at Regen Marketplace"</span>
}</div>
    </div>
  </div>

  <!-- GET /impact -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/impact</span>
      <span class="dev-endpoint__desc">Network-wide impact stats</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p>No parameters. Returns aggregate stats from Regen Ledger and the Indexer.</p>
      <div class="dev-code">{
  <span class="nm">"credit_classes"</span>: 6,
  <span class="nm">"active_projects"</span>: 42,
  <span class="nm">"jurisdictions"</span>: 14,
  <span class="nm">"total_retirements"</span>: 1823,
  <span class="nm">"credit_types"</span>: [
    { <span class="nm">"abbreviation"</span>: <span class="st">"C"</span>,   <span class="nm">"name"</span>: <span class="st">"Carbon"</span> },
    { <span class="nm">"abbreviation"</span>: <span class="st">"BT"</span>,  <span class="nm">"name"</span>: <span class="st">"Biodiversity (Terrasos)"</span> },
    { <span class="nm">"abbreviation"</span>: <span class="st">"MBS"</span>, <span class="nm">"name"</span>: <span class="st">"Marine Biodiversity Stewardship"</span> }
  ]
}</div>
    </div>
  </div>

  <!-- GET /certificates/:id -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/certificates/:id</span>
      <span class="dev-endpoint__desc">Look up a retirement certificate</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p><code>:id</code> is the base64-encoded node ID from the Regen Indexer, or a tx hash.</p>
      <div class="dev-code">{
  <span class="nm">"node_id"</span>: <span class="st">"bWVhbmluZ..."</span>,
  <span class="nm">"amount"</span>: <span class="st">"0.5"</span>,
  <span class="nm">"batch_denom"</span>: <span class="st">"C01-001-20230101-20231231-001"</span>,
  <span class="nm">"owner"</span>: <span class="st">"regen1..."</span>,
  <span class="nm">"jurisdiction"</span>: <span class="st">"US"</span>,
  <span class="nm">"reason"</span>: <span class="st">"AI session — Regen Compute"</span>,
  <span class="nm">"timestamp"</span>: <span class="st">"2026-03-23T14:32:00Z"</span>,
  <span class="nm">"tx_hash"</span>: <span class="st">"A3F2...9C1D"</span>,
  <span class="nm">"certificate_url"</span>: <span class="st">"https://compute.regen.network/impact/bWVhbmluZ..."</span>
}</div>
    </div>
  </div>

  <!-- GET /subscription -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/subscription</span>
      <span class="dev-endpoint__desc">Current user subscription &amp; impact</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--required">Auth required</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <div class="dev-code">{
  <span class="nm">"subscribed"</span>: true,
  <span class="nm">"tier"</span>: <span class="st">"builder"</span>,
  <span class="nm">"status"</span>: <span class="st">"active"</span>,
  <span class="nm">"referral_count"</span>: 3,
  <span class="nm">"referral_link"</span>: <span class="st">"https://compute.regen.network/r/ABC123"</span>,
  <span class="nm">"cumulative_credits_retired"</span>: 12.5
}</div>
    </div>
  </div>

  <!-- GET /payment-info -->
  <div class="dev-endpoint">
    <div class="dev-endpoint__head" onclick="toggleEndpoint(this)">
      <span class="dev-method dev-method--get">GET</span>
      <span class="dev-endpoint__path">/payment-info</span>
      <span class="dev-endpoint__desc">Crypto payment addresses for autonomous agents</span>
      <span class="dev-endpoint__auth dev-endpoint__auth--public">Public</span>
      <svg class="dev-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="dev-endpoint__body">
      <p>Returns on-chain payment addresses for agents that want to subscribe autonomously via crypto (EIP-402 pattern).</p>
      <div class="dev-code">{
  <span class="nm">"addresses"</span>: {
    <span class="nm">"evm"</span>: { <span class="nm">"address"</span>: <span class="st">"0x0687..."</span>, <span class="nm">"chains"</span>: [<span class="st">"ethereum"</span>, <span class="st">"base"</span>, ...] },
    <span class="nm">"bitcoin"</span>: <span class="st">"bc1q..."</span>,
    <span class="nm">"solana"</span>: <span class="st">"9npQ..."</span>
  },
  <span class="nm">"minimum_usd"</span>: 1.25,
  <span class="nm">"confirm_endpoint"</span>: <span class="st">"POST https://compute.regen.network/api/v1/confirm-payment"</span>
}</div>
    </div>
  </div>

  <div class="dev-cta">
    <h2>Full OpenAPI spec</h2>
    <p>Import into Postman, Insomnia, or use with any OpenAPI codegen.</p>
    <a href="/api/v1/openapi.json" class="regen-btn regen-btn--primary" target="_blank">openapi.json</a>
  </div>
</div>

<script>
// Tab switching
document.querySelectorAll('.dev-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dev-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + id).classList.add('active');
    history.replaceState(null, '', '#' + id);
  });
});

// Restore tab from hash
const hash = location.hash.slice(1);
if (hash && document.getElementById('tab-' + hash)) {
  document.querySelector('[data-tab="' + hash + '"]')?.click();
}

// Expand/collapse endpoint
function toggleEndpoint(head) {
  const body = head.nextElementSibling;
  const chevron = head.querySelector('.dev-chevron');
  const open = body.classList.toggle('open');
  chevron.classList.toggle('open', open);
}

// Copy to clipboard
function copyCode(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  const btnEl = clone.querySelector('button');
  if (btnEl) btnEl.remove();
  navigator.clipboard.writeText(clone.textContent.trim()).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 1800);
  });
}
</script>

${brandFooter({ links: [{ label: "API Reference", href: "/developers#reference" }, { label: "Badges", href: "/badges" }, { label: "Dashboard", href: "/dashboard/login" }] })}
</body>
</html>`;
}

export function createDevelopersRoutes(baseUrl: string): Router {
  const router = Router();

  router.get("/developers", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(developersPageHTML());
  });

  router.get("/developers-hero.png", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(join(process.cwd(), "public", "developers-hero.png"));
  });

  return router;
}
