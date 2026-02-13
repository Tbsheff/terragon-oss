"use client";

import { useQuery } from "@tanstack/react-query";
import { enrichedThreadListQueryOptions } from "@/queries/board-queries";
import type { EnrichedThreadListItem } from "@/server-actions/threads-enriched";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { useRealtimeGlobal } from "@/hooks/use-realtime";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { GitBranch, GitPullRequest, Clock, AlertCircle } from "lucide-react";

type LocalPipelineState = {
  currentStage?: PipelineStage;
};

function parsePipelineStage(
  pipelineState: string | null,
): PipelineStage | null {
  if (!pipelineState) return null;
  try {
    const parsed = JSON.parse(pipelineState) as LocalPipelineState;
    return parsed.currentStage ?? null;
  } catch {
    return null;
  }
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  brainstorm: "border-primary/50",
  plan: "border-blue-500/50",
  implement: "border-cyan-500/50",
  review: "border-amber-500/50",
  test: "border-emerald-500/50",
  ci: "border-indigo-500/50",
};

const STAGE_BG_COLORS: Record<string, string> = {
  none: "",
  brainstorm: "bg-primary/5",
  plan: "bg-blue-500/5",
  implement: "bg-cyan-500/5",
  review: "bg-amber-500/5",
  test: "bg-emerald-500/5",
  ci: "bg-indigo-500/5",
  done: "bg-green-500/5",
};

const STAGE_DOT_COLORS: Record<string, string> = {
  none: "bg-muted-foreground/40",
  brainstorm: "bg-primary",
  plan: "bg-blue-500",
  implement: "bg-cyan-500",
  review: "bg-amber-500",
  test: "bg-emerald-500",
  ci: "bg-indigo-500",
  done: "bg-green-500",
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  none: "",
  brainstorm: "bg-primary/10 text-primary border-primary/20",
  plan: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  implement:
    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  review:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  test: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  ci: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  done: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const PR_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  open: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  merged:
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  closed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

/**
 * Get the startedAt timestamp of the currently running pipeline stage.
 */
function getRunningStageStartedAt(pipelineState: string | null): string | null {
  const state = parsePipelineState(pipelineState);
  if (!state) return null;
  const running = state.stageHistory.find((h) => h.status === "running");
  return running?.startedAt ?? null;
}

// ─────────────────────────────────────────────────
// BoardCard — individual card component (needs hooks)
// ─────────────────────────────────────────────────

function BoardCard({
  thread,
  stage,
  index,
}: {
  thread: EnrichedThreadListItem;
  stage: PipelineStage | "done" | "none";
  index: number;
}) {
  const runningStartedAt = getRunningStageStartedAt(thread.pipelineState);
  const elapsed = useElapsedTime(runningStartedAt);
  const isError = thread.status === "working-error";

  return (
    <Link href={`/task/${thread.id}`}>
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 gap-0 py-0 shadow-none text-xs",
          "hover:-translate-y-0.5 hover:shadow-md hover:bg-card/80",
          "active:translate-y-0 active:shadow-sm",
          "animate-fade-in",
          stage !== "none" && stage !== "done"
            ? cn(STAGE_COLORS[stage], "hover:border-opacity-100")
            : "",
          isError && "border-destructive/50",
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <CardContent className="p-2.5">
          {/* Title row with error dot */}
          <div className="flex items-start gap-1.5">
            {isError && (
              <span
                className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-destructive"
                title="Error"
              />
            )}
            <p className="font-medium text-foreground line-clamp-2 flex-1">
              {thread.name}
            </p>
          </div>

          {/* Repo name */}
          {thread.githubRepoFullName ? (
            <p className="mt-1 text-muted-foreground/70 truncate flex items-center gap-1">
              <GitBranch className="h-3 w-3 flex-shrink-0" />
              {thread.githubRepoFullName}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground/70 truncate">No repo</p>
          )}

          {/* Metadata row: elapsed time, model, PR badge */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Elapsed time */}
            {elapsed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {elapsed}
              </span>
            )}

            {/* Model badge */}
            {thread.model && (
              <span className="text-[10px] text-muted-foreground/60">
                {thread.model}
              </span>
            )}

            {/* PR badge */}
            {thread.latestPR && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 gap-0.5",
                  PR_STATUS_COLORS[thread.latestPR.prStatus] ?? "",
                )}
              >
                <GitPullRequest className="h-2.5 w-2.5" />#
                {thread.latestPR.prNumber}
              </Badge>
            )}

            {/* Error indicator with label */}
            {thread.hasError && !isError && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
                <AlertCircle className="h-2.5 w-2.5" />
                Error
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─────────────────────────────────────────────────
// Board Page
// ─────────────────────────────────────────────────

export default function BoardPage() {
  useRealtimeGlobal();
  const { data: threads } = useQuery(enrichedThreadListQueryOptions());
  const activeThreads = threads?.filter((t) => !t.archived) ?? [];

  const columns: Array<{
    stage: PipelineStage | "done" | "none";
    label: string;
  }> = [
    { stage: "none", label: "New" },
    ...PIPELINE_STAGES.map((s) => ({
      stage: s,
      label: PIPELINE_STAGE_LABELS[s],
    })),
    { stage: "done", label: "Done" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3">
        <h1 className="text-lg font-semibold font-[var(--font-cabin)]">
          Board
        </h1>
        <p className="text-sm text-muted-foreground">
          Track tasks across pipeline stages
        </p>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex h-full p-4 gap-3">
          {columns.map((col) => {
            const columnThreads = activeThreads.filter((t) => {
              const stage = parsePipelineStage(t.pipelineState);
              if (col.stage === "none") return !stage && t.status === "draft";
              if (col.stage === "done") return t.status === "complete";
              return stage === col.stage;
            });

            return (
              <Card
                key={col.stage}
                className={cn(
                  "flex w-60 flex-shrink-0 flex-col bg-muted/30 gap-0 py-0 shadow-none",
                  STAGE_BG_COLORS[col.stage],
                )}
              >
                <CardHeader className="px-3 py-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STAGE_DOT_COLORS[col.stage],
                        )}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {col.label}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        STAGE_BADGE_COLORS[col.stage],
                      )}
                    >
                      {columnThreads.length}
                    </Badge>
                  </div>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {columnThreads.map((thread, index) => (
                    <BoardCard
                      key={thread.id}
                      thread={thread}
                      stage={col.stage}
                      index={index}
                    />
                  ))}
                  {columnThreads.length === 0 && (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/50">
                      <p className="text-xs text-muted-foreground/50">
                        No tasks
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
