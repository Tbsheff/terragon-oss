"use client";

import { useQuery } from "@tanstack/react-query";
import { testConnection } from "@/server-actions/settings";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useConnection() {
  const query = useQuery({
    queryKey: ["connection", "health"],
    queryFn: async () => {
      const result = await testConnection();
      return {
        isConnected: result.success,
        status: (result.success
          ? "connected"
          : "disconnected") as ConnectionStatus,
        version: result.version ?? null,
        gatewayStatus: result.status ?? null,
        error: result.error ?? null,
        lastCheck: new Date().toISOString(),
      };
    },
    refetchInterval: 30_000,
    retry: false,
    staleTime: 25_000,
  });

  return {
    status: query.data?.status ?? ("disconnected" as ConnectionStatus),
    lastCheck: query.data?.lastCheck ?? null,
    health: query.data ?? null,
    isConnected: query.data?.isConnected ?? false,
    isLoading: query.isLoading,
    error: query.data?.error ?? null,
    refetch: query.refetch,
  };
}
