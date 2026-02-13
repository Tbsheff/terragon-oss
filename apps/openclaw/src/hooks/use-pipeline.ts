"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/constants";
import {
  startPipeline,
  advancePipeline,
  retryStage,
  cancelPipeline,
  getPipelineState,
} from "@/server-actions/pipeline";

// ─────────────────────────────────────────────────
// Pipeline State Types
// ─────────────────────────────────────────────────

export type PipelineStageStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export type PipelineStageHistory = {
  stage: PipelineStage;
  agentId: string;
  sessionKey: string;
  status: PipelineStageStatus;
  startedAt: string;
  completedAt?: string;
  retryCount?: number;
  feedback?: string;
};

export type PipelineState = {
  templateId: string;
  currentStage: PipelineStage | "done";
  stageHistory: PipelineStageHistory[];
};

// ─────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────

/**
 * Parse pipeline state from the thread's JSON column.
 */
export function parsePipelineState(json: string | null): PipelineState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as PipelineState;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────

/**
 * Get the display info for a pipeline stage status.
 */
export function getStageInfo(status: PipelineStageStatus) {
  switch (status) {
    case "pending":
      return {
        color: "text-muted-foreground",
        bg: "bg-muted",
        label: "Pending",
      };
    case "running":
      return { color: "text-primary", bg: "bg-primary/20", label: "Running" };
    case "passed":
      return {
        color: "text-green-500",
        bg: "bg-green-500/20",
        label: "Passed",
      };
    case "failed":
      return {
        color: "text-destructive",
        bg: "bg-destructive/20",
        label: "Failed",
      };
    case "skipped":
      return {
        color: "text-muted-foreground",
        bg: "bg-muted/50",
        label: "Skipped",
      };
  }
}

/**
 * Get the overall progress percentage of the pipeline (0-100).
 */
export function getPipelineProgress(state: PipelineState | null): number {
  if (!state) return 0;
  if (state.currentStage === "done") return 100;

  const completedCount = state.stageHistory.filter(
    (h) =>
      h.status === "passed" || h.status === "skipped" || h.status === "failed",
  ).length;

  // Use all stages as denominator for consistent progress
  const totalStages = PIPELINE_STAGES.length;
  return Math.round((completedCount / totalStages) * 100);
}

/**
 * Check if the pipeline is actively running.
 */
export function isPipelineActive(state: PipelineState | null): boolean {
  if (!state) return false;
  if (state.currentStage === "done") return false;
  return state.stageHistory.some((h) => h.status === "running");
}

/**
 * Get the status of a specific stage within the pipeline.
 */
export function getStageStatus(
  stage: PipelineStage,
  state: PipelineState | null,
): PipelineStageStatus {
  if (!state) return "pending";

  const entries = state.stageHistory.filter((h) => h.stage === stage);
  const latest = entries[entries.length - 1];
  if (latest) return latest.status;

  if (state.currentStage === stage) return "running";
  return "pending";
}

// ─────────────────────────────────────────────────
// Hook: usePipelineState
// ─────────────────────────────────────────────────

/**
 * Hook to track pipeline state for a thread.
 * Polls the server for updates while the pipeline is running.
 */
export function usePipelineState(threadId: string | null) {
  const query = useQuery({
    queryKey: ["pipeline", threadId],
    queryFn: async (): Promise<PipelineState | null> => {
      if (!threadId) return null;
      const result = await getPipelineState(threadId);
      if (!result.ok) return null;
      return result.data;
    },
    enabled: !!threadId,
    refetchInterval: (query) => {
      // Poll faster while pipeline is running, slower when idle
      const data = query.state.data;
      if (isPipelineActive(data ?? null)) return 2_000;
      if (data && data.currentStage !== "done") return 5_000;
      return false; // Stop polling when done or no state
    },
  });

  const progress = useMemo(
    () => getPipelineProgress(query.data ?? null),
    [query.data],
  );

  const active = useMemo(
    () => isPipelineActive(query.data ?? null),
    [query.data],
  );

  return {
    ...query,
    progress,
    active,
  };
}

// ─────────────────────────────────────────────────
// Hook: usePipelineActions
// ─────────────────────────────────────────────────

/**
 * Hook providing mutation functions for pipeline control.
 */
export function usePipelineActions(threadId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    if (threadId) {
      queryClient.invalidateQueries({ queryKey: ["pipeline", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }, [threadId, queryClient]);

  const start = useMutation({
    mutationFn: async (templateId: string) => {
      if (!threadId) throw new Error("No thread ID");
      const result = await startPipeline(threadId, templateId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const advance = useMutation({
    mutationFn: async () => {
      if (!threadId) throw new Error("No thread ID");
      const result = await advancePipeline(threadId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });

  const retry = useMutation({
    mutationFn: async () => {
      if (!threadId) throw new Error("No thread ID");
      const result = await retryStage(threadId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!threadId) throw new Error("No thread ID");
      const result = await cancelPipeline(threadId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });

  return { start, advance, retry, cancel };
}
