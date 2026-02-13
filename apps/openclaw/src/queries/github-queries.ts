"use client";

import { queryOptions } from "@tanstack/react-query";
import { getThreadPRs, pollCheckStatus } from "@/server-actions/github";

/** Query key factories */
export const githubQueryKeys = {
  prs: (threadId: string) => ["github", "prs", threadId] as const,
  checks: (prId: string) => ["github", "checks", prId] as const,
};

/** Query options for PRs belonging to a thread */
export function threadPRsQueryOptions(threadId: string) {
  return queryOptions({
    queryKey: githubQueryKeys.prs(threadId),
    queryFn: async () => {
      const result = await getThreadPRs(threadId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!threadId,
    staleTime: 30_000,
  });
}

/** Query options for check runs on a specific PR */
export function prChecksQueryOptions(prId: string) {
  return queryOptions({
    queryKey: githubQueryKeys.checks(prId),
    queryFn: async () => {
      const result = await pollCheckStatus(prId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!prId,
    staleTime: 30_000,
  });
}
