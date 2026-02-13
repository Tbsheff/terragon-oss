"use client";

import { queryOptions } from "@tanstack/react-query";
import {
  listThreadsEnriched,
  type EnrichedThreadListItem,
} from "@/server-actions/threads-enriched";

export const boardQueryKeys = {
  enrichedList: ["threads", "enriched-list"] as const,
};

/** Query options for enriched thread list (board view) */
export function enrichedThreadListQueryOptions() {
  return queryOptions<EnrichedThreadListItem[]>({
    queryKey: boardQueryKeys.enrichedList,
    queryFn: () => listThreadsEnriched(),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}
