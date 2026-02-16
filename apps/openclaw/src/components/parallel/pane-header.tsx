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
  draft: "bg-muted-foreground/40",
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
        "flex items-center justify-between gap-2 border-b px-3 py-1.5",
        isActive ? "border-primary/30 bg-primary/[0.03]" : "border-border/50",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", statusColor)} />
        <span className="text-xs font-medium truncate">
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
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Maximize2 className="h-3 w-3" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Full view</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => removePane(threadId)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove from view</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
