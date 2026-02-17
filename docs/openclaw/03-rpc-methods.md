# OpenClaw Gateway RPC Methods

Complete reference for all RPC methods exposed by the OpenClaw gateway. Methods are invoked over WebSocket using the Protocol v3 request/response frame format.

## Wire Format

Every request is a JSON frame:

```json
{
  "type": "req",
  "id": "<unique-id>",
  "method": "<method-name>",
  "params": { ... }
}
```

Responses arrive as:

```json
{
  "type": "res",
  "id": "<matching-id>",
  "ok": true,
  "payload": { ... }
}
```

On error:

```json
{
  "type": "res",
  "id": "<matching-id>",
  "ok": false,
  "error": { "code": "...", "message": "..." }
}
```

All RPC methods are gated behind the `connect` handshake. Non-connect requests block until the handshake completes (30s timeout).

---

## Health

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `health` | _none_ | `HealthStatus` | Gateway health check. Returns uptime, active sessions, CPU/memory usage, channel status, and token usage. |

---

## Chat

Methods for sending messages to agents and retrieving conversation history.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `chat.send` | `sessionKey: string`, `message: string`, `idempotencyKey: string` | `Record<string, unknown>` | Send a user message to an agent session. The `idempotencyKey` prevents duplicate processing. Streaming responses arrive as `chat` events (not in the response payload). Additional options can be spread into params. |
| `chat.abort` | `sessionKey: string` | `Record<string, unknown>` | Abort the currently running agent turn in the given session. Triggers an `aborted` state chat event. |
| `chat.history` | `sessionKey: string` | `{ entries: ChatHistoryEntry[] }` | Retrieve full conversation history for a session. Each entry contains the run ID, messages, usage stats, and timestamps. |
| `chat.inject` | `sessionKey: string`, `content: string`, `role?: "system" \| "user"` | `Record<string, unknown>` | Inject a message into the session's context without triggering an agent response. Useful for adding system instructions or pre-seeding context. Defaults to `"system"` role if omitted. |

### Chat Events

Chat streaming is delivered via `event` frames with `event: "chat"` and a `ChatEventPayload`:

```typescript
{
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage;
  error?: { code: string; message: string };
  usage?: { inputTokens: number; outputTokens: number; totalCost?: number };
}
```

- **delta** -- Partial message content (streaming token by token)
- **final** -- Complete message with final usage stats
- **aborted** -- Agent turn was aborted via `chat.abort`
- **error** -- Agent turn failed

---

## Agents

CRUD operations for agent definitions (personas, configurations).

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `agents.list` | _none_ | `{ agents: OpenClawAgent[] }` | List all configured agents. |
| `agents.create` | `name: string`, `emoji?: string`, `model?: string`, `workspace?: string`, `description?: string` | `OpenClawAgent` | Create a new agent definition. Returns the created agent with generated `id` and timestamps. |
| `agents.update` | `id: string`, plus any partial fields: `name?`, `emoji?`, `model?`, `workspace?`, `description?` | `OpenClawAgent` | Update an existing agent. Only provided fields are changed. Returns the updated agent. |
| `agents.delete` | `id: string` | `Record<string, unknown>` | Delete an agent by ID. Associated sessions are not automatically removed. |

### Agent Files

Manage files attached to an agent (e.g., system prompts, CLAUDE.md).

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `agents.files.list` | `agentId: string` | `{ files: OpenClawAgentFile[] }` | List all files for an agent. Each file has `name` and `content`. |
| `agents.files.get` | `agentId: string`, `filename: string` | `OpenClawAgentFile` | Retrieve a single agent file by name. |
| `agents.files.set` | `agentId: string`, `filename: string`, `content: string` | `Record<string, unknown>` | Create or overwrite an agent file. |

---

## Sessions

Manage agent chat sessions (conversations).

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `sessions.list` | _none_ | `{ sessions: OpenClawSession[] }` | List all active sessions with metadata (agent, model, message count, thinking level, queue mode). |
| `sessions.patch` | `key: string`, plus partial settings: `agentId?`, `model?`, `thinking?`, `queueMode?`, `resetPolicy?`, `verboseLevel?` | `OpenClawSession` | Update session settings. Returns the patched session. |
| `sessions.preview` | `key: string` | `SessionPreview` | Get a lightweight preview of a session (summary, message count, last activity). |
| `sessions.reset` | `key: string` | `Record<string, unknown>` | Clear the session's conversation history while keeping the session alive. |
| `sessions.delete` | `key: string` | `Record<string, unknown>` | Permanently delete a session and its history. |
| `sessions.compact` | `key: string` | `Record<string, unknown>` | Compact/summarize the session's context to reduce token usage while preserving essential information. |
| `sessions.spawn` | `agentId: string`, `model?: string`, `sessionKey?: string`, `systemPrompt?: string` | `OpenClawSession` | Create a new session for the given agent. Optionally specify a custom session key, model override, or system prompt. |

---

## Config

Gateway configuration management.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `config.get` | _none_ | `GatewayConfig` | Retrieve the full gateway configuration as a key-value record. |
| `config.set` | `config: GatewayConfig` (full replacement) | `Record<string, unknown>` | Replace the entire gateway configuration. Overwrites all existing values. |
| `config.patch` | `partial: Partial<GatewayConfig>` | `GatewayConfig` | Merge partial updates into the existing configuration. Returns the merged result. |
| `config.schema` | _none_ | `ConfigSchema` | Retrieve the configuration schema describing available properties, types, defaults, and constraints. |
| `config.apply` | _none_ | `Record<string, unknown>` | Apply the current configuration. Triggers a reload/restart of affected gateway subsystems. |

---

## Models

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `models.list` | _none_ | `{ models: GatewayModel[] }` | List all available language models. Returns model IDs, provider info, token limits, and capability flags (vision, tools). |

---

## Channels

External communication channels (Slack, Discord, etc.) connected to the gateway.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `channels.status` | _none_ | `{ items: ChannelStatus[] }` | List all channels with connection state, account info, DM/group policies, last activity, and any error state. |
| `channels.logout` | `id: string` | `Record<string, unknown>` | Disconnect and log out a specific channel by ID. |

---

## Cron

Scheduled job management. Jobs can trigger agent turns or system events on a schedule.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `cron.list` | _none_ | `{ jobs: CronJob[] }` | List all cron jobs with schedule, payload, delivery config, and run history. |
| `cron.add` | `name: string`, `enabled: boolean`, `schedule: CronSchedule`, `sessionTarget: "main" \| "isolated"`, `payload: CronPayload`, `agentId?: string`, `delivery?: CronDelivery`, `deleteAfterRun?: boolean` | `CronJob` | Create a new cron job. Returns the job with generated `jobId` and computed `nextRunAt`. |
| `cron.update` | `jobId: string`, plus partial fields: `name?`, `enabled?`, `schedule?`, `payload?`, etc. | `CronJob` | Update an existing cron job. Returns the updated job. |
| `cron.remove` | `jobId: string` | `void` | Delete a cron job. |
| `cron.run` | `jobId: string` | `{ runId: string }` | Manually trigger a cron job immediately, regardless of schedule. Returns the run ID. |
| `cron.runs` | `jobId: string` | `{ runs: CronRunEntry[] }` | List execution history for a specific cron job. Each entry includes status (`running`, `success`, `failed`), timestamps, and any error. |
| `cron.status` | _none_ | `{ enabled: boolean, activeJobs: number }` | Get the overall cron subsystem status. |

---

## Exec Approvals

Permission system for command execution. When an agent requests to run a command that requires approval, it creates an approval request.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `exec.approvals.list` | _none_ | `{ approvals: ExecApprovalRequest[] }` | List all pending execution approval requests. Each includes the command, args, working directory, session, and requesting agent. |
| `exec.approvals.resolve` | `id: string`, `decision: ExecApprovalDecision` | `Record<string, unknown>` | Resolve a pending approval. Decision is one of `"allow_once"`, `"always_allow"`, or `"deny"`. |
| `exec.approvals.overrides` | _none_ | `{ overrides: Record<string, ExecApprovalDecision> }` | List all persistent approval overrides. Keys are command patterns (glob), values are decisions. |
| `exec.approvals.overrides.set` | `pattern: string`, `decision: ExecApprovalDecision` | `Record<string, unknown>` | Set a persistent override for a command pattern. Future matching commands will be auto-resolved with this decision. |

### Exec Approval Events

When an approval is requested, the gateway emits an event:

```
event: "exec.approval.requested"
payload: ExecApprovalRequest
```

---

## Skills

Plugin/skill management for extending gateway capabilities.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `skills.status` | _none_ | `SkillsStatus` | Get installed skills and count of available skills in the registry. |
| `skills.bins` | _none_ | `{ bins: SkillBin[] }` | Browse the skill registry. Returns available skills with metadata (name, description, version, author, download count). |
| `skills.install` | `id: string` | `SkillInfo` | Install a skill from the registry. Returns the installed skill info. |
| `skills.update` | `id: string` | `SkillInfo` | Update an installed skill to the latest version. Returns the updated skill info. |

---

## Usage

Token usage and cost tracking.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `usage.status` | _none_ | `UsageStatus` | Get current period usage summary: total input/output tokens, cost, period bounds, and session count. |
| `usage.cost` | `periodStart?: string`, `periodEnd?: string` | `UsageCost` | Get detailed cost breakdown by model for a specific time period. Defaults to current billing period if dates omitted. |

---

## Logs

Gateway log access for debugging.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `logs.tail` | `lines?: number`, `level?: string`, `sessionKey?: string` | `{ entries: LogEntry[] }` | Tail recent gateway logs. Optionally filter by log level (`"debug"`, `"info"`, `"warn"`, `"error"`) and/or session. |

---

## Connection Handshake

The `connect` method is special -- it is the first RPC call after WebSocket open, used to authenticate and negotiate protocol features.

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `connect` | `ConnectParams` (see below) | `HelloPayload` | Authenticate with the gateway. Returns negotiated protocol version, available methods/events, and auth details. |

### ConnectParams

```typescript
{
  minProtocol: number;        // Minimum supported protocol (3)
  maxProtocol: number;        // Maximum supported protocol (3)
  client: {
    id: string;               // Client identifier
    version: string;          // Client version
    platform: string;         // "browser" | "node" | platform string
    mode: string;             // "backend"
    instanceId?: string;
  };
  role: string;               // "operator"
  scopes: string[];           // e.g. ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"]
  device?: { ... };           // Optional device attestation
  caps: string[];             // Capability flags
  auth?: { token?: string; password?: string };
  userAgent?: string;
  locale?: string;
}
```

### HelloPayload

```typescript
{
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: { deviceToken?: string; role?: string; scopes?: string[]; issuedAtMs?: number };
  policy?: { tickIntervalMs?: number };
}
```

### Auth Flow

1. Gateway sends `connect.challenge` event with `{ nonce, ts }`
2. Client sends `connect` request with `ConnectParams` (including auth token)
3. Gateway responds with `HelloPayload`
4. Connection is now ready for RPC calls

In proxy mode (browser), the proxy intercepts the `connect` request and injects the auth token server-side before forwarding to the upstream gateway.
