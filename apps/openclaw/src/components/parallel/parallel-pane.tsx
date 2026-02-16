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
  const { activePaneId, setActivePane } = useParallelLayout();
  const isActive = activePaneId === threadId;

  return (
    <div
      onClick={() => {
        if (!isActive) setActivePane(threadId);
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border transition-all",
        isActive
          ? "border-primary/40 shadow-sm"
          : "border-border/50 cursor-pointer hover:border-border",
      )}
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
