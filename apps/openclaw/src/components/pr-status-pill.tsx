"use client";

import { cn } from "@/lib/utils";
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  FileEdit,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type PRStatus = "draft" | "open" | "merged" | "closed";
type ChecksStatus = "none" | "pending" | "success" | "failure" | "unknown";

interface PRStatusPillProps {
  prStatus: PRStatus;
  checksStatus?: ChecksStatus;
  prNumber?: number;
  prUrl?: string | null;
  className?: string;
}

// ─────────────────────────────────────────────────
// Status configs
// ─────────────────────────────────────────────────

const prStatusConfig: Record<
  PRStatus,
  { label: string; icon: typeof GitPullRequest; colorClass: string }
> = {
  draft: {
    label: "Draft",
    icon: FileEdit,
    colorClass: "bg-zinc-700/60 text-zinc-300 border-zinc-600",
  },
  open: {
    label: "Open",
    icon: GitPullRequest,
    colorClass: "bg-green-900/40 text-green-400 border-green-700/50",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    colorClass: "bg-purple-900/40 text-purple-400 border-purple-700/50",
  },
  closed: {
    label: "Closed",
    icon: XCircle,
    colorClass: "bg-red-900/40 text-red-400 border-red-700/50",
  },
};

const checksConfig: Record<
  ChecksStatus,
  { icon: typeof CheckCircle2; colorClass: string; label: string } | null
> = {
  none: null,
  pending: {
    icon: Loader2,
    colorClass: "text-yellow-400",
    label: "Checks running",
  },
  success: {
    icon: CheckCircle2,
    colorClass: "text-green-400",
    label: "Checks passing",
  },
  failure: {
    icon: AlertCircle,
    colorClass: "text-red-400",
    label: "Checks failing",
  },
  unknown: {
    icon: Clock,
    colorClass: "text-zinc-400",
    label: "Checks unknown",
  },
};

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export function PRStatusPill({
  prStatus,
  checksStatus = "none",
  prNumber,
  prUrl,
  className,
}: PRStatusPillProps) {
  const statusCfg = prStatusConfig[prStatus];
  const checksCfg = checksConfig[checksStatus];
  const StatusIcon = statusCfg.icon;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        statusCfg.colorClass,
        className,
      )}
      title={
        checksCfg ? `${statusCfg.label} - ${checksCfg.label}` : statusCfg.label
      }
    >
      <StatusIcon className="h-3 w-3" />
      <span>
        {prNumber ? `#${prNumber}` : ""} {statusCfg.label}
      </span>
      {checksCfg && (
        <span className={cn("ml-0.5 flex items-center", checksCfg.colorClass)}>
          <checksCfg.icon
            className={cn(
              "h-3 w-3",
              checksStatus === "pending" && "animate-spin",
            )}
          />
        </span>
      )}
    </span>
  );

  if (prUrl) {
    return (
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return content;
}
