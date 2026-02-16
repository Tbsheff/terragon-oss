"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { getActivityLabel } from "@/lib/activity-label";
import { parseTokenUsage } from "@/lib/token-usage";
import { formatCost } from "@/lib/utils";
import {
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  Archive,
  Clock,
  Leaf,
  AlertTriangle,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
    case "working-done":
      return <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />;
    case "working":
    case "stopping":
      return (
        <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
      );
    case "working-error":
      return <XCircle className="size-3.5 text-destructive shrink-0" />;
    default:
      return <Circle className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

function StageBadge({ stage }: { stage: PipelineStage | "done" }) {
  if (stage === "done") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] leading-none text-green-500 border-green-500/30 px-1 py-0 rounded-sm"
      >
        Done
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] leading-none text-primary border-primary/30 px-1 py-0 rounded-sm"
    >
      {PIPELINE_STAGE_LABELS[stage]}
    </Badge>
  );
}

function ElapsedBadge({ startedAt }: { startedAt: string | null }) {
  const elapsed = useElapsedTime(startedAt);
  if (!elapsed) return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums">
      <Clock className="size-2.5" />
      {elapsed}
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
    <div className="flex flex-col">
      {/* Active tasks */}
      <SidebarMenu>
        {activeThreads.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <Leaf className="size-5 opacity-40" />
            <p className="text-xs text-pretty">No active tasks</p>
          </div>
        ) : (
          activeThreads.map((t, index) => {
            const isActive = pathname === `/task/${t.id}`;
            const pipeline = parsePipelineState(t.pipelineState);
            const isTaskWorking =
              t.status === "working" || t.status === "stopping";
            const isError = t.status === "working-error";
            const firstEntry = pipeline?.stageHistory[0];
            const activityLabel = getActivityLabel(
              pipeline?.currentStage ?? null,
              t.status,
            );
            const tokenUsage = parseTokenUsage(t.tokenUsage);

            return (
              <SidebarMenuItem
                key={t.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={t.name ?? "Untitled Task"}
                  className="h-auto py-1.5"
                >
                  <Link href={`/task/${t.id}`}>
                    <StatusIcon status={t.status} />
                    <span className="flex flex-col gap-0.5 min-w-0">
                      {/* Row 1: Task name + error/elapsed indicators */}
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-xs font-medium leading-snug">
                          {t.name ?? "Untitled Task"}
                        </span>
                        {isError && (
                          <AlertTriangle className="size-3 text-destructive shrink-0" />
                        )}
                        {isTaskWorking && (
                          <ElapsedBadge
                            startedAt={firstEntry?.startedAt ?? null}
                          />
                        )}
                      </span>
                      {/* Row 2: Activity label (only when working) */}
                      {isTaskWorking && activityLabel && (
                        <span className="text-[10px] leading-tight text-muted-foreground truncate">
                          {activityLabel}
                        </span>
                      )}
                      {/* Row 3: Stage + metadata */}
                      <span className="flex items-center gap-1.5 min-w-0">
                        {pipeline?.currentStage && (
                          <StageBadge stage={pipeline.currentStage} />
                        )}
                        {tokenUsage?.totalCost != null &&
                          tokenUsage.totalCost > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                              {formatCost(tokenUsage.totalCost)}
                            </span>
                          )}
                        {t.githubRepoFullName && (
                          <span className="text-[10px] text-muted-foreground truncate ml-auto">
                            {t.githubRepoFullName.split("/")[1]}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })
        )}
      </SidebarMenu>

      {/* Archived tasks */}
      {archivedThreads.length > 0 && (
        <div className="group-data-[collapsible=icon]:hidden">
          <SidebarSeparator className="my-2" />
          <div className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-medium text-sidebar-foreground/70 uppercase tracking-wider">
            <Archive className="size-3" />
            Archived ({archivedThreads.length})
          </div>
          <SidebarMenu>
            {archivedThreads.slice(0, 10).map((t) => (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  tooltip={t.name ?? "Untitled"}
                  className="text-muted-foreground"
                >
                  <Link href={`/task/${t.id}`}>
                    <StatusIcon status={t.status} />
                    <span className="truncate text-xs">
                      {t.name ?? "Untitled"}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      )}
    </div>
  );
}
