"use client";

import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import type {
  PipelineState,
  PipelineStageStatus,
  PipelineStageHistory,
} from "@/hooks/use-pipeline";
import { StageBadge } from "./stage-badge";
import { useElapsedTime, formatDuration } from "@/hooks/use-elapsed-time";

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getStageStatus(
  stage: PipelineStage,
  state: PipelineState | null,
): { status: PipelineStageStatus; retryCount?: number } {
  if (!state) return { status: "pending" };

  // Find the most recent history entry for this stage
  const entries = state.stageHistory.filter((h) => h.stage === stage);
  const latest = entries[entries.length - 1];

  if (latest) {
    return {
      status: latest.status,
      retryCount: latest.retryCount,
    };
  }

  // If the current stage matches, it's about to run or running
  if (state.currentStage === stage) {
    return { status: "running" };
  }

  return { status: "pending" };
}

// ─────────────────────────────────────────────────
// Connector line between stages
// ─────────────────────────────────────────────────

function StageConnector({ status }: { status: PipelineStageStatus }) {
  return (
    <div
      className={cn(
        "h-0.5 flex-1 min-w-3 max-w-8",
        status === "passed" && "bg-green-500/40",
        status === "failed" && "bg-red-500/40",
        status === "running" && "bg-primary/40",
        status === "skipped" && "bg-muted-foreground/20",
        status === "pending" && "bg-border",
      )}
    />
  );
}

function StageDuration({ entry }: { entry: PipelineStageHistory | undefined }) {
  const liveElapsed = useElapsedTime(
    entry?.status === "running" ? entry.startedAt : null,
  );

  if (!entry) return null;

  if (entry.status === "running" && liveElapsed) {
    return <span className="text-[10px] text-primary">{liveElapsed}</span>;
  }

  if (entry.completedAt) {
    return (
      <span className="text-[10px] text-muted-foreground">
        {formatDuration(entry.startedAt, entry.completedAt)}
      </span>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────
// Pipeline Status (horizontal progress bar)
// ─────────────────────────────────────────────────

type PipelineStatusProps = {
  state: PipelineState | null;
  /** Only show stages from the template, or all stages */
  showAllStages?: boolean;
  compact?: boolean;
  className?: string;
};

export function PipelineStatus({
  state,
  showAllStages = false,
  compact = false,
  className,
}: PipelineStatusProps) {
  // Determine which stages to show
  const stagesToShow = showAllStages
    ? PIPELINE_STAGES
    : state
      ? getEnabledStages(state)
      : PIPELINE_STAGES;

  const isDone = state?.currentStage === "done";
  const allPassed =
    isDone &&
    state?.stageHistory.every(
      (h) => h.status === "passed" || h.status === "skipped",
    );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Status header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Pipeline</span>
        {state && (
          <span
            className={cn(
              "font-medium",
              isDone && allPassed && "text-green-400",
              isDone && !allPassed && "text-red-400",
              !isDone && "text-primary",
            )}
          >
            {isDone
              ? allPassed
                ? "Complete"
                : "Failed"
              : `Running: ${PIPELINE_STAGE_LABELS[state.currentStage as PipelineStage] ?? state.currentStage}`}
          </span>
        )}
        {!state && (
          <span className="text-muted-foreground/60">Not started</span>
        )}
      </div>

      {/* Stage progress bar */}
      <div className="flex items-center gap-0">
        {stagesToShow.map((stage, idx) => {
          const { status, retryCount } = getStageStatus(stage, state);
          const entries = state?.stageHistory.filter((h) => h.stage === stage);
          const latestEntry = entries?.[entries.length - 1];

          return (
            <div key={stage} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center">
                {idx > 0 && <StageConnector status={status} />}
                <StageBadge
                  stage={stage}
                  status={status}
                  retryCount={retryCount}
                  feedback={latestEntry?.feedback}
                  compact={compact}
                />
              </div>
              <StageDuration entry={latestEntry} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getEnabledStages(state: PipelineState): readonly PipelineStage[] {
  // Derive from history + current stage
  const stagesInHistory = state.stageHistory.map((h) => h.stage);
  const current =
    state.currentStage !== "done" ? [state.currentStage as PipelineStage] : [];
  const all = [...new Set([...stagesInHistory, ...current])];

  // Sort by pipeline order
  return PIPELINE_STAGES.filter((s) => all.includes(s));
}
