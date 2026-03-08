# Community Seeding Drafts

Two messaging tracks: **Website-first** (for general AI users) and **MCP-first** (for developers). Each points to the other. The website is the conversion target. The MCP is the distribution engine.

---

## 1. Hacker News — "Show HN"

**Target**: Developers, technical audience, people who care about verifiable claims

**Title**: Show HN: Regenerative Compute — Ecological accountability for AI, verified on-chain

**Post**:

We built compute.regen.network — a platform that connects AI usage to verified ecological credit retirement on Regen Network (a public blockchain purpose-built for ecological credits).

Two ways to use it:

1. Subscribe at compute.regen.network ($1.25-$5/mo (or yearly, save 17%)nth (or save 17% yearly)). Your payment funds verified ecological projects. You get a dashboard with on-chain proof of every retirement.

2. If you use Claude Code, Cursor, or any MCP-compatible AI tool, install the AI plugin: `claude mcp add -s user regen-compute -- npx regen-compute`. It gives your AI assistant the ability to estimate session footprint, browse live credit inventory, and retire credits without leaving your workflow.

Key difference from existing "green AI" claims: every retirement is on the Regen Ledger — a public, immutable blockchain. Not a private database. Anyone can verify any retirement. We also don't claim "carbon neutrality" — we call it "regenerative contribution" because that's what it actually is.

Credits available: carbon, biodiversity (Terrasos/Colombia), marine, umbrella species, regenerative grazing. $2M+ in live inventory from projects in 9+ countries.

Open source (Apache-2.0): https://github.com/regen-network/regen-compute

---

## 2. r/ClaudeAI

**Target**: Claude users, many non-technical, interested in AI tools

**Title**: I built a way to fund ecological regeneration from your AI sessions — works with Claude Code and as a simple subscription

**Post**:

Every AI session uses energy. I wanted a way to do something about it that wasn't just hand-waving.

Regenerative Compute (compute.regen.network) lets you fund verified ecological projects — forests, soil, biodiversity — with permanent proof on a public ledger.

**Easiest way**: Subscribe at compute.regen.network. Plans start at $1.25/month or $12.50/year (save 17% — and 85% of your yearly payment goes to ecology vs 75% monthly). You get a dashboard tracking your impact with on-chain proof.

**Developer way**: If you use Claude Code, there's an MCP plugin. One command to install:

```
claude mcp add -s user regen-compute -- npx regen-compute
```

Then you can ask Claude things like "What's the ecological footprint of this session?" or "Show me what ecological credits are available on Regen Network."

Every credit retirement is recorded on a public blockchain (Regen Network). Not a corporate database — an immutable public ledger anyone can audit. We don't call it "carbon offsetting" because that term is loaded with greenwashing. We call it "regenerative contribution" — you're funding real projects, and here's the proof.

Five types of credits: carbon, biodiversity, marine ecosystems, umbrella species habitat, and regenerative grazing. Projects in 9+ countries.

Site: https://compute.regen.network
GitHub: https://github.com/regen-network/regen-compute

---

## 3. r/MachineLearning

**Target**: ML researchers and practitioners, care about empirical claims

**Title**: Ecological accountability for AI compute — verified on-chain, not marketing claims

**Post**:

The AI energy conversation usually stops at "data centers use a lot of electricity." Luccioni et al. (2023) and Epoch AI (2025) have put real numbers on per-query energy costs (0.3-2.9 Wh per typical query, ~40 Wh for 100k-token contexts). But individual users have had no mechanism to act on these numbers from inside their workflow.

We built Regenerative Compute (compute.regen.network) to close that gap.

It connects AI usage to verified ecological credit retirement on Regen Network — a purpose-built blockchain for ecological assets. Two entry points:

1. **Website subscription** (compute.regen.network): $1.25-$5/mo (or yearly, save 17%)nth (or save 17% yearly). Automatic monthly credit retirements with on-chain proof. No crypto knowledge needed.

2. **MCP plugin** for Claude Code/Cursor: `npx regen-compute`. Your AI assistant can estimate session footprint, browse live credit inventory from the Regen Ledger, and retire credits directly.

Design choices worth noting:
- Footprint estimation is explicitly heuristic. We don't claim precision — we label it as approximate and cite our methodology at compute.regen.network/research.
- We never say "carbon neutral." The framing is "regenerative contribution" — factual, verifiable, no neutrality claims.
- Retirements are on a public ledger. Anyone can audit any retirement. This is fundamentally different from traditional offset registries.
- Five credit types beyond carbon: biodiversity, marine, umbrella species, regenerative grazing.

Open source: https://github.com/regen-network/regen-compute
Research page: https://compute.regen.network/research

---

## 4. Twitter/X Thread

**Target**: Broad tech/climate audience, high-signal, shareable

**Thread**:

**Tweet 1**:
Your AI has an ecological footprint. Now you can do something about it — with proof.

Introducing Regenerative Compute: ecological accountability for AI, verified on a public ledger.

Subscribe: compute.regen.network
Install the AI plugin: npx regen-compute

**Tweet 2**:
How it works:

Subscribe at compute.regen.network ($1.25-$5/mo (or yearly, save 17%)). Your payment funds verified ecological credit retirement — forests, soil, biodiversity, marine ecosystems.

Every retirement is on-chain on Regen Network. Not a private database. Public, permanent, auditable.

**Tweet 3**:
For developers: there's an MCP plugin for Claude Code, Cursor, and any MCP-compatible AI tool.

One command:
claude mcp add -s user regen-compute -- npx regen-compute

Your AI can estimate its footprint, browse live credits, and retire them — without leaving your workflow.

**Tweet 4**:
Why "regenerative contribution" and not "carbon offset"?

Because we don't claim carbon neutrality. We fund real projects and give you on-chain proof. That's a factual claim, not a marketing one.

5 credit types. 9+ countries. $2M+ in live inventory on a public marketplace.

**Tweet 5**:
Open source. Apache-2.0.

GitHub: github.com/regen-network/regen-compute
npm: npmjs.com/package/regen-compute

Subscribe: compute.regen.network

---

## 5. Claude Code Discord

**Target**: Claude Code power users, developers, MCP enthusiasts

**Post**:

Built an MCP server that gives Claude ecological awareness — and a website where anyone can subscribe to fund ecological regeneration from their AI usage.

**The website** (compute.regen.network): Subscribe for $1.25-$5/mo (or yearly, save 17%)nth (or save 17% yearly). Your payment automatically retires verified ecological credits on Regen Network. Dashboard tracks your impact with on-chain proof.

**The MCP plugin**: One command to install:
```
claude mcp add -s user regen-compute -- npx regen-compute
```

Then try: "Estimate my AI session's ecological footprint, then show me what credits are available to retire on Regen Network."

7 tools — footprint estimation, credit browsing, on-chain retirement, certificates, cross-chain payment via ecoBridge (50+ tokens, 10+ chains).

Every retirement is on a public blockchain. Not greenwashing — verifiable proof.

Open source: https://github.com/regen-network/regen-compute

---

## 6. Cursor Forums

**Target**: Cursor users, many newer to MCP

**Post**:

**Title**: MCP Plugin: Ecological accountability for your AI coding sessions

Made an MCP server that works with Cursor to estimate your session's ecological footprint and retire verified credits on Regen Network.

Add to your MCP settings:
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

What it does: Your AI can estimate session footprint, browse live ecological credit inventory, and retire credits — carbon, biodiversity, marine, and more. Every retirement is on a public blockchain with permanent proof.

If you just want to subscribe without the MCP setup, compute.regen.network has plans starting at $1.25/month or $12.50/year (save 17%). Same credits, same on-chain proof, simpler path.

GitHub: https://github.com/regen-network/regen-compute

---

## 7. Dev.to Cross-Post

**Target**: Developer community, long-form friendly

Use the full blog post from `blog-launch-post.md` with Dev.to front matter:

```yaml
---
title: "Your AI Has a Footprint. Now You Can Do Something About It."
published: true
tags: ai, sustainability, mcp, opensource
canonical_url: https://compute.regen.network/blog/launch
---
```

---

## 8. Regen Discord / Forum

**Target**: Existing Regen community, understand crypto/on-chain

**Post**:

Regenerative Compute is live — the first product that channels AI compute spending into Regen Network credit retirements.

**For the broader AI audience**: compute.regen.network has subscription plans ($1.25-$5/mo (or yearly, save 17%)). No wallet needed. Credit card payments fund monthly batch retirements on Regen Ledger. Dashboard shows on-chain proof.

**For developers**: The MCP plugin works with Claude Code, Cursor, and any MCP client. It queries the Regen Ledger for live sell orders, executes MsgBuyDirect with auto-retire via @cosmjs, and retrieves retirement certificates from the indexer.

Revenue split: Monthly subs = 75% credits / 20% ops / 5% REGEN burn. Yearly subs = 85% credits / 10% ops / 5% burn. Yearly subscribers save 17% and more of their money goes to credits.

Every subscription drives demand for credits on the Regen Marketplace and burns REGEN. This is a new demand channel for the entire ecosystem.

npm: https://www.npmjs.com/package/regen-compute
GitHub: https://github.com/regen-network/regen-compute
Subscribe: https://compute.regen.network

---

## Messaging Quick Reference

| Channel | Lead with | CTA | Secondary CTA |
|---------|-----------|-----|---------------|
| Hacker News | On-chain verification angle | GitHub + Website | MCP install |
| r/ClaudeAI | Simple subscription for Claude users | compute.regen.network | MCP install |
| r/MachineLearning | Research-backed footprint numbers | Website + Research page | MCP install |
| Twitter/X | Punchy hook + proof angle | compute.regen.network | npx regen-compute |
| Claude Discord | MCP plugin demo | MCP install | compute.regen.network |
| Cursor Forums | MCP plugin setup | MCP install | compute.regen.network |
| Dev.to | Full blog post | compute.regen.network | GitHub |
| Regen Discord | Ecosystem value (demand + REGEN burn) | Website + npm | GitHub |
