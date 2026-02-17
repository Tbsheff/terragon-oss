"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
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
import { useDirectChat } from "@/hooks/use-direct-chat";
import { useGateway } from "@/components/gateway-provider";
import { ExecApprovalCard } from "./exec-approval-card";
import { openClawHistoryToDBMessages } from "@/lib/message-adapter";
import type { DBMessage, ThreadStatus, UIMessage } from "@/lib/types";
import type { SlashCommandContext } from "@/lib/slash-commands";
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
import { filePanelOpenAtom } from "@/hooks/use-file-panel";
import { FileBrowserPanel } from "@/components/file-browser/file-browser-panel";
import { ForkDialog } from "./fork-dialog";
import { EditResendDialog } from "./edit-resend-dialog";

const DIRECT_STREAMING =
  process.env.NEXT_PUBLIC_DIRECT_STREAMING === "true" ||
  process.env.NEXT_PUBLIC_DIRECT_STREAMING === "1";

type OpenClawChatUIProps = {
  threadId: string;
};

/**
 * Main chat UI orchestrator.
 * Wires together: OpenClaw client, message adapter, realtime, and chat rendering.
 *
 * Data flow:
 *   OpenClaw events -> message-adapter -> DBMessage[] -> toUIMessages() -> UIMessage[] -> ChatMessages
 *
 * When NEXT_PUBLIC_DIRECT_STREAMING is enabled, chat messages stream directly
 * from the browser's WebSocket connection to the gateway, bypassing server actions.
 */
export function OpenClawChatUI({ threadId }: OpenClawChatUIProps) {
  if (DIRECT_STREAMING) {
    return <DirectStreamingChatUI threadId={threadId} />;
  }
  return <ServerActionChatUI threadId={threadId} />;
}

// ─────────────────────────────────────────────────
// Shared chat layout with file panel
// ─────────────────────────────────────────────────

function ChatWithFilePanel({
  children,
  uiMessages,
}: {
  children: React.ReactNode;
  uiMessages: UIMessage[];
}) {
  const filePanelOpen = useAtomValue(filePanelOpenAtom);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {/* File browser panel */}
      {filePanelOpen && <FileBrowserPanel messages={uiMessages} />}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Empty state icon (shared)
// ─────────────────────────────────────────────────

const EmptyStateIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="size-8 text-primary/40"
  >
    <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.5 9c-1.2 1-2 2.6-2 4.3 0 3 2.5 5.5 5.5 5.5h.5c.5 1.3 1.8 2.2 3.5 2.2s3-1 3.5-2.2h.5c3 0 5.5-2.5 5.5-5.5 0-1.7-.8-3.3-2-4.3A3.6 3.6 0 0 0 15 4.7C14.4 3.6 13.2 3 12 3z" />
  </svg>
);

// ─────────────────────────────────────────────────
// Shared hooks for slash command context
// ─────────────────────────────────────────────────

function useSlashCommandHandlers(
  threadId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const [currentModel, setCurrentModel] = useState(
    "claude-sonnet-4-5-20250929",
  );

  const handleInject = useCallback(
    async (content: string, role: "system" | "user") => {
      const { injectChatContext } = await import(
        "@/server-actions/openclaw-chat"
      );
      const result = await injectChatContext(threadId, content, role);
      if (!result.ok) toast.error(result.error);
    },
    [threadId],
  );

  const handleSwitchModel = useCallback(
    async (model: string) => {
      const { patchSession } = await import("@/server-actions/sessions");
      const result = await patchSession(threadId, { model });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrentModel(model);
      queryClient.invalidateQueries({ queryKey: ["threads", threadId] });
    },
    [threadId, queryClient],
  );

  return { currentModel, setCurrentModel, handleInject, handleSwitchModel };
}

function useSlashCommandContext(
  threadId: string,
  handleInject: (content: string, role: "system" | "user") => Promise<void>,
  handleSwitchModel: (model: string) => Promise<void>,
  onSendMessage: (msg: string) => void,
): SlashCommandContext {
  return useMemo(
    () => ({
      threadId,
      sessionKey: threadId,
      onInject: handleInject,
      onSwitchModel: handleSwitchModel,
      onSendMessage,
    }),
    [threadId, handleInject, handleSwitchModel, onSendMessage],
  );
}

// ─────────────────────────────────────────────────
// Fork / Edit-Resend dialog state
// ─────────────────────────────────────────────────

type ForkDialogState = {
  type: "fork" | "edit-resend";
  messageIndex: number;
} | null;

function useForkDialogs(uiMessages: UIMessage[]) {
  const [dialogState, setDialogState] = useState<ForkDialogState>(null);

  const handleFork = useCallback((messageIndex: number) => {
    setDialogState({ type: "fork", messageIndex });
  }, []);

  const handleEditResend = useCallback((messageIndex: number) => {
    setDialogState({ type: "edit-resend", messageIndex });
  }, []);

  const closeDialog = useCallback(() => setDialogState(null), []);

  const targetMessage = dialogState
    ? (uiMessages[dialogState.messageIndex] ?? null)
    : null;

  return {
    dialogState,
    targetMessage,
    handleFork,
    handleEditResend,
    closeDialog,
  };
}

// ─────────────────────────────────────────────────
// Direct streaming path (browser -> gateway WebSocket)
// ─────────────────────────────────────────────────

function DirectStreamingChatUI({ threadId }: OpenClawChatUIProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pendingUserMsg, setPendingUserMsg] = useState<DBMessage | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const { data: threadDetail } = useQuery(threadDetailQueryOptions(threadId));
  const { connectionState } = useGateway();
  useRealtimeThread(threadId);
  const { pending: pendingApprovals } = useExecApprovals(threadId);

  // Direct chat via browser gateway client
  const {
    messages: directMessages,
    streamingMessages: directStreaming,
    sendMessage,
    abort,
  } = useDirectChat(threadId);

  const { currentModel, setCurrentModel, handleInject, handleSwitchModel } =
    useSlashCommandHandlers(threadId, queryClient);

  // Sync model from thread detail
  useEffect(() => {
    if (threadDetail?.model) setCurrentModel(threadDetail.model);
  }, [threadDetail?.model, setCurrentModel]);

  const sendMessageStable = useCallback(
    (msg: string) => {
      sendMessage(msg);
    },
    [sendMessage],
  );

  const slashCommandContext = useSlashCommandContext(
    threadId,
    handleInject,
    handleSwitchModel,
    sendMessageStable,
  );

  // Clear pending user message once real messages arrive
  const hasRealMessages =
    directMessages.length > 0 || directStreaming.length > 0;
  useEffect(() => {
    if (hasRealMessages) setPendingUserMsg(null);
  }, [hasRealMessages]);

  const dbMessages = useMemo(() => {
    if (pendingUserMsg && !directMessages.length) {
      return [pendingUserMsg];
    }
    return directMessages.length > 0 ? directMessages : [];
  }, [directMessages, pendingUserMsg]);

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

  const uiMessages = useMemo(
    () =>
      toUIMessages({
        dbMessages,
        agent: "claudeCode",
        threadStatus: (threadDetail?.status as ThreadStatus) ?? null,
      }),
    [dbMessages, threadDetail?.status],
  );

  // Sync external thread status into local isWorking state
  useEffect(() => {
    if (threadDetail) {
      setIsWorking(
        threadDetail.status === "working" || threadDetail.status === "stopping",
      );
    }
  }, [threadDetail?.status]);

  // Fork / edit-resend dialogs
  const {
    dialogState,
    targetMessage,
    handleFork,
    handleEditResend,
    closeDialog,
  } = useForkDialogs(uiMessages);

  const handleSend = useCallback(
    async (message: string) => {
      setPendingUserMsg({
        type: "user",
        model: null,
        parts: [{ type: "text", text: message }],
        timestamp: new Date().toISOString(),
      });
      setIsWorking(true);

      try {
        await sendMessage(message);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to send message",
        );
        setIsWorking(false);
        setPendingUserMsg(null);
      }
    },
    [sendMessage],
  );

  // Auto-send initial prompt on first load — wait for gateway connection
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (!threadDetail?.id || initialPromptSentRef.current) return;
    if (connectionState !== "connected") return;
    initialPromptSentRef.current = true;

    const autoSend = async () => {
      const { consumeInitialPrompt } = await import("@/server-actions/threads");
      const prompt = await consumeInitialPrompt(threadId);
      if (prompt) {
        handleSend(prompt);
      }
    };
    autoSend();
  }, [threadDetail?.id, threadId, handleSend, connectionState]);

  const handleStop = useCallback(async () => {
    try {
      await abort();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to abort");
    }
    setIsWorking(false);
  }, [abort]);

  const handleArchive = useCallback(async () => {
    const { archiveThread } = await import("@/server-actions/threads");
    await archiveThread(threadId);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  }, [threadId, queryClient]);

  const handleResetSession = useCallback(async () => {
    const { resetSession } = await import("@/server-actions/threads");
    await resetSession(threadId);
    queryClient.invalidateQueries({
      queryKey: ["threads", "messages", threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ["threads", "detail", threadId],
    });
  }, [threadId, queryClient]);

  const handleDeleteSession = useCallback(async () => {
    const { deleteSession } = await import("@/server-actions/threads");
    await deleteSession(threadId);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    router.push("/");
  }, [threadId, queryClient, router]);

  return (
    <ThreadProvider thread={openClawThread} isReadOnly={false}>
      <ChatWithFilePanel uiMessages={uiMessages}>
        <OpenClawChatHeader
          onArchive={handleArchive}
          onResetSession={handleResetSession}
          onDeleteSession={handleDeleteSession}
          parentThreadId={threadDetail?.parentThreadId ?? null}
        />

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4 px-4 py-6">
            {uiMessages.length === 0 && !isWorking ? (
              <ConversationEmptyState
                icon={EmptyStateIcon}
                title="Start a conversation"
                description="Describe a coding task and the agent will get to work."
                className="opacity-80"
              />
            ) : (
              <>
                <ChatMessages
                  messages={uiMessages}
                  isAgentWorking={isWorking}
                  onFork={handleFork}
                  onEditResend={handleEditResend}
                />
                {isWorking && uiMessages.length === 0 && (
                  <WorkingMessage message="Agent is starting..." />
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

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
          slashCommandContext={slashCommandContext}
          currentModel={currentModel}
          onModelChange={handleSwitchModel}
        />

        <ForkDialog
          open={dialogState?.type === "fork"}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          sourceThreadId={threadId}
          messageIndex={dialogState?.messageIndex ?? 0}
          message={targetMessage}
        />
        <EditResendDialog
          open={dialogState?.type === "edit-resend"}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          sourceThreadId={threadId}
          messageIndex={dialogState?.messageIndex ?? 0}
          message={targetMessage}
        />
      </ChatWithFilePanel>
    </ThreadProvider>
  );
}

// ─────────────────────────────────────────────────
// Server-action path (existing behavior)
// ─────────────────────────────────────────────────

function ServerActionChatUI({ threadId }: OpenClawChatUIProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
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
  const streamingMessages = useRealtimeChatMessages(
    threadId,
  ) as unknown as DBMessage[];

  const { currentModel, setCurrentModel, handleInject, handleSwitchModel } =
    useSlashCommandHandlers(threadId, queryClient);

  // Sync model from thread detail
  useEffect(() => {
    if (threadDetail?.model) setCurrentModel(threadDetail.model);
  }, [threadDetail?.model, setCurrentModel]);

  // Convert gateway history -> DBMessage[]
  const gatewayMessages = useMemo((): DBMessage[] => {
    if (!historyData?.ok || !historyData.data.length) return [];
    return openClawHistoryToDBMessages(
      historyData.data,
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

  // Convert DBMessages -> UIMessages via the forked toUIMessages pipeline
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
  useEffect(() => {
    if (threadDetail) {
      setIsWorking(
        threadDetail.status === "working" || threadDetail.status === "stopping",
      );
    }
  }, [threadDetail?.status]);

  // Fork / edit-resend dialogs
  const {
    dialogState,
    targetMessage,
    handleFork,
    handleEditResend,
    closeDialog,
  } = useForkDialogs(uiMessages);

  const handleSend = useCallback(
    async (message: string) => {
      setPendingUserMsg({
        type: "user",
        model: null,
        parts: [{ type: "text", text: message }],
        timestamp: new Date().toISOString(),
      });
      setIsWorking(true);

      const { sendChatMessage } = await import(
        "@/server-actions/openclaw-chat"
      );
      const result = await sendChatMessage(threadId, message);
      if (!result.ok) {
        toast.error(result.error);
        setIsWorking(false);
        setPendingUserMsg(null);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["threads", "messages", threadId],
      });
    },
    [threadId, queryClient],
  );

  const slashCommandContext = useSlashCommandContext(
    threadId,
    handleInject,
    handleSwitchModel,
    handleSend,
  );

  // Auto-send initial prompt on first load
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (!threadDetail?.id || initialPromptSentRef.current) return;
    initialPromptSentRef.current = true;

    const autoSend = async () => {
      const { consumeInitialPrompt } = await import("@/server-actions/threads");
      const prompt = await consumeInitialPrompt(threadId);
      if (prompt) {
        handleSend(prompt);
      }
    };
    autoSend();
  }, [threadDetail?.id, threadId, handleSend]);

  const handleStop = useCallback(async () => {
    const { abortChat } = await import("@/server-actions/openclaw-chat");
    const result = await abortChat(threadId);
    if (!result.ok) {
      toast.error(result.error);
    }
    setIsWorking(false);
  }, [threadId]);

  const handleArchive = useCallback(async () => {
    const { archiveThread } = await import("@/server-actions/threads");
    await archiveThread(threadId);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  }, [threadId, queryClient]);

  const handleResetSession = useCallback(async () => {
    const { resetSession } = await import("@/server-actions/threads");
    await resetSession(threadId);
    queryClient.invalidateQueries({
      queryKey: ["threads", "messages", threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ["threads", "detail", threadId],
    });
  }, [threadId, queryClient]);

  const handleDeleteSession = useCallback(async () => {
    const { deleteSession } = await import("@/server-actions/threads");
    await deleteSession(threadId);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    router.push("/");
  }, [threadId, queryClient, router]);

  return (
    <ThreadProvider thread={openClawThread} isReadOnly={false}>
      <ChatWithFilePanel uiMessages={uiMessages}>
        <OpenClawChatHeader
          onArchive={handleArchive}
          onResetSession={handleResetSession}
          onDeleteSession={handleDeleteSession}
          parentThreadId={threadDetail?.parentThreadId ?? null}
        />

        {/* Chat messages area -- flex-1 + min-h-0 ensures proper scroll containment */}
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4 px-4 py-6">
            {uiMessages.length === 0 && !isWorking ? (
              <ConversationEmptyState
                icon={EmptyStateIcon}
                title="Start a conversation"
                description="Describe a coding task and the agent will get to work."
                className="opacity-80"
              />
            ) : (
              <>
                <ChatMessages
                  messages={uiMessages}
                  isAgentWorking={isWorking}
                  onFork={handleFork}
                  onEditResend={handleEditResend}
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
          slashCommandContext={slashCommandContext}
          currentModel={currentModel}
          onModelChange={handleSwitchModel}
        />

        <ForkDialog
          open={dialogState?.type === "fork"}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          sourceThreadId={threadId}
          messageIndex={dialogState?.messageIndex ?? 0}
          message={targetMessage}
        />
        <EditResendDialog
          open={dialogState?.type === "edit-resend"}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          sourceThreadId={threadId}
          messageIndex={dialogState?.messageIndex ?? 0}
          message={targetMessage}
        />
      </ChatWithFilePanel>
    </ThreadProvider>
  );
}
