/**
 * Developer REST API routes — /api/v1/
 *
 * Wraps service-layer functions to provide a JSON API for developers
 * who want to embed retirement, credit browsing, footprint estimation,
 * and certificate retrieval into their own applications.
 *
 * Auth: Bearer API key in Authorization header (same keys as payment routes).
 * Rate limiting: In-memory sliding window per API key.
 * Usage tracking: Every call recorded in api_usage table for billing.
 */

import { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { getUserByApiKey, recordApiUsage, type User } from "./db.js";
import { estimateFootprint } from "../services/estimator.js";
import { getRetirementById, getRetirementStats, getOrderStats } from "../services/indexer.js";
import { listCreditClasses, listSellOrders, listProjects } from "../services/ledger.js";
import { getRecentOrders } from "../services/indexer.js";
import { executeRetirement } from "../services/retirement.js";

// Credit type abbreviation to human-readable name
const CREDIT_TYPE_NAMES: Record<string, string> = {
  C: "Carbon",
  BT: "Biodiversity (Terrasos)",
  KSH: "Kilo-Sheep-Hour",
  MBS: "Marine Biodiversity Stewardship",
  USS: "Umbrella Species Stewardship",
};

// --- Rate limiter ---

interface RateWindow {
  count: number;
  windowStart: number;
}

const rateLimitWindows = new Map<string, RateWindow>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of rateLimitWindows) {
    if (now - window.windowStart > 120_000) {
      rateLimitWindows.delete(key);
    }
  }
}, 300_000);

function checkRateLimit(apiKey: string, limit: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const existing = rateLimitWindows.get(apiKey);

  if (!existing || now - existing.windowStart >= windowMs) {
    rateLimitWindows.set(apiKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  existing.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// --- Error helpers ---

function apiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const body: { error: { code: string; message: string; details?: Record<string, unknown> } } = {
    error: { code, message },
  };
  if (details) body.error.details = details;
  res.status(status).json(body);
}

// --- Auth middleware ---

function authenticateApiKey(
  req: Request,
  res: Response,
  db: Database.Database
): User | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    apiError(res, 401, "UNAUTHORIZED", "Missing Authorization header. Use: Bearer <api_key>");
    return null;
  }

  const apiKey = auth.slice(7).trim();
  const user = getUserByApiKey(db, apiKey);
  if (!user) {
    apiError(res, 401, "UNAUTHORIZED", "Invalid API key");
    return null;
  }

  return user;
}

// --- Route factory ---

export function createApiRoutes(
  db: Database.Database,
  baseUrl: string,
  config: Config
): Router {
  const router = Router();
  const rateLimit = config.apiRateLimit;

  // --- OpenAPI spec (public, no auth) ---
  router.get("/api/v1/openapi.json", (_req: Request, res: Response) => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const specPath = join(__dirname, "openapi.json");
      const spec = readFileSync(specPath, "utf-8");
      // Inject the actual server URL
      const parsed = JSON.parse(spec);
      parsed.servers = [{ url: `${baseUrl}/api/v1`, description: "Regenerative Compute API" }];
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json(parsed);
    } catch {
      apiError(res, 500, "INTERNAL_ERROR", "OpenAPI spec not available");
    }
  });

  // --- Auth + rate limit middleware for all other /api/v1/ routes ---
  router.use("/api/v1", (req: Request, res: Response, next: NextFunction) => {
    // Skip openapi.json (already handled above)
    if (req.path === "/openapi.json") {
      next();
      return;
    }

    const startTime = Date.now();
    const user = authenticateApiKey(req, res, db);
    if (!user) return;

    // Rate limiting
    const { allowed, retryAfterSec } = checkRateLimit(user.api_key, rateLimit);
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSec));
      apiError(res, 429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`);
      recordApiUsage(db, user.id, req.path, req.method, 429, Date.now() - startTime);
      return;
    }

    // Attach user and timing to request for downstream handlers
    (req as unknown as Record<string, unknown>)._apiUser = user;
    (req as unknown as Record<string, unknown>)._apiStartTime = startTime;

    // Track usage after response is sent
    res.on("finish", () => {
      recordApiUsage(db, user.id, req.path, req.method, res.statusCode, Date.now() - startTime);
    });

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", String(rateLimit));

    next();
  });

  // Helper to get authenticated user from request
  function getUser(req: Request): User {
    return (req as unknown as Record<string, unknown>)._apiUser as User;
  }

  // --- POST /api/v1/retire ---
  router.post("/api/v1/retire", async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) return;

    const { credit_class, quantity, beneficiary_name, jurisdiction, reason } = req.body ?? {};

    if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0)) {
      apiError(res, 400, "INVALID_REQUEST", "quantity must be a positive number");
      return;
    }

    try {
      const result = await executeRetirement({
        creditClass: credit_class,
        quantity,
        beneficiaryName: beneficiary_name,
        jurisdiction,
        reason,
      });

      if (result.status === "success") {
        res.json({
          status: "success",
          tx_hash: result.txHash,
          credits_retired: result.creditsRetired,
          cost: result.cost,
          block_height: result.blockHeight,
          certificate_id: result.certificateId ?? null,
          certificate_url: result.certificateId ? `${baseUrl}/impact/${encodeURIComponent(result.certificateId)}` : null,
          jurisdiction: result.jurisdiction,
          reason: result.reason,
          beneficiary_name: result.beneficiaryName ?? null,
          remaining_balance_cents: result.remainingBalanceCents ?? null,
        });
      } else {
        res.json({
          status: "marketplace_link",
          marketplace_url: result.marketplaceUrl,
          message: result.message,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, 500, "INTERNAL_ERROR", `Retirement failed: ${msg}`);
    }
  });

  // --- GET /api/v1/credits ---
  router.get("/api/v1/credits", async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) return;

    const creditType = (req.query.type as string) || "all";
    const maxResults = Math.min(parseInt((req.query.max_results as string) || "10", 10), 50);

    try {
      const [classes, sellOrders, projects, recentOrders] = await Promise.all([
        listCreditClasses(),
        listSellOrders().catch(() => []),
        listProjects(),
        getRecentOrders(5).catch(() => []),
      ]);

      // Filter classes by credit type
      const filteredClasses =
        creditType === "all"
          ? classes
          : classes.filter((c) => {
              if (creditType === "carbon") return c.credit_type_abbrev === "C";
              if (creditType === "biodiversity")
                return ["BT", "MBS", "KSH", "USS"].includes(c.credit_type_abbrev);
              return true;
            });

      // Project lookup
      const projectsByClass = new Map<string, typeof projects>();
      for (const project of projects) {
        const existing = projectsByClass.get(project.class_id) || [];
        existing.push(project);
        projectsByClass.set(project.class_id, existing);
      }

      // Aggregate sell orders by type
      const classLookup = new Map(classes.map((c) => [c.id, c]));
      const sellOrdersByType = new Map<string, { quantity: number; count: number }>();
      for (const order of sellOrders) {
        const classId = order.batch_denom.replace(/-\d.*$/, "");
        const cls = classLookup.get(classId);
        const typeAbbrev = cls?.credit_type_abbrev || "Other";
        const existing = sellOrdersByType.get(typeAbbrev) || { quantity: 0, count: 0 };
        existing.quantity += parseFloat(order.quantity) || 0;
        existing.count += 1;
        sellOrdersByType.set(typeAbbrev, existing);
      }

      const marketplaceSnapshot = Array.from(sellOrdersByType.entries()).map(([abbrev, stats]) => ({
        credit_type: CREDIT_TYPE_NAMES[abbrev] || abbrev,
        credit_type_abbreviation: abbrev,
        available_credits: Math.round(stats.quantity * 10) / 10,
        sell_orders: stats.count,
      }));

      const creditClasses = filteredClasses.slice(0, maxResults).map((cls) => {
        const classProjects = projectsByClass.get(cls.id) || [];
        return {
          id: cls.id,
          type: CREDIT_TYPE_NAMES[cls.credit_type_abbrev] || cls.credit_type_abbrev,
          type_abbreviation: cls.credit_type_abbrev,
          projects: classProjects.length,
          jurisdictions: [...new Set(classProjects.map((p) => p.jurisdiction))],
        };
      });

      const sellOrderList = sellOrders.slice(0, maxResults).map((order) => ({
        batch_denom: order.batch_denom,
        quantity: order.quantity,
        ask_amount: order.ask_amount,
        ask_denom: order.ask_denom,
      }));

      const recent = recentOrders.map((order) => ({
        project_id: order.projectId,
        credits_amount: order.creditsAmount,
        total_price: order.totalPrice,
        ask_denom: order.askDenom,
        retired: order.retiredCredits,
      }));

      res.json({
        marketplace_snapshot: marketplaceSnapshot,
        credit_classes: creditClasses,
        sell_orders: sellOrderList,
        recent_orders: recent,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, 503, "SERVICE_UNAVAILABLE", `Failed to fetch credits: ${msg}`);
    }
  });

  // --- GET /api/v1/footprint ---
  router.get("/api/v1/footprint", (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) return;

    const sessionMinutes = parseFloat((req.query.session_minutes as string) || "0");
    const toolCalls = req.query.tool_calls ? parseInt(req.query.tool_calls as string, 10) : undefined;

    if (!sessionMinutes || sessionMinutes <= 0) {
      apiError(res, 400, "INVALID_REQUEST", "session_minutes is required and must be a positive number");
      return;
    }

    const estimate = estimateFootprint(sessionMinutes, toolCalls);
    res.json(estimate);
  });

  // --- GET /api/v1/certificates/:id ---
  router.get("/api/v1/certificates/:id", async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) return;

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const retirement = await getRetirementById(id);
      if (!retirement) {
        apiError(res, 404, "NOT_FOUND", `No retirement certificate found for ID: ${id}`);
        return;
      }

      res.json({
        node_id: retirement.nodeId,
        amount: retirement.amount,
        batch_denom: retirement.batchDenom,
        owner: retirement.owner,
        jurisdiction: retirement.jurisdiction,
        reason: retirement.reason || "Ecological regeneration",
        timestamp: retirement.timestamp,
        block_height: retirement.blockHeight,
        tx_hash: retirement.txHash,
        certificate_url: `${baseUrl}/impact/${encodeURIComponent(retirement.nodeId)}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, 503, "SERVICE_UNAVAILABLE", `Failed to retrieve certificate: ${msg}`);
    }
  });

  // --- GET /api/v1/impact ---
  router.get("/api/v1/impact", async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) return;

    try {
      const [classes, projects, retirementStats, orderStats] = await Promise.all([
        listCreditClasses(),
        listProjects(),
        getRetirementStats().catch(() => null),
        getOrderStats().catch(() => null),
      ]);

      const jurisdictions = [...new Set(projects.map((p) => p.jurisdiction))];

      const creditTypes = [
        { abbreviation: "C", name: "Carbon" },
        { abbreviation: "BT", name: "Biodiversity (Terrasos)" },
        { abbreviation: "MBS", name: "Marine Biodiversity Stewardship" },
        { abbreviation: "KSH", name: "Kilo-Sheep-Hour" },
        { abbreviation: "USS", name: "Umbrella Species Stewardship" },
      ];

      res.json({
        credit_classes: classes.length,
        active_projects: projects.length,
        jurisdictions: jurisdictions.length,
        total_retirements: retirementStats?.totalRetirements ?? null,
        total_marketplace_orders: orderStats?.totalOrders ?? null,
        credit_types: creditTypes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, 503, "SERVICE_UNAVAILABLE", `Failed to fetch impact data: ${msg}`);
    }
  });

  return router;
}
