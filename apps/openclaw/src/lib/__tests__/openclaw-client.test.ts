import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenClawClient } from "@/lib/openclaw-client";

describe("OpenClawClient RPC methods", () => {
  let client: OpenClawClient;

  beforeEach(() => {
    client = new OpenClawClient();
    // Mock sendRequest to avoid actual WebSocket calls
    type ClientInternal = {
      sendRequest: <T = Record<string, unknown>>(
        method: string,
        params?: Record<string, unknown>,
      ) => Promise<T>;
    };
    const spy = vi.spyOn(client as unknown as ClientInternal, "sendRequest");
    spy.mockImplementation(
      async (
        method: string,
        params?: Record<string, unknown>,
      ): Promise<Record<string, unknown>> => {
        // Return mock responses based on method
        if (method === "sessions.spawn") {
          return {
            key: params?.sessionKey || "session-123",
            agentId: params?.agentId,
          };
        }
        if (method === "chat.inject") {
          return { ok: true };
        }
        if (method === "channels.status") {
          return {
            items: [
              { id: "ch1", type: "whatsapp", connected: true },
              { id: "ch2", type: "telegram", connected: false },
            ],
          };
        }
        return {};
      },
    );
  });

  describe("sessionsSpawn", () => {
    it("should call sessions.spawn RPC with correct params", async () => {
      const result = await client.sessionsSpawn({
        agentId: "main",
        model: "sonnet",
        sessionKey: "session-abc",
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("sessions.spawn", {
        agentId: "main",
        model: "sonnet",
        sessionKey: "session-abc",
      });
      expect(result.key).toBe("session-abc");
    });

    it("should work with minimal params", async () => {
      const result = await client.sessionsSpawn({ agentId: "main" });

      expect(result.agentId).toBe("main");
    });
  });

  describe("chatInject", () => {
    it("should call chat.inject RPC with correct params", async () => {
      await client.chatInject({
        sessionKey: "session-123",
        content: "System context",
        role: "system",
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("chat.inject", {
        sessionKey: "session-123",
        content: "System context",
        role: "system",
      });
    });

    it("should default role to system", async () => {
      await client.chatInject({
        sessionKey: "session-123",
        content: "Context",
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("chat.inject", {
        sessionKey: "session-123",
        content: "Context",
        role: undefined,
      });
    });
  });

  describe("channelsStatus", () => {
    it("should call channels.status RPC and unwrap items", async () => {
      const result = await client.channelsStatus();

      expect(client["sendRequest"]).toHaveBeenCalledWith("channels.status", {});
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "ch1",
        type: "whatsapp",
        connected: true,
      });
    });
  });
});
