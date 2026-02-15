import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendChatMessage,
  abortChat,
  loadChatHistory,
  injectChatContext,
} from "@/server-actions/openclaw-chat";

// Mock dependencies
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

vi.mock("@/server/bridge-registry", () => ({
  getBridge: vi.fn(() => null),
}));

describe("openclaw-chat server actions", () => {
  let mockClient: {
    getState: ReturnType<typeof vi.fn>;
    chatSend: ReturnType<typeof vi.fn>;
    chatAbort: ReturnType<typeof vi.fn>;
    chatHistory: ReturnType<typeof vi.fn>;
    chatInject: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      getState: vi.fn().mockReturnValue("connected"),
      chatSend: vi.fn(),
      chatAbort: vi.fn(),
      chatHistory: vi.fn(),
      chatInject: vi.fn(),
    };

    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    vi.mocked(getOpenClawClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getOpenClawClient>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendChatMessage", () => {
    it("should return ActionResult success", async () => {
      mockClient.chatSend.mockResolvedValue(undefined);

      const result = await sendChatMessage("session-123", "Hello");

      expect(result.ok).toBe(true);
      expect(mockClient.chatSend).toHaveBeenCalledWith("session-123", "Hello");
    });

    it("should return ActionResult error when not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await sendChatMessage("session-123", "Hello");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors", async () => {
      mockClient.chatSend.mockRejectedValue(new Error("Network error"));

      const result = await sendChatMessage("session-123", "Hello");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("abortChat", () => {
    it("should return ActionResult success", async () => {
      mockClient.chatAbort.mockResolvedValue(undefined);

      const result = await abortChat("session-123");

      expect(result.ok).toBe(true);
      expect(mockClient.chatAbort).toHaveBeenCalledWith("session-123");
    });

    it("should return ActionResult error when not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await abortChat("session-123");

      expect(result.ok).toBe(false);
    });
  });

  describe("loadChatHistory", () => {
    it("should return ActionResult with history data", async () => {
      const mockHistory = [
        {
          runId: "run-1",
          sessionKey: "session-123",
          messages: [],
          startedAt: new Date().toISOString(),
        },
      ];

      mockClient.chatHistory.mockResolvedValue(mockHistory);

      const result = await loadChatHistory("session-123");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockHistory);
      }
    });

    it("should return ActionResult error when not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await loadChatHistory("session-123");

      expect(result.ok).toBe(false);
    });
  });

  describe("injectChatContext", () => {
    it("should call chat.inject with correct params", async () => {
      mockClient.chatInject.mockResolvedValue(undefined);

      const result = await injectChatContext(
        "session-123",
        "System context",
        "system",
      );

      expect(result.ok).toBe(true);
      expect(mockClient.chatInject).toHaveBeenCalledWith({
        sessionKey: "session-123",
        content: "System context",
        role: "system",
      });
    });

    it("should default role to system", async () => {
      mockClient.chatInject.mockResolvedValue(undefined);

      const result = await injectChatContext("session-123", "Context");

      expect(result.ok).toBe(true);
      expect(mockClient.chatInject).toHaveBeenCalledWith({
        sessionKey: "session-123",
        content: "Context",
        role: "system",
      });
    });

    it("should return error when not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await injectChatContext("session-123", "Context");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors", async () => {
      mockClient.chatInject.mockRejectedValue(new Error("RPC failed"));

      const result = await injectChatContext("session-123", "Context");

      expect(result.ok).toBe(false);
    });
  });
});
