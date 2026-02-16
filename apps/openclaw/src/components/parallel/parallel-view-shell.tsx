"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ParallelLayoutProvider,
  useParallelLayout,
  type LayoutMode,
} from "./parallel-layout-provider";
import { ParallelToolbar } from "./parallel-toolbar";
import { ParallelGrid } from "./parallel-grid";

/**
 * Inner component that syncs state changes back to URL params.
 */
function ParallelViewInner() {
  const router = useRouter();
  const { paneIds, layoutMode, activePaneId } = useParallelLayout();

  // Debounce URL updates to avoid rapid param churn
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncToUrl = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (paneIds.length > 0) params.set("ids", paneIds.join(","));
      if (layoutMode !== "split") params.set("layout", layoutMode);
      if (activePaneId) params.set("active", activePaneId);
      const qs = params.toString();
      router.replace(`/parallel${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 300);
  }, [paneIds, layoutMode, activePaneId, router]);

  // Sync to URL whenever state changes — timer-based to coalesce rapid changes
  // Uses ref cleanup pattern to avoid stale closures
  const lastSyncKey = `${paneIds.join(",")}-${layoutMode}-${activePaneId}`;
  const prevKeyRef = useRef(lastSyncKey);
  if (prevKeyRef.current !== lastSyncKey) {
    prevKeyRef.current = lastSyncKey;
    syncToUrl();
  }

  return (
    <div className="flex h-full flex-col">
      <ParallelToolbar />
      <ParallelGrid />
    </div>
  );
}

type ParallelViewShellProps = {
  initialIds: string[];
  initialLayout: LayoutMode;
  initialActive: string | null;
};

export function ParallelViewShell({
  initialIds,
  initialLayout,
  initialActive,
}: ParallelViewShellProps) {
  return (
    <ParallelLayoutProvider
      initialPaneIds={initialIds}
      initialLayout={initialLayout}
      initialActive={initialActive}
    >
      <ParallelViewInner />
    </ParallelLayoutProvider>
  );
}
