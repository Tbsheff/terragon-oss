"use client";

import { queryOptions } from "@tanstack/react-query";
import {
  listThreads,
  getThread,
  type ThreadListItem,
  type ThreadDetail,
} from "@/server-actions/threads";
import {
  getThreadErrors,
  type ThreadError,
} from "@/server-actions/thread-errors";

/** Query key factories (following Terragon pattern) */
export const threadQueryKeys = {
  all: ["threads"] as const,
  list: (filters?: { archived?: boolean }) =>
    ["threads", "list", filters] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
  messages: (id: string) => ["threads", "messages", id] as const,
  errors: (id: string) => ["threads", "errors", id] as const,
};

/** Query options for thread list */
export function threadListQueryOptions(filters?: { archived?: boolean }) {
  return queryOptions<ThreadListItem[]>({
    queryKey: threadQueryKeys.list(filters),
    queryFn: () => listThreads(filters),
    staleTime: 10_000,
  });
}

/** Query options for single thread detail */
export function threadDetailQueryOptions(threadId: string) {
  return queryOptions<ThreadDetail | null>({
    queryKey: threadQueryKeys.detail(threadId),
    queryFn: () => getThread(threadId),
    enabled: !!threadId,
    staleTime: 5_000,
  });
}

/** Query options for thread errors */
export function threadErrorsQueryOptions(threadId: string) {
  return queryOptions<ThreadError[]>({
    queryKey: threadQueryKeys.errors(threadId),
    queryFn: () => getThreadErrors(threadId),
    enabled: !!threadId,
    staleTime: 10_000,
  });
}
