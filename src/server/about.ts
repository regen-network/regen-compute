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
  <meta name="description" content="Meet the people behind Regenerative Compute and Regen Network — ecologists, permaculturists, and technologists building ecological accountability for AI.">
  <meta property="og:title" content="About — Regenerative Compute">
  <meta property="og:description" content="Meet the people building ecological accountability for AI — from permaculture farms to the blockchain.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/about">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenChristian">
  <meta name="twitter:title" content="About — Regenerative Compute">
  <meta name="twitter:description" content="Meet the people building ecological accountability for AI — from permaculture farms to the blockchain.">
  <meta name="twitter:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .about-hero {
      padding: 72px 0 56px;
      text-align: center;
      border-bottom: 1px solid var(--regen-gray-200);
    }
    .about-hero h1 {
      font-size: 38px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .about-hero h1 span {
      background: linear-gradient(180deg, #4fb573, #b9e1c7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .about-hero .subtitle {
      font-size: 18px; color: var(--regen-gray-500);
      max-width: 640px; margin: 0 auto; line-height: 1.6;
    }

    .about-banner {
      width: 100%; max-height: 400px; object-fit: cover;
      border-radius: 0 0 12px 12px;
      margin-top: 24px;
    }
    .about-body { padding: 32px 0 0; }
    .about-body h2 {
      font-size: 24px; font-weight: 800; color: var(--regen-navy);
      margin: 56px 0 16px; letter-spacing: -0.01em;
    }
    .about-body h2:first-child { margin-top: 0; }
    .about-body p {
      font-size: 16px; color: var(--regen-gray-700); line-height: 1.75;
      margin: 12px 0;
    }
    .about-body p.lead {
      font-size: 18px; line-height: 1.7; color: var(--regen-gray-600);
    }
    .about-body a { color: var(--regen-green); font-weight: 500; }
    .about-body a:hover { text-decoration: underline; }

    .about-callout {
      background: var(--regen-green-bg);
      border-left: 4px solid var(--regen-green);
      border-radius: 0 8px 8px 0;
      padding: 20px 24px; margin: 24px 0;
      font-size: 15px; color: var(--regen-gray-700); line-height: 1.7;
    }
    .about-callout strong { color: var(--regen-navy); }

    /* People section */
    .people-grid {
      display: grid; grid-template-columns: 1fr; gap: 40px;
      margin: 32px 0 0;
    }
    .person {
      display: flex; gap: 28px; align-items: flex-start;
    }
    .person-photo {
      flex-shrink: 0; width: 96px; height: 96px;
      border-radius: 50%; overflow: hidden;
      background: linear-gradient(135deg, #1a5c3a 0%, #0d7a5f 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .person-photo img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .person-photo .initials {
      font-size: 32px; font-weight: 800; color: rgba(255,255,255,0.9);
      letter-spacing: -0.02em;
    }
    .person-info h3 {
      font-size: 18px; font-weight: 700; color: var(--regen-navy);
      margin: 0 0 2px;
    }
    .person-info .role {
      font-size: 13px; font-weight: 600; color: var(--regen-green);
      text-transform: uppercase; letter-spacing: 0.04em;
      margin: 0 0 10px;
    }
    .person-info p {
      font-size: 15px; color: var(--regen-gray-700); line-height: 1.7;
      margin: 0;
    }

    /* Milestone timeline */
    .timeline {
      position: relative; margin: 32px 0 0; padding-left: 28px;
      border-left: 2px solid var(--regen-green-light);
    }
    .timeline-item {
      position: relative; margin-bottom: 28px;
    }
    .timeline-item::before {
      content: ""; position: absolute; left: -34px; top: 6px;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--regen-green); border: 2px solid var(--regen-white);
    }
    .timeline-item .year {
      font-size: 13px; font-weight: 700; color: var(--regen-green);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .timeline-item p {
      font-size: 15px; color: var(--regen-gray-700); line-height: 1.6;
      margin: 4px 0 0;
    }

    /* Developer CTA */
    .dev-section {
      background: linear-gradient(135deg, #0a2e1f 0%, #0d4a38 50%, #0a3d2e 100%);
      border-radius: var(--regen-radius-lg);
      padding: 48px 40px; margin: 56px 0 0;
      color: #fff;
    }
    .dev-section h2 {
      color: #fff; margin-top: 0; font-size: 26px;
    }
    .dev-section p {
      color: rgba(255,255,255,0.85); font-size: 16px; line-height: 1.7;
    }
    .dev-section a { color: #4ade80; }
    .dev-section a:hover { color: #86efac; }
    .dev-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px; margin: 24px 0 0;
    }
    .dev-card {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      border-radius: var(--regen-radius); padding: 20px;
    }
    .dev-card h3 {
      font-size: 15px; font-weight: 700; color: #4ade80;
      margin: 0 0 8px;
    }
    .dev-card p {
      font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.6;
      margin: 0;
    }
    .dev-section .btn-row {
      display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap;
    }
    .dev-section .regen-btn--light {
      background: #fff; color: var(--regen-navy); font-weight: 700;
    }
    .dev-section .regen-btn--light:hover {
      background: #f0fdf4;
    }
    .dev-section .regen-btn--ghost {
      background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3);
    }
    .dev-section .regen-btn--ghost:hover {
      background: rgba(255,255,255,0.08);
    }

    .about-cta {
      text-align: center; margin: 56px 0 0;
      padding: 40px 24px;
      background: var(--regen-green-bg);
      border: 1px solid var(--regen-green-light);
      border-radius: var(--regen-radius-lg);
    }
    .about-cta h2 { margin-top: 0; font-size: 22px; }
    .about-cta p {
      color: var(--regen-gray-700); margin: 0 0 20px; font-size: 16px;
      max-width: 520px; margin-left: auto; margin-right: auto;
    }
    .about-cta .btn-row {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .about-hero { padding: 48px 0 40px; }
      .about-hero h1 { font-size: 28px; }
      .about-hero .subtitle { font-size: 16px; }
      .person { flex-direction: column; gap: 16px; }
      .dev-section { padding: 32px 24px; }
      .dev-grid { grid-template-columns: 1fr; }
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
      <h1>Built by People Who <span>Love This Planet</span></h1>
      <p class="subtitle">Regenerative Compute didn&rsquo;t start in a tech incubator. It started in the soil &mdash; with people who spent decades working alongside farmers, ecologists, and indigenous communities before ever writing a line of code.</p>
    </div>
    <img class="about-banner" src="/team/team-banner.jpg" alt="The Regen Network team at Racebrook retreat, September 2022" loading="lazy">
  </section>

  <section class="about-body">
    <div class="regen-container">

      <h2>The Origin Story</h2>
      <p class="lead">
        In the spring of 2017, three people asked a dangerous question: <em>What would it look like to put blockchain technology to work for planetary regeneration?</em>
      </p>
      <p>
        Gregory Landua, Christian Shearer, and Brecht Deriemaeker weren&rsquo;t crypto speculators. They were permaculturists, ecological designers, and systems thinkers who had spent years in the field &mdash; getting their hands dirty building food forests, restoring degraded land, and helping farming communities around the world develop regenerative practices. They understood something that most of the tech world didn&rsquo;t: the planet doesn&rsquo;t need better carbon accounting spreadsheets. It needs economic systems that actually reward people for healing ecosystems.
      </p>
      <p>
        That insight became <a href="https://regen.network" target="_blank" rel="noopener">Regen Network</a> &mdash; a public blockchain purpose-built for ecological accounting. Not just carbon. Biodiversity. Soil health. Watershed restoration. Marine ecosystems. Animal welfare. The full picture of what it means to regenerate a living planet.
      </p>

      <h2>The People</h2>
      <div class="people-grid">
        <div class="person">
          <div class="person-photo"><img src="/team/gregory.png" alt="Gregory Landua" loading="lazy"></div>
          <div class="person-info">
            <h3>Gregory Landua</h3>
            <div class="role">Co-Founder &amp; CEO, Regen Network</div>
            <p>
              Gregory co-authored <em>Regenerative Enterprise</em> in 2013, one of the foundational texts of the regenerative movement. He co-founded Terra Genesis International, a consultancy that helps global brands transform their supply chains into regenerative systems. He holds a master&rsquo;s in Regenerative Entrepreneurship and a Permaculture Design Certificate. Gregory isn&rsquo;t building Regen Network because blockchain is interesting &mdash; he&rsquo;s building it because he&rsquo;s spent his career trying to get capital to flow toward healing the planet, and this is the best tool he&rsquo;s found.
            </p>
          </div>
        </div>

        <div class="person">
          <div class="person-photo"><img src="/team/christian.png" alt="Christian Shearer" loading="lazy"></div>
          <div class="person-info">
            <h3>Christian Shearer</h3>
            <div class="role">Co-Founder, Regen Network &middot; Creator, Regenerative Compute</div>
            <p>
              At 24, Christian founded the <a href="https://www.panyaproject.org/" target="_blank" rel="noopener">Panya Project</a> in Chiang Mai, Thailand &mdash; now one of the most well-known permaculture education centers in Southeast Asia. Over 15 years, he worked alongside farmers across Thailand, Malaysia, India, Taiwan, Barbados, Ecuador, Nicaragua, and the Philippines. He co-founded Terra Genesis International with Gregory before co-founding Regen Network, where he served as CEO and later Chief Investment Officer. He built Regenerative Compute because he believes AI developers deserve a real, verifiable way to account for their ecological footprint &mdash; not greenwashing, but actual credits retired on a public ledger.
            </p>
          </div>
        </div>

        <div class="person">
          <div class="person-photo"><img src="/team/gisel.png" alt="Gisel Booman, Ph.D." loading="lazy"></div>
          <div class="person-info">
            <h3>Gisel Booman, Ph.D.</h3>
            <div class="role">Head of Science, Regen Network</div>
            <p>
              Gisel holds a PhD in Biological Sciences specializing in Landscape Ecology. Before joining Regen Network, she was an Assistant Professor of GIS at Universidad Nacional de Mar del Plata in Argentina and consulted for the Inter-American Development Bank on remote sensing and environmental assessment. For over seven years at Regen, she has led the science that makes ecological credits credible &mdash; designing the MRV (Measurement, Reporting, Verification) systems that bridge remote sensing data with on-the-ground ecological outcomes. She&rsquo;s the person who ensures that when we say &ldquo;verified ecological credit,&rdquo; we mean it. Her work connects methodology developers, land stewards, and project proponents into a system where ecological claims can be independently verified.
            </p>
          </div>
        </div>

        <div class="person">
          <div class="person-photo"><img src="/team/aaron.png" alt="Aaron Craelius" loading="lazy"></div>
          <div class="person-info">
            <h3>Aaron Craelius</h3>
            <div class="role">CTO, Regen Network</div>
            <p>
              Aaron is the engineer who made it all real. He built key contributions to the Cosmos SDK, including the Upgrade Module that enables live blockchain upgrades without downtime. Under his technical leadership, Regen Network became a <strong>lead maintainer of the Cosmos SDK</strong> &mdash; a recognition of deep technical trust from the entire Cosmos ecosystem. The Regen Ledger &mdash; the sovereign proof-of-stake blockchain that records every ecological credit retirement &mdash; is his architecture.
            </p>
          </div>
        </div>
      </div>

      <h2>What They Built</h2>
      <div class="timeline">
        <div class="timeline-item">
          <span class="year">2017</span>
          <p>Regen Network founded. Whitepaper written. Three co-founders take a European tour to build community around the idea of blockchain for planetary regeneration.</p>
        </div>
        <div class="timeline-item">
          <span class="year">2019</span>
          <p>Selected for the <strong>Techstars Sustainability Accelerator</strong> in partnership with <strong>The Nature Conservancy</strong>. Regen becomes an official Techstars company.</p>
        </div>
        <div class="timeline-item">
          <span class="year">2020</span>
          <p>Signed as <strong>lead maintainer of the Cosmos SDK</strong> by the Interchain Foundation. Sold <strong>124,000 carbon credits to Microsoft</strong> &mdash; one of the largest soil carbon credit issuances in Australia. Microsoft selected Regen as one of only 15 companies globally to source credits from.</p>
        </div>
        <div class="timeline-item">
          <span class="year">2021</span>
          <p><strong>Regen Ledger mainnet launch</strong> &mdash; a sovereign proof-of-stake blockchain purpose-built for ecological accounting. Regen Foundation begins operations, tasked with distributing 30% of REGEN tokens to smallholder farmers, indigenous peoples, and scientific researchers.</p>
        </div>
        <div class="timeline-item">
          <span class="year">2025</span>
          <p><strong>Regenerative Compute launches</strong> &mdash; bringing Regen Network&rsquo;s ecological infrastructure directly into AI developer workflows via MCP. Individual developers can now fund verified ecological regeneration as part of their daily work.</p>
        </div>
      </div>

      <h2>A Personal Note from Christian</h2>
      <p>
        Regenerative Compute is one of my first &ldquo;vibe coding&rdquo; projects &mdash; built largely in collaboration with AI tools, the very tools this project exists to serve. I say that not as a gimmick, but because it&rsquo;s actually the point.
      </p>
      <p>
        For years, building the ecological asset infrastructure at Regen Network was a slog. Important, necessary, deeply meaningful work &mdash; but slow. Building a blockchain, designing credit registries, negotiating with land stewards across continents, writing smart contracts, wiring up marketplace flows. Every step was hard-won. We were a small team trying to build public goods infrastructure that the world desperately needs, and the pace never felt fast enough for the urgency of the moment.
      </p>
      <p>
        Then these AI tools arrived. And suddenly, a single person with deep domain knowledge and a clear vision could build in weeks what used to take a team months. Regenerative Compute &mdash; the MCP server, the landing page, the subscription system, the on-chain retirement pipeline, the dashboard, the API, the email notifications &mdash; all of it was built by one person working with Claude Code. Not because I&rsquo;m a 10x engineer (I&rsquo;m not), but because the tools finally caught up to the ambition.
      </p>
      <p>
        That&rsquo;s what excites me most about where we are right now. The hard infrastructure is built. The ecological credits are real. The blockchain works. The verification is solid. And now, with AI as a creative partner, we can finally move at the speed the planet needs. We can build the bridges between this ecological infrastructure and the millions of developers who want to do the right thing but didn&rsquo;t have an easy way to do it.
      </p>
      <p>
        If you&rsquo;re a developer reading this and thinking <em>&ldquo;I could build something on top of this&rdquo;</em> &mdash; you absolutely can. And it&rsquo;ll go faster than you think.
      </p>

      <h2>Why This Matters for AI</h2>
      <p>
        AI is extraordinary. It&rsquo;s also hungry &mdash; for energy, for water, for rare earth minerals. Every prompt, every training run, every inference has an ecological cost. Most of the industry pretends this cost doesn&rsquo;t exist, or buries it in corporate sustainability reports nobody reads.
      </p>
      <p>
        We think there&rsquo;s a better way. Not guilt. Not greenwashing. Not vague promises about carbon neutrality by 2040. Instead: <strong>real ecological credits, retired permanently on a public blockchain, funded directly by the people who use AI every day.</strong>
      </p>
      <div class="about-callout">
        <strong>We call this regenerative contribution, not carbon offset.</strong> We don&rsquo;t claim to make your AI usage carbon neutral. We fund verified ecological regeneration alongside your AI usage &mdash; carbon, biodiversity, marine ecosystems, species stewardship &mdash; because the real impacts of AI go well beyond CO&#x2082;.
      </div>
      <p>
        Every dollar you contribute is transparently allocated: 85% goes directly to ecological credit purchases, 5% to REGEN token burn supporting the network, and 10% to operations. Every retirement is recorded on-chain. Every certificate is publicly verifiable. No trust required &mdash; just check the ledger.
      </p>

      <div class="dev-section">
        <h2>Calling All Developers</h2>
        <p>
          Regen Network is open infrastructure. The ecological credit system, the blockchain, the marketplace, the APIs &mdash; they&rsquo;re all public goods. And Regenerative Compute is fully open source. We need developers who care about this planet to help build what comes next.
        </p>
        <div class="dev-grid">
          <div class="dev-card">
            <h3>Contribute to regen-compute</h3>
            <p>TypeScript MCP server with Express API. Add credit types, improve footprint estimation, build integrations for new AI tools.</p>
          </div>
          <div class="dev-card">
            <h3>Build on Regen Ledger</h3>
            <p>CosmWasm smart contracts, Cosmos SDK modules, ecological state protocols. The chain is live and composable.</p>
          </div>
          <div class="dev-card">
            <h3>Create New Integrations</h3>
            <p>VS Code extensions, CI/CD plugins, API wrappers. Any tool that developers use can become a channel for ecological contribution.</p>
          </div>
          <div class="dev-card">
            <h3>Join the Community</h3>
            <p>Discord, governance proposals, working groups. This is a real community of people who believe technology should serve life.</p>
          </div>
        </div>
        <div class="btn-row">
          <a class="regen-btn regen-btn--light" href="https://github.com/regen-network/regen-compute" target="_blank" rel="noopener">View on GitHub</a>
          <a class="regen-btn regen-btn--ghost" href="https://discord.gg/regen-network" target="_blank" rel="noopener">Join Discord</a>
          <a class="regen-btn regen-btn--ghost" href="https://regen.network" target="_blank" rel="noopener">Explore Regen Network</a>
        </div>
      </div>

      <div class="about-cta">
        <h2>Start Your Regenerative Practice</h2>
        <p>You don&rsquo;t need to be a climate scientist. You just need to care. Subscribe, and every month your AI usage funds real ecological regeneration &mdash; verified, permanent, and yours to share.</p>
        <div class="btn-row">
          <a class="regen-btn regen-btn--dark" href="/#pricing">Choose Your Plan</a>
          <a class="regen-btn regen-btn--outline" href="/dashboard/login">View Your Dashboard</a>
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
