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

  // ── Sessions — extended ──────────────────────

  describe("sessionsPreview", () => {
    it("should call sessions.preview with key param", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        key: "s1",
        summary: "Discussed auth",
        messageCount: 5,
      });

      const result = await client.sessionsPreview("s1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("sessions.preview", {
        key: "s1",
      });
      expect(result.summary).toBe("Discussed auth");
    });
  });

  describe("sessionsReset", () => {
    it("should call sessions.reset with key param", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.sessionsReset("s1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("sessions.reset", {
        key: "s1",
      });
    });
  });

  describe("sessionsDelete", () => {
    it("should call sessions.delete with key param", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.sessionsDelete("s1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("sessions.delete", {
        key: "s1",
      });
    });
  });

  describe("sessionsCompact", () => {
    it("should call sessions.compact with key param", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.sessionsCompact("s1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("sessions.compact", {
        key: "s1",
      });
    });
  });

  // ── Models ────────────────────────────────────

  describe("modelsList", () => {
    it("should call models.list and unwrap models array", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        models: [
          {
            id: "claude-sonnet-4-5-20250929",
            name: "Sonnet 4.5",
            provider: "anthropic",
          },
          { id: "claude-opus-4-6", name: "Opus 4.6", provider: "anthropic" },
        ],
      });

      const result = await client.modelsList();

      expect(client["sendRequest"]).toHaveBeenCalledWith("models.list");
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("claude-sonnet-4-5-20250929");
    });
  });

  // ── Usage & Cost ──────────────────────────────

  describe("usageStatus", () => {
    it("should call usage.status RPC", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        inputTokens: 50000,
        outputTokens: 12000,
        totalCost: 0.42,
      });

      const result = await client.usageStatus();

      expect(client["sendRequest"]).toHaveBeenCalledWith("usage.status", {});
      expect(result.totalCost).toBe(0.42);
    });
  });

  describe("usageCost", () => {
    it("should call usage.cost with optional period", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        totalCost: 1.5,
        breakdown: [
          { model: "sonnet", inputTokens: 100, outputTokens: 50, cost: 0.5 },
        ],
      });

      const result = await client.usageCost({
        periodStart: "2026-02-01",
        periodEnd: "2026-02-16",
      });

      expect(client["sendRequest"]).toHaveBeenCalledWith("usage.cost", {
        periodStart: "2026-02-01",
        periodEnd: "2026-02-16",
      });
      expect(result.breakdown).toHaveLength(1);
    });

    it("should work without options", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        totalCost: 0,
      });

      await client.usageCost();

      expect(client["sendRequest"]).toHaveBeenCalledWith("usage.cost", {});
    });
  });

  // ── Config — extended ─────────────────────────

  describe("configSchema", () => {
    it("should call config.schema RPC", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        properties: { model: { type: "string", description: "Default model" } },
      });

      const result = await client.configSchema();

      expect(client["sendRequest"]).toHaveBeenCalledWith("config.schema");
      expect(result.properties?.model?.type).toBe("string");
    });
  });

  describe("configApply", () => {
    it("should call config.apply RPC", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.configApply();

      expect(client["sendRequest"]).toHaveBeenCalledWith("config.apply", {});
    });
  });

  // ── Skills ────────────────────────────────────

  describe("skillsStatus", () => {
    it("should call skills.status RPC", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        installed: [{ id: "web-search", name: "Web Search", version: "1.0.0" }],
        available: 42,
      });

      const result = await client.skillsStatus();

      expect(client["sendRequest"]).toHaveBeenCalledWith("skills.status", {});
      expect(result.installed).toHaveLength(1);
      expect(result.available).toBe(42);
    });
  });

  describe("skillsBins", () => {
    it("should call skills.bins and unwrap bins array", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        bins: [{ id: "browser", name: "Browser Control", version: "2.0.0" }],
      });

      const result = await client.skillsBins();

      expect(client["sendRequest"]).toHaveBeenCalledWith("skills.bins", {});
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("browser");
    });
  });

  describe("skillsInstall", () => {
    it("should call skills.install with skill id", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        id: "browser",
        name: "Browser Control",
        version: "2.0.0",
      });

      const result = await client.skillsInstall("browser");

      expect(client["sendRequest"]).toHaveBeenCalledWith("skills.install", {
        id: "browser",
      });
      expect(result.name).toBe("Browser Control");
    });
  });

  describe("skillsUpdate", () => {
    it("should call skills.update with skill id", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        id: "browser",
        name: "Browser Control",
        version: "2.1.0",
      });

      const result = await client.skillsUpdate("browser");

      expect(client["sendRequest"]).toHaveBeenCalledWith("skills.update", {
        id: "browser",
      });
      expect(result.version).toBe("2.1.0");
    });
  });

  // ── Logs ──────────────────────────────────────

  describe("logsTail", () => {
    it("should call logs.tail and unwrap entries", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        entries: [
          { ts: "2026-02-16T10:00:00Z", level: "info", message: "Boot" },
        ],
      });

      const result = await client.logsTail({ lines: 50 });

      expect(client["sendRequest"]).toHaveBeenCalledWith("logs.tail", {
        lines: 50,
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.level).toBe("info");
    });

    it("should work without options", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({
        entries: [],
      });

      const result = await client.logsTail();

      expect(client["sendRequest"]).toHaveBeenCalledWith("logs.tail", {});
      expect(result).toHaveLength(0);
    });
  });

  // ── Channels — extended ───────────────────────

  describe("channelsLogout", () => {
    it("should call channels.logout with channel id", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.channelsLogout("ch1");

      expect(client["sendRequest"]).toHaveBeenCalledWith("channels.logout", {
        id: "ch1",
      });
    });
  });

  // ── Raw send ──────────────────────────────────

  describe("send", () => {
    it("should call send RPC with sessionKey and payload", async () => {
      vi.spyOn(client as any, "sendRequest").mockResolvedValueOnce({});

      await client.send("s1", { action: "ping" });

      expect(client["sendRequest"]).toHaveBeenCalledWith("send", {
        sessionKey: "s1",
        action: "ping",
      });
    });
  });
});
