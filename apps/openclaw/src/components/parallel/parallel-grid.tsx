"use client";

import { cn } from "@/lib/utils";
import { useParallelLayout } from "./parallel-layout-provider";
import { ParallelPane } from "./parallel-pane";

export function ParallelGrid() {
  const { paneIds, layoutMode, activePaneId } = useParallelLayout();

  if (paneIds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No agents added. Click &quot;Add Agent&quot; to get started.
        </p>
      </div>
    );
  }

  // In focus mode, only show the active pane
  if (layoutMode === "focus") {
    const focusId = activePaneId ?? paneIds[0];
    if (!focusId) return null;
    return (
      <div className="flex-1 overflow-hidden p-2">
        <div className="h-full">
          <ParallelPane threadId={focusId} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-hidden p-2 grid gap-2",
        layoutMode === "split" && "grid-cols-2",
        layoutMode === "grid" && "grid-cols-2 grid-rows-2",
      )}
    >
      {paneIds.map((id) => (
        <ParallelPane key={id} threadId={id} />
      ))}
    </div>
  );
}
