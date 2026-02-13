"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThreadProvider, type OpenClawThread } from "./thread-context";
import { OpenClawChatHeader } from "./openclaw-chat-header";
import { OpenClawPromptBox } from "./openclaw-promptbox";
import { ChatMessages, WorkingMessage } from "./chat-messages";
import { toUIMessages } from "./toUIMessages";
import { useRealtimeThread } from "@/hooks/use-realtime";
import { openClawHistoryToDBMessages } from "@/lib/message-adapter";
import type { DBMessage, ThreadStatus } from "@/lib/types";
import {
  threadDetailQueryOptions,
  threadMessagesQueryOptions,
} from "@/queries/thread-queries";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

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
  const [pendingUserMsg, setPendingUserMsg] = useState<DBMessage | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Fetch thread detail
  const { data: threadDetail } = useQuery(threadDetailQueryOptions(threadId));

  // Subscribe to realtime updates for this thread
  useRealtimeThread(threadId);

  // Fetch messages from gateway — poll while agent is working
  const { data: historyData } = useQuery({
    ...threadMessagesQueryOptions(threadId),
    refetchInterval: isWorking ? 2_000 : false,
  });

  // Convert gateway history → DBMessage[]
  // Type assertion: message-adapter's DBMessage uses null where types.ts uses undefined —
  // structurally equivalent at runtime, toUIMessages handles both.
  const gatewayMessages = useMemo((): DBMessage[] => {
    if (!historyData?.ok || !historyData.history.length) return [];
    return openClawHistoryToDBMessages(
      historyData.history,
    ) as unknown as DBMessage[];
  }, [historyData]);

  // Clear pending user message once gateway reflects it
  const hasGatewayMessages = gatewayMessages.length > 0;
  useEffect(() => {
    if (hasGatewayMessages) setPendingUserMsg(null);
  }, [hasGatewayMessages]);

  // Gateway messages are source of truth; show pending optimistic msg until they arrive
  const dbMessages = hasGatewayMessages
    ? gatewayMessages
    : pendingUserMsg
      ? [pendingUserMsg]
      : [];

  // Map thread detail to simplified OpenClawThread type for context
  const openClawThread: OpenClawThread | null = threadDetail
    ? {
        id: threadDetail.id,
        name: threadDetail.name,
        status: threadDetail.status,
        pipelineState: threadDetail.pipelineState,
        tokenUsage: threadDetail.tokenUsage,
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
      // Show optimistic user message until gateway reflects it
      setPendingUserMsg({
        type: "user",
        model: null,
        parts: [{ type: "text", text: message }],
        timestamp: new Date().toISOString(),
      });
      setIsWorking(true);

      try {
        const { sendChatMessage } = await import(
          "@/server-actions/openclaw-chat"
        );
        await sendChatMessage(threadId, message);
        // Trigger immediate refetch after send succeeds
        queryClient.invalidateQueries({
          queryKey: ["threads", "messages", threadId],
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        setIsWorking(false);
        setPendingUserMsg(null);
      }
    },
    [threadId, queryClient],
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
      <div className="flex h-full flex-col overflow-hidden">
        <OpenClawChatHeader onArchive={handleArchive} />

        {/* Chat messages area -- flex-1 + min-h-0 ensures proper scroll containment */}
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4 px-4 py-6">
            {uiMessages.length === 0 && !isWorking ? (
              <ConversationEmptyState
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-8 w-8 text-primary/40"
                  >
                    <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.5 9c-1.2 1-2 2.6-2 4.3 0 3 2.5 5.5 5.5 5.5h.5c.5 1.3 1.8 2.2 3.5 2.2s3-1 3.5-2.2h.5c3 0 5.5-2.5 5.5-5.5 0-1.7-.8-3.3-2-4.3A3.6 3.6 0 0 0 15 4.7C14.4 3.6 13.2 3 12 3z" />
                  </svg>
                }
                title="Start a conversation"
                description="Describe a coding task and the agent will get to work."
                className="opacity-80"
              />
            ) : (
              <>
                <ChatMessages
                  messages={uiMessages}
                  isAgentWorking={isWorking}
                />
                {isWorking && uiMessages.length === 0 && (
                  <WorkingMessage message="Agent is starting..." />
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <OpenClawPromptBox
          onSend={handleSend}
          onStop={handleStop}
          isWorking={isWorking}
        />
      </div>
    </ThreadProvider>
  );
}
