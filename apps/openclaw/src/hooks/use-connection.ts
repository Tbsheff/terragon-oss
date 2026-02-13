"use client";

import { useQuery } from "@tanstack/react-query";
import { testConnection } from "@/server-actions/settings";
import {
  classifyConnectError,
  type GatewayConnectError,
} from "@/lib/openclaw-types";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useConnection() {
  const query = useQuery({
    queryKey: ["connection", "health"],
    queryFn: async () => {
      const result = await testConnection();
      const isConnected = result.success;

      // Classify error into structured type
      let connectError: GatewayConnectError | null = null;
      if (!isConnected && result.error) {
        connectError = classifyConnectError(undefined, result.error);
      }

      return {
        isConnected,
        status: (isConnected
          ? "connected"
          : "disconnected") as ConnectionStatus,
        version: result.version ?? null,
        gatewayStatus: result.status ?? null,
        error: result.error ?? null,
        connectError,
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
    connectError: query.data?.connectError ?? null,
    refetch: query.refetch,
  };
}
