import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenClawBridge } from "@/server/openclaw-bridge";
import type { LocalBroadcastServer } from "@/server/broadcast";

describe("OpenClawBridge", () => {
  let bridge: OpenClawBridge;
  let mockBroadcast: {
    broadcast: ReturnType<typeof vi.fn>;
    broadcastAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockBroadcast = {
      broadcast: vi.fn(),
      broadcastAll: vi.fn(),
    };

    bridge = new OpenClawBridge({
      broadcast: mockBroadcast as unknown as LocalBroadcastServer,
      gatewayUrl: "ws://localhost:8080",
    });
  });

  describe("onChannelEvent", () => {
    it("should broadcast channel-update to all clients", () => {
      const channelPayload = {
        id: "ch1",
        type: "whatsapp",
        connected: true,
      };

      bridge.onChannelEvent(channelPayload);

      expect(mockBroadcast.broadcastAll).toHaveBeenCalledWith({
        type: "channel-update",
        data: channelPayload,
      });
    });
  });

  describe("onTickEvent", () => {
    it("should broadcast tick event to all clients", () => {
      const tickPayload = {
        ts: Date.now(),
        uptime: 3600,
      };

      bridge.onTickEvent(tickPayload);

      expect(mockBroadcast.broadcastAll).toHaveBeenCalledWith({
        type: "tick",
        data: tickPayload,
      });
    });
  });
});
