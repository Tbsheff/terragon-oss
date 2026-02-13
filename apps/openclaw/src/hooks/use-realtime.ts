"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  StreamingMessageAccumulator,
  type DBMessage,
} from "@/lib/message-adapter";
import type {
  ChatEventPayload,
  ExecApprovalRequest,
} from "@/lib/openclaw-types";

type RealtimeMessage = {
  type: string;
  threadId?: string;
  data?: Record<string, unknown>;
  status?: string;
};

type UseRealtimeOptions = {
  /** Room to subscribe to (usually threadId) */
  room: string;
  /** Called on every message */
  onMessage?: (msg: RealtimeMessage) => void;
  /** Whether the hook is enabled */
  enabled?: boolean;
};

/**
 * Hook to subscribe to local WebSocket broadcast server.
 * Replaces Terragon's PartySocket-based useRealtimeBase.
 */
export function useRealtime({
  room,
  onMessage,
  enabled = true,
}: UseRealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    if (!enabled || !room) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/ws?room=${encodeURIComponent(room)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: RealtimeMessage = JSON.parse(event.data);
        onMessageRef.current?.(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Auto-reconnect after 2s by bumping reconnectCount to re-trigger effect
      if (wsRef.current === ws) {
        setTimeout(() => {
          setReconnectCount((c) => c + 1);
        }, 2000);
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [room, enabled, reconnectCount]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}

/**
 * Hook that subscribes to thread-specific real-time updates.
 * On receiving updates, invalidates React Query caches for the thread.
 */
export function useRealtimeThread(threadId: string | null) {
  const queryClient = useQueryClient();

  useRealtime({
    room: threadId ?? "",
    enabled: !!threadId,
    onMessage: (msg) => {
      if (msg.type === "thread-update" && msg.data) {
        // Invalidate thread detail query
        queryClient.invalidateQueries({
          queryKey: ["threads", "detail", threadId],
        });

        // If messages updated, invalidate messages query
        if (msg.data["messagesUpdated"]) {
          queryClient.invalidateQueries({
            queryKey: ["threads", "messages", threadId],
          });
        }

        // If status changed, also invalidate the list
        if (msg.data["threadStatusUpdated"]) {
          queryClient.invalidateQueries({
            queryKey: ["threads", "list"],
          });
        }
      }
    },
  });
}

/**
 * Hook that accumulates chat messages from realtime broadcast events.
 * Uses StreamingMessageAccumulator to process ChatEventPayload into DBMessage[].
 * Returns event-driven messages (no polling).
 */
export function useRealtimeChatMessages(threadId: string | null) {
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const accumulatorRef = useRef(new StreamingMessageAccumulator());

  // Reset accumulator when thread changes
  useEffect(() => {
    accumulatorRef.current.reset();
    setMessages([]);
  }, [threadId]);

  useRealtime({
    room: threadId ?? "",
    enabled: !!threadId,
    onMessage: (msg) => {
      if (msg.type === "thread-update" && msg.data?.chatEvent) {
        const chatEvent = msg.data.chatEvent as ChatEventPayload;
        const newMessages = accumulatorRef.current.processEvent(chatEvent);
        setMessages(newMessages);
      }
    },
  });

  return messages;
}

/**
 * Hook that tracks pending exec approval requests for a thread.
 * Listens for exec-approval broadcast events and manages the pending list.
 */
export function useExecApprovals(threadId: string | null) {
  const [pending, setPending] = useState<ExecApprovalRequest[]>([]);

  useRealtime({
    room: threadId ?? "",
    enabled: !!threadId,
    onMessage: (msg) => {
      if (msg.type === "exec-approval" && msg.data) {
        const approval = msg.data as unknown as ExecApprovalRequest;
        setPending((prev) => {
          // Deduplicate by ID
          if (prev.some((p) => p.id === approval.id)) return prev;
          return [...prev, approval];
        });
      }
    },
  });

  const resolve = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { pending, resolve };
}

/**
 * Hook that subscribes to global events (connection status, agent updates).
 */
export function useRealtimeGlobal() {
  const queryClient = useQueryClient();

  useRealtime({
    room: "__global__",
    enabled: true,
    onMessage: (msg) => {
      if (msg.type === "connection-status") {
        queryClient.invalidateQueries({
          queryKey: ["connection"],
        });
      }
      if (msg.type === "agent-update") {
        queryClient.invalidateQueries({
          queryKey: ["agents"],
        });
      }
      if (msg.type === "thread-list-update") {
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "stats"],
        });
        queryClient.invalidateQueries({
          queryKey: ["threads", "enriched-list"],
        });
        queryClient.invalidateQueries({
          queryKey: ["threads", "list"],
        });
      }
    },
  });
}
