"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useParallelLayout } from "./parallel-layout-provider";
import { ParallelPane } from "./parallel-pane";
import { ThreadPickerDialog } from "./thread-picker-dialog";

export function ParallelGrid() {
  const { paneIds, layoutMode, activePaneId } = useParallelLayout();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (paneIds.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground text-pretty">
          No agents added yet.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-3" />
          Add Agent
        </Button>
        <ThreadPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
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
