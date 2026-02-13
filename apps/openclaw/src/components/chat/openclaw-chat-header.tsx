"use client";

import { useThread } from "./thread-context";
import { usePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { getActivityLabel } from "@/lib/activity-label";
import { cn, formatCost } from "@/lib/utils";
import { ConnectionStatusBadge } from "@/components/connection-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Archive, Clock, Coins, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PRStatusBadge } from "@/components/github/pr-status-badge";
import { threadPRsQueryOptions } from "@/queries/github-queries";
import { threadErrorsQueryOptions } from "@/queries/thread-queries";
import { parseTokenUsage, formatTokenCount } from "@/lib/token-usage";

export function OpenClawChatHeader({ onArchive }: { onArchive?: () => void }) {
  const { thread } = useThread();

  // Read pipeline state from kvStore via server action (decoupled from thread table)
  const { data: pipeline } = usePipelineState(thread?.id ?? null);
  // Pipeline UI is only shown when pipeline state exists (i.e. pipeline mode was opted into)
  const hasPipeline = pipeline != null;
  const currentStage = hasPipeline ? (pipeline.currentStage ?? null) : null;
  const isWorking =
    thread?.status === "working" || thread?.status === "stopping";

  // Elapsed time for active stage (only in pipeline mode)
  const activeEntry = hasPipeline
    ? pipeline.stageHistory.find((h) => h.status === "running")
    : undefined;
  const stageElapsed = useElapsedTime(activeEntry?.startedAt ?? null);

  // Total elapsed from first stage (only in pipeline mode)
  const firstEntry = hasPipeline ? pipeline.stageHistory[0] : undefined;
  const totalElapsed = useElapsedTime(
    isWorking ? (firstEntry?.startedAt ?? null) : null,
  );

  const activityLabel = thread
    ? getActivityLabel(currentStage, thread.status)
    : null;
  const tokenUsage = thread ? parseTokenUsage(thread.tokenUsage) : null;
  const totalTokens = tokenUsage
    ? tokenUsage.inputTokens + tokenUsage.outputTokens
    : 0;

  const isError = thread?.status === "working-error";
  const { data: threadErrors } = useQuery({
    ...threadErrorsQueryOptions(thread?.id ?? ""),
    enabled: isError && !!thread,
  });
  const latestError = threadErrors?.[0];

  // PR status badge -- only fetch when thread has a GitHub repo
  const { data: prs } = useQuery({
    ...threadPRsQueryOptions(thread?.id ?? ""),
    enabled: !!thread?.githubRepoFullName,
  });
  const latestPR = prs?.at(-1) ?? null;

  if (!thread) return null;

  const hasSecondaryInfo =
    (hasPipeline && (stageElapsed || totalElapsed)) ||
    (tokenUsage && totalTokens > 0) ||
    latestPR;

  return (
    <div className="shrink-0">
      <header className="border-b border-border/70 bg-card/50 backdrop-blur-sm px-4 py-2.5">
        {/* Primary row: title + stage | actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="truncate text-sm font-semibold font-[var(--font-cabin)]">
              {thread.name ?? "Untitled Task"}
            </h1>
            {hasPipeline && currentStage && currentStage !== "done" && (
              <PipelineStagePill stage={currentStage} />
            )}
            {hasPipeline && currentStage === "done" && (
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] px-2 py-0">
                Complete
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ConnectionStatusBadge />
            {onArchive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onArchive}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive task</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Secondary row: timing, tokens, PR status, activity */}
        {(hasSecondaryInfo || (isWorking && activityLabel)) && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {isWorking && activityLabel && (
              <span className="text-[11px] text-muted-foreground truncate animate-fade-in">
                {activityLabel}
              </span>
            )}
            {hasPipeline && stageElapsed && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                {stageElapsed}
              </span>
            )}
            {hasPipeline && totalElapsed && (
              <span className="text-[11px] text-muted-foreground/60">
                {totalElapsed} total
              </span>
            )}
            {tokenUsage && totalTokens > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 cursor-default">
                    <Coins className="h-3 w-3 shrink-0" />
                    <span>{formatTokenCount(totalTokens)}</span>
                    {tokenUsage.totalCost != null &&
                      tokenUsage.totalCost > 0 && (
                        <span className="font-mono">
                          &middot; {formatCost(tokenUsage.totalCost)}
                        </span>
                      )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatTokenCount(tokenUsage.inputTokens)} in /{" "}
                  {formatTokenCount(tokenUsage.outputTokens)} out
                </TooltipContent>
              </Tooltip>
            )}
            {latestPR && (
              <PRStatusBadge
                prNumber={latestPR.prNumber}
                prStatus={latestPR.prStatus}
                prUrl={latestPR.prUrl}
                checksStatus={latestPR.checksStatus}
              />
            )}
          </div>
        )}
      </header>

      {/* Error banner -- fixed height so it doesn't shift layout */}
      {isError && latestError && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive dark:text-red-400 animate-fade-in">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{latestError.errorMessage}</span>
        </div>
      )}
    </div>
  );
}

const STAGE_PILL_COLORS: Record<
  PipelineStage,
  { bg: string; text: string; dot: string }
> = {
  brainstorm: { bg: "bg-primary/15", text: "text-primary", dot: "bg-primary" },
  plan: {
    bg: "bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  implement: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  review: {
    bg: "bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  test: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  ci: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
};

function PipelineStagePill({ stage }: { stage: PipelineStage }) {
  const colors = STAGE_PILL_COLORS[stage];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        colors.bg,
        colors.text,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full opacity-75 animate-pulse",
          colors.dot,
        )}
      />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}
