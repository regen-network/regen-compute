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
      research_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migrate existing tables
  try { db.exec("ALTER TABLE outreach_records ADD COLUMN research_notes TEXT"); } catch {}
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
  research_notes: string | null;
  created_at: string;
  updated_at: string;
}

function getRecords(db: Database.Database): OutreachRecord[] {
  return db.prepare("SELECT * FROM outreach_records ORDER BY created_at DESC").all() as OutreachRecord[];
}

function saveRecord(db: Database.Database, record: Omit<OutreachRecord, "id" | "created_at" | "updated_at">): OutreachRecord {
  const result = db.prepare(`
    INSERT INTO outreach_records (company_name, credit_type, region, contact_name, contact_email, pitch, status, notes, research_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.company_name, record.credit_type, record.region, record.contact_name, record.contact_email, record.pitch, record.status, record.notes, record.research_notes ?? null);
  return db.prepare("SELECT * FROM outreach_records WHERE id = ?").get(result.lastInsertRowid) as OutreachRecord;
}

function updateStatus(db: Database.Database, id: number, status: string, notes?: string) {
  db.prepare(`
    UPDATE outreach_records SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?
  `).run(status, notes ?? null, id);
}

function updateContact(db: Database.Database, id: number, contact_name: string | null, contact_email: string | null) {
  db.prepare("UPDATE outreach_records SET contact_name = ?, contact_email = ?, updated_at = datetime('now') WHERE id = ?").run(contact_name, contact_email, id);
}

function updateResearchNotes(db: Database.Database, id: number, research_notes: string) {
  db.prepare("UPDATE outreach_records SET research_notes = ?, updated_at = datetime('now') WHERE id = ?").run(research_notes, id);
}

function updatePitch(db: Database.Database, id: number, pitch: string) {
  db.prepare("UPDATE outreach_records SET pitch = ?, updated_at = datetime('now') WHERE id = ?").run(pitch, id);
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

const RESEARCH_PROMPT = `You are a business development research assistant for Regen Network, preparing outreach briefs on ecological credit project developers and suppliers.

Given a company or project, return a structured research brief covering:

COMPANY OVERVIEW
- Website URL
- LinkedIn company page URL
- What they do, credit type, methodology, certifications
- Registries or marketplaces they currently list on
- Notable projects or regions

KEY CONTACTS
- Names, titles, and LinkedIn URLs for people in: Business Development, Partnerships, Sustainability, Supply, Project Development, or C-suite
- Email address patterns if known (e.g. firstname@company.com)
- Phone numbers if publicly available
- Best person to cold-contact and why

PARTNER / LISTING APPLICATION
- Direct URL to any partner application, supplier onboarding, or marketplace listing page
- Notes on their application process if known

OUTREACH STRATEGY
- 3–5 creative, specific suggestions for how to contact or meet this team (conferences they likely attend, communities they participate in, mutual connections via Regen Network ecosystem, relevant events, LinkedIn engagement tactics, etc.)
- Any warm intro angles (shared mission, shared investors, ecosystem overlap)
- One sentence on the strongest hook for THIS specific company — why Regenerative Compute is a natural fit for them

Format with clear section headers in ALL CAPS. Use plain text, no markdown. Be specific and actionable. If you don't know something with confidence, say so briefly — don't guess URLs or names.`;

async function researchCompany(company: string, creditType: string, region: string): Promise<string> {
  return generateText(RESEARCH_PROMPT, `Research this ecological credit company for outreach:
- Company/Project: ${company}
- Credit type: ${creditType}
- Region: ${region || "not specified"}

Return everything you know that would help a BD person prepare for outreach.`);
}

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
  const statusColor: Record<string, string> = {
    draft: "#94a3b8", sent: "#3b82f6", responded: "#f59e0b",
    listed: "#4fb573", declined: "#ef4444",
  };

  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/'/g,"&#39;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Outreach — Regen Admin</title>
  ${brandFonts()}
  <style>
    ${brandCSS()}
    *, *::before, *::after { box-sizing: border-box; }
    body { background: #f1f5f9; margin: 0; }

    /* ── Nav ── */
    .top-nav {
      background: #0a2e1f; height: 56px;
      display: flex; align-items: center; padding: 0 24px;
      position: sticky; top: 0; z-index: 100;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .nav-brand { flex: 1; }
    .nav-title { color: #fff; font-size: 15px; font-weight: 700; }
    .nav-sub { color: rgba(255,255,255,0.4); font-size: 12px; margin-left: 10px; }
    .nav-btn {
      background: #4fb573; color: #fff; border: none; border-radius: 6px;
      padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: inherit;
    }
    .nav-btn:hover { background: #3da562; }

    /* ── Main layout ── */
    .main { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }

    /* ── Table card ── */
    .table-card {
      background: #fff; border-radius: 10px;
      border: 1px solid #e2e8f0; overflow: hidden;
    }
    .table-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table-card thead th {
      text-align: left; padding: 11px 16px;
      font-size: 11px; font-weight: 700; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.05em;
      background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .record-row { cursor: pointer; transition: background 0.1s; }
    .record-row:hover td { background: #f8fafc; }
    .record-row td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .record-row.open td { background: #f0faf4; border-bottom: none; }
    .chevron { display: inline-block; transition: transform 0.2s; color: #94a3b8; margin-right: 8px; font-size: 10px; }
    .record-row.open .chevron { transform: rotate(90deg); }

    .status-pill {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap;
    }

    /* ── Accordion detail ── */
    .detail-row td { padding: 0; border-bottom: 2px solid #e2e8f0; }
    .detail-inner { padding: 0 16px 16px; }

    /* ── Tabs ── */
    .tab-bar {
      display: flex; gap: 2px; border-bottom: 1px solid #e2e8f0;
      margin: 0 -16px 16px; padding: 0 16px;
    }
    .tab-btn {
      padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      border: none; background: none; color: #64748b; font-family: inherit;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab-btn:hover { color: #0a2e1f; }
    .tab-btn.active { color: #1a5c3a; border-bottom-color: #4fb573; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .content-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 14px; font-size: 13px; color: #334155; line-height: 1.7;
      white-space: pre-wrap; min-height: 60px;
    }
    .content-empty { color: #94a3b8; font-style: italic; font-size: 13px; padding: 12px 0; }

    .detail-actions {
      display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap;
    }
    .detail-actions select {
      border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;
      font-size: 13px; font-family: inherit; color: #0f172a; outline: none; cursor: pointer;
    }
    .detail-actions select:focus { border-color: #4fb573; }
    .action-btn {
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700;
      cursor: pointer; font-family: inherit; border: 1px solid;
    }
    .action-btn-ghost { background: none; border-color: #e2e8f0; color: #64748b; }
    .action-btn-ghost:hover { background: #f1f5f9; }
    .action-btn-danger { background: none; border-color: #fecaca; color: #ef4444; }
    .action-btn-danger:hover { background: #fff1f1; }
    .action-btn-primary { background: #1a5c3a; border-color: #1a5c3a; color: #fff; }
    .action-btn-primary:hover { background: #145433; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .spacer { flex: 1; }

    .spinner-svg { display: none; animation: spin 0.8s linear infinite; vertical-align: middle; }
    .spinner-svg.on { display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Empty state ── */
    .empty-state { text-align: center; padding: 64px 24px; color: #94a3b8; font-size: 14px; }

    /* ── Modal ── */
    .modal-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      z-index: 200; align-items: flex-start; justify-content: center; padding-top: 64px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #fff; border-radius: 12px; width: 100%; max-width: 520px;
      max-height: calc(100vh - 100px); overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex; align-items: center; padding: 20px 24px 0;
      border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;
    }
    .modal-header h2 { font-size: 16px; font-weight: 700; color: #0a2e1f; margin: 0; flex: 1; }
    .modal-close {
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #94a3b8; line-height: 1; padding: 0 4px;
    }
    .modal-body { padding: 0 24px 24px; }

    .no-claude {
      background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e;
    }
    label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    input, select, textarea {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 9px 12px; font-size: 13px; color: #0f172a;
      background: #fff; outline: none; margin-bottom: 12px; font-family: inherit;
    }
    input:focus, select:focus, textarea:focus { border-color: #4fb573; }
    textarea { resize: vertical; min-height: 160px; }
    .modal-actions { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
    .modal-research-out {
      background: #f0faf4; border: 1px solid #c3e8d0; border-radius: 6px;
      padding: 12px; font-size: 12px; color: #334155; line-height: 1.6;
      white-space: pre-wrap; margin-bottom: 12px; display: none;
    }
  </style>
</head>
<body>

  <!-- Nav -->
  <nav class="top-nav">
    <div class="nav-brand">
      <span class="nav-title">Supplier Outreach</span>
      <span class="nav-sub">${records.length} record${records.length !== 1 ? "s" : ""}</span>
    </div>
    <button class="nav-btn" onclick="openModal()">+ New Record</button>
  </nav>

  <!-- Records table -->
  <div class="main">
    <div class="table-card">
      ${records.length === 0
        ? `<div class="empty-state">No outreach records yet.<br>Click <strong>+ New Record</strong> to get started.</div>`
        : `<table>
        <thead>
          <tr>
            <th style="width:28%">Company</th>
            <th style="width:16%">Type</th>
            <th style="width:20%">Contact</th>
            <th style="width:12%">Status</th>
            <th style="width:10%">Date</th>
            <th style="width:14%">Content</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => {
            const hasPitch = !!r.pitch;
            const hasResearch = !!r.research_notes;
            const color = statusColor[r.status] ?? "#94a3b8";
            return `
          <tr class="record-row" id="row-${r.id}" onclick="toggleRow(${r.id})">
            <td><span class="chevron">&#9654;</span><strong>${esc(r.company_name)}</strong>${r.region ? `<br><span style="color:#94a3b8;font-size:11px;margin-left:18px">${esc(r.region)}</span>` : ""}</td>
            <td style="color:#374151">${esc(r.credit_type)}</td>
            <td>${r.contact_name ? esc(r.contact_name) : `<span style="color:#94a3b8">—</span>`}${r.contact_email ? `<br><a href="mailto:${esc(r.contact_email)}" style="color:#4fb573;font-size:11px" onclick="event.stopPropagation()">${esc(r.contact_email)}</a>` : ""}</td>
            <td><span class="status-pill" style="background:${color}">${r.status}</span></td>
            <td style="color:#94a3b8;font-size:12px">${r.created_at.slice(0,10)}</td>
            <td style="font-size:11px;color:#94a3b8">${[hasPitch?"Pitch":"", hasResearch?"Research":""].filter(Boolean).join(" · ") || "—"}</td>
          </tr>
          <tr class="detail-row" id="detail-${r.id}" style="display:none">
            <td colspan="6">
              <div class="detail-inner">
                <div class="tab-bar">
                  <button class="tab-btn active" onclick="switchTab(event,${r.id},'pitch')">Pitch</button>
                  <button class="tab-btn" onclick="switchTab(event,${r.id},'research')">Research</button>
                </div>
                <div class="tab-panel active" id="tab-pitch-${r.id}">
                  ${hasPitch
                    ? `<div class="content-box" id="pitch-content-${r.id}">${esc(r.pitch!)}</div>
                       <div style="margin-top:8px;display:flex;gap:8px">
                         <button class="action-btn action-btn-ghost" onclick="editPitch(${r.id})">Edit</button>
                         <button class="action-btn action-btn-ghost" onclick="rePitch(${r.id},'${esc(r.company_name)}','${esc(r.credit_type)}','${esc(r.region??"")}','${esc(r.contact_name??"")}',this)" ${!claudeReady?"disabled":""}>
                           <svg class="spinner-svg" id="rp-spin-${r.id}" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
                           Regenerate
                         </button>
                       </div>`
                    : `<div class="content-empty">No pitch yet.</div>
                       <button class="action-btn action-btn-primary" style="margin-top:8px" onclick="rePitch(${r.id},'${esc(r.company_name)}','${esc(r.credit_type)}','${esc(r.region??"")}','${esc(r.contact_name??"")}',this)" ${!claudeReady?"disabled":""}>
                         <svg class="spinner-svg" id="rp-spin-${r.id}" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
                         Generate Pitch
                       </button>`}
                </div>
                <div class="tab-panel" id="tab-research-${r.id}">
                  ${hasResearch
                    ? `<div class="content-box" id="research-content-${r.id}">${esc(r.research_notes!)}</div>
                       <div style="margin-top:8px;display:flex;gap:8px">
                         <button class="action-btn action-btn-ghost" onclick="editResearch(${r.id})">Edit</button>
                         <button class="action-btn action-btn-ghost" onclick="reResearch(${r.id},'${esc(r.company_name)}','${esc(r.credit_type)}','${esc(r.region??"")}',this)" ${!claudeReady?"disabled":""}>
                           <svg class="spinner-svg" id="rr-spin-${r.id}" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
                           Re-research
                         </button>
                       </div>`
                    : `<div class="content-empty">No research notes yet.</div>
                       <button class="action-btn action-btn-primary" style="margin-top:8px" onclick="reResearch(${r.id},'${esc(r.company_name)}','${esc(r.credit_type)}','${esc(r.region??"")}',this)" ${!claudeReady?"disabled":""}>
                         <svg class="spinner-svg" id="rr-spin-${r.id}" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
                         Research with Claude
                       </button>`}
                </div>
                <div class="detail-actions" style="margin-top:14px;flex-wrap:wrap;gap:8px">
                  <input id="contact-name-${r.id}" type="text" value="${esc(r.contact_name??'')}" placeholder="Contact name" onclick="event.stopPropagation()" style="margin:0;width:160px;padding:6px 10px;font-size:12px">
                  <input id="contact-email-${r.id}" type="email" value="${esc(r.contact_email??'')}" placeholder="Contact email" onclick="event.stopPropagation()" style="margin:0;width:200px;padding:6px 10px;font-size:12px">
                  <button class="action-btn action-btn-ghost" onclick="saveContact(${r.id})">Save Contact</button>
                  <div class="spacer"></div>
                  <select onchange="updateStatus(${r.id},this.value)" onclick="event.stopPropagation()">
                    ${["draft","sent","responded","listed","declined"].map(s =>
                      `<option value="${s}" ${r.status===s?"selected":""}>${s}</option>`
                    ).join("")}
                  </select>
                  <button class="action-btn action-btn-danger" onclick="deleteRecord(${r.id},'${esc(r.company_name)}')">Delete</button>
                </div>
              </div>
            </td>
          </tr>`;
          }).join("")}
        </tbody>
      </table>`}
    </div>
  </div>

  <!-- New Record Modal -->
  <div class="modal-overlay" id="modal-overlay" onclick="maybeCloseModal(event)">
    <div class="modal">
      <div class="modal-header">
        <h2>New Outreach Record</h2>
        <button class="modal-close" onclick="closeModal()">&#x2715;</button>
      </div>
      <div class="modal-body">
        ${!claudeReady ? `<div class="no-claude">ANTHROPIC_API_KEY not set — AI features disabled.</div>` : ""}
        <form id="outreach-form">
          <label>Company / Project Name *</label>
          <input type="text" name="company_name" required placeholder="e.g. Terra Genesis Carbon">

          <label>Credit Type *</label>
          <select name="credit_type" required>
            <option value="">Select type...</option>
            <option>Soil carbon</option><option>Biochar</option>
            <option>Regenerative agriculture</option><option>Biodiversity</option>
            <option>Marine biodiversity</option><option>Agroforestry</option>
            <option>Grassland restoration</option><option>Other</option>
          </select>

          <label>Region</label>
          <input type="text" name="region" placeholder="e.g. Brazil, Southeast Asia, US Midwest">

          <label>Contact Name</label>
          <input type="text" name="contact_name" placeholder="e.g. Jane Smith">

          <label>Contact Email</label>
          <input type="email" name="contact_email" placeholder="jane@example.com">

          <label>Pitch</label>
          <textarea name="pitch" id="pitch-textarea" placeholder="Write your own or generate with Claude below..."></textarea>

          <div id="modal-research-out" class="modal-research-out"></div>

          <div class="modal-actions">
            <button type="button" class="action-btn action-btn-ghost" onclick="doResearch()" ${!claudeReady?"disabled":""}>
              <svg class="spinner-svg" id="research-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
              Research
            </button>
            <button type="button" class="action-btn action-btn-ghost" onclick="generatePitch()" ${!claudeReady?"disabled":""}>
              <svg class="spinner-svg" id="pitch-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
              Generate Pitch
            </button>
            <div class="spacer"></div>
            <button type="submit" class="action-btn action-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    // ── Modal ──
    function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
    function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
    function maybeCloseModal(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

    // ── Accordion ──
    function toggleRow(id) {
      const row = document.getElementById('row-' + id);
      const detail = document.getElementById('detail-' + id);
      const open = row.classList.toggle('open');
      detail.style.display = open ? '' : 'none';
    }

    // ── Tabs ──
    function switchTab(e, id, tab) {
      e.stopPropagation();
      const detail = document.getElementById('detail-' + id);
      detail.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      detail.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      document.getElementById('tab-' + tab + '-' + id).classList.add('active');
    }

    // ── Research (existing record) ──
    async function reResearch(id, company, creditType, region, btn) {
      const origText = btn.textContent.trim();
      btn.disabled = true;
      const spin = document.getElementById('rr-spin-' + id);
      if (spin) spin.classList.add('on');
      try {
        const res = await fetch('/admin/outreach/research', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, company_name: company, credit_type: creditType, region }),
        });
        const json = await res.json();
        if (json.research) { window.location.reload(); }
        else { alert(json.error ?? 'Failed.'); btn.disabled = false; if (spin) spin.classList.remove('on'); }
      } catch(e) { alert('Error.'); btn.disabled = false; if (spin) spin.classList.remove('on'); }
    }

    async function rePitch(id, company, creditType, region, contactName, btn) {
      btn.disabled = true;
      const spin = document.getElementById('rp-spin-' + id);
      if (spin) spin.classList.add('on');
      try {
        const res = await fetch('/admin/outreach/pitch-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, company_name: company, credit_type: creditType, region, contact_name: contactName }),
        });
        const json = await res.json();
        if (json.ok) { window.location.reload(); }
        else { alert(json.error ?? 'Failed.'); btn.disabled = false; if (spin) spin.classList.remove('on'); }
      } catch(e) { alert('Error.'); btn.disabled = false; if (spin) spin.classList.remove('on'); }
    }

    async function editPitch(id) {
      const box = document.getElementById('pitch-content-' + id);
      if (!box) return;
      const ta = document.createElement('textarea');
      ta.value = box.textContent;
      ta.style.cssText = 'width:100%;min-height:180px;font-size:13px;font-family:inherit;border:1px solid #4fb573;border-radius:6px;padding:10px;resize:vertical;outline:none';
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'action-btn action-btn-primary';
      saveBtn.style.marginTop = '8px';
      saveBtn.onclick = async () => {
        await fetch('/admin/outreach/pitch-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, pitch: ta.value }),
        });
        window.location.reload();
      };
      box.replaceWith(ta);
      ta.after(saveBtn);
    }

    async function editResearch(id) {
      const box = document.getElementById('research-content-' + id);
      if (!box) return;
      const ta = document.createElement('textarea');
      ta.value = box.textContent;
      ta.style.cssText = 'width:100%;min-height:120px;font-size:13px;font-family:inherit;border:1px solid #4fb573;border-radius:6px;padding:10px;resize:vertical;outline:none';
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'action-btn action-btn-primary';
      saveBtn.style.marginTop = '8px';
      saveBtn.onclick = async () => {
        await fetch('/admin/outreach/research-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, research_notes: ta.value }),
        });
        window.location.reload();
      };
      box.replaceWith(ta);
      ta.after(saveBtn);
    }

    // ── Research (new record modal) ──
    async function doResearch() {
      const form = document.getElementById('outreach-form');
      const data = new FormData(form);
      const company = data.get('company_name');
      if (!company) { alert('Enter a company name first.'); return; }
      const spin = document.getElementById('research-spinner');
      const out = document.getElementById('modal-research-out');
      spin.classList.add('on');
      out.style.display = 'none';
      try {
        const res = await fetch('/admin/outreach/research', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_name: company, credit_type: data.get('credit_type'), region: data.get('region') }),
        });
        const json = await res.json();
        if (json.research) {
          out.textContent = json.research;
          out.style.display = 'block';
          out.dataset.value = json.research;
        } else { alert(json.error ?? 'Failed.'); }
      } catch(e) { alert('Error.'); }
      finally { spin.classList.remove('on'); }
    }

    // ── Generate pitch (modal) ──
    async function generatePitch() {
      const form = document.getElementById('outreach-form');
      const data = new FormData(form);
      const company = data.get('company_name');
      const creditType = data.get('credit_type');
      if (!company || !creditType) { alert('Company name and credit type are required.'); return; }
      const spin = document.getElementById('pitch-spinner');
      spin.classList.add('on');
      try {
        const res = await fetch('/admin/outreach/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_name: company, credit_type: creditType, region: data.get('region'), contact_name: data.get('contact_name') }),
        });
        const json = await res.json();
        if (json.pitch) { document.getElementById('pitch-textarea').value = json.pitch; }
        else { alert(json.error ?? 'Failed.'); }
      } catch(e) { alert('Error.'); }
      finally { spin.classList.remove('on'); }
    }

    // ── Save new record ──
    document.getElementById('outreach-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const body = Object.fromEntries(data);
      const out = document.getElementById('modal-research-out');
      if (out.dataset.value) body.research_notes = out.dataset.value;
      const res = await fetch('/admin/outreach/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { window.location.reload(); }
      else { alert('Failed to save.'); }
    });

    // ── Status & Delete ──
    async function saveContact(id) {
      const name = document.getElementById('contact-name-' + id).value;
      const email = document.getElementById('contact-email-' + id).value;
      await fetch('/admin/outreach/contact-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, contact_name: name, contact_email: email }),
      });
      window.location.reload();
    }

    async function updateStatus(id, status) {
      await fetch('/admin/outreach/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    }

    async function deleteRecord(id, name) {
      if (!confirm('Delete "' + name + '"?')) return;
      await fetch('/admin/outreach/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      window.location.reload();
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
    if (auth && auth === `Bearer ${config.sessionSecret}`) return true;
    // Accept query param for browser access
    if (req.query.secret === config.sessionSecret) return true;
    // Accept cookie for browser access
    const cookie = req.headers.cookie ?? "";
    const match = cookie.match(/admin_token=([^;]+)/);
    if (match && decodeURIComponent(match[1]) === config.sessionSecret) return true;
    return false;
  }

  router.get("/admin/outreach", (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      return res.status(401).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Admin Login</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; max-width: 380px; width: 100%; }
  h2 { font-size: 18px; color: #0a2e1f; margin: 0 0 8px; }
  p { font-size: 13px; color: #64748b; margin: 0 0 24px; }
  input { width: 100%; box-sizing: border-box; border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 10px 14px; font-size: 14px; outline: none; margin-bottom: 12px; }
  input:focus { border-color: #4fb573; }
  button { width: 100%; background: #1a5c3a; color: #fff; border: none; border-radius: 7px; padding: 11px; font-size: 14px; font-weight: 700; cursor: pointer; }
  button:hover { background: #145433; }
</style>
</head>
<body>
  <div class="box">
    <h2>Admin Access</h2>
    <p>Enter your session secret to continue.</p>
    <form onsubmit="login(event)">
      <input id="tk" type="password" placeholder="Session secret" autofocus>
      <button type="submit">Login</button>
    </form>
  </div>
  <script>
    function login(e) {
      e.preventDefault();
      const val = document.getElementById('tk').value;
      window.location.href = '/admin/outreach?secret=' + encodeURIComponent(val);
    }
  </script>
</body></html>`);
    }
    res.setHeader("Content-Type", "text/html");
    res.send(pageHTML(getRecords(db), isClaudeConfigured()));
  });

  router.post("/admin/outreach/generate", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!isClaudeConfigured()) return res.json({ pitch: "ANTHROPIC_API_KEY not configured — add it to your .env to enable pitch generation." });

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

  router.post("/admin/outreach/delete", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    db.prepare("DELETE FROM outreach_records WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  router.post("/admin/outreach/research", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!isClaudeConfigured()) return res.json({ error: "ANTHROPIC_API_KEY not configured." });

    const { id, company_name, credit_type, region } = req.body ?? {};
    if (!company_name) return res.status(400).json({ error: "company_name required" });

    try {
      const research = await researchCompany(company_name, credit_type ?? "", region ?? "");
      // If an existing record id was provided, save directly
      if (id) updateResearchNotes(db, id, research);
      res.json({ research });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/admin/outreach/contact-save", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id, contact_name, contact_email } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    updateContact(db, id, contact_name || null, contact_email || null);
    res.json({ ok: true });
  });

  router.post("/admin/outreach/pitch-save", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id, pitch: pitchOverride, company_name, credit_type, region, contact_name } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    try {
      // If a pitch string was passed directly (manual edit), just save it
      const finalPitch = pitchOverride
        ? pitchOverride
        : await generatePitch(company_name ?? "", credit_type ?? "", region ?? "", contact_name ?? "");
      updatePitch(db, id, finalPitch);
      res.json({ ok: true, pitch: finalPitch });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/admin/outreach/research-save", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id, research_notes } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    updateResearchNotes(db, id, research_notes ?? "");
    res.json({ ok: true });
  });

  router.post("/admin/outreach/save", (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { company_name, credit_type, region, contact_name, contact_email, pitch, notes, research_notes } = req.body ?? {};
    if (!company_name || !credit_type) return res.status(400).json({ error: "company_name and credit_type required" });

    const record = saveRecord(db, {
      company_name, credit_type,
      region: region || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      pitch: pitch || null,
      status: "draft",
      notes: notes || null,
      research_notes: research_notes || null,
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
