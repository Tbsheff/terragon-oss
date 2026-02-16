"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { selectedDiffAtom } from "@/hooks/use-file-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GitCompare } from "lucide-react";

type DiffLine = {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
};

/**
 * Simple line-by-line diff.
 * Matches removed lines with added lines in sequence to produce inline diff hunks.
 */
function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const result: DiffLine[] = [];

  // Build a simple LCS-style diff using a greedy match
  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNo = 1;
  let newLineNo = 1;

  while (oldIdx < oldLines.length && newIdx < newLines.length) {
    if (oldLines[oldIdx] === newLines[newIdx]) {
      result.push({
        type: "context",
        content: oldLines[oldIdx]!,
        oldLineNo: oldLineNo++,
        newLineNo: newLineNo++,
      });
      oldIdx++;
      newIdx++;
    } else {
      // Look ahead in new for a match to current old line
      let foundInNew = -1;
      for (
        let j = newIdx + 1;
        j < Math.min(newIdx + 10, newLines.length);
        j++
      ) {
        if (newLines[j] === oldLines[oldIdx]) {
          foundInNew = j;
          break;
        }
      }

      // Look ahead in old for a match to current new line
      let foundInOld = -1;
      for (
        let j = oldIdx + 1;
        j < Math.min(oldIdx + 10, oldLines.length);
        j++
      ) {
        if (oldLines[j] === newLines[newIdx]) {
          foundInOld = j;
          break;
        }
      }

      if (
        foundInNew !== -1 &&
        (foundInOld === -1 || foundInNew - newIdx <= foundInOld - oldIdx)
      ) {
        // Lines were added
        while (newIdx < foundInNew) {
          result.push({
            type: "add",
            content: newLines[newIdx]!,
            oldLineNo: null,
            newLineNo: newLineNo++,
          });
          newIdx++;
        }
      } else if (foundInOld !== -1) {
        // Lines were removed
        while (oldIdx < foundInOld) {
          result.push({
            type: "remove",
            content: oldLines[oldIdx]!,
            oldLineNo: oldLineNo++,
            newLineNo: null,
          });
          oldIdx++;
        }
      } else {
        // Replace: remove old, add new
        result.push({
          type: "remove",
          content: oldLines[oldIdx]!,
          oldLineNo: oldLineNo++,
          newLineNo: null,
        });
        oldIdx++;
        result.push({
          type: "add",
          content: newLines[newIdx]!,
          oldLineNo: null,
          newLineNo: newLineNo++,
        });
        newIdx++;
      }
    }
  }

  // Remaining old lines are removals
  while (oldIdx < oldLines.length) {
    result.push({
      type: "remove",
      content: oldLines[oldIdx]!,
      oldLineNo: oldLineNo++,
      newLineNo: null,
    });
    oldIdx++;
  }

  // Remaining new lines are additions
  while (newIdx < newLines.length) {
    result.push({
      type: "add",
      content: newLines[newIdx]!,
      oldLineNo: null,
      newLineNo: newLineNo++,
    });
    newIdx++;
  }

  return result;
}

export function FileDiffViewer() {
  const diff = useAtomValue(selectedDiffAtom);

  if (!diff) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <GitCompare className="size-8 text-muted-foreground/30" />
          <span className="text-sm font-medium text-muted-foreground/70">
            No diff selected
          </span>
          <p className="text-xs text-pretty text-muted-foreground/50">
            Click an edit tool result to view the diff
          </p>
        </div>
      </div>
    );
  }

  const lines = useMemo(
    () => computeDiff(diff.oldString, diff.newString),
    [diff.oldString, diff.newString],
  );

  const addCount = lines.filter((l) => l.type === "add").length;
  const removeCount = lines.filter((l) => l.type === "remove").length;

  return (
    <ScrollArea className="flex-1">
      <div className="glass border-b border-border/60 px-3 py-2 text-xs font-mono flex items-center gap-2">
        <span className="truncate font-medium text-foreground/80">
          {diff.path.split("/").pop()}
        </span>
        <span className="tabular-nums text-green-600 dark:text-green-400 shrink-0">
          +{addCount}
        </span>
        <span className="tabular-nums text-red-600 dark:text-red-400 shrink-0">
          -{removeCount}
        </span>
      </div>
      <pre className="text-xs font-mono p-0 m-0">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex px-2",
              line.type === "add" &&
                "bg-green-500/10 text-green-800 dark:text-green-300",
              line.type === "remove" &&
                "bg-red-500/10 text-red-800 dark:text-red-300",
              line.type === "context" && "text-foreground/80",
            )}
          >
            <span className="w-10 shrink-0 text-right pr-2 tabular-nums text-muted-foreground/40 select-none">
              {line.oldLineNo ?? " "}
            </span>
            <span className="w-10 shrink-0 text-right pr-2 tabular-nums text-muted-foreground/40 select-none border-r border-border/40 mr-2">
              {line.newLineNo ?? " "}
            </span>
            <span className="w-4 shrink-0 select-none">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="whitespace-pre-wrap break-all">
              {line.content}
            </span>
          </div>
        ))}
      </pre>
    </ScrollArea>
  );
}
