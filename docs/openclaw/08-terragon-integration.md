# Terragon-OpenClaw Integration

How Terragon connects to the OpenClaw gateway. All code lives in `apps/openclaw/src/`.

---

## Architecture Overview

```
  Browser                    Next.js Server                 OpenClaw Gateway
  ──────                     ──────────────                 ────────────────
  BrowserGatewayClient ──ws──▶ GatewayProxy ──ws──▶ ws://host:18789/ws
  (no auth token)            (injects token)        (full protocol v3)
                             ▲
                             │ loadSettings()
                             ▼
                          SQLite DB
                    (openclaw_connection table)
```

Three layers, each with a distinct responsibility:

1. **BrowserGatewayClient** -- browser-side, thin, no secrets
2. **GatewayProxy** -- server-side, intercepts connect, injects auth
3. **OpenClawClient** -- full-featured, used in server actions and Node.js contexts

---

## OpenClawClient (`src/lib/openclaw-client.ts`)

Full-featured singleton WebSocket RPC client. Works in both Node.js and browser environments (in browser, it auto-routes through the proxy).

### Connection Flow

```typescript
const client = new OpenClawClient();
const hello = await client.connect("ws://mac-mini.tailnet:18789/ws", token);
```

1. Opens a `ReconnectingWebSocket` (uses `ws` package in Node, native WebSocket in browser)
2. Waits for `connect.challenge` event from gateway
3. Sends `connect` request with protocol version, client metadata, scopes, and auth token
4. Receives `HelloPayload` with negotiated features and granted scopes
5. Marks connection as ready -- all queued RPC calls proceed

### Constants

| Constant             | Value                                                                                             | Purpose                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `CLIENT_ID`          | `"gateway-client"`                                                                                | Client identifier sent in connect handshake   |
| `CLIENT_MODE`        | `"backend"`                                                                                       | Tells gateway this is a backend client        |
| `CLIENT_VERSION`     | `"0.1.0"`                                                                                         | Protocol client version                       |
| `CONNECT_ROLE`       | `"operator"`                                                                                      | Role -- operator (human) vs agent (AI daemon) |
| `CONNECT_SCOPES`     | `["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"]` | Requested permission scopes                   |
| `REQUEST_TIMEOUT_MS` | `30000`                                                                                           | Per-request timeout for RPC calls             |

### RPC Methods (37 total)

**Chat:**

- `chatSend(sessionKey, message, options?)` -- send a message, generates idempotency key via nanoid
- `chatAbort(sessionKey)` -- abort an in-progress response
- `chatHistory(sessionKey)` -- retrieve full conversation history as `ChatHistoryEntry[]`
- `chatInject(params: InjectParams)` -- inject a system or user message without triggering a response

**Agents:**

- `agentsList()` -- list all configured agents
- `agentsCreate(agent)` -- create a new agent definition
- `agentsUpdate(id, updates)` -- partial update an agent
- `agentsDelete(id)` -- delete an agent
- `agentsFilesList(agentId)` -- list files attached to an agent
- `agentsFilesGet(agentId, filename)` -- read a specific agent file
- `agentsFilesSet(agentId, filename, content)` -- write/update an agent file

**Sessions:**

- `sessionsList()` -- list all active sessions
- `sessionsPatch(sessionKey, settings)` -- update session settings (model, thinking level, queue mode, etc.)
- `sessionsSpawn(params: SpawnSessionParams)` -- create a new session with a specific agent
- `sessionsPreview(sessionKey)` -- get a lightweight session summary
- `sessionsReset(sessionKey)` -- clear session conversation history
- `sessionsDelete(sessionKey)` -- destroy a session
- `sessionsCompact(sessionKey)` -- compact/summarize session history to reduce context

**Config:**

- `configGet()` -- read full gateway configuration
- `configSet(config)` -- replace full configuration
- `configPatch(partial)` -- merge partial updates into configuration
- `configSchema()` -- get the JSON Schema describing valid config properties
- `configApply()` -- apply pending configuration changes

**Models:**

- `modelsList()` -- enumerate available AI models

**Usage:**

- `usageStatus()` -- token counts and cost for current period
- `usageCost(opts?)` -- detailed cost breakdown by model with optional date range

**Exec Approvals:**

- `execApprovalsList()` -- list pending approval requests
- `execApprovalsResolve(id, decision)` -- approve/deny a specific request (`allow_once | always_allow | deny`)
- `execApprovalsOverrides()` -- get persistent approval overrides by pattern
- `execApprovalsSetOverride(pattern, decision)` -- set a persistent override

**Skills:**

- `skillsStatus()` -- installed skills and available count
- `skillsBins()` -- browse the skill registry
- `skillsInstall(skillId)` -- install a skill
- `skillsUpdate(skillId)` -- update an installed skill

**Cron:**

- `cronList()` -- list scheduled jobs
- `cronAdd(job)` -- create a scheduled job
- `cronUpdate(jobId, patch)` -- update a job
- `cronRemove(jobId)` -- delete a job
- `cronRun(jobId)` -- trigger an immediate run
- `cronRuns(jobId)` -- list run history for a job
- `cronStatus()` -- global cron enable/disable status

**Channels:**

- `channelsStatus()` -- list all messaging channels with connection state
- `channelsLogout(channelId)` -- disconnect a channel

**Logs:**

- `logsTail(opts?)` -- fetch recent log entries, filterable by level, line count, and session

**Other:**

- `health()` -- gateway health check (uptime, CPU, memory, active sessions)
- `send(sessionKey, payload)` -- raw frame send

### Reconnection

Uses `reconnecting-websocket` with exponential backoff:

- Min delay: 1s, max delay: 10s, growth factor: 1.5x
- Max retries: 10
- On reconnect, re-does the full handshake automatically
- All pending requests are rejected on disconnect with "Connection lost -- reconnecting"

### Singleton

```typescript
const client = getOpenClawClient({ url, token });
```

Auto-connects on first call if `OPENCLAW_GATEWAY_URL` env var is set.

---

## BrowserGatewayClient (`src/lib/browser-gateway-client.ts`)

Thin browser-only subset of `OpenClawClient`. Designed to run in React components via the same-origin WebSocket proxy.

### Key Differences from OpenClawClient

| Aspect             | OpenClawClient                      | BrowserGatewayClient                                 |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| Environment        | Node.js + Browser                   | Browser only                                         |
| Auth               | Sends token in connect params       | Omits auth -- proxy injects it                       |
| Challenge handling | Waits for `connect.challenge` event | Ignores `connect.challenge`, sends connect on `open` |
| WS library         | `ws` (Node) or native (browser)     | Native WebSocket only                                |
| RPC surface        | 37 methods                          | 4 methods                                            |
| Constructor args   | `connect(url, token)`               | `connect()` -- no args                               |

### Exposed Methods (4 only)

```typescript
chatSend(sessionKey, message, options?)
chatAbort(sessionKey)
chatHistory(sessionKey)
execApprovalsResolve(id, decision)
```

This is the minimum needed for the chat UI to function: send messages, cancel, load history, and respond to tool approval prompts.

### Connection Flow

```typescript
const client = new BrowserGatewayClient();
const hello = await client.connect(); // no args -- derives URL from window.location
```

1. Constructs WS URL from `window.location`: `ws(s)://<host>/api/gateway/ws`
2. On WebSocket `open`, immediately sends `connect` request (no challenge wait)
3. Proxy handles auth injection transparently
4. On reconnect, re-sends connect and rejects all pending requests

---

## GatewayProxy (`src/server/gateway-proxy.ts`)

Server-side WebSocket proxy. Runs inside the Next.js custom server. This is the security boundary.

### Flow

```
Browser ──ws──▶ /api/gateway/ws ──▶ GatewayProxy.handleUpgrade()
                                         │
                                    onConnection(client)
                                         │
                                    Waits for first message
                                         │
                                    ┌─────┴─────┐
                                    │ Must be a  │
                                    │ "connect"  │──No──▶ close(4000)
                                    │ request    │
                                    └─────┬─────┘
                                         │ Yes
                                    loadSettings()
                                         │
                                    ┌─────┴─────┐
                                    │ Has URL?   │──No──▶ close(4001)
                                    └─────┬─────┘
                                         │ Yes
                                    Inject auth.token
                                    Ensure operator.read/write scopes
                                         │
                                    Open upstream WS to gateway
                                         │
                                    Forward modified connect
                                         │
                                    Bidirectional forwarding
```

### Security Properties

1. **Token never reaches the browser.** The proxy calls `loadSettings()` to fetch the auth token from the SQLite DB, then injects it into the connect frame. The browser client sends `auth: undefined`.

2. **First-message validation.** If the first frame is not a `connect` request, the proxy closes with code 4000. No arbitrary frames reach the upstream before authentication.

3. **Scope enforcement.** The proxy ensures `operator.read` and `operator.write` are always in the scope set, regardless of what the browser requests.

4. **Connection isolation.** Each browser WebSocket gets its own upstream connection to the gateway. No connection sharing or multiplexing.

### Close Codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 4000 | First message was not a connect request, or was unparseable |
| 4001 | No gateway URL configured in the database                   |
| 4002 | Upstream connection error (gateway unreachable or errored)  |

### loadSettings Callback

The proxy is constructed with a `loadSettings` function that returns `{ url, token }`:

```typescript
const proxy = new GatewayProxy(async () => {
  const conn = await db
    .select()
    .from(openclawConnection)
    .where(eq(openclawConnection.id, "default"));
  return {
    url: `${conn.useTls ? "wss" : "ws"}://${conn.host}:${conn.port}/ws`,
    token: conn.authToken ?? "",
  };
});
```

This reads from the `openclaw_connection` SQLite table, which stores:

- `host` (default: `mac-mini.tailnet`)
- `port` (default: `18789`)
- `auth_token` (encrypted)
- `use_tls` (boolean)

---

## OpenClaw Types (`src/lib/openclaw-types.ts`)

35+ exported types covering the full OpenClaw protocol v3. Organized by domain.

### Wire Protocol

- `OpenClawRequest` -- outgoing `{ type: "req", id, method, params? }`
- `OpenClawResponse` -- incoming `{ type: "res", id, ok, payload?, error? }`
- `OpenClawEvent` -- incoming `{ type: "event", event, payload, seq }`
- `OpenClawFrame` -- union of Response | Event

### Auth

- `ConnectChallengeEvent` -- the `connect.challenge` event with nonce and timestamp
- `ConnectParams` -- connect request payload: protocol range, client info, role, scopes, device attestation, auth
- `HelloPayload` -- successful connect response: negotiated protocol, feature flags (available methods/events), auth info, policy

### Chat

- `ChatEventPayload` -- streaming event: runId, state (`delta | final | aborted | error`), message content, usage stats
- `ChatMessage` -- role + content blocks
- `ChatContentBlock` -- union: `ChatTextBlock | ChatThinkingBlock | ChatToolUseBlock | ChatToolResultBlock`
- `ChatHistoryEntry` -- completed turn with messages, usage, and timestamps

### Entities

- `OpenClawAgent` -- agent definition: id, name, emoji, model, workspace, description
- `OpenClawAgentFile` -- file attached to an agent: name + content
- `OpenClawSession` -- session state: key, agentId, model, thinking level, queue mode, reset policy, verbose level
- `SessionPreview` -- lightweight session summary
- `GatewayModel` -- model info: id, name, provider, maxTokens, capability flags
- `ChannelStatus` -- messaging channel: id, type, connected, policies, error

### Config

- `GatewayConfig` -- `Record<string, unknown>` (opaque)
- `ConfigSchema` -- JSON Schema for config validation

### Execution

- `ExecApprovalRequest` -- pending approval: id, sessionKey, agentId, command, args, cwd
- `ExecApprovalDecision` -- `"allow_once" | "always_allow" | "deny"`

### Scheduling

- `CronSchedule` -- discriminated union: `at` (one-shot datetime), `every` (interval), `cron` (expression)
- `CronPayload` -- discriminated union: `systemEvent` or `agentTurn`
- `CronDelivery` -- target channels
- `CronJob` -- full job definition
- `CronRunEntry` -- execution log entry

### Observability

- `HealthStatus` -- ok, version, uptime, activeSessions, cpu, memory, usage
- `UsageStatus` -- token counts and cost for a period
- `UsageCost` -- detailed per-model cost breakdown
- `LogEntry` -- timestamped log: level, message, source, session, agent
- `SkillsStatus`, `SkillInfo`, `SkillBin` -- skill registry types

### Connection

- `ConnectionState` -- `"disconnected" | "connecting" | "authenticating" | "connected" | "reconnecting"`
- `GatewayErrorCode` -- 8 error codes from `AUTH_FAILED` to `UNKNOWN`
- `GatewayConnectError` -- structured error with code, message, retryable flag, and optional hint
- `classifyConnectError(rawCode?, rawMessage?)` -- classifier function that maps raw error strings to structured `GatewayConnectError`

### Terminal (Future)

- `TerminalOpenParams`, `TerminalOpenResult`, `TerminalInputParams`, `TerminalResizeParams`, `TerminalCloseParams`, `TerminalOutputEvent` -- PTY types defined but not yet wired into the client

---

## Supporting Infrastructure

### OpenClawBridge (`src/server/openclaw-bridge.ts`)

Event bridge between the gateway and the local broadcast server. Routes OpenClaw events to WebSocket rooms for real-time UI updates.

- Maintains a `sessionKey -> threadId` map
- `onChatEvent(payload)` -- maps session key to thread ID, broadcasts `thread-update` to the room, broadcasts `thread-list-update` globally
- `onAgentEvent(event)` -- broadcasts `agent-update` to all clients
- `onExecApproval(approval)` -- broadcasts to the session's room, or globally if no mapping exists
- `onConnectionChange(status)` -- broadcasts `connection-status` to all clients
- `onChannelEvent(payload)` -- broadcasts `channel-update` to all clients
- `onTickEvent(payload)` -- broadcasts `tick` to all clients

### Bridge Registry (`src/server/bridge-registry.ts`)

Global singleton stored on `globalThis` to survive HMR reloads. Lets server actions access the bridge instance.

### LocalBroadcastServer (`src/server/broadcast.ts`)

Room-based WebSocket server replacing PartyKit for single-user local use. Clients connect via `ws://localhost:3100/ws?room={threadId}`. Supports room join/leave and broadcast to room or all clients.

### Server Actions (`src/server-actions/gateway.ts`)

Next.js server actions for one-shot gateway operations. Each action creates a fresh `OpenClawClient`, executes a single RPC call, disconnects, and returns the result.

- `getGatewayConfig()` -- reads gateway config
- `updateGatewayConfig(patch)` -- patches gateway config
- `getHealthStatus()` -- checks gateway health

Connection settings are read from the `openclaw_connection` table.

### React Hooks (`src/hooks/use-openclaw.ts`)

- `connectionStateAtom` -- Jotai atom tracking `ConnectionState`
- `gatewayHealthAtom` -- Jotai atom holding latest `HealthStatus`
- `openclawQueryKeys` -- React Query key factory for agents, sessions, config, health
- `useConnectionHealth()` -- polls `/api/openclaw-event` every 30s, updates the health atom
- `useConnectionState()` -- reads the connection state atom

### Database Schema (`src/db/schema.ts`)

The `openclaw_connection` table stores gateway connection settings:

```typescript
openclawConnection = sqliteTable("openclaw_connection", {
  id: text("id").primaryKey().default("default"),
  host: text("host").notNull().default("mac-mini.tailnet"),
  port: integer("port").notNull().default(18789),
  authToken: text("auth_token"),
  useTls: integer("use_tls", { mode: "boolean" }).notNull().default(false),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
  lastHealthCheck: text("last_health_check"),
  lastHealthStatus: text("last_health_status").default("unknown"),
});
```

---

## Current Limitations and Gaps

### Protocol Coverage

- **Terminal/PTY:** Types are defined (`TerminalOpenParams`, etc.) but no client methods exist. Gateway may support `terminal.open`, `terminal.input`, `terminal.resize`, `terminal.close` but the client does not expose them.
- **Memory RPC:** No memory-related methods despite the gateway likely supporting `memory.list`, `memory.get`, `memory.set`. The bridge routes events but the client cannot query memory directly.
- **Filesystem RPC:** No file browsing or editing methods for the gateway's working directory.

### Server Action Pattern

The `gateway.ts` server actions create a **new connection per call** -- connect, execute, disconnect. This adds ~1-2s of handshake overhead per action and does not reuse connections. A persistent connection pool or singleton would reduce latency.

### BrowserGatewayClient Surface

Only 4 methods are exposed to the browser. Agent management, session lifecycle, config, cron, skills, usage, and logs all require server-side calls. Expanding the browser client's surface would allow richer client-side UIs but must be balanced against the security boundary.

### Event Subscription

The `BrowserGatewayClient` handles chat and exec approval events but does not expose or handle:

- `channel.update` events
- `cron.run.started` / `cron.run.completed` events
- `agent.lifecycle` events
- `session.timeout` events

These events pass through the proxy but are not acted on by the browser client.

### Error Recovery

Both clients reject all pending requests on reconnect but do not replay them. A request queue with replay-on-reconnect would improve reliability for transient disconnects.

### Multi-User

The proxy assumes a single `"default"` connection row. Multi-user deployments would need per-user or per-session connection settings, which the current schema does not support.
