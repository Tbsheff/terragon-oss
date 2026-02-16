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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-sm font-medium text-muted-foreground/60 text-pretty">
            No agents added yet
          </p>
          <p className="text-xs text-muted-foreground/40 text-pretty">
            Add threads to monitor them side by side
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-border/60 hover:border-primary/30 transition-colors"
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
      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full">
          <ParallelPane threadId={focusId} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-hidden p-3 grid gap-3",
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
