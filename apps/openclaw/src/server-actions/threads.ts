"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";
import { db } from "@/db";
import { kvStore } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { OpenClawSession } from "@/lib/openclaw-types";
import {
  getSessionMeta,
  setSessionMeta,
  deleteSessionMeta,
  getAllSessionMeta,
  type SessionMeta,
} from "./session-meta-store";
import { getSettings } from "./settings";

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
  parentThreadId: string | null;
  forkMessageIndex: number | null;
};

// ─────────────────────────────────────────────────
// Map gateway session to ThreadListItem
// ─────────────────────────────────────────────────

function sessionToThreadListItem(
  session: OpenClawSession,
  meta: SessionMeta | null,
): ThreadListItem {
  // Derive richer status from messageCount and lastMessageAt
  let status = "draft";
  if (session.messageCount && session.messageCount > 0) {
    if (session.lastMessageAt) {
      const lastMessageTime = new Date(session.lastMessageAt).getTime();
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTime;
      // If last message was within 60s, consider it "working"
      status = timeSinceLastMessage < 60000 ? "working" : "working-done";
    } else {
      status = "working-done";
    }
  }

  return {
    id: session.key,
    name: meta?.name ?? session.agentId ?? null,
    status,
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

/**
 * Build a ThreadListItem from local metadata alone (no gateway session).
 * Used when the session hasn't been created on the gateway yet or spawn failed.
 */
function metaToThreadListItem(
  sessionKey: string,
  meta: SessionMeta,
): ThreadListItem {
  const now = new Date().toISOString();
  return {
    id: sessionKey,
    name: meta.name ?? null,
    status: "draft",
    agent: "claudeCode",
    model: null,
    githubRepoFullName: meta.githubRepoFullName ?? null,
    pipelineState: meta.pipelineState ?? null,
    tokenUsage: meta.tokenUsage ?? null,
    archived: meta.archived ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────

export async function listThreads(opts?: {
  archived?: boolean;
}): Promise<ThreadListItem[]> {
  // Load all local session metadata first — this is the source of truth
  // for which threads were created through our UI.
  const allMeta = await getAllSessionMeta();

  // Try to enrich with gateway session data
  let sessionMap = new Map<string, OpenClawSession>();
  try {
    const client = getOpenClawClient();
    const sessions = await client.sessionsList();
    for (const s of sessions) {
      sessionMap.set(s.key, s);
    }
  } catch {
    // Gateway unavailable — use local metadata only
  }

  const items: ThreadListItem[] = [];
  for (const [sessionKey, meta] of allMeta) {
    const session = sessionMap.get(sessionKey);
    const item = session
      ? sessionToThreadListItem(session, meta)
      : metaToThreadListItem(sessionKey, meta);

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
  const meta = await getSessionMeta(id);
  // No local metadata means we never created this thread
  if (!meta) return null;

  // Try to enrich with gateway session data
  let base: ThreadListItem;
  try {
    const client = getOpenClawClient();
    const sessions = await client.sessionsList();
    const session = sessions.find((s) => s.key === id);
    base = session
      ? sessionToThreadListItem(session, meta)
      : metaToThreadListItem(id, meta);
  } catch {
    // Gateway unavailable — use local metadata only
    base = metaToThreadListItem(id, meta);
  }

  return {
    ...base,
    githubBranch: meta.githubBranch ?? null,
    baseBranch: meta.baseBranch ?? null,
    environmentId: meta.environmentId ?? null,
    parentThreadId: meta.parentThreadId ?? null,
    forkMessageIndex: meta.forkMessageIndex ?? null,
  };
}

export async function createThread(opts: {
  name: string;
  agentId?: string;
  githubRepoFullName?: string;
  model?: string;
  pipelineTemplateId?: string;
  initialPrompt?: string;
}): Promise<{ id: string }> {
  // Use a deterministic session key
  const { nanoid } = await import("nanoid");
  const sessionKey = `session-${nanoid()}`;

  // Resolve agent: explicit > user default > "claudeCode"
  let agentId = opts.agentId;
  if (!agentId) {
    const s = await getSettings();
    agentId = s?.defaultAgent ?? "claudeCode";
  }

  // Fire-and-forget: try to spawn a session on the gateway.
  // Don't await — thread creation shouldn't block on gateway availability.
  try {
    const client = getOpenClawClient();
    client
      .sessionsSpawn({
        agentId,
        sessionKey,
        model: opts.model,
      })
      .catch(() => {
        // Gateway unavailable or doesn't support sessions.spawn — ignore
      });
  } catch {
    // Client creation failed — ignore
  }

  // Store metadata in kvStore
  await setSessionMeta(sessionKey, {
    name: opts.name,
    githubRepoFullName: opts.githubRepoFullName,
    archived: false,
    initialPrompt: opts.initialPrompt,
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

export async function consumeInitialPrompt(
  threadId: string,
): Promise<string | null> {
  const meta = await getSessionMeta(threadId);
  if (!meta?.initialPrompt) return null;
  const prompt = meta.initialPrompt;
  // Clear the initial prompt so it's only consumed once
  await setSessionMeta(threadId, { ...meta, initialPrompt: undefined });
  return prompt;
}

export async function resetSession(threadId: string): Promise<void> {
  const client = getOpenClawClient();
  try {
    await client.sessionsReset(threadId);
  } catch {
    // Gateway may not support reset — ignore
  }
}

export async function deleteSession(threadId: string): Promise<void> {
  const client = getOpenClawClient();
  try {
    await client.sessionsDelete(threadId);
  } catch {
    // Gateway may not support delete — ignore
  }
  await deleteSessionMeta(threadId);
  // Also clean up pipeline state if any
  await db.delete(kvStore).where(eq(kvStore.key, `pipeline:${threadId}`));
}
