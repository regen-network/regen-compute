# Regenerative Compute

**Add Regenerative AI to your AI coding assistant in 30 seconds.**

[![npm version](https://img.shields.io/npm/v/regen-compute)](https://www.npmjs.com/package/regen-compute)
[![CI](https://github.com/CShear/regen-compute/actions/workflows/ci.yml/badge.svg)](https://github.com/CShear/regen-compute/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

Every AI session consumes energy. This MCP server lets your AI assistant estimate that footprint and retire verified ecocredits on [Regen Network](https://regen.network) — with immutable on-chain proof.

This is **regenerative contribution**, not carbon offsetting. No neutrality claims. Just verified funding of ecological regeneration.

## Install

```bash
claude mcp add -s user regen-compute -- npx regen-compute
```

That's it. Works immediately — no API keys, no wallet, no configuration needed for read-only tools.

### Supported Platforms

<details>
<summary><b>Cursor</b></summary>

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

Restart Cursor. Tools appear in Cursor's AI chat.

</details>

<details>
<summary><b>Windsurf</b></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

Open Windsurf Settings > Cascade > MCP Servers to verify the connection.

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

Requires VS Code 1.99+ with GitHub Copilot. Tools are available in Agent mode.

</details>

<details>
<summary><b>JetBrains (IntelliJ, WebStorm, PyCharm, etc.)</b></summary>

Go to **Settings > Tools > AI Assistant > Model Context Protocol (MCP)**, click **+**, and paste:

```json
{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

Requires a JetBrains AI Assistant subscription.

</details>

<details>
<summary><b>Gemini CLI</b></summary>

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

</details>

<details>
<summary><b>Continue.dev</b></summary>

Create `.continue/mcpServers/regen-compute.yaml` in your workspace:

```yaml
name: Regenerative Compute
version: 0.0.1
schema: v1
mcpServers:
  - name: regen-compute
    type: stdio
    command: npx
    args:
      - "regen-compute"
```

Note: MCP tools are only available in Continue's agent mode.

</details>

<details>
<summary><b>Sourcegraph Cody</b></summary>

Cody uses the OpenCtx bridge, which requires a local file path (not npx). Install first:

```bash
npm install -g regen-compute
```

Then add to your VS Code `settings.json`:

```json
{
  "openctx.providers": {
    "https://openctx.org/npm/@openctx/provider-modelcontextprotocol": {
      "nodeCommand": "node",
      "mcp.provider.uri": "file:///ABSOLUTE/PATH/TO/node_modules/regen-compute/dist/index.js"
    }
  }
}
```

Replace the path with the actual location of the installed package.

</details>

<details>
<summary><b>Any MCP-compatible client</b></summary>

Most MCP clients accept this standard config:

```json
{
  "mcpServers": {
    "regen-compute": {
      "command": "npx",
      "args": ["regen-compute"]
    }
  }
}
```

</details>

> **ChatGPT and OpenAI API**: These platforms require a remote HTTP MCP server (streamable HTTP or SSE transport). Regenerative Compute currently uses stdio transport. HTTP transport support is on the [roadmap](ROADMAP.md).

## What You Get

| Tool | What it does |
|------|-------------|
| `estimate_session_footprint` | Estimate energy, CO2, and retirement cost for your AI session |
| `browse_available_credits` | Browse live sell orders on Regen Marketplace (carbon, biodiversity, marine, species) |
| `retire_credits` | Retire credits on-chain (with wallet) or get a credit card purchase link (without) |
| `get_retirement_certificate` | Verify any retirement with on-chain proof |
| `get_impact_summary` | Regen Network aggregate stats — projects, retirements, jurisdictions |
| `browse_ecobridge_tokens` | List 50+ tokens across 10+ chains for cross-chain payment |
| `retire_via_ecobridge` | Pay with USDC/ETH/etc. on Ethereum, Base, Polygon, Arbitrum, and more |

### Three payment modes — pick what works for you

1. **Credit card** (default, no setup) — get a Regen Marketplace link
2. **Direct on-chain** — set `REGEN_WALLET_MNEMONIC`, retire in a single tx
3. **Any token, any chain** — USDC on Base, ETH on Arbitrum, etc. via [ecoBridge](https://bridge.eco)

## How It Works

```
Your AI Assistant (Claude Code / Cursor / etc.)
    │
    │ MCP Protocol (stdio)
    ▼
Regenerative Compute MCP Server
    │
    ├─ Footprint estimation (heuristic, clearly labeled as approximate)
    ├─ Credit browsing (live sell order data from Regen Ledger)
    ├─ Retirement execution (MsgBuyDirect with auto-retire)
    └─ Certificate retrieval (on-chain verification)
    │
    ▼
Regen Network Ledger (immutable, verifiable, non-reversible)
```

If anything fails during on-chain retirement, it falls back to a marketplace link. Users are never stuck.

## Configuration

Works with zero config. Set environment variables for advanced features:

```bash
cp .env.example .env
```

| Variable | Required | What it enables |
|----------|----------|----------------|
| *(none)* | — | Footprint estimation, credit browsing, impact stats, marketplace links |
| `REGEN_WALLET_MNEMONIC` | Optional | Direct on-chain retirement (MsgBuyDirect) |
| `ECOBRIDGE_EVM_MNEMONIC` | Optional | Cross-chain payment via ecoBridge (send USDC, ETH, etc.) |
| `ECOBRIDGE_ENABLED=false` | Optional | Disable ecoBridge tools |

See [`.env.example`](.env.example) for all options with inline documentation.

## MCP Prompts

Pre-built workflows you can invoke:

| Prompt | Workflow |
|--------|----------|
| `offset_my_session` | Estimate footprint → browse credits → retire |
| `show_regen_impact` | Pull live network stats and summarize |
| `retire_with_any_token` | Browse ecoBridge tokens → pick chain/token → retire |

## Credit Types

| Type | Description |
|------|-------------|
| Carbon (C) | Verified carbon removal and avoidance |
| Biodiversity (BT) | Terrasos voluntary biodiversity credits |
| Marine Biodiversity (MBS) | Marine ecosystem stewardship |
| Umbrella Species (USS) | Habitat conservation via umbrella species |
| Kilo-Sheep-Hour (KSH) | Grazing-based land stewardship |

## Data Sources

| Source | What it provides |
|--------|------------------|
| [Regen Ledger REST](https://lcd-regen.keplr.app) | Credit classes, projects, batches, sell orders |
| [Regen Indexer GraphQL](https://api.regen.network/indexer/v1/graphql) | Retirement certificates, marketplace orders, stats |
| [Regen Marketplace](https://app.regen.network) | Credit card purchase flow |
| [ecoBridge API](https://api.bridge.eco) | Cross-chain tokens, prices, widget links |

## Development

### Local setup

```bash
git clone https://github.com/CShear/regen-compute.git
cd regen-compute
npm install
cp .env.example .env  # fill in your keys (optional — read-only tools work without)
npm run build
```

### Connect to Claude Code (local build)

Point your MCP config at the local build so changes are reflected immediately:

```bash
claude mcp add regen-compute -s user -- node /path/to/regen-compute/dist/index.js
```

To enable ecoBridge tools locally:

```bash
claude mcp add regen-compute -s user \
  --env ECOBRIDGE_ENABLED=true \
  -- node /path/to/regen-compute/dist/index.js
```

### Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Watch mode with hot reload (tsx) |
| `npm run build` | Production build (tsc) |
| `npm run typecheck` | Type checking only |
| `npm test` | Run test suite (vitest) |
| `npm run test:watch` | Run tests in watch mode |

### Running tests

```bash
npm test              # single run
npm run test:watch    # re-run on file changes
```

Tests mock all external APIs (RPC providers, ecoBridge, Regen Ledger) — no network calls, no wallets needed.

## Roadmap

| Phase | Status |
|-------|--------|
| **1.0** Read-only MCP — footprint, browsing, marketplace links, certificates | Complete |
| **1.5** On-chain retirement — wallet signing, order routing, ecoBridge cross-chain | Complete |
| **2.0** Subscription pool — Stripe, monthly batch retirements, fractional attribution | [In progress](ROADMAP.md) |
| **3.0** Smart contract — CosmWasm pool, automated retirement, REGEN burn | Planned |
| **4.0** Scale — enterprise API, platform partnerships, credit supply development | Planned |

See [ROADMAP.md](ROADMAP.md) for the full 3-track rollout plan, dependency graph, and business context.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the issue workflow, label guide, and branch conventions.

Good first issues: [`gh issue list --label "good first issue"`](https://github.com/CShear/regen-compute/labels/good%20first%20issue)

## License

Apache-2.0 — see [LICENSE](LICENSE).
