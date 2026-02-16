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
      <DialogContent className="max-w-md border-border/60 shadow-xs">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-cabin)] tracking-tight text-balance">
            Add Agents to View
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Select active threads to add to the parallel view.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-2 px-2 space-y-1.5">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && available.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-center text-sm text-muted-foreground/60 text-pretty">
                No available threads to add.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-border/60 hover:border-primary/30 transition-colors"
                onClick={() => onOpenChange(false)}
                asChild
              >
                <a href="/task/new">Create a new task</a>
              </Button>
            </div>
          )}

          {available.map((thread, i) => {
            const isSelected = selected.has(thread.id);
            return (
              <button
                key={thread.id}
                onClick={() => toggleThread(thread.id)}
                className={cn(
                  "animate-fade-in flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                  isSelected
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                    : "border-border/60 hover:border-primary/30 hover:shadow-xs",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {isSelected && <Check className="size-3" />}
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
