"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, Users, ListOrdered } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getHealthStatus } from "@/server-actions/gateway";
import { CostChart } from "./cost-chart";

function MetricBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted/50">
      <div
        className={cn("h-2 rounded-full transition-all duration-500", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  barValue,
  barMax,
  barColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  barValue?: number;
  barMax?: number;
  barColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {barValue !== undefined && barMax !== undefined && barColor && (
          <div className="mt-3">
            <MetricBar value={barValue} max={barMax} color={barColor} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TokenUsageEntry = {
  taskName?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  date?: string;
};

export function ResourceDashboard({
  tokenUsageData,
}: {
  tokenUsageData?: TokenUsageEntry[];
}) {
  const { data: healthResult, isLoading } = useQuery({
    queryKey: ["resources", "health"],
    queryFn: () => getHealthStatus(),
    refetchInterval: 30_000,
  });

  const health = healthResult?.health;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const cpuPercent = health?.cpu ?? 0;
  const memPercent = health?.memory ?? 0;
  const activeSessions = health?.activeSessions ?? 0;
  const maxCapacity = 5; // Configurable from settings

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU Usage"
          value={`${cpuPercent.toFixed(1)}%`}
          subtitle="Current processor load"
          icon={Cpu}
          barValue={cpuPercent}
          barMax={100}
          barColor={
            cpuPercent > 80
              ? "bg-red-500"
              : cpuPercent > 50
                ? "bg-yellow-500"
                : "bg-emerald-500"
          }
        />
        <MetricCard
          title="Memory"
          value={`${memPercent.toFixed(1)}%`}
          subtitle="RAM utilization"
          icon={HardDrive}
          barValue={memPercent}
          barMax={100}
          barColor={
            memPercent > 80
              ? "bg-red-500"
              : memPercent > 60
                ? "bg-yellow-500"
                : "bg-blue-500"
          }
        />
        <MetricCard
          title="Active Agents"
          value={`${activeSessions}`}
          subtitle={`of ${maxCapacity} capacity`}
          icon={Users}
          barValue={activeSessions}
          barMax={maxCapacity}
          barColor="bg-violet-500"
        />
        <MetricCard
          title="Queue Depth"
          value="0"
          subtitle="Tasks waiting"
          icon={ListOrdered}
        />
      </div>

      {tokenUsageData && tokenUsageData.length > 0 && (
        <CostChart entries={tokenUsageData} />
      )}
    </div>
  );
}
