// ─────────────────────────────────────────────────
// OpenClaw Protocol v3 — Wire Types
// ─────────────────────────────────────────────────

/** Outgoing request frame */
export type OpenClawRequest = {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

/** Incoming response frame */
export type OpenClawResponse = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
};

/** Incoming event frame */
export type OpenClawEvent = {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
  seq: number;
};

/** Any frame received from the gateway */
export type OpenClawFrame = OpenClawResponse | OpenClawEvent;

// ─────────────────────────────────────────────────
// Auth Handshake
// ─────────────────────────────────────────────────

export type ConnectChallengeEvent = {
  type: "event";
  event: "connect.challenge";
  payload: { nonce: string; ts: number };
  seq: number;
};

export type ConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  role: string;
  scopes: string[];
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
  caps: string[];
  auth?: { token?: string; password?: string };
  userAgent?: string;
  locale?: string;
};

export type HelloPayload = {
  type?: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};

// ─────────────────────────────────────────────────
// Chat Events
// ─────────────────────────────────────────────────

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage;
  error?: { code: string; message: string };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: ChatContentBlock[];
};

export type ChatContentBlock =
  | ChatTextBlock
  | ChatThinkingBlock
  | ChatToolUseBlock
  | ChatToolResultBlock;

export type ChatTextBlock = {
  type: "text";
  text: string;
};

export type ChatThinkingBlock = {
  type: "thinking";
  thinking: string;
};

export type ChatToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ChatToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

// ─────────────────────────────────────────────────
// Agent Types
// ─────────────────────────────────────────────────

export type OpenClawAgent = {
  id: string;
  name: string;
  emoji?: string;
  model?: string;
  workspace?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OpenClawAgentFile = {
  name: string;
  content: string;
};

// ─────────────────────────────────────────────────
// Session Types
// ─────────────────────────────────────────────────

export type OpenClawSession = {
  key: string;
  agentId?: string;
  model?: string;
  thinking?: "off" | "low" | "medium" | "high";
  createdAt?: string;
  lastMessageAt?: string;
  messageCount?: number;
};

// ─────────────────────────────────────────────────
// Gateway Config
// ─────────────────────────────────────────────────

export type GatewayConfig = Record<string, unknown>;

// ─────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────

export type HealthStatus = {
  status: "ok" | "degraded" | "error";
  version?: string;
  uptime?: number;
  activeSessions?: number;
  cpu?: number;
  memory?: number;
};

// ─────────────────────────────────────────────────
// Client Options
// ─────────────────────────────────────────────────

export type OpenClawClientOptions = {
  url: string;
  token?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
};

// ─────────────────────────────────────────────────
// Connection State
// ─────────────────────────────────────────────────

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

// ─────────────────────────────────────────────────
// Chat History
// ─────────────────────────────────────────────────

export type ChatHistoryEntry = {
  runId: string;
  sessionKey: string;
  messages: ChatMessage[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
  startedAt: string;
  completedAt?: string;
};
