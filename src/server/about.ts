/**
 * GET /about — About Regen Network & Regenerative Compute.
 *
 * Tells the Regen Network story: what the network is, how Regen Compute
 * fits in, ways to get involved, and open-source contribution info.
 */

import { Router, Request, Response } from "express";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";

export function createAboutRoutes(baseUrl: string): Router {
  const router = Router();

  router.get("/about", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About — Regenerative Compute</title>
  <meta name="description" content="Learn about Regen Network, how Regenerative Compute connects AI usage to verified ecological credit retirement, and how to get involved.">
  <meta property="og:title" content="About — Regenerative Compute">
  <meta property="og:description" content="The story behind Regen Network and Regenerative Compute — ecological accountability for AI.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/about">
  <meta property="og:image" content="${baseUrl}/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="About — Regenerative Compute">
  <meta name="twitter:description" content="The story behind Regen Network and Regenerative Compute — ecological accountability for AI.">
  <meta name="twitter:image" content="${baseUrl}/og-image.jpg">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .about-hero {
      padding: 64px 0 48px;
      text-align: center;
      border-bottom: 1px solid var(--regen-gray-200);
    }
    .about-hero h1 {
      font-size: 36px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 12px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .about-hero h1 span {
      background: linear-gradient(180deg, #4fb573, #b9e1c7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .about-hero .subtitle {
      font-size: 17px; color: var(--regen-gray-500);
      max-width: 600px; margin: 0 auto;
    }

    .about-body { padding: 48px 0 0; }
    .about-body h2 {
      font-size: 22px; font-weight: 800; color: var(--regen-navy);
      margin: 40px 0 12px; letter-spacing: -0.01em;
    }
    .about-body h2:first-child { margin-top: 0; }
    .about-body h3 {
      font-size: 16px; font-weight: 700; color: var(--regen-gray-700);
      margin: 24px 0 8px;
    }
    .about-body p {
      font-size: 15px; color: var(--regen-gray-700); line-height: 1.7;
      margin: 10px 0;
    }
    .about-body ul {
      font-size: 15px; color: var(--regen-gray-700); line-height: 1.7;
      margin: 8px 0 8px 24px;
    }
    .about-body li { margin-bottom: 6px; }
    .about-body a { color: var(--regen-green); font-weight: 500; }
    .about-body a:hover { text-decoration: underline; }

    .about-callout {
      background: var(--regen-green-bg);
      border-left: 4px solid var(--regen-green);
      border-radius: 0 8px 8px 0;
      padding: 16px 20px; margin: 20px 0;
      font-size: 15px; color: var(--regen-gray-700);
    }
    .about-callout strong { color: var(--regen-navy); }

    .involve-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px; margin: 20px 0;
    }
    .involve-card {
      background: var(--regen-white);
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius);
      padding: 24px; text-align: left;
      transition: box-shadow 0.3s ease;
    }
    .involve-card:hover { box-shadow: var(--regen-shadow-card-hover); }
    .involve-card h3 {
      margin: 0 0 8px; font-size: 16px; color: var(--regen-green);
    }
    .involve-card p {
      font-size: 14px; color: var(--regen-gray-700); line-height: 1.6;
      margin: 0 0 12px;
    }
    .involve-card a.involve-link {
      font-size: 13px; font-weight: 600;
    }

    .about-cta {
      text-align: center; margin: 48px 0 0;
      padding: 32px 24px;
      background: var(--regen-green-bg);
      border: 1px solid var(--regen-green-light);
      border-radius: var(--regen-radius-lg);
    }
    .about-cta p {
      color: var(--regen-gray-700); margin: 0 0 16px; font-size: 16px;
    }
    .about-cta .btn-row {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .about-hero h1 { font-size: 26px; }
      .about-hero .subtitle { font-size: 15px; }
      .involve-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({
    nav: [
      { label: "AI Plugin", href: "/ai-plugin" },
      { label: "Research", href: "/research" },
      { label: "About", href: "/about" },
      { label: "Dashboard", href: "/dashboard/login" },
    ],
  })}

  <section class="about-hero">
    <div class="regen-container">
      <h1>Aligning AI with <span>Ecological Regeneration</span></h1>
      <p class="subtitle">The story behind Regen Network and how Regenerative Compute connects your AI usage to real ecological impact.</p>
    </div>
  </section>

  <section class="about-body">
    <div class="regen-container">

      <h2>What is Regen Network?</h2>
      <p>
        <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a> is a blockchain-based
        ecological ledger that enables the verification, trading, and retirement of ecological credits.
        Founded to align economic systems with ecological regeneration, Regen Network provides the infrastructure
        for a transparent, on-chain marketplace where ecological outcomes &mdash; from carbon sequestration to
        biodiversity stewardship &mdash; can be measured, verified, and valued.
      </p>
      <p>
        The network supports multiple credit types including carbon, biodiversity, marine ecosystem, and species
        stewardship credits. Every retirement is permanently recorded on a public ledger, creating an immutable
        record of ecological contribution.
      </p>

      <h2>How Regenerative Compute Fits In</h2>
      <p>
        Regenerative Compute connects AI compute usage to verified credit retirement on
        <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a>.
        When you subscribe, your monthly contribution funds real ecological projects &mdash; verified on-chain,
        with retirement certificates you can share and verify independently.
      </p>
      <div class="about-callout">
        <strong>Regenerative contribution, not carbon offset.</strong> We don&rsquo;t claim to make your AI usage
        &ldquo;carbon neutral.&rdquo; Instead, we fund verified ecological regeneration alongside your AI usage &mdash;
        covering carbon, biodiversity, marine, and species stewardship credits &mdash; because the real impacts of
        AI go well beyond CO&#x2082;.
      </div>
      <p>
        Your subscription funds real ecological projects verified on-chain. Every dollar is transparently allocated:
        85% goes directly to ecological credit purchases, 5% to REGEN token burn (supporting the network), and 10%
        to operations. Retirement certificates are publicly verifiable on the Regen ledger.
      </p>

      <h2>How to Get Involved</h2>
      <div class="involve-grid">
        <div class="involve-card">
          <h3>Subscribe</h3>
          <p>Fund ecological regeneration through your AI usage. Plans start at $2.50/month.</p>
          <a class="involve-link" href="/#pricing">View plans &rarr;</a>
        </div>
        <div class="involve-card">
          <h3>Build</h3>
          <p>Developers can build on top of regen-compute &mdash; it&rsquo;s an open MCP server with a REST API.</p>
          <a class="involve-link" href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">GitHub &rarr;</a>
        </div>
        <div class="involve-card">
          <h3>List Credits</h3>
          <p>Have an ecological project? List your credits on Regen Marketplace and reach mission-aligned buyers.</p>
          <a class="involve-link" href="https://app.regen.network" target="_blank" rel="noopener">Regen Marketplace &rarr;</a>
        </div>
        <div class="involve-card">
          <h3>Partner</h3>
          <p>Organizations can subscribe company-wide to account for their team&rsquo;s AI compute footprint.</p>
          <a class="involve-link" href="/#pricing">Explore plans &rarr;</a>
        </div>
        <div class="involve-card">
          <h3>Community</h3>
          <p>Join the conversation &mdash; connect with others building at the intersection of ecology and technology.</p>
          <a class="involve-link" href="https://discord.gg/regen-network" target="_blank" rel="noopener">Discord</a>
          &nbsp;&middot;&nbsp;
          <a class="involve-link" href="https://twitter.com/raboratory" target="_blank" rel="noopener">Twitter / X</a>
        </div>
      </div>

      <h2>Open Source</h2>
      <p>
        Regenerative Compute is fully open source. The MCP server, landing page, API, and all tooling live in a
        single repository. Contributions are welcome &mdash; whether it&rsquo;s improving footprint estimation,
        adding new credit types, or building integrations.
      </p>
      <p>
        <a href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">View the source on GitHub &rarr;</a>
      </p>

      <div class="about-cta">
        <p>Ready to align your AI usage with ecological regeneration?</p>
        <div class="btn-row">
          <a class="regen-btn regen-btn--dark" href="/#pricing">Choose Your Plan</a>
          <a class="regen-btn regen-btn--outline" href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">View on GitHub</a>
        </div>
      </div>

    </div>
  </section>

  ${brandFooter({ links: [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research" },
    { label: "About", href: "/about" },
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ], showInstall: true })}

  ${betaBannerJS()}
</body>
</html>`);
  });

  return router;
}
