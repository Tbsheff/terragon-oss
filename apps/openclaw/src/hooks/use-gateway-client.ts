"use client";

import { useState, useEffect, useRef } from "react";
import { BrowserGatewayClient } from "@/lib/browser-gateway-client";
import type { ConnectionState } from "@/lib/openclaw-types";

/**
 * Manages the BrowserGatewayClient lifecycle.
 * Creates a singleton client, auto-connects, tracks connection state, disconnects on unmount.
 */
export function useGatewayClient() {
  const clientRef = useRef<BrowserGatewayClient | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  // Sync external connection state into React state.
  // This effect is necessary: it manages a WebSocket resource (external system)
  // with proper cleanup on unmount.
  useEffect(() => {
    const client = new BrowserGatewayClient();
    clientRef.current = client;

    const onConnected = () => setConnectionState("connected");
    const onDisconnected = () => setConnectionState("disconnected");
    const onConnectError = () => setConnectionState(client.getState());

    client.on("connected", onConnected);
    client.on("disconnected", onDisconnected);
    client.on("connect-error", onConnectError);

    setConnectionState("connecting");
    client.connect().catch(() => {
      // Connection errors are handled via events
    });

    return () => {
      client.off("connected", onConnected);
      client.off("disconnected", onDisconnected);
      client.off("connect-error", onConnectError);
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  return { client: clientRef.current, connectionState };
}
