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
      className="animate-fade-in bg-card/50 backdrop-blur-sm"
      style={{ animationDelay: "200ms" }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-[var(--font-cabin)] text-base tracking-tight">
          <Activity className="h-4 w-4 text-primary" />
          Active Agents
          {activeThreads && activeThreads.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {activeThreads.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!activeThreads || activeThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No active agents</p>
            <p className="text-xs opacity-60">
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
        "animate-fade-in block rounded-lg border bg-card/80 p-3 transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30",
      )}
      style={{
        animationDelay: `${250 + index * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-medium">
              {thread.name ?? "Untitled"}
            </h4>
            {thread.status === "working-error" && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
          {activityLabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activityLabel}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
        <PipelineStatus state={pipelineState} compact className="mt-1" />
      )}
    </Link>
  );
}
