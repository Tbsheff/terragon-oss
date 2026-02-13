"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
      // Auto-reconnect after 2s
      if (wsRef.current === ws) {
        setTimeout(() => {
          // Re-run effect by checking if still mounted
        }, 2000);
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [room, enabled]);

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
    },
  });
}
