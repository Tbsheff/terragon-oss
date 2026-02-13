"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThreadProvider, type OpenClawThread } from "./thread-context";
import { OpenClawChatHeader } from "./openclaw-chat-header";
import { OpenClawPromptBox } from "./openclaw-promptbox";
import { ChatMessages, WorkingMessage } from "./chat-messages";
import { toUIMessages } from "./toUIMessages";
import {
  useRealtimeThread,
  useRealtimeChatMessages,
  useExecApprovals,
} from "@/hooks/use-realtime";
import { ExecApprovalCard } from "./exec-approval-card";
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

  // Track pending exec approval requests
  const { pending: pendingApprovals } = useExecApprovals(threadId);

  // Fetch initial history from gateway (no polling)
  const { data: historyData } = useQuery(threadMessagesQueryOptions(threadId));

  // Event-driven streaming messages from WebSocket
  // Same null-vs-undefined cast as gatewayMessages — structurally equivalent at runtime
  const streamingMessages = useRealtimeChatMessages(
    threadId,
  ) as unknown as DBMessage[];

  // Convert gateway history → DBMessage[]
  // Type assertion: message-adapter's DBMessage uses null where types.ts uses undefined —
  // structurally equivalent at runtime, toUIMessages handles both.
  const gatewayMessages = useMemo((): DBMessage[] => {
    if (!historyData?.ok || !historyData.history.length) return [];
    return openClawHistoryToDBMessages(
      historyData.history,
    ) as unknown as DBMessage[];
  }, [historyData]);

  // Clear pending user message once streaming or gateway messages arrive
  const hasRealMessages =
    gatewayMessages.length > 0 || streamingMessages.length > 0;
  useEffect(() => {
    if (hasRealMessages) setPendingUserMsg(null);
  }, [hasRealMessages]);

  // Merge: history is the base, streaming messages are appended for the current turn
  const dbMessages = useMemo(() => {
    if (
      pendingUserMsg &&
      !gatewayMessages.length &&
      !streamingMessages.length
    ) {
      return [pendingUserMsg];
    }
    if (streamingMessages.length > 0) {
      return [...gatewayMessages, ...streamingMessages];
    }
    return gatewayMessages.length > 0 ? gatewayMessages : [];
  }, [gatewayMessages, streamingMessages, pendingUserMsg]);

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
        toast.error(
          err instanceof Error ? err.message : "Failed to send message",
        );
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
      toast.error("Failed to stop the agent");
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

        {/* Exec approval cards */}
        {pendingApprovals.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border/50 px-4 py-3">
            {pendingApprovals.map((approval) => (
              <ExecApprovalCard
                key={approval.id}
                id={approval.id}
                command={approval.command}
                args={approval.args}
                cwd={approval.cwd}
                agentId={approval.agentId}
              />
            ))}
          </div>
        )}

        <OpenClawPromptBox
          onSend={handleSend}
          onStop={handleStop}
          isWorking={isWorking}
        />
      </div>
    </ThreadProvider>
  );
}
