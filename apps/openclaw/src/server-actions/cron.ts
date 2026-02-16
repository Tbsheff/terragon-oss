"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";
import type { CronJob, CronRunEntry } from "@/lib/openclaw-types";

export async function listCronJobs(): Promise<ActionResult<CronJob[]>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const jobs = await client.cronList();
    return { ok: true, data: jobs };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCronStatus(): Promise<
  ActionResult<{ enabled: boolean; activeJobs: number }>
> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const status = await client.cronStatus();
    return { ok: true, data: status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function addCronJob(
  params: Omit<CronJob, "jobId" | "createdAt" | "lastRunAt" | "nextRunAt">,
): Promise<ActionResult<CronJob>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const job = await client.cronAdd(params);
    return { ok: true, data: job };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateCronJob(
  jobId: string,
  patch: Partial<Omit<CronJob, "jobId" | "createdAt">>,
): Promise<ActionResult<CronJob>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const job = await client.cronUpdate(jobId, patch);
    return { ok: true, data: job };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function removeCronJob(
  jobId: string,
): Promise<ActionResult<void>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    await client.cronRemove(jobId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function runCronJob(
  jobId: string,
): Promise<ActionResult<{ runId: string }>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const result = await client.cronRun(jobId);
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCronRuns(
  jobId: string,
): Promise<ActionResult<CronRunEntry[]>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const runs = await client.cronRuns(jobId);
    return { ok: true, data: runs };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
