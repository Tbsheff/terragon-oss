/**
 * OpenClaw Event Bridge
 *
 * Connects to the OpenClaw gateway as a WebSocket client,
 * receives chat/agent events, and forwards them to the local broadcast server.
 * This enables real-time UI updates without polling.
 *
 * Gateway is the source of truth — no DB writes happen here.
 */

import type { LocalBroadcastServer } from "./broadcast";
import type {
  ChatEventPayload,
  OpenClawEvent,
  ExecApprovalRequest,
} from "@/lib/openclaw-types";

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
    chatEvent?: ChatEventPayload;
  };
};

/**
 * Bridge between OpenClaw gateway events and the local broadcast server.
 * Receives chat and agent events and rebroadcasts them to UI clients.
 * Routes events by session key directly (no DB mapping needed).
 */
export class OpenClawBridge {
  private broadcast: LocalBroadcastServer;
  // Session key → thread ID mapping for routing events to the right WS room
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

  /** Handle a chat event from the OpenClaw client — broadcast directly */
  onChatEvent(payload: ChatEventPayload): void {
    const threadId = this.sessionToThread.get(payload.sessionKey);
    if (!threadId) return;

    const message: OpenClawBroadcastMessage = {
      type: "thread-update",
      threadId,
      data: {
        messagesUpdated: true,
        chatEvent: payload,
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
    this.broadcast.broadcast(threadId, message);

    // Broadcast thread-list-update globally so dashboard refreshes
    this.broadcast.broadcastAll({
      type: "thread-list-update",
    });
  }

  /** Handle an agent lifecycle event */
  onAgentEvent(event: OpenClawEvent): void {
    // Agent events are broadcast to all clients (not room-specific)
    this.broadcast.broadcastAll({
      type: "agent-update",
      data: event.payload,
    });
  }

  /** Handle an exec approval request — broadcast to the session's thread room */
  onExecApproval(approval: ExecApprovalRequest): void {
    const threadId = this.sessionToThread.get(approval.sessionKey);
    if (!threadId) {
      // No thread mapping — broadcast globally so UI can still show it
      this.broadcast.broadcastAll({
        type: "exec-approval",
        data: approval,
      });
      return;
    }
    this.broadcast.broadcast(threadId, {
      type: "exec-approval",
      threadId,
      data: approval,
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
