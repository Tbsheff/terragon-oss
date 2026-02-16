"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGateway } from "@/components/gateway-provider";
import {
  StreamingMessageAccumulator,
  openClawHistoryToDBMessages,
} from "@/lib/message-adapter";
import type { ChatEventPayload } from "@/lib/openclaw-types";
import type { DBMessage } from "@/lib/types";

/**
 * Hook replacing both useRealtimeChatMessages and server-action sendChatMessage.
 * Subscribes directly to the browser gateway client for chat events.
 *
 * Returns DBMessage[] matching the shape toUIMessages() expects.
 */
export function useDirectChat(threadId: string | null) {
  const { client } = useGateway();
  const [streamingMessages, setStreamingMessages] = useState<DBMessage[]>([]);
  const [historyMessages, setHistoryMessages] = useState<DBMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const accumulatorRef = useRef(new StreamingMessageAccumulator());

  // Reset when thread changes
  useEffect(() => {
    accumulatorRef.current.reset();
    setStreamingMessages([]);
    setHistoryMessages([]);
    setHistoryLoaded(false);
  }, [threadId]);

  // Subscribe to chat events from browser gateway.
  // This effect is necessary: it subscribes to an external event source (WebSocket)
  // and cleans up the listener on unmount/dependency change.
  useEffect(() => {
    if (!client || !threadId) return;

    const handler = (payload: ChatEventPayload) => {
      // Filter to events for this thread (sessionKey === threadId)
      if (payload.sessionKey !== threadId) return;

      const newMessages = accumulatorRef.current.processEvent(payload);
      // Cast adapter DBMessage[] → types DBMessage[] (structurally equivalent at runtime)
      setStreamingMessages(newMessages as unknown as DBMessage[]);
    };

    client.on("chat", handler);
    return () => {
      client.off("chat", handler);
    };
  }, [client, threadId]);

  const loadHistory = useCallback(async () => {
    if (!client || !threadId || historyLoaded) return;

    try {
      const entries = await client.chatHistory(threadId);
      const dbMsgs = openClawHistoryToDBMessages(entries);
      setHistoryMessages(dbMsgs as unknown as DBMessage[]);
      setHistoryLoaded(true);
    } catch (err) {
      console.warn("[useDirectChat] Failed to load history:", err);
    }
  }, [client, threadId, historyLoaded]);

  // Auto-load history when client connects and threadId is set
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !threadId) return;
      await client.chatSend(threadId, text);
    },
    [client, threadId],
  );

  const abort = useCallback(async () => {
    if (!client || !threadId) return;
    await client.chatAbort(threadId);
  }, [client, threadId]);

  // Merge: history is the base, streaming messages overlay the current turn.
  // Memoize to avoid new array identity on every streaming delta.
  const messages = useMemo<DBMessage[]>(
    () =>
      streamingMessages.length > 0
        ? [...historyMessages, ...streamingMessages]
        : historyMessages,
    [historyMessages, streamingMessages],
  );

  return {
    messages,
    streamingMessages,
    sendMessage,
    abort,
    loadHistory,
    historyLoaded,
  };
}
