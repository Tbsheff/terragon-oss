"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { threadDetailQueryOptions } from "@/queries/thread-queries";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { useParallelLayout } from "./parallel-layout-provider";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground",
  working: "bg-primary animate-pulse",
  "working-done": "bg-green-500",
  "working-error": "bg-destructive",
  complete: "bg-green-500",
  stopped: "bg-amber-500",
};

type PaneHeaderProps = {
  threadId: string;
  isActive: boolean;
};

export function PaneHeader({ threadId, isActive }: PaneHeaderProps) {
  const { removePane } = useParallelLayout();
  const { data: thread } = useQuery(threadDetailQueryOptions(threadId));

  const pipelineState = parsePipelineState(thread?.pipelineState ?? null);
  const currentStage = pipelineState?.currentStage as
    | PipelineStage
    | "done"
    | undefined;
  const stageLabel =
    currentStage && currentStage !== "done"
      ? PIPELINE_STAGE_LABELS[currentStage]
      : currentStage === "done"
        ? "Done"
        : null;

  const statusColor =
    STATUS_COLORS[thread?.status ?? "draft"] ?? "bg-muted-foreground/40";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b px-3 py-1.5 bg-card/80 backdrop-blur",
        isActive ? "border-border/60" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("size-2 shrink-0 rounded-full", statusColor)} />
        <span className="text-xs font-medium font-[var(--font-cabin)] tracking-tight truncate">
          {thread?.name ?? "Loading..."}
        </span>
        {stageLabel && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
            {stageLabel}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/task/${threadId}`}
              aria-label="Full view"
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Maximize2 className="size-3" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Full view</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => removePane(threadId)}
              aria-label="Remove from view"
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove from view</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
