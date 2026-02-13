"use client";

import { useQuery } from "@tanstack/react-query";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { useDocumentTitle } from "@/hooks/use-document-title";

/**
 * Client component that syncs browser tab title with active task counts.
 * Shows "(N) OpenClaw" when N tasks are running, "(!) OpenClaw" on error.
 */
export function DashboardTitleSync() {
  const { data: threads = [] } = useQuery(
    threadListQueryOptions({ archived: false }),
  );

  const activeCount = threads.filter(
    (t) => t.status === "working" || t.status === "stopping",
  ).length;

  const hasError = threads.some((t) => t.status === "working-error");

  useDocumentTitle(activeCount, hasError);

  return null;
}
