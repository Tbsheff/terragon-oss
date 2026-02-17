import { db } from "@/db";
import { kvStore } from "@/db/schema";
import { eq, inArray, like } from "drizzle-orm";

export type SessionMeta = {
  name?: string;
  githubRepoFullName?: string;
  githubBranch?: string;
  baseBranch?: string;
  pipelineState?: string;
  tokenUsage?: string;
  environmentId?: string;
  archived?: boolean;
  parentThreadId?: string;
  forkMessageIndex?: number;
  initialPrompt?: string;
};

function sessionMetaKey(sessionKey: string): string {
  return `session-meta:${sessionKey}`;
}

export async function getSessionMeta(
  sessionKey: string,
): Promise<SessionMeta | null> {
  const key = sessionMetaKey(sessionKey);
  const rows = await db
    .select()
    .from(kvStore)
    .where(eq(kvStore.key, key))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as SessionMeta;
  } catch {
    return null;
  }
}

export async function setSessionMeta(
  sessionKey: string,
  meta: SessionMeta,
): Promise<void> {
  const key = sessionMetaKey(sessionKey);
  const now = new Date().toISOString();
  const value = JSON.stringify(meta);
  await db
    .insert(kvStore)
    .values({ key, value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: kvStore.key,
      set: { value, updatedAt: now },
    });
}

export async function deleteSessionMeta(sessionKey: string): Promise<void> {
  await db.delete(kvStore).where(eq(kvStore.key, sessionMetaKey(sessionKey)));
}

/**
 * Load all session metadata entries from the kvStore.
 * Returns a Map of sessionKey → SessionMeta for every "session-meta:*" row.
 */
export async function getAllSessionMeta(): Promise<Map<string, SessionMeta>> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(like(kvStore.key, "session-meta:%"));

  const metaMap = new Map<string, SessionMeta>();
  for (const row of rows) {
    const sessionKey = row.key.replace("session-meta:", "");
    try {
      metaMap.set(sessionKey, JSON.parse(row.value) as SessionMeta);
    } catch {
      // Skip invalid JSON
    }
  }
  return metaMap;
}

export async function batchGetSessionMeta(
  sessionKeys: string[],
): Promise<Map<string, SessionMeta>> {
  if (sessionKeys.length === 0) return new Map();

  const keys = sessionKeys.map((k) => sessionMetaKey(k));
  const rows = await db
    .select()
    .from(kvStore)
    .where(inArray(kvStore.key, keys));

  const metaMap = new Map<string, SessionMeta>();
  for (const row of rows) {
    const sessionKey = row.key.replace("session-meta:", "");
    try {
      metaMap.set(sessionKey, JSON.parse(row.value) as SessionMeta);
    } catch {
      // Skip invalid JSON
    }
  }
  return metaMap;
}
