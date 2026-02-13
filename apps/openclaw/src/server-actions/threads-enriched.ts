"use server";

import { db } from "@/db";
import { thread, githubPR } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export type EnrichedThreadListItem = {
  id: string;
  name: string | null;
  status: string;
  agent: string;
  model: string | null;
  githubRepoFullName: string | null;
  pipelineState: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  latestPR: {
    prNumber: number;
    prStatus: string;
    prUrl: string | null;
  } | null;
  hasError: boolean;
};

export async function listThreadsEnriched(): Promise<EnrichedThreadListItem[]> {
  // Query threads with latest PR info via LEFT JOIN
  // We use a subquery approach: get threads, then enrich with PR + error data
  const rows = await db
    .select({
      id: thread.id,
      name: thread.name,
      status: thread.status,
      agent: thread.agent,
      model: thread.model,
      githubRepoFullName: thread.githubRepoFullName,
      pipelineState: thread.pipelineState,
      archived: thread.archived,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      prNumber: githubPR.prNumber,
      prStatus: githubPR.prStatus,
      prUrl: githubPR.prUrl,
      prCreatedAt: githubPR.createdAt,
      errorCount:
        sql<number>`(SELECT COUNT(*) FROM thread_chat WHERE thread_chat.thread_id = ${thread.id} AND thread_chat.error_message IS NOT NULL)`.as(
          "error_count",
        ),
    })
    .from(thread)
    .leftJoin(githubPR, eq(githubPR.threadId, thread.id))
    .orderBy(desc(thread.createdAt));

  // A thread may have multiple PRs from the LEFT JOIN — group by thread and pick latest PR
  const threadMap = new Map<string, EnrichedThreadListItem>();

  for (const row of rows) {
    const existing = threadMap.get(row.id);

    const prInfo =
      row.prNumber != null
        ? {
            prNumber: row.prNumber,
            prStatus: row.prStatus!,
            prUrl: row.prUrl,
          }
        : null;

    if (!existing) {
      threadMap.set(row.id, {
        id: row.id,
        name: row.name,
        status: row.status,
        agent: row.agent,
        model: row.model,
        githubRepoFullName: row.githubRepoFullName,
        pipelineState: row.pipelineState,
        archived: row.archived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        latestPR: prInfo,
        hasError: (row.errorCount ?? 0) > 0,
      });
    } else if (prInfo && !existing.latestPR) {
      // If we haven't set a PR yet, use this one
      existing.latestPR = prInfo;
    }
    // If multiple PRs, the first one from the query (ordered by thread.createdAt desc) wins
  }

  return Array.from(threadMap.values());
}
