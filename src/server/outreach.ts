/**
 * GET  /admin/outreach          — Supplier outreach dashboard
 * POST /admin/outreach/generate — Generate a pitch for a project developer
 * POST /admin/outreach/save     — Save an outreach record
 * POST /admin/outreach/status   — Update outreach status
 *
 * Auth: Bearer SESSION_SECRET (same pattern as other admin routes)
 */

import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { brandFonts, brandCSS, brandHeader, brandFooter } from "./brand.js";
import { generateText, isClaudeConfigured } from "../services/claude.js";

// ---------------------------------------------------------------------------
// DB helpers (outreach table created on first use)
// ---------------------------------------------------------------------------

function ensureOutreachTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      credit_type TEXT NOT NULL,
      region TEXT,
      contact_name TEXT,
      contact_email TEXT,
      pitch TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

interface OutreachRecord {
  id: number;
  company_name: string;
  credit_type: string;
  region: string | null;
  contact_name: string | null;
  contact_email: string | null;
  pitch: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function getRecords(db: Database.Database): OutreachRecord[] {
  return db.prepare("SELECT * FROM outreach_records ORDER BY created_at DESC").all() as OutreachRecord[];
}

function saveRecord(db: Database.Database, record: Omit<OutreachRecord, "id" | "created_at" | "updated_at">): OutreachRecord {
  const result = db.prepare(`
    INSERT INTO outreach_records (company_name, credit_type, region, contact_name, contact_email, pitch, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.company_name, record.credit_type, record.region, record.contact_name, record.contact_email, record.pitch, record.status, record.notes);
  return db.prepare("SELECT * FROM outreach_records WHERE id = ?").get(result.lastInsertRowid) as OutreachRecord;
}

function updateStatus(db: Database.Database, id: number, status: string, notes?: string) {
  db.prepare(`
    UPDATE outreach_records SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?
  `).run(status, notes ?? null, id);
}

// ---------------------------------------------------------------------------
// Pitch generation
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a business development specialist for Regen Network, writing outreach pitches to ecological credit project developers.

Regen Network is a public blockchain purpose-built for ecological credit accounting. Regenerative Compute is a new product that connects AI developer subscriptions directly to verified ecological credit retirements on Regen Network — creating a new, recurring demand source for project developers.

Your goal is to write a compelling, concise email pitch (200-300 words) to a project developer explaining:
1. The AI compute → ecological credit connection and why it creates reliable demand
2. Why their specific credit type is a great fit for this market
3. A clear call to action to list their credits on Regen Marketplace for AI demand

Tone: warm, knowledgeable, mission-aligned. Not salesy. These are fellow ecological regeneration people.
Format: plain text email, no markdown. Start with a brief subject line on the first line prefixed with "Subject: ".`;

async function generatePitch(company: string, creditType: string, region: string, contactName: string): Promise<string> {
  const greeting = contactName ? `Hi ${contactName.split(" ")[0]},` : "Hi,";
  return generateText(SYSTEM_PROMPT, `
Write an outreach email for:
- Company/Project: ${company}
- Credit type: ${creditType}
- Region: ${region || "not specified"}
- Greeting: ${greeting}

Focus on why ${creditType} credits are particularly compelling for the AI developer market and the narrative value for their project.
  `.trim());
}

// ---------------------------------------------------------------------------
// Page HTML
// ---------------------------------------------------------------------------

function pageHTML(records: OutreachRecord[], claudeReady: boolean): string {
  const statusColors: Record<string, string> = {
    draft: "#94a3b8",
    sent: "#3b82f6",
    responded: "#10b981",
    listed: "#4fb573",
    declined: "#ef4444",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Outreach — Regen Compute Admin</title>
  ${brandFonts()}
  <style>
    ${brandCSS()}
    body { background: #f8fafc; }

    .admin-header {
      background: #0a2e1f; padding: 16px 0; margin-bottom: 32px;
    }
    .admin-header h1 {
      color: #fff; font-size: 18px; font-weight: 700; margin: 0;
    }
    .admin-header .sub {
      color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 2px;
    }

    .grid { display: grid; grid-template-columns: 400px 1fr; gap: 24px; align-items: start; }

    .card {
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 24px;
    }
    .card h2 { font-size: 15px; font-weight: 700; color: #0a2e1f; margin: 0 0 18px; }

    label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 5px; }
    input, select, textarea {
      width: 100%; box-sizing: border-box;
      border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 9px 12px; font-size: 13px; color: #0f172a;
      background: #fff; outline: none; margin-bottom: 14px;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus { border-color: #4fb573; }
    textarea { resize: vertical; min-height: 180px; }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 18px; border-radius: 6px; border: none;
      font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .btn-primary { background: #1a5c3a; color: #fff; }
    .btn-primary:hover { background: #145433; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-outline { background: #fff; color: #1a5c3a; border: 1px solid #c3e8d0; }
    .btn-outline:hover { background: #f0faf4; }
    .btn-row { display: flex; gap: 10px; margin-top: 4px; flex-wrap: wrap; }

    .pitch-output {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 14px; font-size: 13px; color: #334155; line-height: 1.7;
      white-space: pre-wrap; min-height: 80px; margin-bottom: 14px;
      display: none;
    }
    .pitch-output.visible { display: block; }

    .spinner { display: none; }
    .spinner.visible { display: inline-block; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Records table */
    .records-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .records-table th {
      text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700;
      color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
      border-bottom: 2px solid #e2e8f0; background: #f8fafc;
    }
    .records-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .records-table tr:hover td { background: #f8fafc; }

    .status-badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600; color: #fff;
    }
    .empty-state {
      text-align: center; padding: 48px 24px; color: #94a3b8; font-size: 14px;
    }

    .no-claude {
      background: #fef3c7; border: 1px solid #fcd34d;
      border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;
      font-size: 13px; color: #92400e;
    }

    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="admin-header">
    <div class="regen-container">
      <h1>Supplier Outreach</h1>
      <div class="sub">Admin — Credit supply pipeline</div>
    </div>
  </div>

  <div class="regen-container">
    <div class="grid">

      <!-- Form -->
      <div class="card">
        <h2>New Outreach</h2>
        ${!claudeReady ? `<div class="no-claude">ANTHROPIC_API_KEY not set — pitch generation disabled. Add it to your .env to enable Claude.</div>` : ""}

        <form id="outreach-form">
          <label>Company / Project Name *</label>
          <input type="text" name="company_name" required placeholder="e.g. Terra Genesis Carbon">

          <label>Credit Type *</label>
          <select name="credit_type" required>
            <option value="">Select type...</option>
            <option value="Soil carbon">Soil carbon</option>
            <option value="Biochar">Biochar</option>
            <option value="Regenerative agriculture">Regenerative agriculture</option>
            <option value="Biodiversity">Biodiversity</option>
            <option value="Marine biodiversity">Marine biodiversity</option>
            <option value="Agroforestry">Agroforestry</option>
            <option value="Grassland restoration">Grassland restoration</option>
            <option value="Other">Other</option>
          </select>

          <label>Region</label>
          <input type="text" name="region" placeholder="e.g. Brazil, Southeast Asia, US Midwest">

          <label>Contact Name</label>
          <input type="text" name="contact_name" placeholder="e.g. Jane Smith">

          <label>Contact Email</label>
          <input type="email" name="contact_email" placeholder="jane@example.com">

          <label>Generated Pitch</label>
          <div class="pitch-output" id="pitch-output"></div>
          <textarea name="pitch" id="pitch-textarea" placeholder="Click 'Generate Pitch' to draft with Claude, or write your own..."></textarea>

          <div class="btn-row">
            <button type="button" class="btn btn-outline" onclick="generatePitch()" ${!claudeReady ? "disabled" : ""}>
              <svg class="spinner" id="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
              Generate Pitch
            </button>
            <button type="submit" class="btn btn-primary">Save Record</button>
          </div>
        </form>
      </div>

      <!-- Records -->
      <div class="card">
        <h2>Outreach Records (${records.length})</h2>
        ${records.length === 0
          ? `<div class="empty-state">No outreach records yet.<br>Generate your first pitch to get started.</div>`
          : `<table class="records-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Type</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `
            <tr>
              <td>
                <strong>${r.company_name}</strong>
                ${r.region ? `<br><span style="color:#94a3b8;font-size:12px">${r.region}</span>` : ""}
              </td>
              <td>${r.credit_type}</td>
              <td>
                ${r.contact_name ?? "—"}
                ${r.contact_email ? `<br><a href="mailto:${r.contact_email}" style="color:#4fb573;font-size:12px">${r.contact_email}</a>` : ""}
              </td>
              <td>
                <select onchange="updateStatus(${r.id}, this.value)" style="margin:0;padding:4px 8px;width:auto">
                  ${["draft","sent","responded","listed","declined"].map(s =>
                    `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`
                  ).join("")}
                </select>
              </td>
              <td style="color:#94a3b8;font-size:12px">${r.created_at.slice(0,10)}</td>
            </tr>
            ${r.pitch ? `<tr><td colspan="5" style="padding:0 12px 12px;color:#334155;font-size:12px;line-height:1.6;white-space:pre-wrap;border-bottom:2px solid #f1f5f9">${r.pitch.replace(/</g,"&lt;")}</td></tr>` : ""}
            `).join("")}
          </tbody>
        </table>`}
      </div>

    </div>
  </div>

  <script>
    async function generatePitch() {
      const form = document.getElementById('outreach-form');
      const data = new FormData(form);
      const company = data.get('company_name');
      const creditType = data.get('credit_type');
      if (!company || !creditType) { alert('Company name and credit type are required.'); return; }

      const spinner = document.getElementById('spinner');
      const output = document.getElementById('pitch-output');
      const textarea = document.getElementById('pitch-textarea');
      spinner.classList.add('visible');
      output.classList.remove('visible');

      try {
        const res = await fetch('/admin/outreach/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: company,
            credit_type: creditType,
            region: data.get('region'),
            contact_name: data.get('contact_name'),
          }),
        });
        const json = await res.json();
        if (json.pitch) {
          textarea.value = json.pitch;
          output.textContent = json.pitch;
          output.classList.add('visible');
        } else {
          alert(json.error ?? 'Failed to generate pitch.');
        }
      } catch (e) {
        alert('Error generating pitch.');
      } finally {
        spinner.classList.remove('visible');
      }
    }

    document.getElementById('outreach-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const res = await fetch('/admin/outreach/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      if (res.ok) { window.location.reload(); }
      else { alert('Failed to save.'); }
    });

    async function updateStatus(id, status) {
      await fetch('/admin/outreach/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createOutreachRoutes(db: Database.Database, _baseUrl: string, config: Config): Router {
  const router = Router();
  ensureOutreachTable(db);

  function isAuthorized(req: Request): boolean {
    const auth = req.headers.authorization;
    return !!auth && auth === `Bearer ${config.sessionSecret}`;
  }

  router.get("/admin/outreach", (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="Regen Compute Admin"');
      return res.status(401).send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:400px">
        <h2>Admin Access Required</h2>
        <p>Set your <code>Authorization: Bearer &lt;SESSION_SECRET&gt;</code> header, or use the URL parameter:</p>
        <form onsubmit="window.location='/admin/outreach';event.preventDefault()">
          <input id="tk" type="password" placeholder="Session secret" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #ccc;border-radius:4px">
          <button onclick="document.cookie='admin_token='+document.getElementById('tk').value+';path=/'" style="padding:8px 16px">Login</button>
        </form>
        </body></html>
      `);
    }
    res.setHeader("Content-Type", "text/html");
    res.send(pageHTML(getRecords(db), isClaudeConfigured()));
  });

  router.post("/admin/outreach/generate", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!isClaudeConfigured()) return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });

    const { company_name, credit_type, region, contact_name } = req.body ?? {};
    if (!company_name || !credit_type) return res.status(400).json({ error: "company_name and credit_type required" });

    try {
      const pitch = await generatePitch(company_name, credit_type, region ?? "", contact_name ?? "");
      res.json({ pitch });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/admin/outreach/save", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { company_name, credit_type, region, contact_name, contact_email, pitch, notes } = req.body ?? {};
    if (!company_name || !credit_type) return res.status(400).json({ error: "company_name and credit_type required" });

    const record = saveRecord(db, {
      company_name, credit_type,
      region: region || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      pitch: pitch || null,
      status: "draft",
      notes: notes || null,
    });
    res.json({ record });
  });

  router.post("/admin/outreach/status", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id, status, notes } = req.body ?? {};
    if (!id || !status) return res.status(400).json({ error: "id and status required" });
    updateStatus(db, id, status, notes);
    res.json({ ok: true });
  });

  return router;
}
