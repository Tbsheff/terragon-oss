"use client";

import { useEffect, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useRouter } from "next/navigation";

/**
 * Global notification provider.
 * Subscribes to the __global__ WebSocket room and fires desktop notifications
 * when tasks complete/fail while the browser tab is not focused.
 */
export function NotificationProvider() {
  // Request permission on mount — external browser API, valid useEffect
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const router = useRouter();

  const handleMessage = useCallback(
    (msg: {
      type: string;
      threadId?: string;
      data?: Record<string, unknown>;
    }) => {
      if (msg.type !== "thread-update" || !msg.data) return;
      if (document.hasFocus()) return;

      const status = msg.data["threadStatusUpdated"] as string | undefined;
      const threadName = (msg.data["threadName"] as string) ?? "Task";
      const threadId = msg.threadId;

      if (!status) return;

      let title: string | null = null;
      if (status === "complete" || status === "working-done") {
        title = "Task Complete";
      } else if (status === "working-error") {
        title = "Task Failed";
      }

      if (
        !title ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      )
        return;

      const notification = new Notification(title, {
        body: threadName,
        tag: `thread-${threadId}`, // deduplicate
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        if (threadId) router.push(`/task/${threadId}`);
        notification.close();
      };

      setTimeout(() => notification.close(), 10_000);
    },
    [router],
  );

  useRealtime({
    room: "__global__",
    enabled: true,
    onMessage: handleMessage,
  });

  return null;
}
