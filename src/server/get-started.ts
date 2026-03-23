/**
 * GET  /get-started         — Public value prop generator for businesses
 * POST /get-started/generate — Generate a custom value prop via Claude
 */

import { Router, Request, Response } from "express";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { generateText, isClaudeConfigured } from "../services/claude.js";

// ---------------------------------------------------------------------------
// Value prop generation
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a sustainability and AI ethics advisor helping businesses understand why Regenerative Compute is a perfect fit for their organization.

Regenerative Compute connects AI usage to verified ecological credit retirements on Regen Network — a public blockchain built for ecological accounting. Companies subscribe monthly and every dollar funds real ecological regeneration (carbon, biodiversity, marine, species stewardship credits), verified by independent scientists and recorded permanently on-chain.

Write a compelling, tailored value proposition (250-350 words) for the specific business, explaining:
1. How their AI usage connects to ecological impact
2. Why regenerative contribution fits their brand, values, or sustainability goals
3. The tangible proof they get (on-chain certificates, shareable badges)
4. A clear, warm call to action

Tone: inspiring but grounded, not greenwashy. Specific to their industry and context.
Format: flowing paragraphs, no bullet lists or headers. Conversational and genuine.`;

async function generateValueProp(company: string, industry: string, aiTools: string, teamSize: string, goals: string): Promise<string> {
  return generateText(SYSTEM_PROMPT, `
Generate a value proposition for:
- Company: ${company}
- Industry: ${industry}
- AI tools they use: ${aiTools || "general AI tools"}
- Team size: ${teamSize || "not specified"}
- Sustainability goals: ${goals || "not specified"}
  `.trim());
}

// ---------------------------------------------------------------------------
// Page HTML
// ---------------------------------------------------------------------------

function pageHTML(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Get Started — Regenerative Compute</title>
  <meta name="description" content="See how Regenerative Compute fits your business. Get a custom value proposition in seconds.">
  <meta property="og:title" content="Get Started with Regenerative Compute">
  <meta property="og:description" content="Find out exactly how Regenerative Compute fits your business, your team, and your sustainability goals.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/get-started">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenCompute">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .hero {
      padding: 72px 0 56px; text-align: center;
      border-bottom: 1px solid var(--regen-gray-200);
    }
    .hero h1 {
      font-size: 40px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px; line-height: 1.1; letter-spacing: -0.02em;
    }
    .hero h1 span {
      background: linear-gradient(180deg, #4fb573, #b9e1c7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero .subtitle {
      font-size: 18px; color: var(--regen-gray-500);
      max-width: 560px; margin: 0 auto; line-height: 1.65;
    }

    .main { padding: 56px 0; }

    .form-card {
      background: var(--regen-white);
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      padding: 40px; max-width: 640px; margin: 0 auto;
    }
    .form-card h2 {
      font-size: 20px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 6px;
    }
    .form-card .form-lead {
      font-size: 14px; color: var(--regen-gray-500); margin: 0 0 28px; line-height: 1.6;
    }

    .field { margin-bottom: 18px; }
    .field label {
      display: block; font-size: 13px; font-weight: 600; color: var(--regen-navy);
      margin-bottom: 6px;
    }
    .field label .opt { font-weight: 400; color: var(--regen-gray-400); }
    .field input, .field select, .field textarea {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid var(--regen-gray-200); border-radius: 8px;
      padding: 11px 14px; font-size: 14px; color: var(--regen-navy);
      background: var(--regen-white); outline: none; font-family: inherit;
      transition: border-color 0.15s;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color: var(--regen-green);
    }
    .field textarea { resize: vertical; min-height: 80px; }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    .submit-btn {
      width: 100%; padding: 14px; border: none; border-radius: 8px;
      background: linear-gradient(135deg, #1a5c3a, #0d7a5f);
      color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
      font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: opacity 0.15s;
    }
    .submit-btn:hover { opacity: 0.92; }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      display: none; animation: spin 0.7s linear infinite;
    }
    .spinner.visible { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Result card */
    .result-card {
      max-width: 640px; margin: 32px auto 0;
      background: linear-gradient(135deg, #0a2e1f 0%, #0d4a38 100%);
      border-radius: var(--regen-radius-lg); padding: 40px;
      display: none;
    }
    .result-card.visible { display: block; }
    .result-card .result-label {
      font-size: 11px; font-weight: 700; color: #4fb573;
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px;
    }
    .result-card .result-company {
      font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 20px;
    }
    .result-card .result-text {
      font-size: 15px; color: rgba(255,255,255,0.85); line-height: 1.8;
      margin-bottom: 28px; white-space: pre-wrap;
    }
    .result-actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .result-btn {
      padding: 10px 20px; border-radius: 7px; font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit; text-decoration: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .result-btn--primary { background: #4fb573; color: #fff; border: none; }
    .result-btn--primary:hover { background: #3da862; }
    .result-btn--ghost { background: transparent; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.25); }
    .result-btn--ghost:hover { background: rgba(255,255,255,0.08); }

    /* How it works strip */
    .how-strip {
      padding: 56px 0; border-top: 1px solid var(--regen-gray-200);
    }
    .how-strip h2 {
      font-size: 22px; font-weight: 800; color: var(--regen-navy);
      text-align: center; margin: 0 0 36px;
    }
    .how-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px; max-width: 800px; margin: 0 auto;
    }
    .how-card {
      text-align: center; padding: 24px 16px;
    }
    .how-card .step {
      width: 36px; height: 36px; background: var(--regen-green-bg);
      border: 2px solid var(--regen-green-light); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; color: var(--regen-green);
      margin: 0 auto 14px;
    }
    .how-card h3 { font-size: 14px; font-weight: 700; color: var(--regen-navy); margin: 0 0 6px; }
    .how-card p  { font-size: 13px; color: var(--regen-gray-500); line-height: 1.6; margin: 0; }

    @media (max-width: 640px) {
      .hero { padding: 48px 0 40px; }
      .hero h1 { font-size: 28px; }
      .form-card { padding: 28px 20px; }
      .field-row { grid-template-columns: 1fr; }
      .result-card { padding: 28px 20px; }
    }
  </style>
</head>
<body>
  ${betaBannerHTML()}

  ${brandHeader({
    nav: [
      { label: "Badges", href: "/badges" },
      { label: "AI Plugin", href: "/ai-plugin" },
      { label: "About", href: "/about" },
      { label: "Dashboard", href: "/dashboard/login" },
    ],
  })}

  <section class="hero">
    <div class="regen-container">
      <h1>Find Out How <span>Regen Compute</span><br>Fits Your Business</h1>
      <p class="subtitle">
        Tell us about your company and how you use AI.
        We&rsquo;ll generate a custom value proposition in seconds.
      </p>
    </div>
  </section>

  <section class="main">
    <div class="regen-container">

      <div class="form-card">
        <h2>About Your Business</h2>
        <p class="form-lead">Takes about 60 seconds. No account needed.</p>

        <form id="gs-form">
          <div class="field">
            <label>Company Name *</label>
            <input type="text" name="company" required placeholder="e.g. Acme AI">
          </div>

          <div class="field-row">
            <div class="field">
              <label>Industry *</label>
              <select name="industry" required>
                <option value="">Select...</option>
                <option>Software / SaaS</option>
                <option>Developer Tools</option>
                <option>Fintech</option>
                <option>Healthcare / Biotech</option>
                <option>E-commerce / Retail</option>
                <option>Media / Publishing</option>
                <option>Marketing / Advertising</option>
                <option>Legal / Compliance</option>
                <option>Education / EdTech</option>
                <option>Logistics / Supply Chain</option>
                <option>Energy / CleanTech</option>
                <option>Consulting / Professional Services</option>
                <option>Government / Non-profit</option>
                <option>Other</option>
              </select>
            </div>
            <div class="field">
              <label>Team Size <span class="opt">(optional)</span></label>
              <select name="team_size">
                <option value="">Select...</option>
                <option>1–10</option>
                <option>11–50</option>
                <option>51–200</option>
                <option>201–1000</option>
                <option>1000+</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>AI Tools You Use *</label>
            <input type="text" name="ai_tools" required placeholder="e.g. Claude, ChatGPT, GitHub Copilot, Cursor">
          </div>

          <div class="field">
            <label>Sustainability Goals <span class="opt">(optional)</span></label>
            <textarea name="goals" placeholder="e.g. We have a net-zero target by 2030, we report ESG metrics, we want to differentiate on sustainability..."></textarea>
          </div>

          <button type="submit" class="submit-btn" id="submit-btn">
            <div class="spinner" id="spinner"></div>
            <span id="btn-label">Generate My Value Proposition</span>
          </button>
        </form>
      </div>

      <div class="result-card" id="result-card">
        <div class="result-label">Your Custom Value Proposition</div>
        <div class="result-company" id="result-company"></div>
        <div class="result-text" id="result-text"></div>
        <div class="result-actions">
          <a class="result-btn result-btn--primary" href="/#pricing">Subscribe Now</a>
          <button class="result-btn result-btn--ghost" onclick="copyValueProp()">Copy Text</button>
          <button class="result-btn result-btn--ghost" onclick="document.getElementById('gs-form').reset();document.getElementById('result-card').classList.remove('visible');window.scrollTo({top:0,behavior:'smooth'})">Start Over</button>
        </div>
      </div>

    </div>
  </section>

  <section class="how-strip">
    <div class="regen-container">
      <h2>How It Works</h2>
      <div class="how-grid">
        <div class="how-card">
          <div class="step">1</div>
          <h3>Subscribe</h3>
          <p>Choose a monthly plan that matches your team size and AI usage.</p>
        </div>
        <div class="how-card">
          <div class="step">2</div>
          <h3>Use AI Normally</h3>
          <p>No changes to your workflow. The MCP server runs quietly in the background.</p>
        </div>
        <div class="how-card">
          <div class="step">3</div>
          <h3>Credits Retire Monthly</h3>
          <p>Each month, verified ecological credits are retired on-chain on your behalf.</p>
        </div>
        <div class="how-card">
          <div class="step">4</div>
          <h3>Show Your Impact</h3>
          <p>Share your certificate and badge. Permanent, verifiable, and yours.</p>
        </div>
      </div>
    </div>
  </section>

  ${brandFooter({ links: [
    { label: "Home", href: "/" },
    { label: "Get Started", href: "/get-started" },
    { label: "Badges", href: "/badges" },
    { label: "About", href: "/about" },
    { label: "Regen Network", href: "https://regen.network" },
  ], showInstall: true })}

  ${betaBannerJS()}
  <script>
    document.getElementById('gs-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const btn = document.getElementById('submit-btn');
      const spinner = document.getElementById('spinner');
      const label = document.getElementById('btn-label');

      btn.disabled = true;
      spinner.classList.add('visible');
      label.textContent = 'Generating...';

      try {
        const res = await fetch('/get-started/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(data)),
        });
        const json = await res.json();
        if (json.value_prop) {
          document.getElementById('result-company').textContent = data.get('company');
          document.getElementById('result-text').textContent = json.value_prop;
          const card = document.getElementById('result-card');
          card.classList.add('visible');
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          alert(json.error ?? 'Something went wrong. Please try again.');
        }
      } catch (err) {
        alert('Something went wrong. Please try again.');
      } finally {
        btn.disabled = false;
        spinner.classList.remove('visible');
        label.textContent = 'Generate My Value Proposition';
      }
    });

    function copyValueProp() {
      const text = document.getElementById('result-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Text'; }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createGetStartedRoutes(baseUrl: string): Router {
  const router = Router();

  router.get("/get-started", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(pageHTML(baseUrl));
  });

  router.post("/get-started/generate", async (req: Request, res: Response) => {
    if (!isClaudeConfigured()) {
      return res.status(503).json({ error: "Value prop generation is not available right now. Please try again later." });
    }

    const { company, industry, ai_tools, team_size, goals } = req.body ?? {};
    if (!company || !industry || !ai_tools) {
      return res.status(400).json({ error: "company, industry, and ai_tools are required" });
    }

    try {
      const value_prop = await generateValueProp(company, industry, ai_tools, team_size ?? "", goals ?? "");
      res.json({ value_prop });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
