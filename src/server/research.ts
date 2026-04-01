/**
 * GET /research — AI emissions research page.
 *
 * A citation-backed overview of AI's ecological footprint:
 * per-query energy estimates, CO2 conversion, usage profiles,
 * water/hardware impacts, and implications for regenerative contribution.
 */

import { Router, Request, Response } from "express";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";

export function createResearchRoutes(baseUrl: string): Router {
  const router = Router();

  router.get("/research", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Emissions Research — Regen Compute</title>
  <meta name="description" content="A transparent, citation-backed look at the ecological footprint of AI usage — energy per query, CO2 estimates, water, hardware lifecycle, and why regenerative contribution matters.">
  <meta property="og:title" content="AI Emissions Research — Regen Compute">
  <meta property="og:description" content="How much energy does one person's AI usage consume? A transparent review with citations.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}/research">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenChristian">
  <meta name="twitter:title" content="AI Emissions Research — Regen Compute">
  <meta name="twitter:description" content="How much energy does one person's AI usage consume? A transparent review with citations.">
  <meta name="twitter:image" content="${baseUrl}/og-card.jpg">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .research-hero {
      position: relative;
      padding: 120px 0 80px;
      text-align: center;
      border-bottom: 1px solid var(--color-border);
      overflow: hidden;
      min-height: 360px;
      display: flex; align-items: center; justify-content: center;
    }
    .research-hero__bg {
      position: absolute; inset: 0;
      background: url('/images/research-hero.webp') center / cover no-repeat;
      filter: brightness(0.25) saturate(0.7);
    }
    .research-hero__fade {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(5,6,10,0.5), rgba(5,6,10,0.3) 50%, var(--color-void));
    }
    .research-hero .regen-container { position: relative; z-index: 2; }
    .research-hero h1 {
      font-family: var(--font-display); font-size: 36px; font-weight: 800;
      color: var(--color-cream);
      margin: 0 0 12px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .research-hero h1 span {
      background: linear-gradient(180deg, var(--color-emerald-bright), var(--color-emerald));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .research-hero .subtitle {
      font-family: var(--font-body); font-size: 17px; color: var(--color-cream-soft);
      max-width: 600px; margin: 0 auto;
    }
    .research-meta {
      font-family: var(--font-ui);
      font-size: 12px; color: var(--color-muted);
      margin-top: 16px; letter-spacing: 0.02em;
    }

    .research-body { padding: 48px 0 0; }
    .research-body h2 {
      font-family: var(--font-display); font-size: 22px; font-weight: 800;
      color: var(--color-cream);
      margin: 40px 0 12px; letter-spacing: -0.01em;
    }
    .research-body h2:first-child { margin-top: 0; }
    .research-body h3 {
      font-family: var(--font-display); font-size: 16px; font-weight: 700;
      color: var(--color-cream-soft);
      margin: 24px 0 8px;
    }
    .research-body p {
      font-family: var(--font-body); font-size: 15px; color: var(--color-cream-soft);
      line-height: 1.7; margin: 10px 0;
    }
    .research-body ul, .research-body ol {
      font-family: var(--font-body); font-size: 15px; color: var(--color-cream-soft);
      line-height: 1.7; margin: 8px 0 8px 24px;
    }
    .research-body li { margin-bottom: 6px; }
    .research-body a { color: var(--color-emerald-bright); font-weight: 500; }
    .research-body a:hover { text-decoration: underline; }

    .research-formula {
      font-family: var(--font-mono);
      font-size: 14px; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: 10px;
      padding: 14px 16px; overflow-x: auto; color: var(--color-cream);
      margin: 14px 0;
    }

    .research-callout {
      background: rgba(43, 153, 79, 0.08);
      border-left: 4px solid var(--color-emerald);
      border-radius: 0 8px 8px 0;
      padding: 16px 20px; margin: 20px 0;
      font-size: 15px; color: var(--color-cream-soft);
    }
    .research-callout strong { color: var(--color-cream); }

    .profiles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px; margin: 20px 0;
    }
    .profile-card {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--regen-radius);
      padding: 20px; text-align: left;
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }
    .profile-card:hover {
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      border-color: rgba(240,236,226,0.12);
    }
    .profile-card h3 {
      font-family: var(--font-display);
      margin: 0 0 4px; font-size: 15px; color: var(--color-emerald-bright);
    }
    .profile-card .usage {
      font-family: var(--font-ui);
      font-size: 12px; color: var(--color-muted); margin: 0 0 10px;
    }
    .profile-card ul { margin: 0 0 0 16px; font-size: 13px; color: var(--color-cream-soft); }
    .profile-card li { margin-bottom: 2px; }

    .ref-list { counter-reset: refs; list-style: none; margin: 0; padding: 0; }
    .ref-list li {
      counter-increment: refs; margin-bottom: 8px; padding-left: 32px;
      position: relative; font-size: 14px; line-height: 1.5;
      color: var(--color-cream-soft);
    }
    .ref-list li::before {
      content: counter(refs) "."; position: absolute; left: 0;
      font-weight: 700; color: var(--color-emerald);
    }

    .research-cta {
      text-align: center; margin: 48px 0 0;
      padding: 32px 24px;
      background: rgba(43, 153, 79, 0.06);
      border: 1px solid rgba(43, 153, 79, 0.15);
      border-radius: var(--regen-radius-lg);
    }
    .research-cta p {
      color: var(--color-cream-soft); margin: 0 0 16px; font-size: 16px;
    }

    @media (max-width: 640px) {
      .research-hero h1 { font-size: 26px; }
      .research-hero .subtitle { font-size: 15px; }
      .profiles-grid { grid-template-columns: 1fr; }
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

  <section class="research-hero">
    <div class="research-hero__bg"></div>
    <div class="research-hero__fade"></div>
    <div class="regen-container">
      <h1>The Ecological Footprint of <span>"One Person Using AI"</span></h1>
      <p class="subtitle">A transparent, citation-backed look at what AI compute actually costs the planet &mdash; and why regenerative contribution matters.</p>
      <p class="research-meta">March 2026 &middot; Best-effort synthesis with transparent uncertainty</p>
    </div>
  </section>

  <section class="research-body">
    <div class="regen-container">

      <h2>Abstract</h2>
      <p>
        &ldquo;How much CO&#x2082; does <em>one person</em> emit from using AI?&rdquo; The honest answer is: it varies wildly.
        Per-interaction impacts depend on model choice, response length, and especially <strong>context length</strong> (big pasted docs, repo-scale code context),
        plus data-center efficiency and grid carbon intensity.
      </p>
      <p>
        Using widely cited estimates, a typical frontier-chatbot text query is plausibly in the range <strong>0.3&ndash;2.9 Wh</strong>,
        with long-context events reaching <strong>~2.5 Wh (10k input tokens)</strong> and <strong>~40 Wh (100k input tokens)</strong>
        (<a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener">Epoch AI</a>;
        <a href="https://spectrum.ieee.org/ai-energy-use" target="_blank" rel="noopener">IEEE Spectrum</a>).
        Using a global-average grid intensity of about <strong>445 g CO&#x2082;/kWh (2024)</strong>
        (<a href="https://www.iea.org/reports/electricity-mid-year-update-2025/emissions-power-generation-co2-emissions-are-plateauing" target="_blank" rel="noopener">IEA</a>),
        that&rsquo;s roughly <strong>0.13&ndash;1.29 g CO&#x2082; per typical query</strong>, with long-context outliers far higher.
      </p>
      <p>
        Beyond CO&#x2082;, AI has material ecological impacts via <strong>water use</strong> (cooling and electricity generation) and <strong>hardware lifecycle</strong>
        (mining, manufacturing, e&#x2011;waste). These matter because some impacts are place-based and not captured by carbon arithmetic alone
        (<a href="https://arxiv.org/pdf/2304.03271" target="_blank" rel="noopener">Li et al., 2023</a>).
      </p>

      <h2>1. What We&rsquo;re Measuring</h2>
      <ul>
        <li><strong>Inference energy</strong> &mdash; GPUs/TPUs generating tokens.</li>
        <li><strong>Data center overhead</strong> &mdash; Cooling, power delivery, networking (summarized by <strong>PUE</strong>). Industry averages sit around ~1.56
          (<a href="https://www.upsite.com/blog/why-pue-remains-flat-and-what-should-be-done-about-it/" target="_blank" rel="noopener">Upsite / Uptime Institute</a>).</li>
        <li><strong>Grid emissions</strong> &mdash; Emissions depend on electricity carbon intensity (varies by region and time of day).</li>
        <li><strong>Non-CO&#x2082; impacts</strong> &mdash; Water footprint, embodied emissions of hardware, local environmental stressors.</li>
      </ul>

      <h2>2. Per-Query Energy Estimates</h2>

      <h3>Anchor A: ~0.3 Wh per typical query</h3>
      <p>
        Epoch AI (Feb 2025) estimates ~<strong>0.3 Wh</strong> for a &ldquo;typical&rdquo; GPT&#x2011;4o text query using updated assumptions about utilization and token counts,
        and highlights that long input contexts can dominate: ~<strong>2.5 Wh (10k)</strong> to ~<strong>40 Wh (100k)</strong>
        (<a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener">Epoch AI</a>).
      </p>

      <h3>Anchor B: ~2.9 Wh per query</h3>
      <p>
        IEEE Spectrum reports an analysis implying ~<strong>2.9 Wh</strong> per query and discusses sector-scale growth in demand
        (<a href="https://spectrum.ieee.org/ai-energy-use" target="_blank" rel="noopener">IEEE Spectrum</a>).
      </p>

      <div class="research-callout">
        <strong>Working range:</strong> Treat <strong>0.3&ndash;2.9 Wh/query</strong> as &ldquo;typical text query&rdquo; uncertainty, and treat long-context events
        (especially repeated) as the main driver for heavy/pro workflows. Standardization initiatives exist because published audited numbers are scarce
        (<a href="https://huggingface.github.io/AIEnergyScore/" target="_blank" rel="noopener">AI Energy Score</a>).
      </div>

      <h2>3. Converting Energy to CO&#x2082;</h2>
      <div class="research-formula">CO&#x2082; per query (g) = Energy per query (kWh) &times; Grid intensity (g CO&#x2082;/kWh)</div>
      <p>
        Using <strong>445 g CO&#x2082;/kWh</strong> as a global-average reference for 2024
        (<a href="https://www.iea.org/reports/electricity-mid-year-update-2025/emissions-power-generation-co2-emissions-are-plateauing" target="_blank" rel="noopener">IEA</a>):
      </p>
      <ul>
        <li>0.3 Wh = 0.0003 kWh &rarr; <strong>0.13 g CO&#x2082;</strong> per query</li>
        <li>2.9 Wh = 0.0029 kWh &rarr; <strong>1.29 g CO&#x2082;</strong> per query</li>
        <li>10k-token long-context event: 2.5 Wh &rarr; <strong>~1.11 g CO&#x2082;</strong></li>
        <li>100k-token long-context event: 40 Wh &rarr; <strong>~17.8 g CO&#x2082;</strong></li>
      </ul>
      <p>
        For country-specific factors, the IEA provides emissions-factor datasets
        (<a href="https://www.iea.org/data-and-statistics/data-product/emissions-factors-2025" target="_blank" rel="noopener">IEA Emissions Factors</a>).
      </p>

      <h2>4. Personal Usage Profiles (Annualized)</h2>
      <div class="profiles-grid">
        <div class="profile-card">
          <h3>Casual Chat User</h3>
          <p class="usage">10&ndash;30 prompts/day</p>
          <ul>
            <li>Efficient: <strong>~0.5&ndash;1.5 kg CO&#x2082;/yr</strong></li>
            <li>Pessimistic: <strong>~4.7&ndash;14.1 kg CO&#x2082;/yr</strong></li>
          </ul>
        </div>
        <div class="profile-card">
          <h3>Power User</h3>
          <p class="usage">50&ndash;200 prompts/day</p>
          <ul>
            <li>Efficient: <strong>~2.4&ndash;9.7 kg CO&#x2082;/yr</strong></li>
            <li>Pessimistic: <strong>~23.5&ndash;94 kg CO&#x2082;/yr</strong></li>
          </ul>
        </div>
        <div class="profile-card">
          <h3>Developer (Agentic)</h3>
          <p class="usage">0.3&ndash;3 kWh/day inference</p>
          <ul>
            <li><strong>~32&ndash;335 kg CO&#x2082;/yr</strong></li>
            <li>(250 workdays, 445 g/kWh)</li>
          </ul>
        </div>
      </div>

      <h2>5. Ecological Impacts Beyond CO&#x2082;</h2>

      <h3>Water</h3>
      <p>
        Water impacts arise from direct cooling and electricity generation.
        Academic work argues AI&rsquo;s water footprint is underreported
        (<a href="https://arxiv.org/pdf/2304.03271" target="_blank" rel="noopener">Li et al., 2023</a>).
        More recent scenario modeling examines global water consumption in AI-driven data centers
        (<a href="https://www.sciencedirect.com/science/article/pii/S0959652625018785" target="_blank" rel="noopener">Journal of Cleaner Production, 2025</a>).
      </p>

      <h3>Hardware Lifecycle</h3>
      <p>
        Operational energy is only part of the picture: accelerators carry embodied emissions and upstream ecological impacts.
        A 2025 cradle-to-grave assessment examines AI accelerator lifecycle emissions
        (<a href="https://arxiv.org/html/2502.01671v1" target="_blank" rel="noopener">arXiv:2502.01671</a>),
        and broader lifecycle reviews emphasize supply-chain and end-of-life burdens
        (<a href="https://www.sciencedirect.com/science/article/pii/S2212827125003749" target="_blank" rel="noopener">LCA review, 2025</a>).
      </p>

      <h2>6. Implications for Regenerative Contribution</h2>
      <ul>
        <li><strong>Publish ranges, not single-point numbers</strong> &mdash; show the knobs (grid, context, model class).</li>
        <li><strong>Prioritize outcomes beyond carbon</strong> &mdash; biodiversity, watershed resilience, marine ecosystems &mdash; because key impacts are place-based and non-CO&#x2082;.</li>
        <li><strong>Encourage measurement where possible</strong> &mdash; for local compute, tooling like <a href="https://docs.codecarbon.io/" target="_blank" rel="noopener">CodeCarbon</a> helps build measurement norms.</li>
      </ul>
      <p>
        This is why Regen Compute frames its work as <strong>regenerative contribution</strong>, not carbon offsetting.
        We fund verified ecological regeneration alongside AI usage &mdash; covering carbon, biodiversity, marine, and species stewardship credits &mdash;
        because the real impacts of AI go well beyond CO&#x2082;.
      </p>

      <h2>Quick Calculator</h2>
      <div class="research-formula">CO&#x2082;/year (kg) = (queries/day &times; 365 &times; Wh/query / 1000) &times; (g CO&#x2082;/kWh / 1000)</div>
      <p>
        Where Wh/query = 0.3&ndash;2.9 (typical), g CO&#x2082;/kWh = 445 (global average) or a country-specific value.
      </p>
      <p>
        <strong>Example:</strong> 50 queries/day &times; 365 days &times; 0.3 Wh = 5,475 Wh = 5.475 kWh/yr &rarr; ~2.44 kg CO&#x2082;/yr at 445 g/kWh.
      </p>

      <h2>References</h2>
      <ol class="ref-list">
        <li><a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener">Epoch AI (2025): How much energy does ChatGPT use?</a></li>
        <li><a href="https://spectrum.ieee.org/ai-energy-use" target="_blank" rel="noopener">IEEE Spectrum (2025): AI energy use discussion (incl. ~2.9 Wh/query claim)</a></li>
        <li><a href="https://www.iea.org/reports/electricity-mid-year-update-2025/emissions-power-generation-co2-emissions-are-plateauing" target="_blank" rel="noopener">IEA: Electricity emissions / carbon intensity (~445 g CO&#x2082;/kWh, 2024)</a></li>
        <li><a href="https://www.iea.org/data-and-statistics/data-product/emissions-factors-2025" target="_blank" rel="noopener">IEA Emissions Factors (2025)</a></li>
        <li><a href="https://arxiv.org/pdf/2304.03271" target="_blank" rel="noopener">Li et al. (2023): Making AI Less &ldquo;Thirsty&rdquo; (water footprint)</a></li>
        <li><a href="https://www.sciencedirect.com/science/article/pii/S0959652625018785" target="_blank" rel="noopener">Journal of Cleaner Production (2025): Water consumption modeling for AI data centers</a></li>
        <li><a href="https://arxiv.org/html/2502.01671v1" target="_blank" rel="noopener">arXiv (2025): Cradle-to-grave lifecycle emissions of AI accelerators</a></li>
        <li><a href="https://www.sciencedirect.com/science/article/pii/S2212827125003749" target="_blank" rel="noopener">Life-cycle assessment review (2025): AI sustainability / LCA synthesis</a></li>
        <li><a href="https://huggingface.github.io/AIEnergyScore/" target="_blank" rel="noopener">AI Energy Score: Standardized efficiency measurement initiative</a></li>
        <li><a href="https://docs.codecarbon.io/" target="_blank" rel="noopener">CodeCarbon documentation</a></li>
        <li><a href="https://www.upsite.com/blog/why-pue-remains-flat-and-what-should-be-done-about-it/" target="_blank" rel="noopener">Upsite: Why PUE remains flat (Uptime Institute discussion)</a></li>
      </ol>

      <div class="research-cta">
        <p>Ready to account for your AI footprint?</p>
        <a class="regen-btn regen-btn--dark" href="/#pricing">Choose Your Plan</a>
      </div>

    </div>
  </section>

  ${brandFooter({ links: [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research" },
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ], showInstall: true })}

  ${betaBannerJS()}
</body>
</html>`);
  });

  return router;
}
