import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThread, listThreads } from "@/server-actions/threads";
import type { OpenClawSession } from "@/lib/openclaw-types";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the OpenClawClient
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test123",
}));

// Mock bridge registry
vi.mock("@/server/bridge-registry", () => ({
  getBridge: () => null,
}));

// Mock settings — returns defaultAgent so createThread doesn't hit raw DB
vi.mock("@/server-actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ defaultAgent: "claudeCode" }),
}));

describe("threads server actions", () => {
  let mockClient: {
    sessionsList: ReturnType<typeof vi.fn>;
    sessionsSpawn: ReturnType<typeof vi.fn>;
  };
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up mock client
    mockClient = {
      sessionsList: vi.fn(),
      sessionsSpawn: vi.fn(),
    };

    // Set up mock db
    const { db } = await import("@/db");
    mockDb = db as unknown as typeof mockDb;

    // Default db chain mocking
    const mockDbChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    };

    mockDb.select.mockReturnValue(mockDbChain);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue(mockDbChain),
    });

    // Mock getOpenClawClient to return our mock client
    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    vi.mocked(getOpenClawClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getOpenClawClient>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createThread", () => {
    it("should call sessions.spawn with sessionKey and fallback to local-only on failure", async () => {
      // Mock sessions.spawn to succeed
      mockClient.sessionsSpawn.mockResolvedValue({
        key: "session-test123",
        agentId: "main",
      });

      const result = await createThread({
        name: "Test Thread",
        model: "sonnet",
      });

      expect(result.id).toBe("session-test123");
      expect(mockClient.sessionsSpawn).toHaveBeenCalledWith({
        agentId: "claudeCode",
        sessionKey: "session-test123",
        model: "sonnet",
      });
    });

    it("should fallback to local-only creation if sessions.spawn fails", async () => {
      // Mock sessions.spawn to fail
      mockClient.sessionsSpawn.mockRejectedValue(
        new Error("Gateway unavailable"),
      );

      const result = await createThread({
        name: "Test Thread",
      });

      expect(result.id).toBe("session-test123");
      // Should still succeed even if gateway call failed
    });
  });

  describe("listThreads", () => {
    it("should use batch metadata loading to avoid N+1 queries", async () => {
      // Mock sessions from gateway with new fields
      const mockSessions: OpenClawSession[] = [
        {
          key: "session-1",
          agentId: "main",
          model: "sonnet",
          thinking: "medium",
          messageCount: 5,
          queueMode: "sequential",
          resetPolicy: { type: "idle", value: 300 },
          verboseLevel: 2,
          lastMessageAt: new Date(Date.now() - 30000).toISOString(), // 30s ago
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          key: "session-2",
          agentId: "main",
          thinking: "high",
          messageCount: 0,
          queueMode: "concurrent",
          createdAt: new Date(Date.now() - 120000).toISOString(), // Older
        },
      ];

      mockClient.sessionsList.mockResolvedValue(mockSessions);

      // Mock batch metadata query
      const mockDbChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            key: "session-meta:session-1",
            value: JSON.stringify({ name: "Thread 1" }),
          },
          {
            key: "session-meta:session-2",
            value: JSON.stringify({ name: "Thread 2" }),
          },
        ]),
      };
      mockDb.select.mockReturnValue(mockDbChain);

      const threads = await listThreads();

      // Should call select only once for batch query
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(threads).toHaveLength(2);
      // Threads are sorted by updatedAt (lastMessageAt or createdAt) descending
      // session-1 has lastMessageAt 30s ago, session-2 has createdAt 120s ago
      expect(threads[0]?.name).toBe("Thread 1"); // More recent
      expect(threads[1]?.name).toBe("Thread 2");
    });

    it("should derive richer status from messageCount and lastMessageAt", async () => {
      const now = Date.now();
      const mockSessions: OpenClawSession[] = [
        {
          key: "session-working",
          agentId: "main",
          messageCount: 3,
          lastMessageAt: new Date(now - 30000).toISOString(), // 30s ago -> "working"
        },
        {
          key: "session-done",
          agentId: "main",
          messageCount: 10,
          lastMessageAt: new Date(now - 120000).toISOString(), // 2min ago -> "working-done"
        },
        {
          key: "session-draft",
          agentId: "main",
          messageCount: 0,
          // no lastMessageAt -> "draft"
        },
      ];

      mockClient.sessionsList.mockResolvedValue(mockSessions);

      // Mock metadata for all sessions
      const mockDbChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            key: "session-meta:session-working",
            value: JSON.stringify({ name: "Working" }),
          },
          {
            key: "session-meta:session-done",
            value: JSON.stringify({ name: "Done" }),
          },
          {
            key: "session-meta:session-draft",
            value: JSON.stringify({ name: "Draft" }),
          },
        ]),
      };
      mockDb.select.mockReturnValue(mockDbChain);

      const threads = await listThreads();

      const working = threads.find((t) => t.id === "session-working");
      const done = threads.find((t) => t.id === "session-done");
      const draft = threads.find((t) => t.id === "session-draft");

      expect(working?.status).toBe("working");
      expect(done?.status).toBe("working-done");
      expect(draft?.status).toBe("draft");
    });
  });
});
