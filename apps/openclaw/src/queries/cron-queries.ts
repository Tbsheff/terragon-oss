import { queryOptions } from "@tanstack/react-query";
import {
  listCronJobs,
  getCronRuns,
  getCronStatus,
} from "@/server-actions/cron";

export const cronQueryKeys = {
  all: ["cron"] as const,
  list: () => [...cronQueryKeys.all, "list"] as const,
  status: () => [...cronQueryKeys.all, "status"] as const,
  runs: (jobId: string) => [...cronQueryKeys.all, "runs", jobId] as const,
};

export function cronListQueryOptions() {
  return queryOptions({
    queryKey: cronQueryKeys.list(),
    queryFn: listCronJobs,
    refetchInterval: 15000, // Refetch every 15s
  });
}

export function cronStatusQueryOptions() {
  return queryOptions({
    queryKey: cronQueryKeys.status(),
    queryFn: getCronStatus,
  });
}

export function cronRunsQueryOptions(jobId: string) {
  return queryOptions({
    queryKey: cronQueryKeys.runs(jobId),
    queryFn: () => getCronRuns(jobId),
  });
}
