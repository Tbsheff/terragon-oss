"use server";

import { db } from "@/db";
import { thread, threadChat } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

export async function listThreads(opts?: {
  archived?: boolean;
}): Promise<ThreadListItem[]> {
  const conditions = [];
  if (opts?.archived !== undefined) {
    conditions.push(eq(thread.archived, opts.archived));
  }

  const rows = await db
    .select()
    .from(thread)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(thread.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    agent: r.agent,
    model: r.model,
    githubRepoFullName: r.githubRepoFullName,
    pipelineState: r.pipelineState,
    tokenUsage: r.tokenUsage,
    archived: r.archived,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  const rows = await db.select().from(thread).where(eq(thread.id, id)).limit(1);

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    agent: r.agent,
    model: r.model,
    githubRepoFullName: r.githubRepoFullName,
    githubBranch: r.githubBranch,
    baseBranch: r.baseBranch,
    pipelineState: r.pipelineState,
    tokenUsage: r.tokenUsage,
    environmentId: r.environmentId,
    archived: r.archived,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createThread(opts: {
  name: string;
  githubRepoFullName?: string;
  model?: string;
  pipelineTemplateId?: string;
}): Promise<{ id: string }> {
  const id = nanoid();
  const chatId = nanoid();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(thread).values({
      id,
      name: opts.name,
      status: "draft",
      agent: "claudeCode",
      model: opts.model ?? null,
      githubRepoFullName: opts.githubRepoFullName ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(threadChat).values({
      id: chatId,
      threadId: id,
      agent: "claudeCode",
      model: opts.model ?? null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  });

  return { id };
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
    archived: boolean;
  }>,
): Promise<void> {
  await db
    .update(thread)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    } as typeof thread.$inferInsert)
    .where(eq(thread.id, id));
}

export async function archiveThread(id: string): Promise<void> {
  await updateThread(id, { archived: true });
}

export async function unarchiveThread(id: string): Promise<void> {
  await updateThread(id, { archived: false });
}

export async function deleteThread(id: string): Promise<void> {
  // Thread chats are cascade deleted
  await db.delete(thread).where(eq(thread.id, id));
}

export async function getThreadChats(threadId: string) {
  return db
    .select()
    .from(threadChat)
    .where(eq(threadChat.threadId, threadId))
    .orderBy(threadChat.createdAt);
}

export async function updateThreadChat(
  chatId: string,
  data: Partial<{
    status: string;
    messages: string;
    sessionKey: string;
    pipelineStage: string;
    errorMessage: string;
  }>,
): Promise<void> {
  await db
    .update(threadChat)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    } as typeof threadChat.$inferInsert)
    .where(eq(threadChat.id, chatId));
}
