"use server";

import { getClient } from "./action-utils";

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
    version?: string;
    uptime?: number;
  };
};

export async function getDashboardStats(): Promise<DashboardStats> {
  let activeCount = 0;
  let completedTodayCount = 0;
  let errorCount = 0;
  let gatewayHealth: DashboardStats["gatewayHealth"];
  let tokenUsageSummary = { inputTokens: 0, outputTokens: 0, totalCost: 0 };

  const client = getClient();

  try {
    if (client) {
      // Fetch health and sessions in parallel (single RPC call each)
      const [health, sessions] = await Promise.all([
        client.health(),
        client.sessionsList(),
      ]);

      // Derive stats from sessions
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayStartTime = todayStart.getTime();

      for (const session of sessions) {
        if (session.lastMessageAt) {
          const lastMessageTime = new Date(session.lastMessageAt).getTime();
          if (lastMessageTime >= todayStartTime) {
            completedTodayCount++;
          }
        }
      }

      // Use sessions count directly (avoids double RPC via listThreads)
      activeCount = health.activeSessions ?? sessions.length;

      // Use health usage data for token summary if available
      if (health.usage) {
        tokenUsageSummary = {
          inputTokens: health.usage.inputTokens,
          outputTokens: health.usage.outputTokens,
          totalCost: health.usage.totalCost ?? 0,
        };
      }

      gatewayHealth = {
        status: health.ok ? "healthy" : "unhealthy",
        cpu: health.cpu,
        memory: health.memory,
        activeSessions: health.activeSessions,
        version: health.version,
        uptime: health.uptime,
      };
    }
  } catch {
    // Gateway unavailable — return zeroes
  }

  return {
    activeCount,
    queuedCount: 0, // Not yet implemented
    completedTodayCount,
    errorCount,
    recentErrors: [],
    tokenUsageSummary,
    gatewayHealth,
  };
}
