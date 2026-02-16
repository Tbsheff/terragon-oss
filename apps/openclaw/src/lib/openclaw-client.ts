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
  ChatHistoryEntry,
  OpenClawAgent,
  OpenClawAgentFile,
  OpenClawSession,
  GatewayConfig,
  HealthStatus,
  OpenClawClientOptions,
  ConnectionState,
  GatewayConnectError,
  ExecApprovalRequest,
  ExecApprovalDecision,
  SpawnSessionParams,
  InjectParams,
  ChannelStatus,
  CronJob,
  CronRunEntry,
  MemorySearchParams,
  MemorySearchResult,
  MemoryFileContent,
} from "@/lib/openclaw-types";
import { classifyConnectError } from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

const CLIENT_ID = "gateway-client";
const CLIENT_MODE = "backend";
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
  agent: Record<string, unknown>;
  connected: HelloPayload;
  disconnected: { reason?: string };
  "connect-error": GatewayConnectError;
  "exec.approval.requested": ExecApprovalRequest;
  [key: string]: Record<string, unknown>;
};

type EventCallback<T = Record<string, unknown>> = (payload: T) => void;

// ─────────────────────────────────────────────────
// Browser proxy URL
// ─────────────────────────────────────────────────

/** Build same-origin WS URL for browser → proxy connection */
function getBrowserProxyUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/gateway/ws`;
}

// ─────────────────────────────────────────────────
// OpenClawClient
// ─────────────────────────────────────────────────

export class OpenClawClient {
  private ws: ReconnectingWebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private state: ConnectionState = "disconnected";

  // Gate non-connect requests until handshake completes
  private readyResolve: (() => void) | null = null;
  private readyReject: ((reason: Error) => void) | null = null;
  private readyPromise: Promise<void> | null = null;

  // ── Lifecycle ──────────────────────────────────

  async connect(url: string, token: string): Promise<HelloPayload> {
    this.setState("connecting");
    this.resetReady();

    // When running in the browser, connect through the same-origin proxy
    // which injects the auth token server-side.
    const isBrowser = typeof window !== "undefined";
    const wsUrl = isBrowser ? getBrowserProxyUrl() : url;
    const proxyMode = isBrowser;

    return new Promise<HelloPayload>((resolve, reject) => {
      this.ws = new ReconnectingWebSocket(wsUrl, [], {
        WebSocket: (isBrowser ? undefined : WebSocket) as any,
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
          platform: isBrowser ? "browser" : (process.platform ?? "node"),
          mode: CLIENT_MODE,
        },
        role: CONNECT_ROLE,
        scopes: CONNECT_SCOPES,
        caps: [],
        // Proxy injects the token server-side; skip it from the browser
        auth: proxyMode ? undefined : token ? { token } : undefined,
        userAgent: isBrowser
          ? `openclaw-dashboard/${CLIENT_VERSION} browser`
          : `openclaw-dashboard/${CLIENT_VERSION} node/${process.version ?? "unknown"}`,
        locale: "en",
      });

      // Handle all messages (challenge + normal)
      this.ws.addEventListener("message", (event: MessageEvent) => {
        try {
          const frame = JSON.parse(
            typeof event.data === "string" ? event.data : event.data.toString(),
          ) as OpenClawFrame;

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

        // Classify close reason into structured error
        const closeCode = (event as { code?: number }).code;
        const closeReason = (event as { reason?: string }).reason;
        if (closeCode && closeCode !== 1000) {
          const structured = classifyConnectError(
            String(closeCode),
            closeReason || `WebSocket closed with code ${closeCode}`,
          );
          this.emit("connect-error", structured);
        }

        // Terminal failure: if max retries exhausted, reject everything
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

  // ── RPC Methods ────────────────────────────────

  health(): Promise<HealthStatus> {
    return this.sendRequest<HealthStatus>("health");
  }

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

  // ── Exec Approvals ──────────────────────────────

  execApprovalsList(): Promise<ExecApprovalRequest[]> {
    return this.sendRequest<{ approvals: ExecApprovalRequest[] }>(
      "exec.approvals.list",
    ).then((res) => res.approvals ?? (res as unknown as ExecApprovalRequest[]));
  }

  execApprovalsResolve(
    id: string,
    decision: ExecApprovalDecision,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("exec.approvals.resolve", { id, decision });
  }

  execApprovalsOverrides(): Promise<Record<string, ExecApprovalDecision>> {
    return this.sendRequest<{
      overrides: Record<string, ExecApprovalDecision>;
    }>("exec.approvals.overrides").then(
      (res) =>
        res.overrides ??
        (res as unknown as Record<string, ExecApprovalDecision>),
    );
  }

  execApprovalsSetOverride(
    pattern: string,
    decision: ExecApprovalDecision,
  ): Promise<Record<string, unknown>> {
    return this.sendRequest("exec.approvals.overrides.set", {
      pattern,
      decision,
    });
  }

  // ── Sessions.spawn ────────────────────────────

  sessionsSpawn(params: SpawnSessionParams): Promise<OpenClawSession> {
    return this.sendRequest<OpenClawSession>("sessions.spawn", params);
  }

  // ── Chat.inject ────────────────────────────────

  chatInject(params: InjectParams): Promise<Record<string, unknown>> {
    return this.sendRequest("chat.inject", params);
  }

  // ── Channels.status ────────────────────────────

  channelsStatus(): Promise<ChannelStatus[]> {
    return this.sendRequest<{ items: ChannelStatus[] }>(
      "channels.status",
      {},
    ).then((res) => res.items ?? (res as unknown as ChannelStatus[]));
  }

  // ── Cron RPC ────────────────────────────────────

  cronList(): Promise<CronJob[]> {
    return this.sendRequest<{ jobs: CronJob[] }>("cron.list", {}).then(
      (res) => res.jobs ?? [],
    );
  }

  cronAdd(
    job: Omit<CronJob, "jobId" | "createdAt" | "lastRunAt" | "nextRunAt">,
  ): Promise<CronJob> {
    return this.sendRequest<CronJob>("cron.add", job);
  }

  cronUpdate(
    jobId: string,
    patch: Partial<Omit<CronJob, "jobId" | "createdAt">>,
  ): Promise<CronJob> {
    return this.sendRequest<CronJob>("cron.update", { jobId, ...patch });
  }

  cronRemove(jobId: string): Promise<void> {
    return this.sendRequest("cron.remove", { jobId }).then(() => undefined);
  }

  cronRun(jobId: string): Promise<{ runId: string }> {
    return this.sendRequest<{ runId: string }>("cron.run", { jobId });
  }

  cronRuns(jobId: string): Promise<CronRunEntry[]> {
    return this.sendRequest<{ runs: CronRunEntry[] }>("cron.runs", {
      jobId,
    }).then((res) => res.runs ?? []);
  }

  cronStatus(): Promise<{ enabled: boolean; activeJobs: number }> {
    return this.sendRequest<{ enabled: boolean; activeJobs: number }>(
      "cron.status",
      {},
    );
  }

  // ── Memory RPC ──────────────────────────────────

  memorySearch(params: MemorySearchParams): Promise<MemorySearchResult[]> {
    return this.sendRequest<{ results: MemorySearchResult[] }>(
      "memory.search",
      params,
    ).then((res) => res.results ?? []);
  }

  memoryGet(
    agentId: string,
    path: string,
    options?: { lineStart?: number; lineCount?: number },
  ): Promise<MemoryFileContent> {
    return this.sendRequest<MemoryFileContent>("memory.get", {
      agentId,
      path,
      ...options,
    });
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
    // Gate non-connect requests until handshake completes (with timeout)
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
      instance.connect(url, token).catch((err) => {
        console.error("[OpenClawClient] initial connection failed:", err);
      });
    }
  }
  return instance;
}
