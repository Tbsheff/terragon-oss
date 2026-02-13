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
      className="animate-fade-in bg-card/50 backdrop-blur-sm"
      style={{ animationDelay: "350ms" }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-[var(--font-cabin)] text-base tracking-tight">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Recent Errors
          {errors && errors.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {errors.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!errors || errors.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recent errors
          </p>
        ) : (
          <div className="space-y-2">
            {errors.map((err, i) => (
              <Link
                key={`${err.threadId}-${i}`}
                href={`/task/${err.threadId}`}
                className="group flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 transition-all duration-200 hover:bg-destructive/10 hover:border-destructive/30"
              >
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-destructive">
                      {err.threadName ?? "Untitled"}
                    </span>
                    {err.stage && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] px-1 py-0 h-4 border-destructive/30 text-destructive"
                      >
                        {err.stage}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {err.errorMessage}
                  </p>
                  <span className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {timeAgo(err.updatedAt)}
                  </span>
                </div>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
