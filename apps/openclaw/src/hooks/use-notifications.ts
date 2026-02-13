"use client";

import { useCallback, useRef } from "react";

type NotificationType = "success" | "error" | "info";

/**
 * Hook for managing desktop notifications via the Web Notification API.
 *
 * Fires notifications for:
 * - Task completed (success/failure)
 * - Review needs human attention
 * - Queue empty (all tasks done)
 */
export function useDesktopNotifications() {
  const permissionRef = useRef<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "denied",
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    permissionRef.current = result;
    return result;
  }, []);

  const notify = useCallback(
    (
      title: string,
      options?: {
        body?: string;
        type?: NotificationType;
        onClick?: () => void;
      },
    ) => {
      if (permissionRef.current !== "granted") return;
      if (document.hasFocus()) return; // Don't notify if app is focused

      const icon = options?.type === "error" ? "/error-icon.png" : "/icon.png";

      const notification = new Notification(title, {
        body: options?.body,
        icon,
        tag: title, // Deduplicate
        silent: false,
      });

      if (options?.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10_000);
    },
    [],
  );

  const notifyTaskComplete = useCallback(
    (taskName: string, success: boolean) => {
      notify(success ? "Task Completed" : "Task Failed", {
        body: taskName,
        type: success ? "success" : "error",
      });
    },
    [notify],
  );

  const notifyReviewNeeded = useCallback(
    (taskName: string) => {
      notify("Review Attention Needed", {
        body: `${taskName} requires human review`,
        type: "info",
      });
    },
    [notify],
  );

  const notifyQueueEmpty = useCallback(() => {
    notify("All Tasks Complete", {
      body: "The task queue is empty",
      type: "success",
    });
  }, [notify]);

  return {
    requestPermission,
    notify,
    notifyTaskComplete,
    notifyReviewNeeded,
    notifyQueueEmpty,
    isSupported: typeof window !== "undefined" && "Notification" in window,
    permission: permissionRef.current,
  };
}
