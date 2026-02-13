"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab title based on active task count and error state.
 * Useful for long-running agents — users can see status without switching tabs.
 */
export function useDocumentTitle(activeCount: number, hasError: boolean) {
  // Sync document.title with external browser API — valid useEffect
  useEffect(() => {
    if (hasError) {
      document.title = "(!) OpenClaw";
    } else if (activeCount > 0) {
      document.title = `(${activeCount}) OpenClaw`;
    } else {
      document.title = "OpenClaw";
    }

    return () => {
      document.title = "OpenClaw";
    };
  }, [activeCount, hasError]);
}
