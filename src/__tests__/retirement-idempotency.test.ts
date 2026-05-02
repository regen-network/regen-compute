import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  cacheRetirementResult,
  getCachedRetirementResult,
  pruneExpiredIdempotencyKeys,
} from "../server/db.js";

/**
 * In-memory SQLite that mimics the production schema for the idempotency
 * cache only. We don't run the full getDb() path here — that would pull
 * in the full subscriber/user/etc. schema, which is overkill for this
 * unit test.
 */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS retirement_idempotency_keys (
      idempotency_key TEXT PRIMARY KEY,
      tx_hash TEXT,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe("retirement idempotency cache", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it("returns null for an unknown key", () => {
    expect(getCachedRetirementResult(db, "missing")).toBeNull();
  });

  it("round-trips a result", () => {
    const result = { status: "success", txHash: "ABC123", creditsRetired: "1.5" };
    cacheRetirementResult(db, "key-1", "ABC123", result);
    const cached = getCachedRetirementResult(db, "key-1");
    expect(cached).not.toBeNull();
    expect(cached!.txHash).toBe("ABC123");
    expect(cached!.result).toEqual(result);
  });

  it("INSERT OR IGNORE preserves the first write under racing duplicates", () => {
    cacheRetirementResult(db, "key-2", "TX_FIRST", { status: "success", txHash: "TX_FIRST" });
    cacheRetirementResult(db, "key-2", "TX_SECOND", { status: "success", txHash: "TX_SECOND" });
    const cached = getCachedRetirementResult(db, "key-2");
    expect(cached!.txHash).toBe("TX_FIRST");
  });

  it("ignores entries older than the TTL", () => {
    cacheRetirementResult(db, "key-old", "TX_OLD", { status: "success" });
    // Backdate the row beyond the 24h TTL.
    db.prepare(
      "UPDATE retirement_idempotency_keys SET created_at = datetime('now', '-25 hours') WHERE idempotency_key = ?"
    ).run("key-old");
    expect(getCachedRetirementResult(db, "key-old")).toBeNull();
  });

  it("survives malformed JSON without throwing", () => {
    db.prepare(
      "INSERT INTO retirement_idempotency_keys (idempotency_key, tx_hash, result_json) VALUES (?, ?, ?)"
    ).run("key-bad", "TX", "{not valid json");
    expect(getCachedRetirementResult(db, "key-bad")).toBeNull();
  });

  it("pruneExpiredIdempotencyKeys removes only expired rows", () => {
    cacheRetirementResult(db, "fresh", "TX1", { status: "success" });
    cacheRetirementResult(db, "stale", "TX2", { status: "success" });
    db.prepare(
      "UPDATE retirement_idempotency_keys SET created_at = datetime('now', '-25 hours') WHERE idempotency_key = ?"
    ).run("stale");
    const removed = pruneExpiredIdempotencyKeys(db);
    expect(removed).toBe(1);
    expect(getCachedRetirementResult(db, "fresh")).not.toBeNull();
    expect(getCachedRetirementResult(db, "stale")).toBeNull();
  });
});

describe("wallet broadcast mutex", () => {
  it("serializes overlapping signAndBroadcast calls per address", async () => {
    // Recreate the same chained-promise pattern used in src/services/wallet.ts
    // and verify two concurrent calls observe in-order entry/exit.
    const chains = new Map<string, Promise<unknown>>();
    async function withWalletLock<T>(address: string, fn: () => Promise<T>): Promise<T> {
      const prior = chains.get(address) ?? Promise.resolve();
      let release: () => void;
      const next = new Promise<void>((r) => { release = r; });
      chains.set(address, next);
      try {
        await prior.catch(() => undefined);
        return await fn();
      } finally {
        release!();
        if (chains.get(address) === next) {
          chains.delete(address);
        }
      }
    }

    const addr = "regen1xyz";
    const events: string[] = [];

    const a = withWalletLock(addr, async () => {
      events.push("a:start");
      await new Promise((r) => setTimeout(r, 30));
      events.push("a:end");
      return "a";
    });
    const b = withWalletLock(addr, async () => {
      events.push("b:start");
      await new Promise((r) => setTimeout(r, 10));
      events.push("b:end");
      return "b";
    });

    const [resA, resB] = await Promise.all([a, b]);
    expect(resA).toBe("a");
    expect(resB).toBe("b");
    // Either a fully completes before b starts, or vice-versa — but never interleaved.
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("does not serialize across different addresses", async () => {
    const chains = new Map<string, Promise<unknown>>();
    async function withWalletLock<T>(address: string, fn: () => Promise<T>): Promise<T> {
      const prior = chains.get(address) ?? Promise.resolve();
      let release: () => void;
      const next = new Promise<void>((r) => { release = r; });
      chains.set(address, next);
      try {
        await prior.catch(() => undefined);
        return await fn();
      } finally {
        release!();
        if (chains.get(address) === next) {
          chains.delete(address);
        }
      }
    }

    const events: string[] = [];
    const a = withWalletLock("addrA", async () => {
      events.push("A:start");
      await new Promise((r) => setTimeout(r, 20));
      events.push("A:end");
    });
    const b = withWalletLock("addrB", async () => {
      events.push("B:start");
      await new Promise((r) => setTimeout(r, 5));
      events.push("B:end");
    });
    await Promise.all([a, b]);
    // B should overlap A (ends earlier) since they hold separate locks.
    expect(events.indexOf("B:end")).toBeLessThan(events.indexOf("A:end"));
  });
});
