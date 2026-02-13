"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";

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
  let activeCount = 0;
  let gatewayHealth: DashboardStats["gatewayHealth"];

  const client = getOpenClawClient();

  try {
    if (client.getState() === "connected") {
      // Get session counts from gateway
      const sessions = await client.sessionsList();
      activeCount = sessions.length;

      // Get health info
      const health = await client.health();
      gatewayHealth = {
        status: health.ok ? "healthy" : "unhealthy",
        cpu: health.cpu,
        memory: health.memory,
        activeSessions: health.activeSessions ?? sessions.length,
      };
    }
  } catch {
    // Gateway unavailable — return zeroes
  }

  return {
    activeCount,
    queuedCount: 0,
    completedTodayCount: 0,
    errorCount: 0,
    recentErrors: [],
    tokenUsageSummary: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
    gatewayHealth,
  };
}
