"use client";

import { GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  open: "border-green-500/30 text-green-500 bg-green-500/10",
  merged: "border-purple-500/30 text-purple-500 bg-purple-500/10",
  closed: "border-red-500/30 text-red-500 bg-red-500/10",
};

const checksDot: Record<string, string> = {
  success: "bg-green-500",
  failure: "bg-red-500",
  pending: "bg-yellow-500 animate-pulse",
  none: "bg-muted-foreground/40",
  unknown: "bg-muted-foreground/40",
};

type PRStatusBadgeProps = {
  prNumber: number;
  prStatus: string;
  prUrl?: string | null;
  checksStatus?: string | null;
  className?: string;
};

export function PRStatusBadge({
  prNumber,
  prStatus,
  prUrl,
  checksStatus,
  className,
}: PRStatusBadgeProps) {
  const style = statusStyles[prStatus] ?? statusStyles.open;
  const dotColor = checksDot[checksStatus ?? "none"] ?? checksDot.none;

  const content = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs font-medium px-2 py-0.5",
        style,
        prUrl && "cursor-pointer hover:opacity-80",
        className,
      )}
    >
      <GitPullRequest className="h-3 w-3" />
      PR #{prNumber}
      {checksStatus && checksStatus !== "none" && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      )}
    </Badge>
  );

  if (prUrl) {
    return (
      <a href={prUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
