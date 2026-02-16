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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Kanban,
  GitBranch,
  GitPullRequest,
  Clock,
  AlertCircle,
  Inbox,
} from "lucide-react";

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
  brainstorm: "border-l-primary/70",
  plan: "border-l-blue-500/70",
  implement: "border-l-cyan-500/70",
  review: "border-l-amber-500/70",
  test: "border-l-emerald-500/70",
  ci: "border-l-indigo-500/70",
};

const STAGE_BG_COLORS: Record<string, string> = {
  none: "bg-muted/20",
  brainstorm: "bg-primary/[0.03]",
  plan: "bg-blue-500/[0.03]",
  implement: "bg-cyan-500/[0.03]",
  review: "bg-amber-500/[0.03]",
  test: "bg-emerald-500/[0.03]",
  ci: "bg-indigo-500/[0.03]",
  done: "bg-green-500/[0.03]",
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

const STAGE_HEADER_BORDER: Record<string, string> = {
  none: "border-l-muted-foreground/30",
  brainstorm: "border-l-primary",
  plan: "border-l-blue-500",
  implement: "border-l-cyan-500",
  review: "border-l-amber-500",
  test: "border-l-emerald-500",
  ci: "border-l-indigo-500",
  done: "border-l-green-500",
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
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
          "cursor-pointer transition-all duration-200 gap-0 py-0 shadow-none border-l-2",
          "hover:-translate-y-0.5 hover:shadow-md hover:bg-card/80",
          "active:translate-y-0 active:shadow-sm",
          "animate-fade-in",
          stage !== "none" && stage !== "done"
            ? STAGE_COLORS[stage]
            : "border-l-transparent",
          isError && "border-l-destructive/70",
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <CardContent className="p-3">
          {/* Title row with error dot */}
          <div className="flex items-start gap-1.5">
            {isError && (
              <span
                className="mt-0.5 size-2 flex-shrink-0 rounded-full bg-destructive animate-pulse"
                title="Error"
              />
            )}
            <p className="text-[13px] font-medium leading-snug text-foreground line-clamp-2 flex-1">
              {thread.name}
            </p>
          </div>

          {/* Repo name */}
          {thread.githubRepoFullName ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground/60 truncate flex items-center gap-1">
              <GitBranch className="size-3 flex-shrink-0" />
              {thread.githubRepoFullName}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground/40 truncate italic">
              No repo
            </p>
          )}

          {/* Metadata row: elapsed time, model, PR badge */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Elapsed time */}
            {elapsed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                <Clock className="size-2.5" />
                {elapsed}
              </span>
            )}

            {/* Model badge */}
            {thread.model && (
              <span className="text-[10px] text-muted-foreground/50 font-mono">
                {thread.model}
              </span>
            )}

            {/* PR badge */}
            {thread.latestPR && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 gap-0.5 h-4",
                  PR_STATUS_COLORS[thread.latestPR.prStatus] ?? "",
                )}
              >
                <GitPullRequest className="size-2.5" />#
                {thread.latestPR.prNumber}
              </Badge>
            )}

            {/* Error indicator with label */}
            {thread.hasError && !isError && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-0.5 h-4 border-destructive/30 text-destructive bg-destructive/5"
              >
                <AlertCircle className="size-2.5" />
                Error
              </Badge>
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

  const totalActive = activeThreads.length;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-lg bg-primary/10 p-1.5">
            <Kanban className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold font-[var(--font-cabin)] tracking-tight text-balance">
              Board
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
              <span className="tabular-nums">{totalActive}</span> active task
              {totalActive !== 1 ? "s" : ""} across pipeline stages
            </p>
          </div>
        </div>
      </div>
      <Separator />
      <div className="relative flex-1 min-h-0">
        {/* Right fade hint for horizontal scroll */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <ScrollArea className="h-full">
          <div className="flex h-full p-4 gap-3">
            {columns.map((col) => {
              const columnThreads = activeThreads.filter((t) => {
                const stage = parsePipelineStage(t.pipelineState);
                if (col.stage === "none") return !stage && t.status === "draft";
                if (col.stage === "done") return t.status === "complete";
                return stage === col.stage;
              });

              return (
                <div
                  key={col.stage}
                  className={cn(
                    "flex min-w-[272px] flex-shrink-0 flex-col rounded-xl border border-border/50",
                    STAGE_BG_COLORS[col.stage],
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2.5 border-b border-border/50 border-l-2 rounded-tl-xl",
                      STAGE_HEADER_BORDER[col.stage],
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            STAGE_DOT_COLORS[col.stage],
                          )}
                        />
                        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                          {col.label}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 tabular-nums",
                          STAGE_BADGE_COLORS[col.stage],
                        )}
                      >
                        {columnThreads.length}
                      </Badge>
                    </div>
                  </div>
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
                      <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40">
                        <Inbox className="size-4 text-muted-foreground/30" />
                        <p className="text-[11px] text-muted-foreground/40 text-pretty">
                          No tasks
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Spacer so last column isn't clipped by fade */}
            <div className="w-4 flex-shrink-0" />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
