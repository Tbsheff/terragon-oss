"use client";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/constants";
import { PIPELINE_STAGE_LABELS } from "@/lib/constants";
import type { PipelineStageStatus } from "@/hooks/use-pipeline";
import { Check, X, Loader2, SkipForward, Circle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────

const statusConfig: Record<
  PipelineStageStatus,
  {
    icon: typeof Check;
    color: string;
    bg: string;
    border: string;
    animate?: boolean;
  }
> = {
  pending: {
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-border",
  },
  running: {
    icon: Loader2,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/50",
    animate: true,
  },
  passed: {
    icon: Check,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  failed: {
    icon: X,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  skipped: {
    icon: SkipForward,
    color: "text-muted-foreground/60",
    bg: "bg-muted/30",
    border: "border-border/50",
  },
};

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

type StageBadgeProps = {
  stage: PipelineStage;
  status: PipelineStageStatus;
  retryCount?: number;
  feedback?: string;
  compact?: boolean;
  className?: string;
};

export function StageBadge({
  stage,
  status,
  retryCount,
  feedback,
  compact = false,
  className,
}: StageBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const label = PIPELINE_STAGE_LABELS[stage];
  const hasFeedback = status === "failed" && !!feedback;

  if (compact) {
    const badge = (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full border p-1",
          config.bg,
          config.border,
          className,
        )}
        title={
          hasFeedback
            ? undefined
            : `${label}: ${status}${retryCount ? ` (retry ${retryCount})` : ""}`
        }
      >
        <Icon
          className={cn(
            "h-3 w-3",
            config.color,
            config.animate && "animate-spin",
          )}
        />
      </div>
    );

    if (hasFeedback) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs font-medium">{label} failed</p>
            <p className="text-xs opacity-80">{feedback}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return badge;
  }

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        config.bg,
        config.border,
        config.color,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
      <span>{label}</span>
      {retryCount != null && retryCount > 0 && (
        <span className="text-red-400 font-bold text-[10px]">
          &times;{retryCount}
        </span>
      )}
    </div>
  );

  if (hasFeedback) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-medium">{label} failed</p>
          <p className="text-xs opacity-80">{feedback}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
