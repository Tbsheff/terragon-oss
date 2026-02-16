"use client";

import { cn } from "@/lib/utils";
import { useFilePanel, type FilePanelTab } from "@/hooks/use-file-panel";
import { Button } from "@/components/ui/button";
import { X, FolderTree, FileCode, GitCompare } from "lucide-react";

const TABS: { value: FilePanelTab; label: string; icon: React.ReactNode }[] = [
  { value: "tree", label: "Tree", icon: <FolderTree className="size-3" /> },
  { value: "viewer", label: "Viewer", icon: <FileCode className="size-3" /> },
  { value: "diff", label: "Diff", icon: <GitCompare className="size-3" /> },
];

export function FilePanelHeader() {
  const { tab, setTab, selectedFile, selectedDiff, close } = useFilePanel();

  const activePath =
    tab === "viewer"
      ? selectedFile?.path
      : tab === "diff"
        ? selectedDiff?.path
        : null;

  return (
    <div className="shrink-0 border-b border-border/70 bg-card">
      {/* Tab row */}
      <div className="flex items-center justify-between px-2 pt-1.5">
        <div className="flex items-center gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === t.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Close file panel"
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Breadcrumb */}
      {activePath && (
        <div className="px-3 pb-1.5 pt-1">
          <span className="font-mono text-[11px] text-muted-foreground truncate block">
            {activePath}
          </span>
        </div>
      )}
    </div>
  );
}
