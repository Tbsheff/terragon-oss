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
  queueMode?: "sequential" | "concurrent" | "collect";
  resetPolicy?: { type: "idle" | "daily" | "off"; value?: number };
  verboseLevel?: number;
};

// ─────────────────────────────────────────────────
// Gateway Config
// ─────────────────────────────────────────────────

export type GatewayConfig = Record<string, unknown>;

// ─────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────

export type HealthStatus = {
  ok: boolean;
  ts?: number;
  durationMs?: number;
  version?: string;
  uptime?: number;
  activeSessions?: number;
  cpu?: number;
  memory?: number;
  channels?: Record<string, unknown>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
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
// Connection State & Errors
// ─────────────────────────────────────────────────

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

export type GatewayErrorCode =
  | "AUTH_FAILED"
  | "AUTH_TOKEN_MISSING"
  | "PROTOCOL_MISMATCH"
  | "GATEWAY_UNREACHABLE"
  | "GATEWAY_TIMEOUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "UNKNOWN";

export type GatewayConnectError = {
  code: GatewayErrorCode;
  message: string;
  retryable: boolean;
  hint?: string;
};

/** Classify a raw error string/code into a structured connect error */
export function classifyConnectError(
  rawCode?: string,
  rawMessage?: string,
): GatewayConnectError {
  const code = rawCode?.toLowerCase() ?? "";
  const msg = rawMessage ?? "Unknown error";

  if (
    code.includes("auth") ||
    code === "unauthorized" ||
    code === "forbidden"
  ) {
    return {
      code: "AUTH_FAILED",
      message: msg,
      retryable: false,
      hint: "Check your gateway auth token in Settings > Connection.",
    };
  }

  if (code.includes("token") || msg.toLowerCase().includes("no token")) {
    return {
      code: "AUTH_TOKEN_MISSING",
      message: msg,
      retryable: false,
      hint: "Set an auth token in Settings > Connection.",
    };
  }

  if (code.includes("protocol") || code.includes("version")) {
    return {
      code: "PROTOCOL_MISMATCH",
      message: msg,
      retryable: false,
      hint: "Update your gateway to a compatible version.",
    };
  }

  if (code.includes("rate") || code.includes("throttl")) {
    return {
      code: "RATE_LIMITED",
      message: msg,
      retryable: true,
    };
  }

  if (code.includes("timeout") || msg.toLowerCase().includes("timed out")) {
    return {
      code: "GATEWAY_TIMEOUT",
      message: msg,
      retryable: true,
    };
  }

  if (code.includes("econnrefused") || code.includes("unreachable")) {
    return {
      code: "GATEWAY_UNREACHABLE",
      message: msg,
      retryable: true,
      hint: "Is the gateway running? Check host and port in Settings > Connection.",
    };
  }

  if (code.includes("internal") || code.includes("server")) {
    return {
      code: "INTERNAL_ERROR",
      message: msg,
      retryable: true,
    };
  }

  return { code: "UNKNOWN", message: msg, retryable: true };
}

// ─────────────────────────────────────────────────
// Exec Approval Types
// ─────────────────────────────────────────────────

export type ExecApprovalRequest = {
  id: string;
  sessionKey: string;
  agentId: string;
  command: string;
  args?: string[];
  cwd?: string;
  requestedAt: string;
};

export type ExecApprovalDecision = "allow_once" | "always_allow" | "deny";

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

// ─────────────────────────────────────────────────
// Sessions.spawn
// ─────────────────────────────────────────────────

export type SpawnSessionParams = {
  agentId: string;
  model?: string;
  sessionKey?: string;
  systemPrompt?: string;
};

// ─────────────────────────────────────────────────
// Chat.inject
// ─────────────────────────────────────────────────

export type InjectParams = {
  sessionKey: string;
  content: string;
  role?: "system" | "user";
};

// ─────────────────────────────────────────────────
// Channels.status
// ─────────────────────────────────────────────────

export type ChannelStatus = {
  id: string;
  type: string;
  connected: boolean;
  accountId?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  lastActivity?: string;
  error?: string;
};

// ─────────────────────────────────────────────────
// Cron Types
// ─────────────────────────────────────────────────

export type CronSchedule =
  | { kind: "at"; datetime: string }
  | { kind: "every"; intervalMs: number }
  | { kind: "cron"; expression: string };

export type CronPayload =
  | { kind: "systemEvent"; event: string; data?: Record<string, unknown> }
  | { kind: "agentTurn"; message: string };

export type CronDelivery = {
  channels?: string[];
};

export type CronJob = {
  jobId: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  payload: CronPayload;
  delivery?: CronDelivery;
  deleteAfterRun?: boolean;
  createdAt?: string;
  lastRunAt?: string;
  nextRunAt?: string;
};

export type CronRunEntry = {
  runId: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "success" | "failed";
  error?: string;
};

// ─────────────────────────────────────────────────
// Terminal / PTY Types (future gateway extension)
// ─────────────────────────────────────────────────

export type TerminalOpenParams = {
  sessionKey: string;
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
};

export type TerminalOpenResult = {
  terminalId: string;
  pid: number;
};

export type TerminalInputParams = {
  terminalId: string;
  data: string;
};

export type TerminalResizeParams = {
  terminalId: string;
  cols: number;
  rows: number;
};

export type TerminalCloseParams = {
  terminalId: string;
};

export type TerminalOutputEvent = {
  terminalId: string;
  data: string;
  seq: number;
};
