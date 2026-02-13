"use server";

import { db } from "@/db";
import { thread, threadChat } from "@/db/schema";
import { eq, desc, and, sql, count, isNotNull, gte } from "drizzle-orm";

export type DashboardStats = {
  activeCount: number;
  queuedCount: number;
  completedTodayCount: number;
  errorCount: number;
  recentErrors: {
    threadId: string;
    threadName: string | null;
    errorMessage: string | null;
    stage: string | null;
    updatedAt: string;
  }[];
  tokenUsageSummary: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // Run queries in parallel for performance
  const [
    activeRows,
    queuedRows,
    completedTodayRows,
    errorRows,
    recentErrors,
    allThreads,
  ] = await Promise.all([
    // Active count: working or stopping
    db
      .select({ cnt: count() })
      .from(thread)
      .where(
        and(
          sql`${thread.status} IN ('working', 'stopping')`,
          eq(thread.archived, false),
        ),
      ),
    // Queued count
    db
      .select({ cnt: count() })
      .from(thread)
      .where(and(eq(thread.status, "queued"), eq(thread.archived, false))),
    // Completed today
    db
      .select({ cnt: count() })
      .from(thread)
      .where(
        and(eq(thread.status, "complete"), gte(thread.updatedAt, todayStart)),
      ),
    // Error count
    db
      .select({ cnt: count() })
      .from(thread)
      .where(
        and(eq(thread.status, "working-error"), eq(thread.archived, false)),
      ),
    // Recent errors: join threadChat where errorMessage is not null
    db
      .select({
        threadId: threadChat.threadId,
        threadName: thread.name,
        errorMessage: threadChat.errorMessage,
        stage: threadChat.pipelineStage,
        updatedAt: threadChat.updatedAt,
      })
      .from(threadChat)
      .innerJoin(thread, eq(threadChat.threadId, thread.id))
      .where(isNotNull(threadChat.errorMessage))
      .orderBy(desc(threadChat.updatedAt))
      .limit(10),
    // All threads for token usage aggregation
    db
      .select({ tokenUsage: thread.tokenUsage })
      .from(thread)
      .where(isNotNull(thread.tokenUsage)),
  ]);

  // Aggregate token usage from JSON fields
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;

  for (const row of allThreads) {
    if (!row.tokenUsage) continue;
    try {
      const usage = JSON.parse(row.tokenUsage);
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      totalCost += usage.totalCost ?? 0;
    } catch {
      // Skip malformed JSON
    }
  }

  return {
    activeCount: activeRows[0]?.cnt ?? 0,
    queuedCount: queuedRows[0]?.cnt ?? 0,
    completedTodayCount: completedTodayRows[0]?.cnt ?? 0,
    errorCount: errorRows[0]?.cnt ?? 0,
    recentErrors,
    tokenUsageSummary: { inputTokens, outputTokens, totalCost },
  };
}
