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
  gatewayHealth?: {
    status: string;
    cpu?: number;
    memory?: number;
    activeSessions?: number;
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
    tokenAgg,
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
    // Aggregate token usage via SQL (avoids fetching all rows over HTTP)
    db
      .select({
        inputTokens: sql<number>`COALESCE(SUM(json_extract(${thread.tokenUsage}, '$.inputTokens')), 0)`,
        outputTokens: sql<number>`COALESCE(SUM(json_extract(${thread.tokenUsage}, '$.outputTokens')), 0)`,
        totalCost: sql<number>`COALESCE(SUM(json_extract(${thread.tokenUsage}, '$.totalCost')), 0)`,
      })
      .from(thread)
      .where(isNotNull(thread.tokenUsage)),
  ]);

  const agg = tokenAgg[0];
  const inputTokens = Number(agg?.inputTokens ?? 0);
  const outputTokens = Number(agg?.outputTokens ?? 0);
  const totalCost = Number(agg?.totalCost ?? 0);

  // Best-effort gateway health
  let gatewayHealth: DashboardStats["gatewayHealth"];
  try {
    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    const client = getOpenClawClient();
    if (client.getState() === "connected") {
      const health = await client.health();
      gatewayHealth = {
        status: health.ok ? "healthy" : "unhealthy",
        cpu: (health as any).cpu,
        memory: (health as any).memory,
        activeSessions: (health as any).activeSessions,
      };
    }
  } catch {
    // Gateway unavailable — skip
  }

  return {
    activeCount: activeRows[0]?.cnt ?? 0,
    queuedCount: queuedRows[0]?.cnt ?? 0,
    completedTodayCount: completedTodayRows[0]?.cnt ?? 0,
    errorCount: errorRows[0]?.cnt ?? 0,
    recentErrors,
    tokenUsageSummary: { inputTokens, outputTokens, totalCost },
    gatewayHealth,
  };
}
