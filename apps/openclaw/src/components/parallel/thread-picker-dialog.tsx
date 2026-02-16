"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { useParallelLayout } from "./parallel-layout-provider";

type ThreadPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ThreadPickerDialog({
  open,
  onOpenChange,
}: ThreadPickerDialogProps) {
  const { paneIds, addPane } = useParallelLayout();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: threads, isLoading } = useQuery({
    ...threadListQueryOptions({ archived: false }),
    enabled: open,
  });

  // Filter out threads already in the parallel view
  const available = useMemo(
    () => (threads ?? []).filter((t) => !paneIds.includes(t.id)),
    [threads, paneIds],
  );

  const toggleThread = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    for (const id of selected) {
      addPane(id);
    }
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Agents to View</DialogTitle>
          <DialogDescription>
            Select active threads to add to the parallel view.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-2 px-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && available.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No available threads to add.
            </p>
          )}

          {available.map((thread) => {
            const isSelected = selected.has(thread.id);
            return (
              <button
                key={thread.id}
                onClick={() => toggleThread(thread.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {thread.name ?? "Untitled task"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {thread.status} &middot; {thread.agent}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
