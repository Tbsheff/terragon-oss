import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Dual-mode database driver:
 * - If TURSO_DB_URL is set → connect to remote libSQL (sqld on Mac Mini)
 * - Otherwise → fall back to local better-sqlite3
 *
 * Both drivers implement the same Drizzle query API, so we use
 * BetterSQLite3Database as the common type annotation.
 */

type Db = BetterSQLite3Database<typeof schema>;

// ─────────────────────────────────────────────────
// Retry logic for remote libSQL
// ─────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("connect") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === MAX_RETRIES - 1) {
        throw err;
      }
      const delay = Math.min(
        BASE_DELAY_MS * Math.pow(2, attempt),
        MAX_DELAY_MS,
      );
      console.warn(
        `[db] Transient error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
        (err as Error).message,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────
// Database initialization
// ─────────────────────────────────────────────────

function createDb(): Db {
  const tursoUrl = process.env.TURSO_DB_URL;

  if (tursoUrl) {
    // Remote libSQL mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/libsql");

    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Wrap client methods with retry logic for transient failures
    const retryClient = new Proxy(client, {
      get(target: Record<string, unknown>, prop: string) {
        if (prop === "execute" || prop === "batch") {
          return (...args: unknown[]) =>
            withRetry(() => (target[prop] as Function)(...args));
        }
        return target[prop];
      },
    });

    console.log(`[db] Connected to remote libSQL at ${tursoUrl}`);
    return drizzle(retryClient, { schema }) as Db;
  }

  // Local SQLite fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const path = require("path");
  const fs = require("fs");

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "openclaw.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  console.log(`[db] Using local SQLite at ${dbPath}`);
  return drizzle(sqlite, { schema }) as Db;
}

export const db: Db = createDb();
export { schema };
