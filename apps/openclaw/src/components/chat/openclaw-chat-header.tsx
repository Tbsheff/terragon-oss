"use client";

import { useThread } from "./thread-context";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { getActivityLabel } from "@/lib/activity-label";
import { ConnectionStatusBadge } from "@/components/connection-status";
import { Archive, Clock } from "lucide-react";

export function OpenClawChatHeader({ onArchive }: { onArchive?: () => void }) {
  const { thread } = useThread();

  if (!thread) return null;

  const pipeline = parsePipelineState(thread.pipelineState);
  const currentStage = pipeline?.currentStage ?? null;
  const isWorking = thread.status === "working" || thread.status === "stopping";

  // Elapsed time for active stage
  const activeEntry = pipeline?.stageHistory.find(
    (h) => h.status === "running",
  );
  const stageElapsed = useElapsedTime(activeEntry?.startedAt ?? null);

  // Total elapsed from first stage
  const firstEntry = pipeline?.stageHistory[0];
  const totalElapsed = useElapsedTime(
    isWorking ? (firstEntry?.startedAt ?? null) : null,
  );

  const activityLabel = getActivityLabel(currentStage, thread.status);

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {thread.name ?? "Untitled Task"}
          </h1>
          {currentStage && currentStage !== "done" && (
            <PipelineStagePill stage={currentStage} />
          )}
          {currentStage === "done" && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-500">
              Complete
            </span>
          )}
          {stageElapsed && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {stageElapsed}
            </span>
          )}
          {totalElapsed && (
            <span className="text-xs text-muted-foreground/60">
              ({totalElapsed} total)
            </span>
          )}
        </div>
        {isWorking && activityLabel && (
          <span className="text-xs text-muted-foreground truncate">
            {activityLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ConnectionStatusBadge />
        {onArchive && (
          <button
            onClick={onArchive}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Archive task"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

function PipelineStagePill({ stage }: { stage: PipelineStage }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}
