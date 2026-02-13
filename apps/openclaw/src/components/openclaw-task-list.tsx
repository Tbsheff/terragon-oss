"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { Circle, CheckCircle2, XCircle, Loader2, Archive } from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
    case "working-done":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "working":
    case "stopping":
      return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
    case "working-error":
      return <XCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
}

function StageBadge({ stage }: { stage: PipelineStage | "done" }) {
  if (stage === "done") {
    return (
      <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
        Done
      </span>
    );
  }
  return (
    <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}

export function OpenClawTaskList() {
  const pathname = usePathname();

  const { data: activeThreads = [] } = useQuery(
    threadListQueryOptions({ archived: false }),
  );
  const { data: archivedThreads = [] } = useQuery(
    threadListQueryOptions({ archived: true }),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Active tasks */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Active
        </h3>
        {activeThreads.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No active tasks
          </p>
        ) : (
          activeThreads.map((t) => {
            const isActive = pathname === `/task/${t.id}`;
            const pipeline = parsePipelineState(t.pipelineState);

            return (
              <Link
                key={t.id}
                href={`/task/${t.id}`}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
                )}
              >
                <StatusIcon status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">
                    {t.name ?? "Untitled Task"}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {pipeline?.currentStage && (
                      <StageBadge stage={pipeline.currentStage} />
                    )}
                    {t.githubRepoFullName && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {t.githubRepoFullName.split("/")[1]}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Archived tasks */}
      {archivedThreads.length > 0 && (
        <div className="border-t border-border px-2 py-2">
          <h3 className="mb-1 flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Archive className="h-3 w-3" />
            Archived ({archivedThreads.length})
          </h3>
          <div className="max-h-32 overflow-y-auto">
            {archivedThreads.slice(0, 10).map((t) => (
              <Link
                key={t.id}
                href={`/task/${t.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <StatusIcon status={t.status} />
                <span className="truncate">{t.name ?? "Untitled"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
