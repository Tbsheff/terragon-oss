"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DashboardStats } from "@/server-actions/dashboard-stats";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  delay: number;
};

function StatCard({ label, value, icon: Icon, color, delay }: StatCardProps) {
  return (
    <Card
      className="animate-fade-in bg-card/50 backdrop-blur-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            color,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold font-[var(--font-cabin)] tabular-nums leading-none">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type QuickStatsRowProps = {
  stats: DashboardStats | undefined;
};

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Active Agents"
        value={stats?.activeCount ?? 0}
        icon={Activity}
        color="bg-primary/15 text-primary"
        delay={0}
      />
      <StatCard
        label="Queue Depth"
        value={stats?.queuedCount ?? 0}
        icon={Clock}
        color="bg-amber-500/15 text-amber-500"
        delay={50}
      />
      <StatCard
        label="Completed Today"
        value={stats?.completedTodayCount ?? 0}
        icon={CheckCircle2}
        color="bg-green-500/15 text-green-500"
        delay={100}
      />
      <StatCard
        label="Errors"
        value={stats?.errorCount ?? 0}
        icon={AlertTriangle}
        color="bg-destructive/15 text-destructive"
        delay={150}
      />
    </div>
  );
}
