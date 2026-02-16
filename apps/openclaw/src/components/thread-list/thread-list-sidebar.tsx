"use client";

import { useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRealtimeGlobal } from "@/hooks/use-realtime";
import { ThreadListGrouped } from "./thread-list-grouped";
import { SquarePen, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function ThreadListSidebar() {
  const [width, setWidth] = useState(300);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Auto-refresh thread list on global realtime events
  useRealtimeGlobal();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const handleMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.min(
          500,
          Math.max(250, startWidth + ev.clientX - startX),
        );
        setWidth(newWidth);
      };
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width],
  );

  return (
    <Fragment>
      <aside
        style={{ width: isCollapsed ? 0 : width }}
        className="hidden md:flex flex-col border-r border-border bg-muted/30 shrink-0 relative overflow-hidden transition-[width] duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground"
          >
            <SquarePen className="size-4" />
            New Chat
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsCollapsed(true)}
                className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Collapse</TooltipContent>
          </Tooltip>
        </div>

        {/* Active/Archived toggle */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              !showArchived
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground",
            )}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              showArchived
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground",
            )}
          >
            Archived
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto py-2">
          <ThreadListGrouped archived={showArchived} />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
        />
      </aside>

      {/* Collapsed state expand button */}
      {isCollapsed && (
        <div className="hidden md:flex flex-col items-center border-r border-border py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsCollapsed(false)}
                className="flex items-center justify-center size-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <PanelLeft className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand threads</TooltipContent>
          </Tooltip>
        </div>
      )}
    </Fragment>
  );
}
