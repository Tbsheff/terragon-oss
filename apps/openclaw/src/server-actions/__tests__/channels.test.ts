import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listChannels } from "@/server-actions/channels";
import type { ChannelStatus } from "@/lib/openclaw-types";

// Mock the OpenClawClient
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

describe("channels server actions", () => {
  let mockClient: {
    channelsStatus: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      channelsStatus: vi.fn(),
      getState: vi.fn().mockReturnValue("connected"),
    };

    const { getOpenClawClient } = await import("@/lib/openclaw-client");
    vi.mocked(getOpenClawClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getOpenClawClient>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listChannels", () => {
    it("should return channel statuses from gateway", async () => {
      const mockStatuses: ChannelStatus[] = [
        {
          id: "ch1",
          type: "whatsapp",
          connected: true,
          accountId: "acc1",
          dmPolicy: "allow",
          lastActivity: new Date().toISOString(),
        },
        {
          id: "ch2",
          type: "telegram",
          connected: false,
          error: "Auth failed",
        },
      ];

      mockClient.channelsStatus.mockResolvedValue(mockStatuses);

      const result = await listChannels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.id).toBe("ch1");
        expect(result.data[0]?.connected).toBe(true);
        expect(result.data[1]?.id).toBe("ch2");
        expect(result.data[1]?.connected).toBe(false);
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await listChannels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.channelsStatus.mockRejectedValue(new Error("RPC call failed"));

      const result = await listChannels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });
});
