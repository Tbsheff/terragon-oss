import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forkThread } from "@/server-actions/fork-thread";

// Mock the OpenClawClient (used by both getClient and resolveAgentId)
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "fork123",
}));

// Mock bridge registry
vi.mock("@/server/bridge-registry", () => ({
  getBridge: () => null,
}));

// Mock history utils
vi.mock("@/lib/history-utils", () => ({
  compactHistoryUpTo: vi.fn().mockReturnValue("compacted-context"),
}));

// Mock session-meta-store
const mockGetSessionMeta = vi.fn().mockResolvedValue({ name: "Source Thread" });
const mockSetSessionMeta = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server-actions/session-meta-store", () => ({
  getSessionMeta: (...args: unknown[]) => mockGetSessionMeta(...args),
  setSessionMeta: (...args: unknown[]) => mockSetSessionMeta(...args),
}));

// Mock settings
const mockGetSettings = vi.fn();
vi.mock("@/server-actions/settings", () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
}));

// Mock database (needed by session-meta-store if not fully mocked)
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("forkThread", () => {
  let mockClient: {
    getState: ReturnType<typeof vi.fn>;
    sessionsList: ReturnType<typeof vi.fn>;
    sessionsSpawn: ReturnType<typeof vi.fn>;
    chatHistory: ReturnType<typeof vi.fn>;
    chatInject: ReturnType<typeof vi.fn>;
    chatSend: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      getState: vi.fn().mockReturnValue("connected"),
      sessionsList: vi.fn(),
      sessionsSpawn: vi.fn().mockResolvedValue({ key: "session-fork123" }),
      chatHistory: vi.fn().mockResolvedValue([]),
      chatInject: vi.fn().mockResolvedValue(undefined),
      chatSend: vi.fn().mockResolvedValue(undefined),
    };

    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    vi.mocked(getOpenClawClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getOpenClawClient>,
    );

    mockGetSettings.mockResolvedValue({ defaultAgent: "default-agent" });
    mockGetSessionMeta.mockResolvedValue({ name: "Source Thread" });
    mockSetSessionMeta.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should inherit source thread's agent", async () => {
    mockClient.sessionsList.mockResolvedValue([
      { key: "source-thread", agentId: "leo" },
    ]);

    const result = await forkThread({
      sourceThreadId: "source-thread",
      forkAtMessageIndex: 3,
      newMessage: "continue this",
    });

    expect(result.ok).toBe(true);
    expect(mockClient.sessionsSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "leo" }),
    );
  });

  it("should fall back to default agent when source session not found", async () => {
    mockClient.sessionsList.mockResolvedValue([
      { key: "other-thread", agentId: "fixer" },
    ]);

    const result = await forkThread({
      sourceThreadId: "missing-thread",
      forkAtMessageIndex: 0,
      newMessage: "hello",
    });

    expect(result.ok).toBe(true);
    expect(mockClient.sessionsSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "default-agent" }),
    );
  });

  it("should fall back to default agent when sessionsList fails", async () => {
    mockClient.sessionsList.mockRejectedValue(new Error("Gateway down"));

    const result = await forkThread({
      sourceThreadId: "source-thread",
      forkAtMessageIndex: 0,
      newMessage: "hello",
    });

    expect(result.ok).toBe(true);
    expect(mockClient.sessionsSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "default-agent" }),
    );
  });

  it("should return error when no agents configured at all", async () => {
    mockClient.sessionsList.mockResolvedValue([]);
    mockGetSettings.mockResolvedValue({ defaultAgent: null });

    const result = await forkThread({
      sourceThreadId: "source-thread",
      forkAtMessageIndex: 0,
      newMessage: "hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No agents configured");
    }
  });

  it("should store fork metadata with parent reference", async () => {
    mockClient.sessionsList.mockResolvedValue([
      { key: "source-thread", agentId: "leo" },
    ]);

    await forkThread({
      sourceThreadId: "source-thread",
      forkAtMessageIndex: 5,
      newMessage: "branch here",
    });

    expect(mockSetSessionMeta).toHaveBeenCalledWith("session-fork123", {
      name: "Fork of Source Thread",
      parentThreadId: "source-thread",
      forkMessageIndex: 5,
      archived: false,
    });
  });

  it("should return not-connected error when client unavailable", async () => {
    mockClient.getState.mockReturnValue("disconnected");

    const result = await forkThread({
      sourceThreadId: "source-thread",
      forkAtMessageIndex: 0,
      newMessage: "hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not connected");
    }
  });
});
