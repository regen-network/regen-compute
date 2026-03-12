/**
 * SQLite database for prepaid balance tracking and pool accounting.
 *
 * Tables:
 * - users: API key, email, balance (in cents), Stripe customer ID
 * - transactions: top-ups and retirement debits with full audit trail
 * - subscribers: Stripe subscription state linked to users
 * - pool_runs: monthly batch retirement execution records
 * - attributions: per-subscriber fractional credit attribution per pool run
 * - burns: REGEN token burn records linked to pool runs
 */

import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

let _db: Database.Database | undefined;

export function getDb(dbPath = "data/regen-compute.db"): Database.Database {
  if (_db) return _db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT UNIQUE NOT NULL,
      email TEXT,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      stripe_customer_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('topup', 'retirement')),
      amount_cents INTEGER NOT NULL,
      description TEXT,
      stripe_session_id TEXT,
      retirement_tx_hash TEXT,
      credit_class TEXT,
      credits_retired REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      stripe_subscription_id TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL CHECK(plan IN ('seedling', 'grove', 'forest', 'dabbler', 'builder', 'agent')),
      amount_cents INTEGER NOT NULL,
      billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_interval IN ('monthly', 'yearly')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'cancelled')),
      current_period_start TEXT,
      current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
    CREATE INDEX IF NOT EXISTS idx_subscribers_stripe_id ON subscribers(stripe_subscription_id);

    CREATE TABLE IF NOT EXISTS pool_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'partial', 'failed')),
      total_revenue_cents INTEGER NOT NULL DEFAULT 0,
      total_spent_cents INTEGER NOT NULL DEFAULT 0,
      carbon_credits_retired REAL DEFAULT 0,
      carbon_tx_hash TEXT,
      biodiversity_credits_retired REAL DEFAULT 0,
      biodiversity_tx_hash TEXT,
      uss_credits_retired REAL DEFAULT 0,
      uss_tx_hash TEXT,
      burn_allocation_cents INTEGER NOT NULL DEFAULT 0,
      burn_tx_hash TEXT,
      ops_allocation_cents INTEGER NOT NULL DEFAULT 0,
      carry_forward_cents INTEGER NOT NULL DEFAULT 0,
      subscriber_count INTEGER NOT NULL DEFAULT 0,
      dry_run INTEGER NOT NULL DEFAULT 0,
      error_log TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_run_id INTEGER NOT NULL REFERENCES pool_runs(id),
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
      contribution_cents INTEGER NOT NULL,
      carbon_credits REAL DEFAULT 0,
      biodiversity_credits REAL DEFAULT 0,
      uss_credits REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attributions_pool_run ON attributions(pool_run_id);
    CREATE INDEX IF NOT EXISTS idx_attributions_subscriber ON attributions(subscriber_id);

    CREATE TABLE IF NOT EXISTS burns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_run_id INTEGER NOT NULL REFERENCES pool_runs(id),
      allocation_cents INTEGER NOT NULL,
      amount_uregen TEXT NOT NULL DEFAULT '0',
      amount_regen REAL NOT NULL DEFAULT 0,
      regen_price_usd REAL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped', 'failed')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_burns_pool_run ON burns(pool_run_id);
    CREATE INDEX IF NOT EXISTS idx_burns_status ON burns(status);

    CREATE TABLE IF NOT EXISTS pool_run_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_run_id INTEGER NOT NULL REFERENCES pool_runs(id),
      batch_denom TEXT NOT NULL,
      credit_class_id TEXT NOT NULL,
      credit_type_abbrev TEXT NOT NULL,
      budget_cents INTEGER NOT NULL DEFAULT 0,
      spent_cents INTEGER NOT NULL DEFAULT 0,
      credits_retired REAL NOT NULL DEFAULT 0,
      sell_order_id TEXT,
      tx_hash TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pool_run_batches_run ON pool_run_batches(pool_run_id);

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_time_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

    CREATE TABLE IF NOT EXISTS magic_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);

    CREATE TABLE IF NOT EXISTS beta_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'comment' CHECK(category IN ('bug', 'suggestion', 'comment')),
      page TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriber_retirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
      regen_address TEXT NOT NULL,
      gross_amount_cents INTEGER NOT NULL,
      net_amount_cents INTEGER NOT NULL,
      credits_budget_cents INTEGER NOT NULL,
      burn_budget_cents INTEGER NOT NULL,
      ops_budget_cents INTEGER NOT NULL,
      total_credits_retired REAL NOT NULL DEFAULT 0,
      total_spent_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_retirements_subscriber ON subscriber_retirements(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_sub_retirements_created ON subscriber_retirements(created_at);

    CREATE TABLE IF NOT EXISTS subscriber_retirement_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retirement_id INTEGER NOT NULL REFERENCES subscriber_retirements(id),
      batch_denom TEXT NOT NULL,
      credit_class_id TEXT NOT NULL,
      credit_type_abbrev TEXT NOT NULL,
      budget_cents INTEGER NOT NULL DEFAULT 0,
      spent_cents INTEGER NOT NULL DEFAULT 0,
      credits_retired REAL NOT NULL DEFAULT 0,
      buy_tx_hash TEXT,
      send_retire_tx_hash TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_ret_batches_retirement ON subscriber_retirement_batches(retirement_id);

    CREATE TABLE IF NOT EXISTS scheduled_retirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
      gross_amount_cents INTEGER NOT NULL,
      net_amount_cents INTEGER NOT NULL DEFAULT 0,
      billing_interval TEXT NOT NULL DEFAULT 'yearly',
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      retirement_id INTEGER REFERENCES subscriber_retirements(id),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      executed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_retirements_subscriber ON scheduled_retirements(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_retirements_status ON scheduled_retirements(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_retirements_date ON scheduled_retirements(scheduled_date);

    CREATE TABLE IF NOT EXISTS monthly_credit_selection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      batch1_denom TEXT NOT NULL,
      batch1_name TEXT NOT NULL,
      batch2_denom TEXT NOT NULL,
      batch2_name TEXT NOT NULL,
      batch3_denom TEXT NOT NULL,
      batch3_name TEXT NOT NULL,
      featured_batch INTEGER NOT NULL DEFAULT 3 CHECK(featured_batch IN (1, 2, 3)),
      confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_monthly_credits_month ON monthly_credit_selection(month);

    CREATE TABLE IF NOT EXISTS burn_accumulator (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_cents INTEGER NOT NULL,
      executed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_burn_accumulator_executed ON burn_accumulator(executed);

    CREATE TABLE IF NOT EXISTS referral_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_user_id INTEGER NOT NULL REFERENCES users(id),
      referred_user_id INTEGER NOT NULL REFERENCES users(id),
      reward_type TEXT NOT NULL DEFAULT 'extra_credit_retirement',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fulfilled', 'expired')),
      retirement_tx_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      fulfilled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);
  `);

  // Migrations for existing DBs — add billing_interval to subscribers table
  const subCols = (_db.pragma("table_info(subscribers)") as Array<{ name: string }>).map((c) => c.name);
  if (!subCols.includes("billing_interval")) {
    _db.exec(`ALTER TABLE subscribers ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'monthly'`);
    console.log("Migration: added billing_interval column to subscribers");
  }

  // Migrations for existing DBs — add referral columns to users table
  const existingCols = (_db.pragma("table_info(users)") as Array<{ name: string }>).map((c) => c.name);

  if (!existingCols.includes("referral_code")) {
    _db.exec(`ALTER TABLE users ADD COLUMN referral_code TEXT`);
    console.log("Migration: added referral_code column");
  }

  _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`);

  if (!existingCols.includes("referred_by")) {
    _db.exec(`ALTER TABLE users ADD COLUMN referred_by INTEGER`);
    console.log("Migration: added referred_by column");
  }

  // Migration: update subscribers CHECK constraint to include new plan names
  const subSchema = (_db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='subscribers'").get() as { sql: string } | undefined)?.sql ?? "";
  if (subSchema.includes("plan IN ('seedling', 'grove', 'forest')") && !subSchema.includes("'dabbler'")) {
    _db.exec(`
      CREATE TABLE subscribers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        stripe_subscription_id TEXT UNIQUE NOT NULL,
        plan TEXT NOT NULL CHECK(plan IN ('seedling', 'grove', 'forest', 'dabbler', 'builder', 'agent')),
        amount_cents INTEGER NOT NULL,
        billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_interval IN ('monthly', 'yearly')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'cancelled')),
        current_period_start TEXT,
        current_period_end TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO subscribers_new SELECT id, user_id, stripe_subscription_id, plan, amount_cents, billing_interval, status, current_period_start, current_period_end, created_at, updated_at FROM subscribers;
      DROP TABLE subscribers;
      ALTER TABLE subscribers_new RENAME TO subscribers;
      CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
      CREATE INDEX IF NOT EXISTS idx_subscribers_stripe_id ON subscribers(stripe_subscription_id);
    `);
    console.log("Migration: updated subscribers CHECK constraint to include dabbler/builder/agent plans");
  }

  // Migration: add regen_address to subscribers
  if (!subCols.includes("regen_address")) {
    _db.exec(`ALTER TABLE subscribers ADD COLUMN regen_address TEXT`);
    console.log("Migration: added regen_address column to subscribers");
  }

  // Migration: add display_name to users
  if (!existingCols.includes("display_name")) {
    _db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
    console.log("Migration: added display_name column to users");
  }

  // Backfill referral codes for users that don't have one
  const usersWithoutCodes = _db.prepare(
    "SELECT id FROM users WHERE referral_code IS NULL"
  ).all() as { id: number }[];
  for (const u of usersWithoutCodes) {
    _db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(
      generateReferralCode(),
      u.id
    );
  }
  if (usersWithoutCodes.length > 0) {
    console.log(`Migration: backfilled ${usersWithoutCodes.length} referral codes`);
  }

  return _db;
}

export function generateApiKey(): string {
  return "rfa_" + randomBytes(24).toString("hex");
}

export function generateReferralCode(): string {
  return "ref_" + randomBytes(8).toString("hex");
}

export interface User {
  id: number;
  api_key: string;
  email: string | null;
  balance_cents: number;
  stripe_customer_id: string | null;
  referral_code: string;
  referred_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: "topup" | "retirement";
  amount_cents: number;
  description: string | null;
  stripe_session_id: string | null;
  retirement_tx_hash: string | null;
  credit_class: string | null;
  credits_retired: number | null;
  created_at: string;
}

export function getUserByApiKey(db: Database.Database, apiKey: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE api_key = ?").get(apiKey) as User | undefined;
}

export function getUserByEmail(db: Database.Database, email: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(email) as User | undefined;
}

export function createUser(
  db: Database.Database,
  email: string | null,
  stripeCustomerId: string | null,
  referredByUserId?: number
): User {
  const apiKey = generateApiKey();
  const referralCode = generateReferralCode();
  const normalizedEmail = email ? email.toLowerCase() : null;
  const stmt = db.prepare(
    "INSERT INTO users (api_key, email, stripe_customer_id, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)"
  );
  const result = stmt.run(apiKey, normalizedEmail, stripeCustomerId, referralCode, referredByUserId ?? null);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as User;
}

export function creditBalance(
  db: Database.Database,
  userId: number,
  amountCents: number,
  stripeSessionId: string,
  description: string
): void {
  const txn = db.transaction(() => {
    db.prepare(
      "UPDATE users SET balance_cents = balance_cents + ?, updated_at = datetime('now') WHERE id = ?"
    ).run(amountCents, userId);

    db.prepare(
      "INSERT INTO transactions (user_id, type, amount_cents, description, stripe_session_id) VALUES (?, 'topup', ?, ?, ?)"
    ).run(userId, amountCents, description, stripeSessionId);
  });
  txn();
}

export function debitBalance(
  db: Database.Database,
  userId: number,
  amountCents: number,
  description: string,
  retirementTxHash?: string,
  creditClass?: string,
  creditsRetired?: number
): { success: boolean; balance_cents: number } {
  const result = { success: false, balance_cents: 0 };

  const txn = db.transaction(() => {
    const user = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(userId) as { balance_cents: number } | undefined;
    if (!user || user.balance_cents < amountCents) {
      result.balance_cents = user?.balance_cents ?? 0;
      return;
    }

    db.prepare(
      "UPDATE users SET balance_cents = balance_cents - ?, updated_at = datetime('now') WHERE id = ?"
    ).run(amountCents, userId);

    db.prepare(
      "INSERT INTO transactions (user_id, type, amount_cents, description, retirement_tx_hash, credit_class, credits_retired) VALUES (?, 'retirement', ?, ?, ?, ?, ?)"
    ).run(userId, amountCents, description, retirementTxHash ?? null, creditClass ?? null, creditsRetired ?? null);

    result.success = true;
    result.balance_cents = user.balance_cents - amountCents;
  });
  txn();

  return result;
}

export function getTransactions(db: Database.Database, userId: number, limit = 20): Transaction[] {
  return db.prepare(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(userId, limit) as Transaction[];
}

// --- Subscriber types and helpers ---

export interface Subscriber {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan: "seedling" | "grove" | "forest" | "dabbler" | "builder" | "agent";
  amount_cents: number;
  billing_interval: "monthly" | "yearly";
  status: "active" | "paused" | "cancelled";
  regen_address: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export function getActiveSubscribers(db: Database.Database): Subscriber[] {
  return db.prepare("SELECT * FROM subscribers WHERE status = 'active'").all() as Subscriber[];
}

export function getSubscriberByStripeId(db: Database.Database, stripeSubId: string): Subscriber | undefined {
  return db.prepare("SELECT * FROM subscribers WHERE stripe_subscription_id = ?").get(stripeSubId) as Subscriber | undefined;
}

export function createSubscriber(
  db: Database.Database,
  userId: number,
  stripeSubId: string,
  plan: string,
  amountCents: number,
  periodStart?: string,
  periodEnd?: string,
  billingInterval: "monthly" | "yearly" = "monthly"
): Subscriber {
  db.prepare(
    "INSERT INTO subscribers (user_id, stripe_subscription_id, plan, amount_cents, billing_interval, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, stripeSubId, plan, amountCents, billingInterval, periodStart ?? null, periodEnd ?? null);
  return db.prepare("SELECT * FROM subscribers WHERE stripe_subscription_id = ?").get(stripeSubId) as Subscriber;
}

export function updateSubscriberStatus(db: Database.Database, stripeSubId: string, status: string): void {
  db.prepare(
    "UPDATE subscribers SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?"
  ).run(status, stripeSubId);
}

export function updateSubscriber(
  db: Database.Database,
  stripeSubId: string,
  updates: { plan?: string; amount_cents?: number; billing_interval?: string; status?: string; current_period_start?: string; current_period_end?: string }
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (updates.plan !== undefined) { sets.push("plan = ?"); values.push(updates.plan); }
  if (updates.amount_cents !== undefined) { sets.push("amount_cents = ?"); values.push(updates.amount_cents); }
  if (updates.billing_interval !== undefined) { sets.push("billing_interval = ?"); values.push(updates.billing_interval); }
  if (updates.status !== undefined) { sets.push("status = ?"); values.push(updates.status); }
  if (updates.current_period_start !== undefined) { sets.push("current_period_start = ?"); values.push(updates.current_period_start); }
  if (updates.current_period_end !== undefined) { sets.push("current_period_end = ?"); values.push(updates.current_period_end); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(stripeSubId);
  db.prepare(`UPDATE subscribers SET ${sets.join(", ")} WHERE stripe_subscription_id = ?`).run(...values);
}

export function setSubscriberRegenAddress(db: Database.Database, subscriberId: number, regenAddress: string): void {
  db.prepare(
    "UPDATE subscribers SET regen_address = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(regenAddress, subscriberId);
}

// --- Subscriber retirement types and helpers ---

export interface SubscriberRetirement {
  id: number;
  subscriber_id: number;
  regen_address: string;
  gross_amount_cents: number;
  net_amount_cents: number;
  credits_budget_cents: number;
  burn_budget_cents: number;
  ops_budget_cents: number;
  total_credits_retired: number;
  total_spent_cents: number;
  created_at: string;
}

export function getSubscriberRetirements(db: Database.Database, subscriberId: number): SubscriberRetirement[] {
  return db.prepare(
    "SELECT * FROM subscriber_retirements WHERE subscriber_id = ? ORDER BY created_at DESC"
  ).all(subscriberId) as SubscriberRetirement[];
}

export function getCumulativeSubscriberRetirements(db: Database.Database, subscriberId: number): {
  total_credits_retired: number;
  total_spent_cents: number;
  total_gross_cents: number;
  retirement_count: number;
} {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_credits_retired), 0) AS total_credits_retired,
      COALESCE(SUM(total_spent_cents), 0) AS total_spent_cents,
      COALESCE(SUM(gross_amount_cents), 0) AS total_gross_cents,
      COUNT(*) AS retirement_count
    FROM subscriber_retirements
    WHERE subscriber_id = ?
  `).get(subscriberId) as { total_credits_retired: number; total_spent_cents: number; total_gross_cents: number; retirement_count: number } | undefined;
  return row ?? { total_credits_retired: 0, total_spent_cents: 0, total_gross_cents: 0, retirement_count: 0 };
}

// --- Monthly credit selection types and helpers ---

export interface MonthlyCreditSelection {
  id: number;
  month: string;
  batch1_denom: string;
  batch1_name: string;
  batch2_denom: string;
  batch2_name: string;
  batch3_denom: string;
  batch3_name: string;
  featured_batch: 1 | 2 | 3;
  confirmed: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get the credit selection for a given month.
 * Falls back to the most recent previous month if no selection exists.
 */
export function getMonthlyCreditSelection(db: Database.Database, month: string): MonthlyCreditSelection | undefined {
  // Try exact month first
  const exact = db.prepare(
    "SELECT * FROM monthly_credit_selection WHERE month = ?"
  ).get(month) as MonthlyCreditSelection | undefined;
  if (exact) return exact;

  // Fall back to most recent previous month
  return db.prepare(
    "SELECT * FROM monthly_credit_selection WHERE month < ? ORDER BY month DESC LIMIT 1"
  ).get(month) as MonthlyCreditSelection | undefined;
}

export function getAllMonthlyCreditSelections(db: Database.Database): MonthlyCreditSelection[] {
  return db.prepare(
    "SELECT * FROM monthly_credit_selection ORDER BY month ASC"
  ).all() as MonthlyCreditSelection[];
}

export function upsertMonthlyCreditSelection(
  db: Database.Database,
  month: string,
  batch1Denom: string, batch1Name: string,
  batch2Denom: string, batch2Name: string,
  batch3Denom: string, batch3Name: string,
  featuredBatch: 1 | 2 | 3 = 3
): MonthlyCreditSelection {
  db.prepare(`
    INSERT INTO monthly_credit_selection (month, batch1_denom, batch1_name, batch2_denom, batch2_name, batch3_denom, batch3_name, featured_batch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET
      batch1_denom = excluded.batch1_denom, batch1_name = excluded.batch1_name,
      batch2_denom = excluded.batch2_denom, batch2_name = excluded.batch2_name,
      batch3_denom = excluded.batch3_denom, batch3_name = excluded.batch3_name,
      featured_batch = excluded.featured_batch, updated_at = datetime('now')
  `).run(month, batch1Denom, batch1Name, batch2Denom, batch2Name, batch3Denom, batch3Name, featuredBatch);
  return db.prepare("SELECT * FROM monthly_credit_selection WHERE month = ?").get(month) as MonthlyCreditSelection;
}

export function confirmMonthlyCreditSelection(db: Database.Database, month: string): void {
  db.prepare(
    "UPDATE monthly_credit_selection SET confirmed = 1, updated_at = datetime('now') WHERE month = ?"
  ).run(month);
}

// --- Scheduled retirement types and helpers ---

export interface ScheduledRetirement {
  id: number;
  subscriber_id: number;
  gross_amount_cents: number;
  net_amount_cents: number;
  billing_interval: "monthly" | "yearly";
  scheduled_date: string;
  status: "pending" | "running" | "completed" | "failed";
  retirement_id: number | null;
  error: string | null;
  created_at: string;
  executed_at: string | null;
}

export function createScheduledRetirement(
  db: Database.Database,
  subscriberId: number,
  grossAmountCents: number,
  netAmountCents: number,
  scheduledDate: string,
  billingInterval: "monthly" | "yearly" = "yearly"
): ScheduledRetirement {
  const result = db.prepare(
    "INSERT INTO scheduled_retirements (subscriber_id, gross_amount_cents, net_amount_cents, billing_interval, scheduled_date) VALUES (?, ?, ?, ?, ?)"
  ).run(subscriberId, grossAmountCents, netAmountCents, billingInterval, scheduledDate);
  return db.prepare("SELECT * FROM scheduled_retirements WHERE id = ?").get(result.lastInsertRowid) as ScheduledRetirement;
}

export function getDueScheduledRetirements(db: Database.Database): ScheduledRetirement[] {
  return db.prepare(
    "SELECT sr.* FROM scheduled_retirements sr JOIN subscribers s ON sr.subscriber_id = s.id WHERE sr.status = 'pending' AND sr.scheduled_date <= datetime('now') AND s.status = 'active' ORDER BY sr.scheduled_date ASC"
  ).all() as ScheduledRetirement[];
}

export function updateScheduledRetirement(
  db: Database.Database,
  id: number,
  updates: Partial<Pick<ScheduledRetirement, "status" | "retirement_id" | "error" | "executed_at">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE scheduled_retirements SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function cancelScheduledRetirements(db: Database.Database, subscriberId: number): number {
  const result = db.prepare(
    "UPDATE scheduled_retirements SET status = 'failed', error = 'subscription_cancelled' WHERE subscriber_id = ? AND status = 'pending'"
  ).run(subscriberId);
  return result.changes;
}

export function getScheduledRetirementsBySubscriber(db: Database.Database, subscriberId: number): ScheduledRetirement[] {
  return db.prepare(
    "SELECT * FROM scheduled_retirements WHERE subscriber_id = ? ORDER BY scheduled_date ASC"
  ).all(subscriberId) as ScheduledRetirement[];
}

// --- Pool run types and helpers ---

export interface PoolRun {
  id: number;
  run_date: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  total_revenue_cents: number;
  total_spent_cents: number;
  carbon_credits_retired: number;
  carbon_tx_hash: string | null;
  biodiversity_credits_retired: number;
  biodiversity_tx_hash: string | null;
  uss_credits_retired: number;
  uss_tx_hash: string | null;
  burn_allocation_cents: number;
  burn_tx_hash: string | null;
  ops_allocation_cents: number;
  carry_forward_cents: number;
  subscriber_count: number;
  dry_run: number;
  error_log: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createPoolRun(db: Database.Database, dryRun: boolean): PoolRun {
  const runDate = new Date().toISOString().split("T")[0];
  db.prepare(
    "INSERT INTO pool_runs (run_date, status, dry_run) VALUES (?, 'running', ?)"
  ).run(runDate, dryRun ? 1 : 0);
  return db.prepare("SELECT * FROM pool_runs ORDER BY id DESC LIMIT 1").get() as PoolRun;
}

export function updatePoolRun(
  db: Database.Database,
  id: number,
  updates: Partial<Pick<PoolRun,
    "status" | "total_revenue_cents" | "total_spent_cents" |
    "carbon_credits_retired" | "carbon_tx_hash" |
    "biodiversity_credits_retired" | "biodiversity_tx_hash" |
    "uss_credits_retired" | "uss_tx_hash" |
    "burn_allocation_cents" | "burn_tx_hash" | "ops_allocation_cents" |
    "carry_forward_cents" | "subscriber_count" | "error_log" | "completed_at"
  >>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE pool_runs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getLastPoolRun(db: Database.Database): PoolRun | undefined {
  return db.prepare("SELECT * FROM pool_runs ORDER BY id DESC LIMIT 1").get() as PoolRun | undefined;
}

// --- Attribution types and helpers ---

export interface Attribution {
  id: number;
  pool_run_id: number;
  subscriber_id: number;
  contribution_cents: number;
  carbon_credits: number;
  biodiversity_credits: number;
  uss_credits: number;
  created_at: string;
}

export function createAttribution(
  db: Database.Database,
  poolRunId: number,
  subscriberId: number,
  contributionCents: number
): Attribution {
  const result = db.prepare(
    "INSERT INTO attributions (pool_run_id, subscriber_id, contribution_cents) VALUES (?, ?, ?)"
  ).run(poolRunId, subscriberId, contributionCents);
  return db.prepare("SELECT * FROM attributions WHERE id = ?").get(result.lastInsertRowid) as Attribution;
}

export function updateAttribution(
  db: Database.Database,
  id: number,
  credits: { carbon_credits?: number; biodiversity_credits?: number; uss_credits?: number }
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (credits.carbon_credits !== undefined) { sets.push("carbon_credits = ?"); values.push(credits.carbon_credits); }
  if (credits.biodiversity_credits !== undefined) { sets.push("biodiversity_credits = ?"); values.push(credits.biodiversity_credits); }
  if (credits.uss_credits !== undefined) { sets.push("uss_credits = ?"); values.push(credits.uss_credits); }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE attributions SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getAttributionsByRun(db: Database.Database, poolRunId: number): Attribution[] {
  return db.prepare("SELECT * FROM attributions WHERE pool_run_id = ?").all(poolRunId) as Attribution[];
}

export function getAttributionsBySubscriber(db: Database.Database, subscriberId: number): Attribution[] {
  return db.prepare(
    "SELECT * FROM attributions WHERE subscriber_id = ? ORDER BY created_at DESC"
  ).all(subscriberId) as Attribution[];
}

// --- Pool run batch helpers ---

export interface PoolRunBatch {
  id: number;
  pool_run_id: number;
  batch_denom: string;
  credit_class_id: string;
  credit_type_abbrev: string;
  budget_cents: number;
  spent_cents: number;
  credits_retired: number;
  sell_order_id: string | null;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
}

export function createPoolRunBatch(
  db: Database.Database,
  poolRunId: number,
  batchDenom: string,
  creditClassId: string,
  creditTypeAbbrev: string,
  budgetCents: number
): PoolRunBatch {
  const result = db.prepare(
    "INSERT INTO pool_run_batches (pool_run_id, batch_denom, credit_class_id, credit_type_abbrev, budget_cents) VALUES (?, ?, ?, ?, ?)"
  ).run(poolRunId, batchDenom, creditClassId, creditTypeAbbrev, budgetCents);
  return db.prepare("SELECT * FROM pool_run_batches WHERE id = ?").get(result.lastInsertRowid) as PoolRunBatch;
}

export function updatePoolRunBatch(
  db: Database.Database,
  id: number,
  updates: Partial<Pick<PoolRunBatch, "spent_cents" | "credits_retired" | "sell_order_id" | "tx_hash" | "error">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE pool_run_batches SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getPoolRunBatches(db: Database.Database, poolRunId: number): PoolRunBatch[] {
  return db.prepare("SELECT * FROM pool_run_batches WHERE pool_run_id = ? ORDER BY credit_type_abbrev, batch_denom").all(poolRunId) as PoolRunBatch[];
}

// --- Email helpers ---

export interface SubscriberWithEmail {
  subscriber_id: number;
  user_email: string;
  plan: string;
  amount_cents: number;
  stripe_subscription_id: string;
}

export function getSubscribersWithEmails(db: Database.Database, subscriberIds: number[]): SubscriberWithEmail[] {
  if (subscriberIds.length === 0) return [];
  const placeholders = subscriberIds.map(() => "?").join(", ");
  return db.prepare(`
    SELECT
      s.id AS subscriber_id,
      u.email AS user_email,
      s.plan,
      s.amount_cents,
      s.stripe_subscription_id
    FROM subscribers s
    JOIN users u ON s.user_id = u.id
    WHERE s.id IN (${placeholders}) AND u.email IS NOT NULL
  `).all(...subscriberIds) as SubscriberWithEmail[];
}

export interface CumulativeAttribution {
  total_carbon: number;
  total_biodiversity: number;
  total_uss: number;
  total_contribution_cents: number;
  months_active: number;
}

// --- Burn types and helpers ---

export interface Burn {
  id: number;
  pool_run_id: number;
  allocation_cents: number;
  amount_uregen: string;
  amount_regen: number;
  regen_price_usd: number | null;
  tx_hash: string | null;
  status: "pending" | "completed" | "skipped" | "failed";
  error: string | null;
  created_at: string;
}

export function createBurn(
  db: Database.Database,
  poolRunId: number,
  allocationCents: number
): Burn {
  const result = db.prepare(
    "INSERT INTO burns (pool_run_id, allocation_cents) VALUES (?, ?)"
  ).run(poolRunId, allocationCents);
  return db.prepare("SELECT * FROM burns WHERE id = ?").get(result.lastInsertRowid) as Burn;
}

export function updateBurn(
  db: Database.Database,
  id: number,
  updates: Partial<Pick<Burn, "amount_uregen" | "amount_regen" | "regen_price_usd" | "tx_hash" | "status" | "error">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE burns SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getBurnsByPoolRun(db: Database.Database, poolRunId: number): Burn[] {
  return db.prepare("SELECT * FROM burns WHERE pool_run_id = ?").all(poolRunId) as Burn[];
}

export function getTotalBurnedRegen(db: Database.Database): { total_regen: number; total_burns: number } {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(amount_regen), 0) AS total_regen,
      COUNT(*) AS total_burns
    FROM burns
    WHERE status = 'completed'
  `).get() as { total_regen: number; total_burns: number } | undefined;
  return row ?? { total_regen: 0, total_burns: 0 };
}

export function getCumulativeAttribution(db: Database.Database, subscriberId: number): CumulativeAttribution {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(carbon_credits), 0) AS total_carbon,
      COALESCE(SUM(biodiversity_credits), 0) AS total_biodiversity,
      COALESCE(SUM(uss_credits), 0) AS total_uss,
      COALESCE(SUM(contribution_cents), 0) AS total_contribution_cents,
      COUNT(DISTINCT pool_run_id) AS months_active
    FROM attributions
    WHERE subscriber_id = ?
  `).get(subscriberId) as CumulativeAttribution | undefined;

  return row ?? {
    total_carbon: 0,
    total_biodiversity: 0,
    total_uss: 0,
    total_contribution_cents: 0,
    months_active: 0,
  };
}

// --- Community stats helpers ---

export interface CommunityStats {
  total_credits: number;
  total_carbon: number;
  total_biodiversity: number;
  total_uss: number;
  member_count: number;
}

export function getCommunityStats(db: Database.Database): CommunityStats {
  const credits = db.prepare(`
    SELECT
      COALESCE(SUM(carbon_credits), 0) AS total_carbon,
      COALESCE(SUM(biodiversity_credits), 0) AS total_biodiversity,
      COALESCE(SUM(uss_credits), 0) AS total_uss
    FROM attributions
  `).get() as { total_carbon: number; total_biodiversity: number; total_uss: number } | undefined;

  const members = db.prepare(`
    SELECT COUNT(*) AS member_count FROM subscribers WHERE status = 'active'
  `).get() as { member_count: number } | undefined;

  const tc = credits?.total_carbon ?? 0;
  const tb = credits?.total_biodiversity ?? 0;
  const tu = credits?.total_uss ?? 0;

  return {
    total_credits: tc + tb + tu,
    total_carbon: tc,
    total_biodiversity: tb,
    total_uss: tu,
    member_count: members?.member_count ?? 0,
  };
}

// --- API usage tracking ---

export function recordApiUsage(
  db: Database.Database,
  userId: number,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs?: number
): void {
  db.prepare(
    "INSERT INTO api_usage (user_id, endpoint, method, status_code, response_time_ms) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, endpoint, method, statusCode, responseTimeMs ?? null);
}

// --- Dashboard helpers ---

export function getSubscriberByUserId(db: Database.Database, userId: number): Subscriber | undefined {
  return db.prepare(
    "SELECT * FROM subscribers WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as Subscriber | undefined;
}

export interface MonthlyAttribution {
  run_date: string;
  carbon_credits: number;
  biodiversity_credits: number;
  uss_credits: number;
  contribution_cents: number;
  carbon_tx_hash: string | null;
  biodiversity_tx_hash: string | null;
  uss_tx_hash: string | null;
}

export function getMonthlyAttributions(db: Database.Database, subscriberId: number): MonthlyAttribution[] {
  return db.prepare(`
    SELECT
      pr.run_date,
      a.carbon_credits,
      a.biodiversity_credits,
      a.uss_credits,
      a.contribution_cents,
      pr.carbon_tx_hash,
      pr.biodiversity_tx_hash,
      pr.uss_tx_hash
    FROM attributions a
    JOIN pool_runs pr ON a.pool_run_id = pr.id
    WHERE a.subscriber_id = ?
    ORDER BY pr.run_date ASC
  `).all(subscriberId) as MonthlyAttribution[];
}

// --- Referral helpers ---

export function getUserByReferralCode(db: Database.Database, code: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE referral_code = ?").get(code) as User | undefined;
}

export function setUserReferredBy(db: Database.Database, userId: number, referrerUserId: number): void {
  db.prepare(
    "UPDATE users SET referred_by = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(referrerUserId, userId);
}

export interface ReferralReward {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  reward_type: string;
  status: "pending" | "fulfilled" | "expired";
  retirement_tx_hash: string | null;
  created_at: string;
  fulfilled_at: string | null;
}

export function createReferralReward(
  db: Database.Database,
  referrerUserId: number,
  referredUserId: number,
  rewardType: string = "extra_credit_retirement"
): ReferralReward {
  const result = db.prepare(
    "INSERT INTO referral_rewards (referrer_user_id, referred_user_id, reward_type) VALUES (?, ?, ?)"
  ).run(referrerUserId, referredUserId, rewardType);
  return db.prepare("SELECT * FROM referral_rewards WHERE id = ?").get(result.lastInsertRowid) as ReferralReward;
}

export function fulfillReferralReward(
  db: Database.Database,
  rewardId: number,
  retirementTxHash: string
): void {
  db.prepare(
    "UPDATE referral_rewards SET status = 'fulfilled', retirement_tx_hash = ?, fulfilled_at = datetime('now') WHERE id = ?"
  ).run(retirementTxHash, rewardId);
}

export function getReferralCount(db: Database.Database, userId: number): number {
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE referred_by = ?"
  ).get(userId) as { count: number } | undefined;
  return row?.count ?? 0;
}

// --- Magic link helpers ---

export function createMagicLinkToken(db: Database.Database, email: string, ttlMinutes: number): string {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  db.prepare(
    "INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)"
  ).run(token, email, expiresAt);
  return token;
}

export function verifyMagicLinkToken(db: Database.Database, token: string): string | null {
  // Atomic update + fetch in one query — prevents TOCTOU race
  const row = db.prepare(
    "UPDATE magic_links SET used = 1 WHERE token = ? AND used = 0 AND expires_at > datetime('now') RETURNING email"
  ).get(token) as { email: string } | undefined;

  return row?.email ?? null;
}
