/**
 * GET /badges            — Badge & seal pack page
 * GET /badges/badge-dark.svg   — Compact badge, dark background
 * GET /badges/badge-light.svg  — Compact badge, light background
 * GET /badges/badge-green.svg  — Compact badge, green background
 * GET /badges/usage.svg?key=   — Dynamic usage badge (live credits retired)
 */

import { Router, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type Database from "better-sqlite3";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { betaBannerCSS, betaBannerHTML, betaBannerJS } from "./beta-banner.js";
import { getUserByApiKey, getSubscriberByUserId, getCumulativeAttribution } from "./db.js";

function loadIconBase64(): string {
  const iconPath = join(process.cwd(), "public", "badge-icon.png");
  if (!existsSync(iconPath)) return "";
  const data = readFileSync(iconPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

// Loaded once at startup — embedded directly into SVGs so they are self-contained
const ICON_DATA_URI = loadIconBase64();

// ---------------------------------------------------------------------------
// Static badge SVGs (compact horizontal, three themes)
// ---------------------------------------------------------------------------

function compactBadgeSVG(theme: "dark" | "light" | "green", iconUrl: string = ICON_DATA_URI): string {
  const themes = {
    dark: {
      leftBg: "#0a2e1f", rightBg: "#145433",
      labelColor: "rgba(255,255,255,0.88)", valueColor: "#a3f0c0",
      border: "",
    },
    light: {
      leftBg: "#f0faf4", rightBg: "#ffffff",
      labelColor: "#0a2e1f", valueColor: "#1a5c3a",
      border: "#c3e8d0",
    },
    green: {
      leftBg: "#1a6640", rightBg: "#4fb573",
      labelColor: "rgba(255,255,255,0.92)", valueColor: "#ffffff",
      border: "",
    },
  };
  const t = themes[theme];
  const borderAttr = t.border ? `stroke="${t.border}" stroke-width="1.5"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="32" viewBox="0 0 240 32" role="img" aria-label="Powered by Regenerative Compute">
  <defs>
    <clipPath id="clip-${theme}"><rect width="240" height="32" rx="5"/></clipPath>
  </defs>
  <g clip-path="url(#clip-${theme})">
    <rect width="240" height="32" fill="${t.leftBg}" rx="5"/>
    <rect x="133" width="107" height="32" fill="${t.rightBg}"/>
    ${t.border ? `<rect width="240" height="32" fill="none" rx="5" ${borderAttr}/>` : ""}
    <image href="${iconUrl}" x="4" y="4" width="24" height="24"/>
    <text x="34" y="20" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" font-weight="600" fill="${t.labelColor}" letter-spacing="0.01em">Regen Compute</text>
    <line x1="133" y1="6" x2="133" y2="26" stroke="${t.border || "rgba(255,255,255,0.2)"}" stroke-width="1"/>
    <text x="186" y="20" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" font-weight="700" fill="${t.valueColor}" text-anchor="middle" letter-spacing="0.01em">Regenerative AI</text>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Dynamic usage badge SVG
// ---------------------------------------------------------------------------

function usageBadgeSVG(opts: {
  credits: number;
  label: string;
  months: number;
  theme?: "dark" | "light" | "green";
  iconUrl?: string;
}): string {
  const { credits, label, months, iconUrl = ICON_DATA_URI } = opts;
  const theme = opts.theme ?? "dark";

  const themes = {
    dark:  { bg: "#0a2e1f", accent: "#4fb573", text: "#fff", sub: "rgba(255,255,255,0.6)" },
    light: { bg: "#f0faf4", accent: "#1a5c3a", text: "#0a2e1f", sub: "#4a7a5a" },
    green: { bg: "#1a6640", accent: "#a3f0c0", text: "#fff", sub: "rgba(255,255,255,0.7)" },
  };
  const t = themes[theme];

  const creditsFormatted = credits >= 1000
    ? `${(credits / 1000).toFixed(1)}k`
    : credits.toFixed(credits < 10 ? 2 : 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80" role="img" aria-label="Regen Compute — ${creditsFormatted} ${label} retired">
  <defs>
    <clipPath id="usage-clip"><rect width="240" height="80" rx="8"/></clipPath>
    <linearGradient id="usage-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bg}"/>
      <stop offset="100%" stop-color="${t.bg}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#usage-clip)">
    <rect width="240" height="80" fill="url(#usage-bg)"/>
    <!-- Icon -->
    <image href="${iconUrl}" x="12" y="12" width="40" height="40"/>
    <!-- Credits number -->
    <text x="64" y="36" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="22" font-weight="800" fill="${t.accent}" letter-spacing="-0.02em">${creditsFormatted}</text>
    <!-- Label -->
    <text x="64" y="52" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" font-weight="600" fill="${t.text}" letter-spacing="0.02em">${label} retired</text>
    <!-- Divider -->
    <line x1="12" y1="62" x2="228" y2="62" stroke="${t.accent}" stroke-width="0.5" stroke-opacity="0.3"/>
    <!-- Footer -->
    <text x="12" y="74" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="9" fill="${t.sub}" letter-spacing="0.03em">POWERED BY REGENERATIVE COMPUTE</text>
    ${months > 0 ? `<text x="228" y="74" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="9" fill="${t.sub}" text-anchor="end">${months} month${months !== 1 ? "s" : ""}</text>` : ""}
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Page HTML
// ---------------------------------------------------------------------------

function badgesPageHTML(baseUrl: string): string {
  const darkEncoded   = encodeURIComponent(compactBadgeSVG("dark"));
  const lightEncoded  = encodeURIComponent(compactBadgeSVG("light"));
  const greenEncoded  = encodeURIComponent(compactBadgeSVG("green"));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Badge Pack — Regenerative Compute</title>
  <meta name="description" content="Display your commitment to ecological AI. Download the Regen Compute badge or seal for your README, website, or product docs.">
  <meta property="og:title" content="Regen Compute — Badge Pack">
  <meta property="og:description" content="Show your commitment to regenerative AI. Free badge assets for your README, website, or product.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/badges">
  <meta property="og:image" content="${baseUrl}/og-card.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RegenCompute">
  ${brandFonts()}
  <style>
    ${betaBannerCSS()}
    ${brandCSS()}

    .badges-hero {
      padding: 64px 0 48px; text-align: center;
      border-bottom: 1px solid var(--regen-gray-200);
    }
    .badges-hero h1 {
      font-size: 36px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .badges-hero h1 span {
      background: linear-gradient(180deg, #4fb573, #b9e1c7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .badges-hero .subtitle {
      font-size: 17px; color: var(--regen-gray-500);
      max-width: 580px; margin: 0 auto; line-height: 1.65;
    }

    .section { padding: 56px 0; }
    .section h2 {
      font-size: 22px; font-weight: 800; color: var(--regen-navy);
      margin: 0 0 6px; letter-spacing: -0.01em;
    }
    .section-lead {
      font-size: 15px; color: var(--regen-gray-500); margin: 0 0 32px; line-height: 1.6;
    }

    .badge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px; margin-bottom: 48px;
    }

    .badge-card {
      border: 1px solid var(--regen-gray-200);
      border-radius: var(--regen-radius-lg);
      overflow: hidden; background: var(--regen-white);
    }
    .badge-preview {
      padding: 36px 24px;
      display: flex; align-items: center; justify-content: center;
      min-height: 100px;
    }
    .badge-preview--black  { background: #111; }
    .badge-preview--white  { background: #fff; border-bottom: 1px solid var(--regen-gray-200); }
    .badge-preview--green  { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }
    .badge-preview--seal-black { background: #111; }
    .badge-preview--seal-white { background: #fff; border-bottom: 1px solid var(--regen-gray-200); }
    .badge-preview--seal-green { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }

    .badge-info { padding: 18px 18px 22px; border-top: 1px solid var(--regen-gray-100); }
    .badge-info h3 { font-size: 14px; font-weight: 700; color: var(--regen-navy); margin: 0 0 4px; }
    .badge-info p  { font-size: 13px; color: var(--regen-gray-500); margin: 0 0 14px; line-height: 1.5; }

    .snippet-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
    .tab-btn {
      font-size: 11px; font-weight: 600; padding: 3px 9px;
      border-radius: 4px; border: 1px solid var(--regen-gray-200);
      background: var(--regen-white); color: var(--regen-gray-500);
      cursor: pointer;
    }
    .tab-btn.active {
      background: var(--regen-green-bg); color: var(--regen-green);
      border-color: var(--regen-green-light);
    }
    .snippet-block {
      position: relative;
      background: #f8fafc; border: 1px solid var(--regen-gray-200);
      border-radius: 6px; padding: 9px 40px 9px 11px;
      font-family: 'Monaco','Menlo','Consolas',monospace;
      font-size: 10.5px; color: #334155; line-height: 1.6;
      word-break: break-all; white-space: pre-wrap;
      display: none;
    }
    .snippet-block.visible { display: block; }
    .copy-btn {
      position: absolute; top: 7px; right: 7px;
      background: var(--regen-white); border: 1px solid var(--regen-gray-200);
      border-radius: 4px; padding: 2px 7px;
      font-size: 11px; font-weight: 600; color: var(--regen-gray-500);
      cursor: pointer;
    }
    .copy-btn:hover { background: var(--regen-green-bg); color: var(--regen-green); border-color: var(--regen-green-light); }
    .copy-btn.copied { color: var(--regen-green); border-color: var(--regen-green-light); }

    .download-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600; color: var(--regen-green);
      text-decoration: none; padding: 5px 11px;
      border: 1px solid var(--regen-green-light);
      border-radius: 6px; background: var(--regen-green-bg);
      margin-top: 10px;
    }
    .download-btn:hover { background: #d1fae5; }

    /* Usage badge section */
    .usage-explainer {
      background: linear-gradient(135deg, #0a2e1f, #0d4a38);
      border-radius: var(--regen-radius-lg);
      padding: 40px; margin-bottom: 32px; color: #fff;
    }
    .usage-explainer h2 { color: #fff; font-size: 20px; margin: 0 0 12px; }
    .usage-explainer p  { color: rgba(255,255,255,0.8); font-size: 15px; line-height: 1.7; margin: 0 0 20px; }
    .usage-key-form { display: flex; gap: 10px; flex-wrap: wrap; }
    .usage-key-input {
      flex: 1; min-width: 240px;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px; padding: 10px 14px;
      font-size: 13px; color: #fff; font-family: 'Monaco','Menlo','Consolas',monospace;
      outline: none;
    }
    .usage-key-input::placeholder { color: rgba(255,255,255,0.4); }
    .usage-key-input:focus { border-color: #4fb573; }
    .usage-preview-btn {
      background: #4fb573; color: #fff; border: none;
      border-radius: 6px; padding: 10px 20px;
      font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .usage-preview-btn:hover { background: #3da862; }
    .usage-preview-area { margin-top: 24px; display: none; }
    .usage-preview-area.visible { display: block; }
    .usage-preview-frames {
      display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
    }
    .usage-frame {
      padding: 20px 24px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .usage-frame--black { background: #111; }
    .usage-frame--white { background: #fff; border: 1px solid #e2e8f0; }
    .usage-frame--green { background: linear-gradient(135deg, #1a5c3a, #0d7a5f); }

    .usage-snippet {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px; padding: 12px 40px 12px 14px; position: relative;
      font-family: 'Monaco','Menlo','Consolas',monospace;
      font-size: 11px; color: rgba(255,255,255,0.85); line-height: 1.6;
      word-break: break-all; white-space: pre-wrap;
    }
    .usage-snippet .copy-btn {
      background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7);
    }

    .what-it-means {
      background: var(--regen-green-bg);
      border: 1px solid var(--regen-green-light);
      border-radius: var(--regen-radius-lg);
      padding: 40px; margin-bottom: 56px;
    }
    .what-it-means h2 { font-size: 20px; color: var(--regen-navy); margin: 0 0 12px; }
    .what-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px; margin-top: 20px;
    }
    .what-card {
      background: var(--regen-white); border: 1px solid var(--regen-green-light);
      border-radius: var(--regen-radius); padding: 16px 18px;
    }
    .what-card .icon { font-size: 18px; margin-bottom: 6px; }
    .what-card h3 { font-size: 13px; font-weight: 700; color: var(--regen-navy); margin: 0 0 4px; }
    .what-card p  { font-size: 13px; color: var(--regen-gray-600); line-height: 1.55; margin: 0; }

    @media (max-width: 640px) {
      .badges-hero { padding: 48px 0 36px; }
      .badges-hero h1 { font-size: 26px; }
      .usage-explainer { padding: 28px 20px; }
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

  <section class="badges-hero">
    <div class="regen-container">
      <h1>Show Your <span>Regenerative AI</span> Commitment</h1>
      <p class="subtitle">
        Use these badges in your README, on your website, or in your product docs.
        Every badge signals that your AI usage funds verified ecological regeneration on Regen Network.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="regen-container">

      <!-- Compact badges -->
      <h2>Compact Badges</h2>
      <p class="section-lead">Horizontal badge in three themes — pick what fits your background.</p>

      <div class="badge-grid">
        ${["dark","light","green"].map(theme => {
          const labels: Record<string,string> = { dark: "Dark", light: "Light", green: "Green" };
          const descs: Record<string,string> = {
            dark: "For dark backgrounds, dark-theme READMEs, and dark UIs.",
            light: "For light backgrounds, white docs, and GitHub READMEs.",
            green: "For green-branded pages or anywhere you want a bold look.",
          };
          const svgUrl = `${baseUrl}/badges/badge-${theme}.svg`;
          const encoded = theme === "dark" ? darkEncoded : theme === "light" ? lightEncoded : greenEncoded;
          return `
        <div class="badge-card">
          <div class="badge-preview badge-preview--${theme === "dark" ? "black" : theme === "light" ? "white" : "green"}">
            <img src="data:image/svg+xml,${encoded}" alt="Regen Compute ${labels[theme]} badge" width="240" height="32">
          </div>
          <div class="badge-info">
            <h3>${labels[theme]}</h3>
            <p>${descs[theme]}</p>
            <div class="snippet-tabs">
              <button class="tab-btn active" onclick="showTab(this,'${theme}','markdown')">Markdown</button>
              <button class="tab-btn" onclick="showTab(this,'${theme}','html')">HTML</button>
              <button class="tab-btn" onclick="showTab(this,'${theme}','url')">URL</button>
            </div>
            <div class="snippet-block visible" id="${theme}-markdown">[![Powered by Regenerative Compute](${svgUrl})](${baseUrl})<button class="copy-btn" onclick="copySnippet(this,'${theme}-markdown')">Copy</button></div>
            <div class="snippet-block" id="${theme}-html">&lt;a href="${baseUrl}" target="_blank" rel="noopener"&gt;\n  &lt;img src="${svgUrl}" alt="Powered by Regenerative Compute" width="240" height="32"&gt;\n&lt;/a&gt;<button class="copy-btn" onclick="copySnippet(this,'${theme}-html')">Copy</button></div>
            <div class="snippet-block" id="${theme}-url">${svgUrl}<button class="copy-btn" onclick="copySnippet(this,'${theme}-url')">Copy</button></div>
            <a class="download-btn" href="${svgUrl}" download="regen-compute-badge-${theme}.svg">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Download SVG
            </a>
          </div>
        </div>`;
        }).join("")}
      </div>

      <!-- Seal -->
      <h2>Certified Seal</h2>
      <p class="section-lead">The full icon on three backgrounds — for websites, footers, and About pages.</p>

      <div class="badge-grid">
        ${[["black","#111"],["white","#fff"],["green","linear-gradient(135deg,#1a5c3a,#0d7a5f)"]].map(([bg, _]) => {
          const sealUrl = `${baseUrl}/public/badge-icon.png`;
          const id = `seal-${bg}`;
          return `
        <div class="badge-card">
          <div class="badge-preview badge-preview--seal-${bg}">
            <img src="${sealUrl}" alt="Regen Compute seal" style="width:120px;height:120px;object-fit:contain;">
          </div>
          <div class="badge-info">
            <h3>Seal — ${bg.charAt(0).toUpperCase() + bg.slice(1)}</h3>
            <p>120×120 icon on ${bg} background. Use in footers, sidebars, and About pages.</p>
            <div class="snippet-tabs">
              <button class="tab-btn active" onclick="showTab(this,'${id}','html')">HTML</button>
              <button class="tab-btn" onclick="showTab(this,'${id}','markdown')">Markdown</button>
              <button class="tab-btn" onclick="showTab(this,'${id}','url')">URL</button>
            </div>
            <div class="snippet-block visible" id="${id}-html">&lt;a href="${baseUrl}" target="_blank" rel="noopener"&gt;\n  &lt;img src="${sealUrl}" alt="Regen Compute Certified" width="120" height="120"&gt;\n&lt;/a&gt;<button class="copy-btn" onclick="copySnippet(this,'${id}-html')">Copy</button></div>
            <div class="snippet-block" id="${id}-markdown">[![Regen Compute Certified](${sealUrl})](${baseUrl})<button class="copy-btn" onclick="copySnippet(this,'${id}-markdown')">Copy</button></div>
            <div class="snippet-block" id="${id}-url">${sealUrl}<button class="copy-btn" onclick="copySnippet(this,'${id}-url')">Copy</button></div>
            <a class="download-btn" href="${sealUrl}" download="regen-compute-seal.png">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Download PNG
            </a>
          </div>
        </div>`;
        }).join("")}
      </div>

      <!-- Dynamic usage badge -->
      <div class="usage-explainer">
        <h2>Live Usage Badge</h2>
        <p>
          A dynamic badge that shows your actual credits retired — updated live from your subscription.
          Paste your API key to preview and get your embed code.
        </p>
        <div class="usage-key-form">
          <input class="usage-key-input" id="api-key-input" type="text" placeholder="Paste your API key (from your dashboard)">
          <button class="usage-preview-btn" onclick="previewUsage()">Preview Badge</button>
        </div>
        <div class="usage-preview-area" id="usage-preview-area">
          <div class="usage-preview-frames">
            <div class="usage-frame usage-frame--black">
              <img id="usage-badge-dark"  src="" alt="Usage badge dark"  width="240" height="80">
            </div>
            <div class="usage-frame usage-frame--white">
              <img id="usage-badge-light" src="" alt="Usage badge light" width="240" height="80">
            </div>
            <div class="usage-frame usage-frame--green">
              <img id="usage-badge-green" src="" alt="Usage badge green" width="240" height="80">
            </div>
          </div>
          <div class="usage-snippet" id="usage-snippet">
            <button class="copy-btn" onclick="copyUsageSnippet()">Copy</button>
          </div>
        </div>
      </div>

      <!-- What it means -->
      <div class="what-it-means">
        <h2>What Does the Badge Mean?</h2>
        <p style="color:var(--regen-gray-700);font-size:15px;line-height:1.7;margin:0 0 4px;">
          When you display the Regen Compute badge, you&rsquo;re telling your users that your AI usage
          is backed by verified ecological credit retirements on <a href="https://regen.network" target="_blank" rel="noopener" style="color:var(--regen-green)">Regen Network</a>.
          Not a pledge — real credits, retired permanently on-chain.
        </p>
        <div class="what-grid">
          <div class="what-card">
            <div class="icon">🌱</div>
            <h3>Verified Credits</h3>
            <p>Every credit is MRV-verified by independent scientists.</p>
          </div>
          <div class="what-card">
            <div class="icon">⛓️</div>
            <h3>On-Chain Proof</h3>
            <p>Retirements are recorded permanently on Regen Ledger. Anyone can verify.</p>
          </div>
          <div class="what-card">
            <div class="icon">🌍</div>
            <h3>Beyond Carbon</h3>
            <p>Carbon, biodiversity, marine, and species stewardship credits.</p>
          </div>
          <div class="what-card">
            <div class="icon">🔗</div>
            <h3>Linkable Certificate</h3>
            <p>Every retirement generates a public, shareable on-chain certificate.</p>
          </div>
        </div>
      </div>

    </div>
  </section>

  ${brandFooter({ links: [
    { label: "Home", href: "/" },
    { label: "Badges", href: "/badges" },
    { label: "Research", href: "/research" },
    { label: "About", href: "/about" },
    { label: "Regen Network", href: "https://regen.network" },
    { label: "Marketplace", href: "https://app.regen.network" },
  ], showInstall: true })}

  ${betaBannerJS()}
  <script>
    function showTab(btn, prefix, format) {
      const card = btn.closest('.badge-info');
      card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      card.querySelectorAll('.snippet-block').forEach(b => b.classList.remove('visible'));
      const target = document.getElementById(prefix + '-' + format);
      if (target) target.classList.add('visible');
    }

    function copySnippet(btn, id) {
      const block = document.getElementById(id);
      if (!block) return;
      const text = block.childNodes[0]?.textContent ?? '';
      navigator.clipboard.writeText(text.trim()).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    }

    async function previewUsage() {
      const key = document.getElementById('api-key-input').value.trim();
      if (!key) return;
      const base = '${baseUrl}';
      const area = document.getElementById('usage-preview-area');
      const snippet = document.getElementById('usage-snippet');

      ['dark','light','green'].forEach(theme => {
        const url = base + '/badges/usage.svg?key=' + encodeURIComponent(key) + '&theme=' + theme + '&t=' + Date.now();
        document.getElementById('usage-badge-' + theme).src = url;
      });

      const mdUrl = base + '/badges/usage.svg?key=' + encodeURIComponent(key);
      snippet.childNodes[0]?.remove?.();
      snippet.insertBefore(
        Object.assign(document.createTextNode(
          '[![My Regenerative AI Impact](' + mdUrl + ')](${baseUrl})'
        ), {}),
        snippet.firstChild
      );

      area.classList.add('visible');
    }

    function copyUsageSnippet() {
      const snippet = document.getElementById('usage-snippet');
      const text = snippet.childNodes[0]?.textContent ?? '';
      const btn = snippet.querySelector('.copy-btn');
      navigator.clipboard.writeText(text.trim()).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createBadgesRoutes(baseUrl: string, db?: Database.Database): Router {
  const router = Router();

  // Static compact badge assets
  router.get("/badges/badge-dark.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("dark"));
  });

  router.get("/badges/badge-light.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("light"));
  });

  router.get("/badges/badge-green.svg", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(compactBadgeSVG("green"));
  });

  // Dynamic usage badge
  router.get("/badges/usage.svg", (req: Request, res: Response) => {
    const apiKey = (req.query.key as string) ?? "";
    const theme = (["dark","light","green"].includes(req.query.theme as string)
      ? req.query.theme
      : "dark") as "dark" | "light" | "green";

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!apiKey || !db) {
      return res.send(usageBadgeSVG({
        credits: 0, label: "credits", months: 0, theme,
      }));
    }

    const user = getUserByApiKey(db, apiKey);
    if (!user) {
      return res.send(usageBadgeSVG({
        credits: 0, label: "credits", months: 0, theme,
      }));
    }

    const subscriber = getSubscriberByUserId(db, user.id);
    const attr = subscriber
      ? getCumulativeAttribution(db, subscriber.id)
      : { total_carbon: 0, total_biodiversity: 0, total_uss: 0, total_contribution_cents: 0, months_active: 0 };

    const totalCredits = attr.total_carbon + attr.total_biodiversity + attr.total_uss;

    // Pick the most meaningful label
    let credits = totalCredits;
    let label = "credits";
    if (attr.total_carbon > 0 && attr.total_biodiversity === 0 && attr.total_uss === 0) {
      credits = attr.total_carbon; label = "carbon credits";
    } else if (totalCredits === 0) {
      credits = 0; label = "credits";
    }

    res.send(usageBadgeSVG({
      credits, label, theme,
      months: attr.months_active,
    }));
  });

  // Main page
  router.get("/badges", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(badgesPageHTML(baseUrl));
  });

  return router;
}
