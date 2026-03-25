/**
 * Structured retirement reason builder.
 *
 * Produces JSON-LD-compatible reason strings for MsgRetire and MsgSend
 * retirement fields. Backward-compatible — the reason field remains a
 * valid string, but now carries structured metadata for indexers and
 * claims engine consumers.
 *
 * See: https://github.com/regen-network/regen-compute/issues/101 (Phase A)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _version: string | undefined;

function getVersion(): string {
  if (_version) return _version;
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
    _version = pkg.version;
  } catch {
    _version = "unknown";
  }
  return _version!;
}

export interface StructuredReasonOptions {
  /** Human-readable note (e.g. subscriber name, context) */
  note?: string;
  /** Subscriber ID for per-subscriber retirements */
  subscriberId?: number;
  /** Billing period (e.g. "2026-03") */
  period?: string;
  /** Source context: "mcp_tool" for direct retirements, "subscription" for scheduled */
  source?: "mcp_tool" | "subscription";
}

/**
 * Build a structured retirement reason string.
 *
 * The returned string is valid JSON that carries semantic context:
 * - @context for JSON-LD compatibility
 * - type to identify this as a Regen Compute retirement
 * - methodology reference for footprint estimation
 * - tool version for traceability
 *
 * Backward-compatible: older consumers that treat reason as plain text
 * will see valid JSON (which is a valid string).
 */
export function buildRetirementReason(options: StructuredReasonOptions = {}): string {
  const reason: Record<string, unknown> = {
    "@context": "https://schema.regen.network/v1",
    type: "ComputeFootprintRetirement",
    tool: "regen-compute",
    version: getVersion(),
    methodology: "Luccioni2023+IEA2024",
    uncertaintyRange: "10x",
  };

  if (options.note) {
    reason.note = options.note;
  }

  if (options.period) {
    reason.period = options.period;
  }

  if (options.source) {
    reason.source = options.source;
  }

  return JSON.stringify(reason);
}
