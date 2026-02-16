/**
 * Browser-compatible WebSocket RPC client for the OpenClaw gateway.
 * Uses browser-native WebSocket via reconnecting-websocket.
 * Thin subset of OpenClawClient — only chat-related methods.
 */

import ReconnectingWebSocket from "reconnecting-websocket";
import { nanoid } from "nanoid";
import type {
  OpenClawRequest,
  OpenClawResponse,
  OpenClawEvent,
  OpenClawFrame,
  ConnectParams,
  HelloPayload,
  ChatEventPayload,
  ChatHistoryEntry,
  ConnectionState,
  GatewayConnectError,
  ExecApprovalRequest,
  ExecApprovalDecision,
} from "@/lib/openclaw-types";
import { classifyConnectError } from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

const CLIENT_ID = "browser-client";
const CLIENT_VERSION = "0.1.0";
const CONNECT_ROLE = "operator";
const CONNECT_SCOPES = [
  "operator.admin",
  "operator.approvals",
  "operator.pairing",
];

// ─────────────────────────────────────────────────
// Pending request tracker
// ─────────────────────────────────────────────────

type PendingRequest = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ─────────────────────────────────────────────────
// Event emitter types
// ─────────────────────────────────────────────────

type EventMap = {
  chat: ChatEventPayload;
  connected: HelloPayload;
  disconnected: { reason?: string };
  "connect-error": GatewayConnectError;
  "exec.approval.requested": ExecApprovalRequest;
  [key: string]: Record<string, unknown>;
};

type EventCallback<T = Record<string, unknown>> = (payload: T) => void;

// ─────────────────────────────────────────────────
// BrowserGatewayClient
// ─────────────────────────────────────────────────

export class BrowserGatewayClient {
  private ws: ReconnectingWebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private state: ConnectionState = "disconnected";

  // Gate non-connect requests until handshake completes
  private readyResolve: (() => void) | null = null;
  private readyReject: ((reason: Error) => void) | null = null;
  private readyPromise: Promise<void> | null = null;

  // ── Lifecycle ──────────────────────────────────

  connect(): Promise<HelloPayload> {
    this.setState("connecting");
    this.resetReady();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/gateway/ws`;

    return new Promise<HelloPayload>((resolve, reject) => {
      // Browser-native WebSocket — no `WebSocket` option needed
      this.ws = new ReconnectingWebSocket(wsUrl, [], {
        maxReconnectionDelay: 10_000,
        minReconnectionDelay: 1_000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 10,
      });

      let handshakeResolved = false;

      const buildConnectParams = (): ConnectParams => ({
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: CLIENT_ID,
          version: CLIENT_VERSION,
          platform: "browser",
          mode: "browser",
        },
        role: CONNECT_ROLE,
        scopes: CONNECT_SCOPES,
        caps: [],
        // Proxy injects the token server-side; omit auth
        auth: undefined,
        userAgent: `openclaw-browser/${CLIENT_VERSION} ${navigator.userAgent.slice(0, 50)}`,
        locale: navigator.language ?? "en",
      });

      this.ws.addEventListener("message", (event: MessageEvent) => {
        try {
          const frame = JSON.parse(event.data as string) as OpenClawFrame;

          if (frame.type === "res") {
            this.handleResponse(frame);
            return;
          }

          if (frame.type === "event") {
            // Auth challenge — send connect params
            if (frame.event === "connect.challenge") {
              this.setState("authenticating");
              this.sendRequest<HelloPayload>(
                "connect",
                buildConnectParams() as unknown as Record<string, unknown>,
              )
                .then((hello) => {
                  this.setState("connected");
                  this.markReady();
                  this.emit("connected", hello);
                  if (!handshakeResolved) {
                    handshakeResolved = true;
                    resolve(hello);
                  }
                })
                .catch((err) => {
                  const structured = classifyConnectError(
                    undefined,
                    (err as Error).message,
                  );
                  this.emit("connect-error", structured);
                  if (!handshakeResolved) {
                    handshakeResolved = true;
                    reject(err);
                  }
                });
              return;
            }

            // Route exec approval events
            if (frame.event === "exec.approval.requested") {
              this.emit(
                "exec.approval.requested",
                frame.payload as unknown as ExecApprovalRequest,
              );
            }

            this.handleEvent(frame);
          }
        } catch {
          // ignore unparseable messages
        }
      });

      this.ws.addEventListener("open", () => {
        // On reconnect, re-do handshake automatically
        if (handshakeResolved) {
          this.setState("reconnecting");
          this.resetReady();
          this.rejectAllPending("Connection lost — reconnecting");
        }
      });

      this.ws.addEventListener("close", (event) => {
        this.setState("disconnected");
        this.emit("disconnected", { reason: "connection closed" });

        const closeCode = (event as { code?: number }).code;
        const closeReason = (event as { reason?: string }).reason;
        if (closeCode && closeCode !== 1000) {
          const structured = classifyConnectError(
            String(closeCode),
            closeReason || `WebSocket closed with code ${closeCode}`,
          );
          this.emit("connect-error", structured);
        }

        if (this.ws && this.ws.retryCount >= 10) {
          const structured = classifyConnectError(
            "unreachable",
            "Gateway unreachable after maximum reconnection attempts",
          );
          this.emit("connect-error", structured);
          const err = new Error(structured.message);
          this.rejectReady(err);
          this.rejectAllPending(err.message);
        }
      });

      this.ws.addEventListener("error", () => {
        // errors are followed by close
      });
    });
  }

  disconnect(): void {
    this.rejectAllPending("Client disconnected");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
    this.emit("disconnected", { reason: "client initiated" });
  }

  getState(): ConnectionState {
    return this.state;
  }

  // ── Chat RPC Methods ───────────────────────────

  chatSend(
    sessionKey: string,
    message: string,
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("chat.send", {
      sessionKey,
      message,
      idempotencyKey: nanoid(),
      ...options,
    });
  }

  chatAbort(sessionKey: string): Promise<Record<string, unknown>> {
    return this.sendRequest("chat.abort", { sessionKey });
  }

  chatHistory(sessionKey: string): Promise<ChatHistoryEntry[]> {
    return this.sendRequest<{ entries: ChatHistoryEntry[] }>("chat.history", {
      sessionKey,
    }).then((res) => res.entries ?? (res as unknown as ChatHistoryEntry[]));
  }

  execApprovalsResolve(
    id: string,
    decision: ExecApprovalDecision,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("exec.approvals.resolve", { id, decision });
  }

  // ── Event Subscription ────────────────────────

  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): void;
  on(event: string, callback: EventCallback): void;
  on(event: string, callback: EventCallback<any>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): void;
  off(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback<any>): void {
    this.listeners.get(event)?.delete(callback);
  }

  // ── Internal ──────────────────────────────────

  private setState(next: ConnectionState): void {
    this.state = next;
  }

  private resetReady(): void {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  private markReady(): void {
    this.readyResolve?.();
    this.readyResolve = null;
    this.readyReject = null;
  }

  private rejectReady(reason: Error): void {
    this.readyReject?.(reason);
    this.readyResolve = null;
    this.readyReject = null;
  }

  private emit(event: string, payload: Record<string, unknown>): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      try {
        cb(payload);
      } catch {
        // listener errors should not crash the client
      }
    }
  }

  private async sendRequest<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(method: string, params?: Record<string, unknown>): Promise<T> {
    // Gate non-connect requests until handshake completes
    if (method !== "connect" && this.readyPromise) {
      await Promise.race([
        this.readyPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Gateway connection timed out")),
            REQUEST_TIMEOUT_MS,
          ),
        ),
      ]);
    }

    return new Promise<T>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("Not connected"));
        return;
      }

      const id = nanoid();

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Request "${method}" timed out after ${REQUEST_TIMEOUT_MS}ms`,
          ),
        );
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (value: Record<string, unknown>) => void,
        reject,
        timer,
      });

      const frame: OpenClawRequest = { type: "req", id, method };
      if (params) frame.params = params;

      this.ws.send(JSON.stringify(frame));
    });
  }

  private handleResponse(frame: OpenClawResponse): void {
    const pending = this.pending.get(frame.id);
    if (!pending) return;

    this.pending.delete(frame.id);
    clearTimeout(pending.timer);

    if (frame.ok) {
      pending.resolve(frame.payload ?? {});
    } else {
      const err = frame.error;
      pending.reject(
        new Error(err ? `${err.code}: ${err.message}` : "Unknown error"),
      );
    }
  }

  private handleEvent(frame: OpenClawEvent): void {
    this.emit(frame.event, frame.payload);
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
