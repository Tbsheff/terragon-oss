"use client";

import { useState } from "react";
import { Maximize2, Columns2, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useParallelLayout, type LayoutMode } from "./parallel-layout-provider";
import { ThreadPickerDialog } from "./thread-picker-dialog";

const LAYOUT_OPTIONS: {
  mode: LayoutMode;
  icon: typeof Maximize2;
  label: string;
}[] = [
  { mode: "focus", icon: Maximize2, label: "Focus" },
  { mode: "split", icon: Columns2, label: "Split" },
  { mode: "grid", icon: LayoutGrid, label: "Grid" },
];

export function ParallelToolbar() {
  const { layoutMode, setLayout, paneIds } = useParallelLayout();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center rounded-lg bg-primary/10 p-1.5">
          <LayoutGrid className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold font-[var(--font-cabin)] tracking-tight text-balance">
            Parallel View
          </h1>
        </div>
        <Badge
          variant="outline"
          className="ml-1 text-[10px] px-1.5 py-0 tabular-nums"
        >
          {paneIds.length} agent{paneIds.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Layout mode toggles */}
        <div className="flex items-center rounded-md border border-border/60 bg-card/80 p-0.5">
          {LAYOUT_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLayout(mode)}
                  aria-label={label}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-sm transition-colors",
                    layoutMode === mode
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Add agent button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-3" />
          Add Agent
        </Button>
      </div>

      <ThreadPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}
