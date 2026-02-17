# OpenClaw Type Definitions

Complete TypeScript type reference for the OpenClaw gateway protocol. All types are defined in `apps/openclaw/src/lib/openclaw-types.ts`.

---

## Wire Protocol Types

### OpenClawRequest

Outgoing request frame sent from client to gateway.

```typescript
type OpenClawRequest = {
  type: "req";
  id: string;                          // Unique request ID (nanoid)
  method: string;                      // RPC method name
  params?: Record<string, unknown>;    // Method parameters
};
```

### OpenClawResponse

Incoming response frame from gateway.

```typescript
type OpenClawResponse = {
  type: "res";
  id: string;                          // Matches the request ID
  ok: boolean;                         // Success flag
  payload?: Record<string, unknown>;   // Response data (when ok=true)
  error?: { code: string; message: string };  // Error details (when ok=false)
};
```

### OpenClawEvent

Incoming event frame (server push).

```typescript
type OpenClawEvent = {
  type: "event";
  event: string;                       // Event name (e.g. "chat", "exec.approval.requested")
  payload: Record<string, unknown>;    // Event-specific data
  seq: number;                         // Monotonically increasing sequence number
};
```

### OpenClawFrame

Union of all frames the client can receive.

```typescript
type OpenClawFrame = OpenClawResponse | OpenClawEvent;
```

---

## Connection & Auth

### ConnectionState

Lifecycle state of the WebSocket connection.

```typescript
type ConnectionState =
  | "disconnected"      // No active connection
  | "connecting"        // WebSocket opening
  | "authenticating"    // Handshake in progress (connect request sent)
  | "connected"         // Authenticated, ready for RPC
  | "reconnecting";     // Lost connection, auto-reconnecting
```

### GatewayErrorCode

Categorized error codes for connection failures.

```typescript
type GatewayErrorCode =
  | "AUTH_FAILED"           // Invalid or expired auth token
  | "AUTH_TOKEN_MISSING"    // No auth token provided
  | "PROTOCOL_MISMATCH"    // Client/gateway protocol version incompatible
  | "GATEWAY_UNREACHABLE"  // Cannot reach the gateway (ECONNREFUSED, DNS failure)
  | "GATEWAY_TIMEOUT"      // Connection or request timed out
  | "RATE_LIMITED"          // Too many requests
  | "INTERNAL_ERROR"       // Server-side error
  | "UNKNOWN";             // Unclassified error
```

### GatewayConnectError

Structured error with classification metadata.

```typescript
type GatewayConnectError = {
  code: GatewayErrorCode;
  message: string;
  retryable: boolean;     // Whether the client should auto-retry
  hint?: string;          // Human-readable fix suggestion
};
```

Produced by `classifyConnectError(rawCode?, rawMessage?)` which maps raw error strings/codes into this structured format.

### ConnectChallengeEvent

Server-initiated challenge during auth handshake.

```typescript
type ConnectChallengeEvent = {
  type: "event";
  event: "connect.challenge";
  payload: { nonce: string; ts: number };
  seq: number;
};
```

### ConnectParams

Parameters sent with the `connect` RPC to authenticate.

```typescript
type ConnectParams = {
  minProtocol: number;          // Minimum protocol version (3)
  maxProtocol: number;          // Maximum protocol version (3)
  client: {
    id: string;                 // Client identifier (e.g. "gateway-client")
    version: string;            // Client version (e.g. "0.1.0")
    platform: string;           // "browser" | "node" | process.platform
    mode: string;               // "backend"
    instanceId?: string;        // Optional unique instance ID
  };
  role: string;                 // Auth role (e.g. "operator")
  scopes: string[];             // Requested permission scopes
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
  caps: string[];               // Capability flags
  auth?: {
    token?: string;             // Auth token
    password?: string;          // Alternative: password auth
  };
  userAgent?: string;
  locale?: string;
};
```

### HelloPayload

Response from a successful `connect` handshake.

```typescript
type HelloPayload = {
  type?: "hello-ok";
  protocol: number;                            // Negotiated protocol version
  features?: {
    methods?: string[];                        // Available RPC methods
    events?: string[];                         // Available event types
  };
  snapshot?: unknown;                          // Initial state snapshot
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    tickIntervalMs?: number;                   // Heartbeat interval
  };
};
```

### OpenClawClientOptions

Options for initializing the client singleton.

```typescript
type OpenClawClientOptions = {
  url: string;                              // Gateway WebSocket URL
  token?: string;                           // Auth token
  reconnect?: boolean;                      // Enable auto-reconnect
  maxReconnectAttempts?: number;            // Max retry count
  reconnectInterval?: number;               // Base retry interval (ms)
};
```

---

## Chat Types

### ChatMessage

A single message in a conversation.

```typescript
type ChatMessage = {
  role: "user" | "assistant";
  content: ChatContentBlock[];
};
```

### ChatContentBlock

Union of all content block types within a message.

```typescript
type ChatContentBlock =
  | ChatTextBlock
  | ChatThinkingBlock
  | ChatToolUseBlock
  | ChatToolResultBlock;
```

### ChatTextBlock

Plain text content from the model.

```typescript
type ChatTextBlock = {
  type: "text";
  text: string;
};
```

### ChatThinkingBlock

Extended thinking / chain-of-thought content.

```typescript
type ChatThinkingBlock = {
  type: "thinking";
  thinking: string;
};
```

### ChatToolUseBlock

A tool invocation requested by the model.

```typescript
type ChatToolUseBlock = {
  type: "tool_use";
  id: string;                              // Unique tool use ID
  name: string;                            // Tool name (e.g. "Bash", "Read", "Write")
  input: Record<string, unknown>;          // Tool input parameters
};
```

### ChatToolResultBlock

The result of a tool invocation.

```typescript
type ChatToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;                     // Matches ChatToolUseBlock.id
  content: string;                         // Tool output
  is_error?: boolean;                      // Whether the tool execution failed
};
```

### ChatEventPayload

Payload for `chat` events streamed during an agent turn.

```typescript
type ChatEventPayload = {
  runId: string;                           // Unique run identifier
  sessionKey: string;                      // Session this turn belongs to
  seq: number;                             // Event sequence number
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage;                   // Partial (delta) or complete (final) message
  error?: { code: string; message: string };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
};
```

**State transitions:**
- `delta` -- Streaming content; `message` contains the partial message so far
- `final` -- Turn complete; `message` is the full response, `usage` has final token counts
- `aborted` -- Turn was cancelled via `chat.abort`
- `error` -- Turn failed; `error` contains the failure details

### ChatHistoryEntry

A single completed run in a session's history.

```typescript
type ChatHistoryEntry = {
  runId: string;
  sessionKey: string;
  messages: ChatMessage[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
  startedAt: string;                       // ISO 8601 timestamp
  completedAt?: string;                    // ISO 8601 timestamp (absent if still running)
};
```

### InjectParams

Parameters for the `chat.inject` method.

```typescript
type InjectParams = {
  sessionKey: string;
  content: string;
  role?: "system" | "user";               // Defaults to "system"
};
```

---

## Agent Types

### OpenClawAgent

An agent definition (persona configuration).

```typescript
type OpenClawAgent = {
  id: string;                              // Unique agent ID (generated)
  name: string;                            // Display name
  emoji?: string;                          // Avatar emoji
  model?: string;                          // Default model ID
  workspace?: string;                      // Working directory / project
  description?: string;                    // Agent description
  createdAt?: string;                      // ISO 8601
  updatedAt?: string;                      // ISO 8601
};
```

### OpenClawAgentFile

A file attached to an agent (e.g. system prompt, configuration).

```typescript
type OpenClawAgentFile = {
  name: string;                            // Filename
  content: string;                         // File content (UTF-8 text)
};
```

---

## Session Types

### OpenClawSession

An active chat session.

```typescript
type OpenClawSession = {
  key: string;                             // Unique session key
  agentId?: string;                        // Associated agent ID
  model?: string;                          // Model override for this session
  thinking?: "off" | "low" | "medium" | "high";  // Extended thinking level
  createdAt?: string;                      // ISO 8601
  lastMessageAt?: string;                  // ISO 8601
  messageCount?: number;                   // Total messages in session
  queueMode?: "sequential" | "concurrent" | "collect";  // Message processing mode
  resetPolicy?: {
    type: "idle" | "daily" | "off";        // When to auto-reset context
    value?: number;                        // Idle timeout in ms (for "idle" type)
  };
  verboseLevel?: number;                   // Logging verbosity (0 = silent)
};
```

**Queue modes:**
- `sequential` -- Process messages one at a time in order
- `concurrent` -- Process messages in parallel
- `collect` -- Batch messages before processing

### SessionPreview

Lightweight session summary (from `sessions.preview`).

```typescript
type SessionPreview = {
  key: string;
  summary?: string;                        // AI-generated summary of conversation
  messageCount?: number;
  lastMessageAt?: string;                  // ISO 8601
};
```

### SpawnSessionParams

Parameters for `sessions.spawn`.

```typescript
type SpawnSessionParams = {
  agentId: string;                         // Required: agent to use
  model?: string;                          // Override default model
  sessionKey?: string;                     // Custom session key (auto-generated if omitted)
  systemPrompt?: string;                   // Override agent's system prompt
};
```

---

## Config Types

### GatewayConfig

The gateway configuration is an opaque key-value record. Structure depends on the gateway version.

```typescript
type GatewayConfig = Record<string, unknown>;
```

### ConfigSchema

JSON Schema-like description of available configuration properties.

```typescript
type ConfigSchema = {
  properties?: Record<
    string,
    {
      type: string;                        // JSON Schema type ("string", "number", "boolean", etc.)
      description?: string;
      default?: unknown;
      enum?: unknown[];                    // Allowed values
    }
  >;
  required?: string[];                     // Required property names
};
```

---

## Model Types

### GatewayModel

A language model available through the gateway.

```typescript
type GatewayModel = {
  id: string;                              // Model identifier (e.g. "claude-sonnet-4-20250514")
  name?: string;                           // Human-readable name
  provider?: string;                       // Provider (e.g. "anthropic", "openai")
  maxTokens?: number;                      // Maximum output tokens
  supportsVision?: boolean;                // Can process images
  supportsTools?: boolean;                 // Can use tools / function calling
};
```

---

## Channel Types

### ChannelStatus

Status of an external communication channel.

```typescript
type ChannelStatus = {
  id: string;                              // Channel ID
  type: string;                            // Channel type (e.g. "slack", "discord")
  connected: boolean;                      // Whether the channel is currently active
  accountId?: string;                      // Authenticated account identifier
  dmPolicy?: string;                       // Direct message handling policy
  groupPolicy?: string;                    // Group/channel message handling policy
  lastActivity?: string;                   // ISO 8601 timestamp of last message
  error?: string;                          // Error message if disconnected/failing
};
```

---

## Cron Types

### CronJob

A scheduled job definition.

```typescript
type CronJob = {
  jobId: string;                           // Unique job ID (generated)
  name: string;                            // Human-readable job name
  agentId?: string;                        // Agent to execute the job
  enabled: boolean;                        // Whether the job is active
  schedule: CronSchedule;                  // When to run
  sessionTarget: "main" | "isolated";      // Run in main session or spawn isolated
  payload: CronPayload;                    // What to execute
  delivery?: CronDelivery;                 // Where to deliver results
  deleteAfterRun?: boolean;                // Auto-delete after first execution (one-shot)
  createdAt?: string;                      // ISO 8601
  lastRunAt?: string;                      // ISO 8601
  nextRunAt?: string;                      // ISO 8601 (computed)
};
```

### CronSchedule

Discriminated union for scheduling modes.

```typescript
type CronSchedule =
  | { kind: "at"; datetime: string }       // One-time execution at ISO 8601 datetime
  | { kind: "every"; intervalMs: number }  // Recurring at fixed interval (milliseconds)
  | { kind: "cron"; expression: string };  // Standard cron expression (e.g. "0 9 * * 1-5")
```

### CronPayload

What the cron job executes.

```typescript
type CronPayload =
  | { kind: "systemEvent"; event: string; data?: Record<string, unknown> }  // Emit a system event
  | { kind: "agentTurn"; message: string };                                  // Send a message to the agent
```

### CronDelivery

Optional delivery configuration for job results.

```typescript
type CronDelivery = {
  channels?: string[];                     // Channel IDs to deliver results to
};
```

### CronRunEntry

A single execution record for a cron job.

```typescript
type CronRunEntry = {
  runId: string;                           // Unique run ID
  jobId: string;                           // Parent job ID
  startedAt: string;                       // ISO 8601
  completedAt?: string;                    // ISO 8601 (absent if still running)
  status: "running" | "success" | "failed";
  error?: string;                          // Error message (when status is "failed")
};
```

---

## Exec Approval Types

### ExecApprovalRequest

A pending command execution that requires user approval.

```typescript
type ExecApprovalRequest = {
  id: string;                              // Unique approval request ID
  sessionKey: string;                      // Session that triggered the request
  agentId: string;                         // Agent that wants to run the command
  command: string;                         // The command to execute
  args?: string[];                         // Command arguments
  cwd?: string;                            // Working directory
  requestedAt: string;                     // ISO 8601
};
```

### ExecApprovalDecision

The possible decisions for an approval request.

```typescript
type ExecApprovalDecision = "allow_once" | "always_allow" | "deny";
```

- **allow_once** -- Approve this single execution only
- **always_allow** -- Approve and create a persistent override for matching commands
- **deny** -- Reject the execution

---

## Health Types

### HealthStatus

Gateway health and resource information.

```typescript
type HealthStatus = {
  ok: boolean;                             // Overall health status
  ts?: number;                             // Timestamp (epoch ms)
  durationMs?: number;                     // Health check duration
  version?: string;                        // Gateway version string
  uptime?: number;                         // Uptime in seconds
  activeSessions?: number;                 // Number of active sessions
  cpu?: number;                            // CPU usage (0-1)
  memory?: number;                         // Memory usage (0-1)
  channels?: Record<string, unknown>;      // Per-channel health info
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
};
```

---

## Usage & Cost Types

### UsageStatus

Current period usage summary.

```typescript
type UsageStatus = {
  inputTokens: number;                     // Total input tokens consumed
  outputTokens: number;                    // Total output tokens consumed
  totalCost?: number;                      // Total cost in USD
  periodStart?: string;                    // ISO 8601 billing period start
  periodEnd?: string;                      // ISO 8601 billing period end
  sessions?: number;                       // Number of sessions in this period
};
```

### UsageCost

Detailed cost breakdown by model.

```typescript
type UsageCost = {
  totalCost: number;                       // Total cost in USD
  breakdown?: {
    model: string;                         // Model ID
    inputTokens: number;
    outputTokens: number;
    cost: number;                          // Cost for this model
  }[];
  periodStart?: string;                    // ISO 8601
  periodEnd?: string;                      // ISO 8601
};
```

---

## Skill Types

### SkillsStatus

Overview of the skills subsystem.

```typescript
type SkillsStatus = {
  installed: SkillInfo[];                  // Currently installed skills
  available?: number;                      // Total skills in registry
};
```

### SkillInfo

An installed skill.

```typescript
type SkillInfo = {
  id: string;                              // Unique skill ID
  name: string;                            // Display name
  version?: string;                        // Installed version
  description?: string;                    // What the skill does
  enabled?: boolean;                       // Whether the skill is active
  installedAt?: string;                    // ISO 8601
};
```

### SkillBin

A skill available in the registry (not necessarily installed).

```typescript
type SkillBin = {
  id: string;                              // Unique skill ID
  name: string;                            // Display name
  description?: string;
  version?: string;                        // Latest version
  author?: string;                         // Skill author
  downloadCount?: number;                  // Total installs
};
```

---

## Log Types

### LogEntry

A single gateway log entry.

```typescript
type LogEntry = {
  ts: string;                              // ISO 8601 timestamp
  level: "debug" | "info" | "warn" | "error";
  message: string;                         // Log message
  source?: string;                         // Log source (subsystem name)
  sessionKey?: string;                     // Associated session (if applicable)
  agentId?: string;                        // Associated agent (if applicable)
};
```

---

## Terminal Types (Future Extension)

Types for PTY/terminal access through the gateway. Currently defined but not yet exposed as RPC methods.

### TerminalOpenParams

```typescript
type TerminalOpenParams = {
  sessionKey: string;
  cols?: number;                           // Terminal columns (default: 80)
  rows?: number;                           // Terminal rows (default: 24)
  shell?: string;                          // Shell to use (default: system default)
  cwd?: string;                            // Working directory
};
```

### TerminalOpenResult

```typescript
type TerminalOpenResult = {
  terminalId: string;                      // Unique terminal ID
  pid: number;                             // Process ID of the shell
};
```

### TerminalInputParams

```typescript
type TerminalInputParams = {
  terminalId: string;
  data: string;                            // Raw input data
};
```

### TerminalResizeParams

```typescript
type TerminalResizeParams = {
  terminalId: string;
  cols: number;
  rows: number;
};
```

### TerminalCloseParams

```typescript
type TerminalCloseParams = {
  terminalId: string;
};
```

### TerminalOutputEvent

Event payload for terminal output streaming.

```typescript
type TerminalOutputEvent = {
  terminalId: string;
  data: string;                            // Raw output data
  seq: number;                             // Sequence number for ordering
};
```
