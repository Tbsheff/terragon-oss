"use client";

import { useState, useEffect } from "react";

/**
 * Format milliseconds into a human-readable elapsed time string.
 * <1m → "Xs", <1h → "Xm Ys", >=1h → "Xh Ym"
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Returns a live-updating elapsed time string from a given start timestamp.
 * Updates every second via setInterval; cleans up on unmount.
 */
export function useElapsedTime(startedAt: string | null): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);

  // Sync with system clock — valid useEffect for external system (timer)
  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      return;
    }

    const start = new Date(startedAt).getTime();

    const update = () => setElapsed(formatElapsed(Date.now() - start));
    update(); // immediate

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

/**
 * Compute a static duration string between two ISO timestamps.
 */
export function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return formatElapsed(ms);
}
