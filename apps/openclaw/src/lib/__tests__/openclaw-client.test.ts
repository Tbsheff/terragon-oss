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

  describe("cronList", () => {
    it("should call cron.list RPC and unwrap jobs array", async () => {
      // Mock response with nested jobs array
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        jobs: [
          {
            jobId: "job1",
            name: "Daily backup",
            enabled: true,
            schedule: { kind: "cron", expression: "0 2 * * *" },
            sessionTarget: "main",
            payload: { kind: "agentTurn", message: "Run backup" },
          },
        ],
      });

      const result = await client.cronList();

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.list", {});
      expect(result).toHaveLength(1);
      expect(result[0]?.jobId).toBe("job1");
    });
  });

  describe("cronAdd", () => {
    it("should call cron.add RPC with job params", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        jobId: "job-new",
        name: "Test job",
        enabled: true,
      });

      const job = {
        name: "Test job",
        enabled: true,
        schedule: { kind: "every" as const, intervalMs: 3600000 },
        sessionTarget: "isolated" as const,
        payload: { kind: "systemEvent" as const, event: "tick" },
      };

      const result = await client.cronAdd(job);

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.add", job);
      expect(result.jobId).toBe("job-new");
    });
  });

  describe("cronUpdate", () => {
    it("should call cron.update RPC with jobId and patch", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        jobId: "job1",
        enabled: false,
      });

      const result = await client.cronUpdate("job1", { enabled: false });

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.update", {
        jobId: "job1",
        enabled: false,
      });
      expect(result.enabled).toBe(false);
    });
  });

  describe("cronRemove", () => {
    it("should call cron.remove RPC with jobId", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.cronRemove("job1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.remove", {
        jobId: "job1",
      });
    });
  });

  describe("cronRun", () => {
    it("should call cron.run RPC and return runId", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        runId: "run-123",
      });

      const result = await client.cronRun("job1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.run", {
        jobId: "job1",
      });
      expect(result.runId).toBe("run-123");
    });
  });

  describe("cronRuns", () => {
    it("should call cron.runs RPC and unwrap runs array", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        runs: [
          {
            runId: "run1",
            jobId: "job1",
            startedAt: "2026-02-15T10:00:00Z",
            status: "success",
          },
        ],
      });

      const result = await client.cronRuns("job1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.runs", {
        jobId: "job1",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.runId).toBe("run1");
    });
  });

  describe("cronStatus", () => {
    it("should call cron.status RPC", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        enabled: true,
        activeJobs: 3,
      });

      const result = await client.cronStatus();

      expect(client["sendRequest"]).toHaveBeenCalledWith("cron.status", {});
      expect(result.enabled).toBe(true);
      expect(result.activeJobs).toBe(3);
    });
  });

  describe("memorySearch", () => {
    it("should call memory.search RPC and unwrap results", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        results: [
          {
            text: "Sample memory content",
            filePath: "/memory/notes.md",
            lineStart: 1,
            lineEnd: 5,
            score: 0.95,
          },
        ],
      });

      const result = await client.memorySearch({
        agentId: "agent1",
        query: "sample",
        limit: 10,
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("memory.search", {
        agentId: "agent1",
        query: "sample",
        limit: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe("Sample memory content");
    });
  });

  describe("memoryGet", () => {
    it("should call memory.get RPC with required params", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        path: "/memory/notes.md",
        content: "File content here",
        lines: 100,
      });

      const result = await client.memoryGet("agent1", "/memory/notes.md");

      expect(client["sendRequest"]).toHaveBeenCalledWith("memory.get", {
        agentId: "agent1",
        path: "/memory/notes.md",
      });
      expect(result.content).toBe("File content here");
    });

    it("should call memory.get RPC with optional line params", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        path: "/memory/notes.md",
        content: "Partial content",
        lines: 10,
      });

      const result = await client.memoryGet("agent1", "/memory/notes.md", {
        lineStart: 5,
        lineCount: 10,
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("memory.get", {
        agentId: "agent1",
        path: "/memory/notes.md",
        lineStart: 5,
        lineCount: 10,
      });
      expect(result.content).toBe("Partial content");
    });
  });
});
