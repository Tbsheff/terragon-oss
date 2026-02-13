import ReconnectingWebSocket from "reconnecting-websocket";
import WebSocket from "ws";
import { nanoid } from "nanoid";
import type {
  OpenClawRequest,
  OpenClawResponse,
  OpenClawEvent,
  OpenClawFrame,
  ConnectParams,
  HelloPayload,
  ChatEventPayload,
  ChatMessage,
  ChatHistoryEntry,
  OpenClawAgent,
  OpenClawAgentFile,
  OpenClawSession,
  GatewayConfig,
  HealthStatus,
  OpenClawClientOptions,
  ConnectionState,
} from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

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
  agent: Record<string, unknown>;
  connected: HelloPayload;
  disconnected: { reason?: string };
  [key: string]: Record<string, unknown>;
};

type EventCallback<T = Record<string, unknown>> = (payload: T) => void;

// ─────────────────────────────────────────────────
// OpenClawClient
// ─────────────────────────────────────────────────

export class OpenClawClient {
  private ws: ReconnectingWebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private state: ConnectionState = "disconnected";
  private token: string | null = null;

  // ── Lifecycle ──────────────────────────────────

  async connect(url: string, token: string): Promise<HelloPayload> {
    this.token = token;
    this.setState("connecting");

    return new Promise<HelloPayload>((resolve, reject) => {
      this.ws = new ReconnectingWebSocket(url, [], {
        WebSocket: WebSocket as any,
        maxReconnectionDelay: 10_000,
        minReconnectionDelay: 1_000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 10,
      });

      let handshakeResolved = false;

      // Temporary handler for the auth challenge during initial connect
      const onChallengeMessage = (event: MessageEvent) => {
        try {
          const frame = JSON.parse(
            typeof event.data === "string" ? event.data : event.data.toString(),
          ) as OpenClawFrame;

          if (frame.type === "event" && frame.event === "connect.challenge") {
            this.setState("authenticating");
            this.sendRequest<HelloPayload>("connect", {
              scopes: ["*"],
              token,
            } satisfies ConnectParams)
              .then((hello) => {
                handshakeResolved = true;
                this.setState("connected");
                this.emit("connected", hello);
                resolve(hello);
              })
              .catch((err) => {
                if (!handshakeResolved) {
                  handshakeResolved = true;
                  reject(err);
                }
              });
          }
        } catch {
          // ignore malformed frames during handshake
        }
      };

      this.ws.addEventListener("message", onChallengeMessage);

      // Once the main message handler is wired, remove the temporary one
      this.ws.addEventListener("open", () => {
        // On reconnect, re-do handshake automatically
        if (handshakeResolved) {
          this.setState("reconnecting");
          this.rejectAllPending("Connection lost — reconnecting");
        }
      });

      this.ws.addEventListener("message", (event: MessageEvent) => {
        // The challenge handler above takes care of the initial challenge.
        // All subsequent messages are routed here.
        if (!handshakeResolved) return;

        try {
          const frame = JSON.parse(
            typeof event.data === "string" ? event.data : event.data.toString(),
          ) as OpenClawFrame;

          if (frame.type === "res") {
            this.handleResponse(frame);
          } else if (frame.type === "event") {
            // Re-auth on reconnect challenge
            if (frame.event === "connect.challenge" && this.token) {
              this.setState("authenticating");
              this.sendRequest<HelloPayload>("connect", {
                scopes: ["*"],
                token: this.token,
              } satisfies ConnectParams)
                .then((hello) => {
                  this.setState("connected");
                  this.emit("connected", hello);
                })
                .catch(() => {
                  // auth failed on reconnect
                });
              return;
            }
            this.handleEvent(frame);
          }
        } catch {
          // ignore unparseable messages
        }
      });

      this.ws.addEventListener("close", () => {
        this.setState("disconnected");
        this.emit("disconnected", { reason: "connection closed" });
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
    this.token = null;
    this.setState("disconnected");
    this.emit("disconnected", { reason: "client initiated" });
  }

  getState(): ConnectionState {
    return this.state;
  }

  // ── RPC Methods ────────────────────────────────

  health(): Promise<HealthStatus> {
    return this.sendRequest<HealthStatus>("health");
  }

  chatSend(
    sessionKey: string,
    message: ChatMessage,
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("chat.send", { sessionKey, message, ...options });
  }

  chatAbort(sessionKey: string): Promise<Record<string, unknown>> {
    return this.sendRequest("chat.abort", { sessionKey });
  }

  chatHistory(sessionKey: string): Promise<ChatHistoryEntry[]> {
    return this.sendRequest<{ entries: ChatHistoryEntry[] }>("chat.history", {
      sessionKey,
    }).then((res) => res.entries ?? (res as unknown as ChatHistoryEntry[]));
  }

  agentsList(): Promise<OpenClawAgent[]> {
    return this.sendRequest<{ agents: OpenClawAgent[] }>("agents.list").then(
      (res) => res.agents ?? (res as unknown as OpenClawAgent[]),
    );
  }

  agentsCreate(
    agent: Omit<OpenClawAgent, "id" | "createdAt" | "updatedAt">,
  ): Promise<OpenClawAgent> {
    return this.sendRequest<OpenClawAgent>("agents.create", {
      ...agent,
    });
  }

  agentsUpdate(
    id: string,
    updates: Partial<Omit<OpenClawAgent, "id">>,
  ): Promise<OpenClawAgent> {
    return this.sendRequest<OpenClawAgent>("agents.update", { id, ...updates });
  }

  agentsDelete(id: string): Promise<Record<string, unknown>> {
    return this.sendRequest("agents.delete", { id });
  }

  agentsFilesList(agentId: string): Promise<OpenClawAgentFile[]> {
    return this.sendRequest<{ files: OpenClawAgentFile[] }>(
      "agents.files.list",
      { agentId },
    ).then((res) => res.files ?? (res as unknown as OpenClawAgentFile[]));
  }

  agentsFilesGet(
    agentId: string,
    filename: string,
  ): Promise<OpenClawAgentFile> {
    return this.sendRequest<OpenClawAgentFile>("agents.files.get", {
      agentId,
      filename,
    });
  }

  agentsFilesSet(
    agentId: string,
    filename: string,
    content: string,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("agents.files.set", {
      agentId,
      filename,
      content,
    });
  }

  sessionsList(): Promise<OpenClawSession[]> {
    return this.sendRequest<{ sessions: OpenClawSession[] }>(
      "sessions.list",
    ).then((res) => res.sessions ?? (res as unknown as OpenClawSession[]));
  }

  sessionsPatch(
    sessionKey: string,
    settings: Partial<Omit<OpenClawSession, "key">>,
  ): Promise<OpenClawSession> {
    return this.sendRequest<OpenClawSession>("sessions.patch", {
      sessionKey,
      ...settings,
    });
  }

  configGet(): Promise<GatewayConfig> {
    return this.sendRequest<GatewayConfig>("config.get");
  }

  configSet(config: GatewayConfig): Promise<Record<string, unknown>> {
    return this.sendRequest("config.set", config);
  }

  configPatch(partial: Partial<GatewayConfig>): Promise<GatewayConfig> {
    return this.sendRequest<GatewayConfig>("config.patch", partial);
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

  private sendRequest<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(method: string, params?: Record<string, unknown>): Promise<T> {
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

// ─────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────

let instance: OpenClawClient | null = null;

export function getOpenClawClient(
  options?: OpenClawClientOptions,
): OpenClawClient {
  if (!instance) {
    instance = new OpenClawClient();

    const url = options?.url ?? process.env.OPENCLAW_GATEWAY_URL;
    const token = options?.token ?? process.env.OPENCLAW_AUTH_TOKEN ?? "";

    if (url) {
      instance.connect(url, token).catch(() => {
        // caller should use the returned promise from connect() for error handling
      });
    }
  }
  return instance;
}
