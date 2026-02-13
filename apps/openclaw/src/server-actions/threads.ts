"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";
import { db } from "@/db";
import { kvStore } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { OpenClawSession } from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Types (preserved for React Query compatibility)
// ─────────────────────────────────────────────────

export type ThreadListItem = {
  id: string;
  name: string | null;
  status: string;
  agent: string;
  model: string | null;
  githubRepoFullName: string | null;
  pipelineState: string | null;
  tokenUsage: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThreadDetail = ThreadListItem & {
  githubBranch: string | null;
  baseBranch: string | null;
  environmentId: string | null;
};

// ─────────────────────────────────────────────────
// KV helpers for session metadata
// ─────────────────────────────────────────────────

function sessionMetaKey(sessionKey: string): string {
  return `session-meta:${sessionKey}`;
}

type SessionMeta = {
  name?: string;
  githubRepoFullName?: string;
  githubBranch?: string;
  baseBranch?: string;
  pipelineState?: string;
  tokenUsage?: string;
  environmentId?: string;
  archived?: boolean;
};

async function getSessionMeta(sessionKey: string): Promise<SessionMeta | null> {
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

async function setSessionMeta(
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

async function deleteSessionMeta(sessionKey: string): Promise<void> {
  await db.delete(kvStore).where(eq(kvStore.key, sessionMetaKey(sessionKey)));
}

// ─────────────────────────────────────────────────
// Map gateway session to ThreadListItem
// ─────────────────────────────────────────────────

function sessionToThreadListItem(
  session: OpenClawSession,
  meta: SessionMeta | null,
): ThreadListItem {
  return {
    id: session.key,
    name: meta?.name ?? session.agentId ?? null,
    status: session.lastMessageAt ? "working-done" : "draft",
    agent: session.agentId ?? "claudeCode",
    model: session.model ?? null,
    githubRepoFullName: meta?.githubRepoFullName ?? null,
    pipelineState: meta?.pipelineState ?? null,
    tokenUsage: meta?.tokenUsage ?? null,
    archived: meta?.archived ?? false,
    createdAt: session.createdAt ?? new Date().toISOString(),
    updatedAt:
      session.lastMessageAt ?? session.createdAt ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────

export async function listThreads(opts?: {
  archived?: boolean;
}): Promise<ThreadListItem[]> {
  const client = getOpenClawClient();
  const sessions = await client.sessionsList();

  const items: ThreadListItem[] = [];
  for (const session of sessions) {
    const meta = await getSessionMeta(session.key);

    // Only show sessions created through our UI (have local metadata).
    // Gateway may have many stale sessions from other clients.
    if (!meta) continue;

    const item = sessionToThreadListItem(session, meta);

    // Filter by archived status if requested
    if (opts?.archived !== undefined && item.archived !== opts.archived) {
      continue;
    }

    items.push(item);
  }

  // Sort by updatedAt descending (most recent first)
  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return items;
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  const client = getOpenClawClient();
  const sessions = await client.sessionsList();
  const session = sessions.find((s) => s.key === id);
  if (!session) return null;

  const meta = await getSessionMeta(id);
  const base = sessionToThreadListItem(session, meta);

  return {
    ...base,
    githubBranch: meta?.githubBranch ?? null,
    baseBranch: meta?.baseBranch ?? null,
    environmentId: meta?.environmentId ?? null,
  };
}

export async function createThread(opts: {
  name: string;
  githubRepoFullName?: string;
  model?: string;
  pipelineTemplateId?: string;
}): Promise<{ id: string }> {
  // Use a deterministic session key
  const { nanoid } = await import("nanoid");
  const sessionKey = `session-${nanoid()}`;

  // Store metadata in kvStore
  await setSessionMeta(sessionKey, {
    name: opts.name,
    githubRepoFullName: opts.githubRepoFullName,
    archived: false,
  });

  // Register session with bridge
  try {
    const { getBridge } = await import("@/server/bridge-registry");
    getBridge()?.registerSession(sessionKey, sessionKey);
  } catch {
    // Bridge may not be available
  }

  return { id: sessionKey };
}

export async function updateThread(
  id: string,
  data: Partial<{
    name: string;
    status: string;
    model: string;
    githubRepoFullName: string;
    githubBranch: string;
    baseBranch: string;
    pipelineState: string;
    tokenUsage: string;
    environmentId: string;
    archived: boolean;
  }>,
): Promise<void> {
  const existing = (await getSessionMeta(id)) ?? {};

  // Merge only metadata fields we track locally
  const merged: SessionMeta = {
    ...existing,
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.githubRepoFullName !== undefined
      ? { githubRepoFullName: data.githubRepoFullName }
      : {}),
    ...(data.githubBranch !== undefined
      ? { githubBranch: data.githubBranch }
      : {}),
    ...(data.baseBranch !== undefined ? { baseBranch: data.baseBranch } : {}),
    ...(data.pipelineState !== undefined
      ? { pipelineState: data.pipelineState }
      : {}),
    ...(data.tokenUsage !== undefined ? { tokenUsage: data.tokenUsage } : {}),
    ...(data.environmentId !== undefined
      ? { environmentId: data.environmentId }
      : {}),
    ...(data.archived !== undefined ? { archived: data.archived } : {}),
  };

  await setSessionMeta(id, merged);

  // If model is being updated, also patch the gateway session
  if (data.model !== undefined) {
    try {
      const client = getOpenClawClient();
      await client.sessionsPatch(id, { model: data.model });
    } catch {
      // Gateway may not support patching model — store locally only
    }
  }
}

export async function archiveThread(id: string): Promise<void> {
  await updateThread(id, { archived: true });
}

export async function unarchiveThread(id: string): Promise<void> {
  await updateThread(id, { archived: false });
}

export async function deleteThread(id: string): Promise<void> {
  await deleteSessionMeta(id);
  // Also clean up pipeline state if any
  await db.delete(kvStore).where(eq(kvStore.key, `pipeline:${id}`));
}

export async function getThreadChats(threadId: string) {
  // No longer stored in DB — return empty array.
  // Chat history is fetched directly from gateway via loadChatHistory().
  return [];
}

export async function updateThreadChat(
  _chatId: string,
  _data: Partial<{
    status: string;
    messages: string;
    sessionKey: string;
    pipelineStage: string;
    errorMessage: string;
  }>,
): Promise<void> {
  // No-op: chat state is managed by the gateway.
}
