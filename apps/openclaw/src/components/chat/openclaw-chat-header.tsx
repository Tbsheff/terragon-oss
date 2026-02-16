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
import {
  Archive,
  Clock,
  Coins,
  AlertTriangle,
  FolderOpen,
  GitFork,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PRStatusBadge } from "@/components/github/pr-status-badge";
import { threadPRsQueryOptions } from "@/queries/github-queries";
import { threadErrorsQueryOptions } from "@/queries/thread-queries";
import { parseTokenUsage, formatTokenCount } from "@/lib/token-usage";
import { useFilePanel } from "@/hooks/use-file-panel";

export function OpenClawChatHeader({
  onArchive,
  onResetSession,
  onDeleteSession,
  parentThreadId,
}: {
  onArchive?: () => void;
  onResetSession?: () => void;
  onDeleteSession?: () => void;
  parentThreadId?: string | null;
}) {
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

  return (
    <div className="shrink-0">
      <div className="flex w-full items-center justify-between px-4 border-b bg-card/80 backdrop-blur gap-2 sm:gap-4 overflow-hidden h-[62px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex flex-col min-w-0 w-full">
            {/* Primary row: title + stage pill */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <h1 className="font-bold text-sm text-foreground truncate">
                  {thread.name ?? "Untitled Task"}
                </h1>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasPipeline && currentStage && currentStage !== "done" && (
                    <PipelineStagePill stage={currentStage} />
                  )}
                  {hasPipeline && currentStage === "done" && (
                    <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] px-2 py-0">
                      Complete
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {/* Metadata row: activity, timing, tokens, PR status */}
            <div className="text-muted-foreground text-xs font-mono flex items-center gap-1.5 h-5 min-w-0">
              {isWorking && activityLabel && (
                <span className="truncate animate-fade-in">
                  {activityLabel}
                </span>
              )}
              {hasPipeline && stageElapsed && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="size-3 shrink-0" />
                  {stageElapsed}
                </span>
              )}
              {hasPipeline && totalElapsed && (
                <span className="text-muted-foreground/60 shrink-0">
                  {totalElapsed} total
                </span>
              )}
              {tokenUsage && totalTokens > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-muted-foreground/60 cursor-default shrink-0">
                      <Coins className="size-3 shrink-0" />
                      <span>{formatTokenCount(totalTokens)}</span>
                      {tokenUsage.totalCost != null &&
                        tokenUsage.totalCost > 0 && (
                          <span>
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
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ConnectionStatusBadge />
          <FilesToggleButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Session options"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onResetSession && (
                <DropdownMenuItem onClick={onResetSession}>
                  <RotateCcw className="size-3.5" />
                  Reset Conversation
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDeleteSession && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDeleteSession}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Session
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Fork lineage banner */}
      {parentThreadId && (
        <div className="flex w-full items-center px-4 py-2 border-b bg-muted overflow-hidden">
          <div className="flex items-center gap-2">
            <GitFork className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono font-medium">
              Forked from{" "}
              <Link
                href={`/task/${parentThreadId}`}
                className="underline hover:text-foreground"
              >
                parent task
              </Link>
            </span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {isError && latestError && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-mono font-medium text-destructive dark:text-red-400 animate-fade-in">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">{latestError.errorMessage}</span>
        </div>
      )}
    </div>
  );
}

function FilesToggleButton() {
  const { isOpen, toggle } = useFilePanel();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isOpen ? "Close files" : "Open files"}
          className={cn(
            "size-7 text-muted-foreground hover:text-foreground",
            isOpen && "bg-muted text-foreground",
          )}
        >
          <FolderOpen className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isOpen ? "Close files" : "Open files"}</TooltipContent>
    </Tooltip>
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
          "size-1.5 rounded-full opacity-75 animate-pulse",
          colors.dot,
        )}
      />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}
