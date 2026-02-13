"use client";

import { queryOptions } from "@tanstack/react-query";
import {
  getDashboardStats,
  type DashboardStats,
} from "@/server-actions/dashboard-stats";

/** Query key factories */
export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  stats: () => ["dashboard", "stats"] as const,
};

/** Query options for dashboard stats — polls every 5s */
export function dashboardStatsQueryOptions() {
  return queryOptions<DashboardStats>({
    queryKey: dashboardQueryKeys.stats(),
    queryFn: () => getDashboardStats(),
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}
