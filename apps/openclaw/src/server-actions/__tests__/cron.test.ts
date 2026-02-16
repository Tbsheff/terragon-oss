import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listCronJobs,
  getCronStatus,
  addCronJob,
  updateCronJob,
  removeCronJob,
  runCronJob,
  getCronRuns,
} from "@/server-actions/cron";
import type { CronJob, CronRunEntry } from "@/lib/openclaw-types";

// Mock the OpenClawClient
vi.mock("@/lib/openclaw-client", () => ({
  getOpenClawClient: vi.fn(),
}));

describe("cron server actions", () => {
  let mockClient: {
    cronList: ReturnType<typeof vi.fn>;
    cronStatus: ReturnType<typeof vi.fn>;
    cronAdd: ReturnType<typeof vi.fn>;
    cronUpdate: ReturnType<typeof vi.fn>;
    cronRemove: ReturnType<typeof vi.fn>;
    cronRun: ReturnType<typeof vi.fn>;
    cronRuns: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      cronList: vi.fn(),
      cronStatus: vi.fn(),
      cronAdd: vi.fn(),
      cronUpdate: vi.fn(),
      cronRemove: vi.fn(),
      cronRun: vi.fn(),
      cronRuns: vi.fn(),
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

  describe("listCronJobs", () => {
    it("should return cron jobs from gateway", async () => {
      const mockJobs: CronJob[] = [
        {
          jobId: "job1",
          name: "Daily backup",
          enabled: true,
          schedule: { kind: "cron", expression: "0 2 * * *" },
          sessionTarget: "main",
          payload: { kind: "agentTurn", message: "Run backup" },
        },
        {
          jobId: "job2",
          name: "Hourly check",
          enabled: false,
          schedule: { kind: "every", intervalMs: 3600000 },
          sessionTarget: "isolated",
          payload: { kind: "systemEvent", event: "tick" },
        },
      ];

      mockClient.cronList.mockResolvedValue(mockJobs);

      const result = await listCronJobs();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.jobId).toBe("job1");
        expect(result.data[1]?.enabled).toBe(false);
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await listCronJobs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronList.mockRejectedValue(new Error("RPC call failed"));

      const result = await listCronJobs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("getCronStatus", () => {
    it("should return cron status from gateway", async () => {
      const mockStatus = { enabled: true, activeJobs: 3 };
      mockClient.cronStatus.mockResolvedValue(mockStatus);

      const result = await getCronStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.activeJobs).toBe(3);
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await getCronStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronStatus.mockRejectedValue(new Error("RPC call failed"));

      const result = await getCronStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("addCronJob", () => {
    it("should add a cron job via gateway", async () => {
      const newJob: Omit<
        CronJob,
        "jobId" | "createdAt" | "lastRunAt" | "nextRunAt"
      > = {
        name: "Test job",
        enabled: true,
        schedule: { kind: "every", intervalMs: 3600000 },
        sessionTarget: "isolated",
        payload: { kind: "agentTurn", message: "Test" },
      };

      const mockAddedJob: CronJob = {
        ...newJob,
        jobId: "job-new",
        createdAt: new Date().toISOString(),
      };

      mockClient.cronAdd.mockResolvedValue(mockAddedJob);

      const result = await addCronJob(newJob);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.jobId).toBe("job-new");
        expect(result.data.name).toBe("Test job");
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await addCronJob({
        name: "Test",
        enabled: true,
        schedule: { kind: "every", intervalMs: 3600000 },
        sessionTarget: "main",
        payload: { kind: "systemEvent", event: "tick" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronAdd.mockRejectedValue(new Error("RPC call failed"));

      const result = await addCronJob({
        name: "Test",
        enabled: true,
        schedule: { kind: "every", intervalMs: 3600000 },
        sessionTarget: "main",
        payload: { kind: "systemEvent", event: "tick" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("updateCronJob", () => {
    it("should update a cron job via gateway", async () => {
      const mockUpdatedJob: CronJob = {
        jobId: "job1",
        name: "Updated job",
        enabled: false,
        schedule: { kind: "cron", expression: "0 3 * * *" },
        sessionTarget: "main",
        payload: { kind: "agentTurn", message: "Updated" },
      };

      mockClient.cronUpdate.mockResolvedValue(mockUpdatedJob);

      const result = await updateCronJob("job1", { enabled: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.enabled).toBe(false);
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await updateCronJob("job1", { enabled: false });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronUpdate.mockRejectedValue(new Error("RPC call failed"));

      const result = await updateCronJob("job1", { enabled: false });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("removeCronJob", () => {
    it("should remove a cron job via gateway", async () => {
      mockClient.cronRemove.mockResolvedValue(undefined);

      const result = await removeCronJob("job1");

      expect(result.ok).toBe(true);
      expect(mockClient.cronRemove).toHaveBeenCalledWith("job1");
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await removeCronJob("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronRemove.mockRejectedValue(new Error("RPC call failed"));

      const result = await removeCronJob("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("runCronJob", () => {
    it("should run a cron job via gateway", async () => {
      mockClient.cronRun.mockResolvedValue({ runId: "run-123" });

      const result = await runCronJob("job1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.runId).toBe("run-123");
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await runCronJob("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronRun.mockRejectedValue(new Error("RPC call failed"));

      const result = await runCronJob("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("getCronRuns", () => {
    it("should return cron run history from gateway", async () => {
      const mockRuns: CronRunEntry[] = [
        {
          runId: "run1",
          jobId: "job1",
          startedAt: "2026-02-15T10:00:00Z",
          completedAt: "2026-02-15T10:01:00Z",
          status: "success",
        },
        {
          runId: "run2",
          jobId: "job1",
          startedAt: "2026-02-15T09:00:00Z",
          status: "running",
        },
      ];

      mockClient.cronRuns.mockResolvedValue(mockRuns);

      const result = await getCronRuns("job1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.status).toBe("success");
        expect(result.data[1]?.status).toBe("running");
      }
    });

    it("should return error when gateway is not connected", async () => {
      mockClient.getState.mockReturnValue("disconnected");

      const result = await getCronRuns("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not connected");
      }
    });

    it("should handle RPC errors gracefully", async () => {
      mockClient.cronRuns.mockRejectedValue(new Error("RPC call failed"));

      const result = await getCronRuns("job1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });
});
