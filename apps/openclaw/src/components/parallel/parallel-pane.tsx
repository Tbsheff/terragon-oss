"use client";

import { cn } from "@/lib/utils";
import { useParallelLayout } from "./parallel-layout-provider";
import { PaneHeader } from "./pane-header";
import { CondensedChatView } from "./condensed-chat-view";
import { OpenClawChatUI } from "@/components/chat/openclaw-chat-ui";

type ParallelPaneProps = {
  threadId: string;
};

export function ParallelPane({ threadId }: ParallelPaneProps) {
  const { activePaneId, setActivePane, paneIds } = useParallelLayout();
  const isActive = activePaneId === threadId;
  const index = paneIds.indexOf(threadId);

  return (
    <div
      onClick={() => {
        if (!isActive) setActivePane(threadId);
      }}
      className={cn(
        "animate-fade-in flex flex-col overflow-hidden rounded-lg border shadow-xs transition-all",
        isActive
          ? "border-border/60 ring-1 ring-primary/20 border-t-2 border-t-primary/20"
          : "border-border/60 cursor-pointer hover:border-primary/30",
      )}
      style={{ animationDelay: `${100 + index * 80}ms` }}
    >
      <PaneHeader threadId={threadId} isActive={isActive} />

      <div className="flex-1 overflow-hidden">
        {isActive ? (
          <OpenClawChatUI threadId={threadId} />
        ) : (
          <CondensedChatView threadId={threadId} />
        )}
      </div>
    </div>
  );
}
