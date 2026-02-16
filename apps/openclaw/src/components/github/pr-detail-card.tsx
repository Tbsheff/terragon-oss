"use client";

import { useQuery } from "@tanstack/react-query";
import {
  threadPRsQueryOptions,
  prChecksQueryOptions,
} from "@/queries/github-queries";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitPullRequest,
  Check,
  X,
  Loader2,
  ExternalLink,
  GitMerge,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  merged: "Merged",
  closed: "Closed",
};

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground",
  open: "text-green-600 dark:text-green-400",
  merged: "text-purple-600 dark:text-purple-400",
  closed: "text-red-600 dark:text-red-400",
};

const mergeableLabel: Record<string, string> = {
  clean: "Ready to merge",
  dirty: "Has conflicts",
  blocked: "Blocked",
  unstable: "Unstable checks",
  unknown: "Checking...",
};

function CheckIcon({
  status,
  conclusion,
}: {
  status: string;
  conclusion: string | null;
}) {
  if (status === "in_progress" || status === "queued") {
    return <Loader2 className="size-3.5 text-yellow-500 animate-spin" />;
  }
  if (conclusion === "success") {
    return <Check className="size-3.5 text-green-500" />;
  }
  if (conclusion === "failure" || conclusion === "timed_out") {
    return <X className="size-3.5 text-red-500" />;
  }
  if (conclusion === "skipped" || conclusion === "neutral") {
    return <CircleDot className="size-3.5 text-muted-foreground" />;
  }
  return <CircleDot className="size-3.5 text-muted-foreground" />;
}

function PRCard({
  pr,
}: {
  pr: {
    id: string;
    prNumber: number;
    prStatus: string;
    prTitle: string | null;
    prUrl: string | null;
    checksStatus: string | null;
    mergeableState: string | null;
    headBranch: string | null;
    baseBranch: string | null;
    repoFullName: string;
  };
}) {
  const { data: checksData } = useQuery(prChecksQueryOptions(pr.id));

  return (
    <Card className="py-4 gap-3">
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-center gap-2">
          <GitPullRequest
            className={cn(
              "size-4",
              statusColor[pr.prStatus] ?? "text-foreground",
            )}
          />
          <CardTitle className="text-sm">
            <span className="tabular-nums">#{pr.prNumber}</span>{" "}
            {pr.prTitle ?? "Untitled PR"}
          </CardTitle>
          {pr.prUrl && (
            <a
              href={pr.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open PR #${pr.prNumber} on GitHub`}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <CardDescription className="flex items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className={cn("text-xs px-1.5 py-0", statusColor[pr.prStatus])}
          >
            {statusLabel[pr.prStatus] ?? pr.prStatus}
          </Badge>
          {pr.headBranch && pr.baseBranch && (
            <span className="text-muted-foreground">
              {pr.headBranch} → {pr.baseBranch}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Mergeable state */}
        {pr.mergeableState &&
          pr.prStatus !== "merged" &&
          pr.prStatus !== "closed" && (
            <div className="flex items-center gap-1.5 text-xs">
              <GitMerge
                className={cn(
                  "size-3",
                  pr.mergeableState === "clean"
                    ? "text-green-500"
                    : "text-yellow-500",
                )}
              />
              <span className="text-muted-foreground">
                {mergeableLabel[pr.mergeableState] ?? pr.mergeableState}
              </span>
            </div>
          )}

        {/* Check runs list */}
        {checksData && checksData.checks.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              CI Checks
            </span>
            <div className="space-y-0.5">
              {checksData.checks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center gap-2 text-xs py-0.5"
                >
                  <CheckIcon
                    status={check.status}
                    conclusion={check.conclusion}
                  />
                  <span className="truncate flex-1">{check.name}</span>
                  {check.conclusion && (
                    <span className="text-muted-foreground capitalize">
                      {check.conclusion}
                    </span>
                  )}
                  {check.detailsUrl && (
                    <a
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${check.name} details`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {checksData && checksData.checks.length === 0 && (
          <span className="text-xs text-muted-foreground">No CI checks</span>
        )}
      </CardContent>
    </Card>
  );
}

export function PRDetailCard({ threadId }: { threadId: string }) {
  const { data: prs, isLoading } = useQuery(threadPRsQueryOptions(threadId));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
        <Loader2 className="size-3.5 animate-spin" />
        Loading PR status...
      </div>
    );
  }

  if (!prs || prs.length === 0) return null;

  return (
    <div className="space-y-3">
      {prs.map((pr) => (
        <PRCard key={pr.id} pr={pr} />
      ))}
    </div>
  );
}
