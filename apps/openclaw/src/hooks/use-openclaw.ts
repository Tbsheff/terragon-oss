"use client";

import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import type { ConnectionState, HealthStatus } from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Jotai Atoms for global client state
// ─────────────────────────────────────────────────

export const connectionStateAtom = atom<ConnectionState>("disconnected");
export const gatewayHealthAtom = atom<HealthStatus | null>(null);

// ─────────────────────────────────────────────────
// React Query hooks for OpenClaw data
// ─────────────────────────────────────────────────

/** Query keys for OpenClaw data */
export const openclawQueryKeys = {
  agents: {
    all: ["agents"] as const,
    list: () => ["agents", "list"] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    files: (id: string) => ["agents", "files", id] as const,
    file: (id: string, filename: string) =>
      ["agents", "files", id, filename] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    list: () => ["sessions", "list"] as const,
  },
  config: {
    all: ["config"] as const,
    get: () => ["config", "get"] as const,
  },
  connection: {
    health: () => ["connection", "health"] as const,
  },
};

/** Hook to monitor connection health */
export function useConnectionHealth() {
  const [, setHealth] = useAtom(gatewayHealthAtom);

  return useQuery({
    queryKey: openclawQueryKeys.connection.health(),
    queryFn: async (): Promise<HealthStatus> => {
      // Call server action to check health
      const response = await fetch("/api/openclaw-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "health" }),
      });
      const data = await response.json();
      setHealth(data);
      return data;
    },
    refetchInterval: 30_000, // Poll every 30s
    retry: 1,
    staleTime: 10_000,
  });
}

/** Hook to get connection state */
export function useConnectionState() {
  return useAtom(connectionStateAtom);
}
