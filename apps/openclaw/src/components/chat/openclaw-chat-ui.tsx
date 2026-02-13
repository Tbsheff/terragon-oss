"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThreadProvider, type OpenClawThread } from "./thread-context";
import { OpenClawChatHeader } from "./openclaw-chat-header";
import { OpenClawPromptBox } from "./openclaw-promptbox";
import { ChatMessages, WorkingMessage } from "./chat-messages";
import { ScrollToBottomButton } from "./scroll-to-bottom-button";
import { toUIMessages } from "./toUIMessages";
import { useRealtimeThread } from "@/hooks/use-realtime";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import type { DBMessage, ThreadStatus } from "@/lib/types";
import { threadDetailQueryOptions } from "@/queries/thread-queries";

type OpenClawChatUIProps = {
  threadId: string;
};

/**
 * Main chat UI orchestrator.
 * Wires together: OpenClaw client, message adapter, realtime, and chat rendering.
 *
 * Data flow:
 *   OpenClaw events → message-adapter → DBMessage[] → toUIMessages() → UIMessage[] → ChatMessages
 */
export function OpenClawChatUI({ threadId }: OpenClawChatUIProps) {
  const queryClient = useQueryClient();
  const [dbMessages, setDbMessages] = useState<DBMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const { containerRef, messagesEndRef, isAtBottom, scrollToBottom } =
    useScrollToBottom();

  // Fetch thread detail
  const { data: threadDetail } = useQuery(threadDetailQueryOptions(threadId));

  // Subscribe to realtime updates for this thread
  useRealtimeThread(threadId);

  // Map thread detail to simplified OpenClawThread type for context
  const openClawThread: OpenClawThread | null = threadDetail
    ? {
        id: threadDetail.id,
        name: threadDetail.name,
        status: threadDetail.status,
        pipelineState: threadDetail.pipelineState,
        githubRepoFullName: threadDetail.githubRepoFullName,
        createdAt: threadDetail.createdAt,
      }
    : null;

  // Convert DBMessages → UIMessages via the forked toUIMessages pipeline
  const uiMessages = useMemo(
    () =>
      toUIMessages({
        dbMessages,
        agent: "claudeCode",
        threadStatus: (threadDetail?.status as ThreadStatus) ?? null,
      }),
    [dbMessages, threadDetail?.status],
  );

  // Update working state from thread status
  // This effect is necessary: it syncs external state (thread status from DB/realtime)
  // into local UI state (isWorking) that drives the prompt box and loading indicator.
  useEffect(() => {
    if (threadDetail) {
      setIsWorking(
        threadDetail.status === "working" || threadDetail.status === "stopping",
      );
    }
  }, [threadDetail?.status]);

  const handleSend = useCallback(
    async (message: string) => {
      // Add user message to local state immediately (optimistic)
      const userMsg: DBMessage = {
        type: "user",
        model: null,
        parts: [{ type: "text", text: message }],
        timestamp: new Date().toISOString(),
      };
      setDbMessages((prev) => [...prev, userMsg]);
      setIsWorking(true);

      try {
        const { sendChatMessage } = await import(
          "@/server-actions/openclaw-chat"
        );
        await sendChatMessage(threadId, message);
      } catch (err) {
        console.error("Failed to send message:", err);
        setIsWorking(false);
      }
    },
    [threadId],
  );

  const handleStop = useCallback(async () => {
    try {
      const { abortChat } = await import("@/server-actions/openclaw-chat");
      await abortChat(threadId);
    } catch (err) {
      console.error("Failed to abort:", err);
    }
    setIsWorking(false);
  }, [threadId]);

  const handleArchive = useCallback(async () => {
    const { archiveThread } = await import("@/server-actions/threads");
    await archiveThread(threadId);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  }, [threadId, queryClient]);

  return (
    <ThreadProvider thread={openClawThread} isReadOnly={false}>
      <div className="flex h-full flex-col">
        <OpenClawChatHeader onArchive={handleArchive} />

        {/* Chat messages area */}
        <div className="relative flex-1 overflow-hidden">
          <div ref={containerRef} className="h-full overflow-y-auto px-4 py-4">
            {uiMessages.length === 0 && !isWorking ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Start a conversation to begin...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <ChatMessages
                  messages={uiMessages}
                  isAgentWorking={isWorking}
                />
                {isWorking && uiMessages.length === 0 && (
                  <WorkingMessage message="Agent is starting..." />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <ScrollToBottomButton
            visible={!isAtBottom}
            onClick={scrollToBottom}
          />
        </div>

        <OpenClawPromptBox
          onSend={handleSend}
          onStop={handleStop}
          isWorking={isWorking}
        />
      </div>
    </ThreadProvider>
  );
}
