"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "@/server-actions/dashboard-stats";

type ErrorFeedProps = {
  errors: DashboardStats["recentErrors"] | undefined;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ErrorFeed({ errors }: ErrorFeedProps) {
  return (
    <Card
      className="animate-fade-in border-border/60 shadow-xs border-t-2 border-t-primary/20"
      style={{ animationDelay: "350ms" }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-[var(--font-cabin)] text-base tracking-tight">
          <AlertTriangle className="size-4 text-destructive" />
          Recent Errors
          {errors && errors.length > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto text-xs tabular-nums"
            >
              {errors.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!errors || errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertTriangle className="size-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">No recent errors</p>
            <p className="mt-0.5 text-xs opacity-50 text-pretty">
              Looking good
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err, i) => (
              <Link
                key={`${err.threadId}-${i}`}
                href={`/task/${err.threadId}`}
                className="group flex items-start gap-2.5 rounded-lg border border-destructive/15 bg-destructive/[0.03] p-3 transition-all duration-200 hover:bg-destructive/[0.07] hover:border-destructive/25"
              >
                <div className="mt-1 size-2 shrink-0 rounded-full bg-destructive/70" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-destructive">
                      {err.threadName ?? "Untitled"}
                    </span>
                    {err.stage && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] px-1 py-0 h-4 border-destructive/25 text-destructive/80"
                      >
                        {err.stage}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground leading-relaxed text-pretty">
                    {err.errorMessage}
                  </p>
                  <span className="mt-1 block text-[10px] text-muted-foreground/50 tabular-nums">
                    {timeAgo(err.updatedAt)}
                  </span>
                </div>
                <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
