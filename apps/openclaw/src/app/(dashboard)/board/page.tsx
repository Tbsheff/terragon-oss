"use client";

import { useQuery } from "@tanstack/react-query";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type PipelineState = {
  currentStage?: PipelineStage;
};

function parsePipelineStage(
  pipelineState: string | null,
): PipelineStage | null {
  if (!pipelineState) return null;
  try {
    const parsed = JSON.parse(pipelineState) as PipelineState;
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

export default function BoardPage() {
  const { data: threads } = useQuery(threadListQueryOptions());
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
        <h1 className="text-lg font-semibold">Board</h1>
        <p className="text-sm text-muted-foreground">
          Track tasks across pipeline stages
        </p>
      </div>
      <Separator />
      <div className="flex flex-1 overflow-x-auto p-4 gap-3">
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
              className="flex w-56 flex-shrink-0 flex-col bg-muted/30 gap-0 py-0 shadow-none"
            >
              <CardHeader className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {columnThreads.length}
                  </Badge>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnThreads.map((thread) => (
                  <Link key={thread.id} href={`/task/${thread.id}`}>
                    <Card
                      className={cn(
                        "cursor-pointer hover:bg-card/80 transition-colors gap-0 py-0 shadow-none text-xs",
                        col.stage !== "none" && col.stage !== "done"
                          ? STAGE_COLORS[col.stage]
                          : "",
                      )}
                    >
                      <CardContent className="p-2.5">
                        <p className="font-medium text-foreground line-clamp-2">
                          {thread.name}
                        </p>
                        <p className="mt-1 text-muted-foreground/70 truncate">
                          {thread.githubRepoFullName || "No repo"}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {columnThreads.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    No tasks
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
