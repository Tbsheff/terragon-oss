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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

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
      <Badge
        variant="outline"
        className="text-[10px] text-green-500 border-green-500/30 px-1.5 py-0"
      >
        Done
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] text-primary border-primary/30 px-1.5 py-0"
    >
      {PIPELINE_STAGE_LABELS[stage]}
    </Badge>
  );
}

function ElapsedBadge({ startedAt }: { startedAt: string | null }) {
  const elapsed = useElapsedTime(startedAt);
  if (!elapsed) return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
      <Clock className="h-2.5 w-2.5" />
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
    <div className="flex flex-col gap-2">
      {/* Active tasks */}
      <SidebarMenu>
        {activeThreads.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <Leaf className="h-5 w-5 opacity-40" />
            <p className="text-xs">No active tasks</p>
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
                >
                  <Link href={`/task/${t.id}`}>
                    <StatusIcon status={t.status} />
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="truncate text-xs font-medium">
                          {t.name ?? "Untitled Task"}
                        </span>
                        {isError && (
                          <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                        )}
                        {isTaskWorking && (
                          <ElapsedBadge
                            startedAt={firstEntry?.startedAt ?? null}
                          />
                        )}
                      </span>
                      {isTaskWorking && activityLabel && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {activityLabel}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {pipeline?.currentStage && (
                          <StageBadge stage={pipeline.currentStage} />
                        )}
                        {tokenUsage?.totalCost != null &&
                          tokenUsage.totalCost > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatCost(tokenUsage.totalCost)}
                            </span>
                          )}
                        {t.githubRepoFullName && (
                          <span className="text-[10px] text-muted-foreground truncate">
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
        <div className="border-t border-sidebar-border pt-2 group-data-[collapsible=icon]:hidden">
          <h3 className="mb-1 flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider font-[var(--font-cabin)]">
            <Archive className="h-3 w-3" />
            Archived ({archivedThreads.length})
          </h3>
          <SidebarMenu>
            {archivedThreads.slice(0, 10).map((t) => (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  tooltip={t.name ?? "Untitled"}
                >
                  <Link href={`/task/${t.id}`}>
                    <StatusIcon status={t.status} />
                    <span className="truncate">{t.name ?? "Untitled"}</span>
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
