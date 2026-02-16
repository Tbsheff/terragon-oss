"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { filePanelTabAtom } from "@/hooks/use-file-panel";
import { FilePanelHeader } from "./file-panel-header";
import { FileTree } from "./file-tree";
import { FileViewer } from "./file-viewer";
import { FileDiffViewer } from "./file-diff-viewer";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@/lib/types";
import { extractFileRefs } from "@/lib/extract-file-refs";

const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;

type FileBrowserPanelProps = {
  messages: UIMessage[];
};

export function FileBrowserPanel({ messages }: FileBrowserPanelProps) {
  const tab = useAtomValue(filePanelTabAtom);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const fileRefs = useMemo(() => extractFileRefs(messages), [messages]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;
        // Dragging left (negative delta) = increase panel width
        const delta = startX.current - ev.clientX;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth.current + delta),
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  return (
    <div className="flex h-full shrink-0" style={{ width }}>
      {/* Resize handle */}
      <div
        role="separator"
        aria-label="Resize file panel"
        onMouseDown={handleMouseDown}
        className={cn(
          "w-1 shrink-0 cursor-col-resize select-none transition-colors hover:bg-primary/10 active:bg-primary/15",
          "border-l border-border/60",
        )}
      />

      {/* Panel content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <FilePanelHeader />

        {tab === "tree" && <FileTree files={fileRefs} />}
        {tab === "viewer" && <FileViewer />}
        {tab === "diff" && <FileDiffViewer />}
      </div>
    </div>
  );
}
