/**
 * OpenClaw Event Bridge
 *
 * Connects to the OpenClaw gateway as a WebSocket client,
 * receives chat/agent events, and forwards them to the local broadcast server.
 * This enables real-time UI updates without polling.
 */

import type { LocalBroadcastServer } from "./broadcast";
import type { ChatEventPayload, OpenClawEvent } from "@/lib/openclaw-types";

export type BridgeOptions = {
  broadcast: LocalBroadcastServer;
  gatewayUrl: string;
  authToken?: string;
};

/** Simplified broadcast message for the OpenClaw dashboard */
export type OpenClawBroadcastMessage = {
  type: "thread-update";
  threadId: string;
  data: {
    messagesUpdated?: boolean;
    threadStatusUpdated?: string;
    threadName?: string;
    isThreadCreated?: boolean;
    isThreadDeleted?: boolean;
    isThreadArchived?: boolean;
  };
};

/**
 * Bridge between OpenClaw gateway events and the local broadcast server.
 * Listens for chat and agent events and rebroadcasts them to UI clients.
 *
 * NOTE: This is designed to work with the OpenClawClient from openclaw-client.ts.
 * In the actual integration, the client's event listeners call bridge.onChatEvent()
 * and bridge.onAgentEvent() directly, rather than maintaining a separate WS connection.
 */
export class OpenClawBridge {
  private broadcast: LocalBroadcastServer;
  private sessionToThread = new Map<string, string>();

  constructor(options: BridgeOptions) {
    this.broadcast = options.broadcast;
  }

  /** Register a mapping from OpenClaw session key to thread ID */
  registerSession(sessionKey: string, threadId: string): void {
    this.sessionToThread.set(sessionKey, threadId);
  }

  /** Unregister a session mapping */
  unregisterSession(sessionKey: string): void {
    this.sessionToThread.delete(sessionKey);
  }

  /** Handle a chat event from the OpenClaw client */
  onChatEvent(payload: ChatEventPayload): void {
    const threadId = this.sessionToThread.get(payload.sessionKey);
    if (!threadId) return;

    const message: OpenClawBroadcastMessage = {
      type: "thread-update",
      threadId,
      data: {
        messagesUpdated: true,
        threadStatusUpdated:
          payload.state === "final"
            ? "complete"
            : payload.state === "error"
              ? "working-error"
              : payload.state === "aborted"
                ? "working-done"
                : "working",
      },
    };

    // Broadcast to the thread's room
    this.broadcast.broadcast(threadId, message);
  }

  /** Handle an agent lifecycle event */
  onAgentEvent(event: OpenClawEvent): void {
    // Agent events are broadcast to all clients (not room-specific)
    this.broadcast.broadcastAll({
      type: "agent-update",
      data: event.payload,
    });
  }

  /** Notify all clients of connection status change */
  onConnectionChange(
    status: "connected" | "disconnected" | "reconnecting",
  ): void {
    this.broadcast.broadcastAll({
      type: "connection-status",
      status,
    });
  }
}
