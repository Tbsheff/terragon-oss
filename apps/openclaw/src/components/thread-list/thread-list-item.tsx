"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parsePipelineState } from "@/hooks/use-pipeline";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/constants";
import { getActivityLabel } from "@/lib/activity-label";
import { parseTokenUsage } from "@/lib/token-usage";
import { formatCost, cn } from "@/lib/utils";
import type { ThreadListItem as ThreadListItemType } from "@/server-actions/threads";
import {
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────
// StatusIcon
// ─────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────
// StageBadge
// ─────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────
// ElapsedBadge
// ─────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────
// ThreadListItem
// ─────────────────────────────────────────────────

export function ThreadListItem({
  thread,
  index = 0,
}: {
  thread: ThreadListItemType;
  index?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === `/task/${thread.id}`;

  const pipeline = parsePipelineState(thread.pipelineState);
  const isTaskWorking =
    thread.status === "working" || thread.status === "stopping";
  const isError = thread.status === "working-error";
  const firstEntry = pipeline?.stageHistory[0];
  const activityLabel = getActivityLabel(
    pipeline?.currentStage ?? null,
    thread.status,
  );
  const tokenUsage = parseTokenUsage(thread.tokenUsage);

  return (
    <Link
      href={`/task/${thread.id}`}
      className={cn(
        "flex items-start gap-2 px-3 py-2 rounded-md mx-1 transition-colors animate-fade-in",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="mt-0.5">
        <StatusIcon status={thread.status} />
      </div>
      <span className="flex flex-col gap-0.5 min-w-0 flex-1">
        {/* Row 1: Task name + error/elapsed indicators */}
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-xs font-medium leading-snug">
            {thread.name ?? "Untitled Task"}
          </span>
          {isError && (
            <AlertTriangle className="size-3 text-destructive shrink-0" />
          )}
          {isTaskWorking && (
            <ElapsedBadge startedAt={firstEntry?.startedAt ?? null} />
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
          {tokenUsage?.totalCost != null && tokenUsage.totalCost > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              {formatCost(tokenUsage.totalCost)}
            </span>
          )}
          {thread.githubRepoFullName && (
            <span className="text-[10px] text-muted-foreground truncate ml-auto">
              {thread.githubRepoFullName.split("/")[1]}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
