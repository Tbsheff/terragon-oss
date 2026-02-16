"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Bot } from "lucide-react";
import type { ThreadListItem } from "@/server-actions/threads";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { PipelineStatus } from "@/components/pipeline/pipeline-status";
import { getActivityLabel } from "@/lib/activity-label";
import type { PipelineStage } from "@/lib/constants";
import { AgentCardTimer } from "./agent-card-timer";

type ActiveAgentsPanelProps = {
  threads: ThreadListItem[] | undefined;
};

export function ActiveAgentsPanel({ threads }: ActiveAgentsPanelProps) {
  const activeThreads = threads?.filter(
    (t) =>
      t.status === "working" ||
      t.status === "stopping" ||
      t.status === "queued",
  );

  return (
    <Card
      className="animate-fade-in border-border/60 shadow-xs border-t-2 border-t-primary/20"
      style={{ animationDelay: "200ms" }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-[var(--font-cabin)] text-base tracking-tight">
          <Activity className="size-4 text-primary" />
          Active Agents
          {activeThreads && activeThreads.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
              {activeThreads.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!activeThreads || activeThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bot className="size-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No active agents</p>
            <p className="mt-0.5 text-xs opacity-50 text-pretty">
              Start a task to see agents here
            </p>
          </div>
        ) : (
          activeThreads.map((t, i) => (
            <AgentCard key={t.id} thread={t} index={i} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AgentCard({
  thread,
  index,
}: {
  thread: ThreadListItem;
  index: number;
}) {
  const pipelineState = parsePipelineState(thread.pipelineState);
  const currentStage = pipelineState?.currentStage ?? null;
  const activityLabel = getActivityLabel(
    currentStage as PipelineStage | "done" | null,
    thread.status,
  );

  // Determine if there's an active running stage for elapsed time
  const runningEntry = pipelineState?.stageHistory.find(
    (h) => h.status === "running",
  );

  return (
    <Link
      href={`/task/${thread.id}`}
      className={cn(
        "animate-fade-in group block rounded-lg border border-border/60 bg-card p-3.5 transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30",
      )}
      style={{
        animationDelay: `${250 + index * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-medium leading-snug">
              {thread.name ?? "Untitled"}
            </h4>
            {thread.status === "working-error" && (
              <span className="size-2 shrink-0 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
          {activityLabel && (
            <p className="mt-1 text-xs text-muted-foreground leading-none">
              {activityLabel}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread.model && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {thread.model}
            </Badge>
          )}
          <AgentCardTimer startedAt={runningEntry?.startedAt ?? null} />
        </div>
      </div>

      {/* Mini pipeline progress */}
      {pipelineState && (
        <PipelineStatus state={pipelineState} compact className="mt-1.5" />
      )}
    </Link>
  );
}
