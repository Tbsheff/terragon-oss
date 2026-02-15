import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDashboardStats } from "@/server-actions/dashboard-stats";
import type { OpenClawSession, HealthStatus } from "@/lib/openclaw-types";

// Mock dependencies
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("dashboard-stats server actions", () => {
  let mockClient: {
    getState: ReturnType<typeof vi.fn>;
    health: ReturnType<typeof vi.fn>;
    sessionsList: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      getState: vi.fn().mockReturnValue("connected"),
      health: vi.fn(),
      sessionsList: vi.fn(),
    };

    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    vi.mocked(getOpenClawClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getOpenClawClient>,
    );

    // Mock db for batch metadata loading
    const { db } = await import("@/db");
    const mockDb = db as unknown as {
      select: ReturnType<typeof vi.fn>;
    };
    const mockDbChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(mockDbChain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDashboardStats", () => {
    it("should use Promise.all for parallel health + sessions fetch", async () => {
      const mockHealth: HealthStatus = {
        ok: true,
        version: "1.0.0",
        uptime: 3600,
        activeSessions: 5,
        cpu: 45,
        memory: 60,
        usage: {
          inputTokens: 10000,
          outputTokens: 5000,
          totalCost: 0.5,
        },
      };

      const mockSessions: OpenClawSession[] = [
        {
          key: "session-1",
          agentId: "main",
          messageCount: 10,
          lastMessageAt: new Date().toISOString(), // Today
        },
      ];

      mockClient.health.mockResolvedValue(mockHealth);
      mockClient.sessionsList.mockResolvedValue(mockSessions);

      await getDashboardStats();

      // Both should be called (in parallel via Promise.all)
      expect(mockClient.health).toHaveBeenCalled();
      expect(mockClient.sessionsList).toHaveBeenCalled();
    });

    it("should include version and uptime in gatewayHealth", async () => {
      const mockHealth: HealthStatus = {
        ok: true,
        version: "1.0.0",
        uptime: 7200,
        cpu: 30,
        memory: 50,
      };

      mockClient.health.mockResolvedValue(mockHealth);
      mockClient.sessionsList.mockResolvedValue([]);

      const stats = await getDashboardStats();

      expect(stats.gatewayHealth?.version).toBe("1.0.0");
      expect(stats.gatewayHealth?.uptime).toBe(7200);
    });

    it("should derive completedTodayCount from sessions with lastMessageAt today", async () => {
      const now = new Date();
      const todayStart = new Date(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );

      const mockSessions: OpenClawSession[] = [
        {
          key: "session-today-1",
          agentId: "main",
          messageCount: 5,
          lastMessageAt: new Date(todayStart.getTime() + 3600000).toISOString(), // 1 hour into today
        },
        {
          key: "session-today-2",
          agentId: "main",
          messageCount: 3,
          lastMessageAt: new Date(todayStart.getTime() + 7200000).toISOString(), // 2 hours into today
        },
        {
          key: "session-yesterday",
          agentId: "main",
          messageCount: 10,
          lastMessageAt: new Date(
            todayStart.getTime() - 86400000,
          ).toISOString(), // Yesterday
        },
        {
          key: "session-draft",
          agentId: "main",
          messageCount: 0,
          // No lastMessageAt
        },
      ];

      mockClient.health.mockResolvedValue({ ok: true });
      mockClient.sessionsList.mockResolvedValue(mockSessions);

      const stats = await getDashboardStats();

      expect(stats.completedTodayCount).toBe(2); // Only today sessions
    });

    it("should use health usage data for tokenUsageSummary", async () => {
      const mockHealth: HealthStatus = {
        ok: true,
        usage: {
          inputTokens: 15000,
          outputTokens: 8000,
          totalCost: 1.2,
        },
      };

      mockClient.health.mockResolvedValue(mockHealth);
      mockClient.sessionsList.mockResolvedValue([]);

      const stats = await getDashboardStats();

      expect(stats.tokenUsageSummary.inputTokens).toBe(15000);
      expect(stats.tokenUsageSummary.outputTokens).toBe(8000);
      expect(stats.tokenUsageSummary.totalCost).toBe(1.2);
    });

    it("should fall back to zeros when gateway is disconnected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const stats = await getDashboardStats();

      expect(stats.completedTodayCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.tokenUsageSummary).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
      });
      expect(stats.gatewayHealth).toBeUndefined();
    });
  });
});
