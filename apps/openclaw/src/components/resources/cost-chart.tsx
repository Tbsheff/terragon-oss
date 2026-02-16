"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCost } from "@/lib/utils";

type CostEntry = {
  taskName?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  date?: string;
};

type AggregatedEntry = {
  label: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  count: number;
};

type ViewMode = "daily" | "weekly" | "per-task";

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CostChart({ entries }: { entries: CostEntry[] }) {
  const [view, setView] = useState<ViewMode>("daily");

  const aggregated = useMemo((): AggregatedEntry[] => {
    if (view === "per-task") {
      return entries.map((e, i) => ({
        label: e.taskName ?? `Task ${i + 1}`,
        inputTokens: e.inputTokens ?? 0,
        outputTokens: e.outputTokens ?? 0,
        totalCost: e.totalCost ?? 0,
        count: 1,
      }));
    }

    const grouped = new Map<string, AggregatedEntry>();

    for (const entry of entries) {
      const dateStr = entry.date ?? new Date().toISOString();
      const key =
        view === "daily" ? getDayLabel(dateStr) : getWeekLabel(dateStr);

      const existing = grouped.get(key);
      if (existing) {
        existing.inputTokens += entry.inputTokens ?? 0;
        existing.outputTokens += entry.outputTokens ?? 0;
        existing.totalCost += entry.totalCost ?? 0;
        existing.count += 1;
      } else {
        grouped.set(key, {
          label: key,
          inputTokens: entry.inputTokens ?? 0,
          outputTokens: entry.outputTokens ?? 0,
          totalCost: entry.totalCost ?? 0,
          count: 1,
        });
      }
    }

    return Array.from(grouped.values());
  }, [entries, view]);

  const maxCost = Math.max(...aggregated.map((e) => e.totalCost), 0.001);
  const totalCost = aggregated.reduce((sum, e) => sum + e.totalCost, 0);
  const totalInput = aggregated.reduce((sum, e) => sum + e.inputTokens, 0);
  const totalOutput = aggregated.reduce((sum, e) => sum + e.outputTokens, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Token Costs</CardTitle>
            <CardDescription className="tabular-nums">
              Total: {formatCost(totalCost)} &middot;{" "}
              {totalInput.toLocaleString()} input /{" "}
              {totalOutput.toLocaleString()} output tokens
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {(["daily", "weekly", "per-task"] as const).map((mode) => (
              <Button
                key={mode}
                variant={view === mode ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setView(mode)}
              >
                {mode === "per-task"
                  ? "Per Task"
                  : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {aggregated.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground text-pretty">
            No cost data available
          </div>
        ) : (
          <div className="space-y-3">
            {aggregated.map((entry, i) => {
              const inputPct =
                entry.totalCost > 0
                  ? (entry.inputTokens /
                      (entry.inputTokens + entry.outputTokens)) *
                    (entry.totalCost / maxCost) *
                    100
                  : 0;
              const outputPct =
                entry.totalCost > 0
                  ? (entry.outputTokens /
                      (entry.inputTokens + entry.outputTokens)) *
                    (entry.totalCost / maxCost) *
                    100
                  : 0;

              return (
                <div key={`${entry.label}-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {entry.label}
                      {entry.count > 1 && (
                        <span className="ml-1 text-muted-foreground/60">
                          ({entry.count} tasks)
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatCost(entry.totalCost)}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="bg-chart-2 transition-all duration-300"
                      style={{ width: `${inputPct}%` }}
                      title={`Input: ${entry.inputTokens.toLocaleString()} tokens`}
                    />
                    <div
                      className="bg-chart-4 transition-all duration-300"
                      style={{ width: `${outputPct}%` }}
                      title={`Output: ${entry.outputTokens.toLocaleString()} tokens`}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-chart-2" />
                Input tokens
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-chart-4" />
                Output tokens
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
