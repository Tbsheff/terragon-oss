"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react";
import type { ThreadListItem } from "@/server-actions/threads";

type RecentActivityFeedProps = {
  threads: ThreadListItem[] | undefined;
};

const DEFAULT_STATUS = {
  icon: Play,
  color: "text-muted-foreground",
  label: "Draft",
} as const;

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  complete: {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Completed",
  },
  "working-done": {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Done",
  },
  working: { icon: Loader2, color: "text-primary", label: "Working" },
  stopping: { icon: Loader2, color: "text-amber-500", label: "Stopping" },
  "working-error": {
    icon: AlertCircle,
    color: "text-destructive",
    label: "Error",
  },
  queued: { icon: Clock, color: "text-amber-500", label: "Queued" },
  draft: { icon: Play, color: "text-muted-foreground", label: "Draft" },
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

export function RecentActivityFeed({ threads }: RecentActivityFeedProps) {
  // Show the 10 most recently updated, non-archived threads
  const recent = threads?.filter((t) => !t.archived).slice(0, 10);

  return (
    <Card
      className="animate-fade-in border-border/60 shadow-xs border-t-2 border-t-primary/20"
      style={{ animationDelay: "300ms" }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-[var(--font-cabin)] text-base tracking-tight">
          <Clock className="size-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recent || recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Clock className="size-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="mt-0.5 text-xs opacity-50 text-pretty">
              Tasks will appear here as they run
            </p>
          </div>
        ) : (
          <div className="-mx-1 divide-y divide-border/40">
            {recent.map((t, i) => {
              const config = STATUS_CONFIG[t.status] ?? DEFAULT_STATUS;
              const Icon = config.icon;

              return (
                <Link
                  key={t.id}
                  href={`/task/${t.id}`}
                  className={cn(
                    "animate-fade-in flex items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors duration-150",
                    "hover:bg-muted/50",
                  )}
                  style={{
                    animationDelay: `${350 + i * 40}ms`,
                  }}
                >
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      config.color,
                      t.status === "working" && "animate-spin",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.name ?? "Untitled"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] px-1.5 py-0 h-4",
                      config.color,
                    )}
                  >
                    {config.label}
                  </Badge>
                  <span className="shrink-0 w-12 text-right text-[10px] text-muted-foreground/60 tabular-nums">
                    {timeAgo(t.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
