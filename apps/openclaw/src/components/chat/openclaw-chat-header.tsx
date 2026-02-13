"use client";

import { useThread } from "./thread-context";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { ConnectionStatusBadge } from "@/components/connection-status";
import { Archive } from "lucide-react";

export function OpenClawChatHeader({ onArchive }: { onArchive?: () => void }) {
  const { thread } = useThread();

  if (!thread) return null;

  const pipeline = parsePipelineState(thread.pipelineState);
  const currentStage = pipeline?.currentStage;

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2">
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
