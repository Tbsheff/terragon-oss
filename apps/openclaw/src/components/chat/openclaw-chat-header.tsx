"use client";

import { useThread } from "./thread-context";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { getActivityLabel } from "@/lib/activity-label";
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
import { formatCost } from "@/lib/utils";

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
  const tokenUsage = parseTokenUsage(thread.tokenUsage);
  const totalTokens = tokenUsage
    ? tokenUsage.inputTokens + tokenUsage.outputTokens
    : 0;

  const isError = thread.status === "working-error";
  const { data: threadErrors } = useQuery({
    ...threadErrorsQueryOptions(thread.id),
    enabled: isError,
  });
  const latestError = threadErrors?.[0];

  // PR status badge — only fetch when thread has a GitHub repo
  const { data: prs } = useQuery({
    ...threadPRsQueryOptions(thread.id),
    enabled: !!thread.githubRepoFullName,
  });
  const latestPR = prs?.at(-1) ?? null;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border/70 bg-card/50 backdrop-blur-sm px-4 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="truncate text-sm font-semibold font-[var(--font-cabin)]">
              {thread.name ?? "Untitled Task"}
            </h1>
            {currentStage && currentStage !== "done" && (
              <PipelineStagePill stage={currentStage} />
            )}
            {currentStage === "done" && (
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Complete
              </Badge>
            )}
            {stageElapsed && (
              <span className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {stageElapsed}
              </span>
            )}
            {totalElapsed && (
              <span className="text-xs text-muted-foreground/60">
                ({totalElapsed} total)
              </span>
            )}
            {tokenUsage && totalTokens > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                <Coins className="h-3 w-3" />
                <span>{formatTokenCount(totalTokens)} tokens</span>
                {tokenUsage.totalCost != null && tokenUsage.totalCost > 0 && (
                  <span className="font-mono">
                    · {formatCost(tokenUsage.totalCost)}
                  </span>
                )}
              </span>
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
          {isWorking && activityLabel && (
            <span className="text-xs text-muted-foreground truncate animate-fade-in">
              {activityLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ConnectionStatusBadge />
          {onArchive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onArchive}
                  className="h-8 w-8 text-muted-foreground"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive task</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>
      {isError && latestError && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive animate-fade-in">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{latestError.errorMessage}</span>
        </div>
      )}
    </>
  );
}

function PipelineStagePill({ stage }: { stage: PipelineStage }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary opacity-75 animate-pulse" />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}
