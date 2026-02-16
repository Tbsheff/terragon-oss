"use client";

import { createContext, useContext } from "react";
import { useGatewayClient } from "@/hooks/use-gateway-client";
import type { BrowserGatewayClient } from "@/lib/browser-gateway-client";
import type { ConnectionState } from "@/lib/openclaw-types";

type GatewayContextValue = {
  client: BrowserGatewayClient | null;
  connectionState: ConnectionState;
};

const GatewayContext = createContext<GatewayContextValue>({
  client: null,
  connectionState: "disconnected",
});

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const { client, connectionState } = useGatewayClient();

  return (
    <GatewayContext.Provider value={{ client, connectionState }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway(): GatewayContextValue {
  return useContext(GatewayContext);
}
