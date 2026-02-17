# Extracted Learnings

Consolidated learnings from deep research into OpenClaw gateway protocol, community dashboards, and Terragon's existing integration.

---

## Gateway & Protocol

- **JSON-only WebSocket** — 3 frame types (`req`/`res`/`event`), no binary support
- **3-step handshake**: `connect.challenge` → `connect` → `hello-ok`; all non-connect RPCs gated until handshake completes
- **Reconnection strategy**: exponential backoff (1s initial → 1.5x growth → 10s max, 10 max retries), then terminal `disconnected` state
- **Non-retryable errors** (`AUTH_FAILED`, `AUTH_TOKEN_MISSING`, `PROTOCOL_MISMATCH`) require user intervention — UI must distinguish from retryable errors
- **Retryable errors** (`GATEWAY_UNREACHABLE`, `GATEWAY_TIMEOUT`, `RATE_LIMITED`, `INTERNAL_ERROR`) trigger auto-reconnect
- **30s hard timeout** on all RPC requests — no long-poll patterns possible; loading states must complete or error within 30s
- **Event `seq` numbers** are monotonically increasing — use to detect missed events after reconnect
- **`ok: boolean`** on responses — always check before accessing `payload` or `error`
- **`deviceToken`** returned after auth should be stored and reused for subsequent reconnections
- **Request IDs** must be unique per request (nanoid recommended)

### Chat Streaming

- Events carry `runId` + `sessionKey` + `seq` for ordering
- State machine: `delta` (accumulate) → `final` (done with usage) | `aborted` (cancelled) | `error`
- Tool call/result linked by `tool_use_id` — UI must correlate across content blocks
- `ChatHistoryEntry.completedAt` absent = still running — use as in-flight indicator

### Connection States

```
disconnected → connecting → authenticating → connected ↔ reconnecting
```

- On reconnect: pending requests are rejected (not replayed)
- After max retries: transitions to `disconnected`, emits `connect-error` with `GATEWAY_UNREACHABLE`

---

## RPC Methods & Capabilities

### Critical Methods for Dashboard

| Method                                           | Why Critical                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `health`                                         | Single call for uptime, session count, CPU/mem, cost — status bar     |
| `sessions.list` + `sessions.preview`             | Core fleet view; preview is lightweight for polling                   |
| `chat.send` / `chat.abort`                       | Primary interaction surface                                           |
| `exec.approvals.list` + `exec.approvals.resolve` | Unresolved requests default to **deny** — missing these blocks agents |
| `usage.status` / `usage.cost`                    | Token + cost dashboard widgets                                        |
| `agents.list`                                    | Prerequisite for session spawn and fleet view                         |
| `logs.tail`                                      | Filterable debug panel                                                |
| `cron.list` / `cron.runs`                        | Scheduler visibility                                                  |

### High-Value Unique Features

- **`chat.inject`** — inject system context without triggering agent response; enables programmatic context seeding from UI
- **`exec.approvals.overrides.set`** — persistent glob-pattern allow/deny rules; a management UI is high-value
- **`sessions.spawn`** with custom `systemPrompt` — create sub-agents on demand from dashboard
- **`sessions.compact`** — explicit context compression; useful as manual action in session detail view
- **Cron `sessionTarget: "isolated"`** — fresh session per run vs. shared main session; critical UX distinction
- **`config.schema` + `config.patch` + `config.apply`** — hot-reload config UI without gateway restart
- **5,700+ skills registry** (`skills.bins` / `skills.install`) — marketplace-style UI viable

### What's Missing from the Gateway

- No `sessions.list` filtering or pagination — must fetch all and filter client-side
- No `chat.history` streaming — history is a bulk fetch, not incremental
- No terminal/PTY RPC — blocked entirely
- No multi-gateway support — can't build cross-node fleet view without external tooling
- No per-user access control — any operator with token has full access
- No push events for session/agent state changes — only `chat` and `exec.approval.requested` are real-time; polling required for session list, cron status, health
- No request replay on reconnect — transient disconnects drop in-flight calls

---

## Authentication & Sessions

### Auth Architecture

- **Layered**: token-based + optional public-key device signatures + tool access profiles + exec approval system
- **Token source**: `OPENCLAW_AUTH_TOKEN` env var as fallback when DB has no stored token
- **WS auth**: token injected in first `connect` frame (`params.auth.token`); HTTP uses `Authorization: Bearer`
- **Pairing codes** expire in 5 minutes; successful pairing rotates to long-lived device token
- **Scope system**: `operator.read/write/admin/approvals/pairing`; GatewayProxy enforces read+write minimum

### GatewayProxy Pattern (Critical Security Boundary)

- Browser connects to `/api/gateway/ws` same-origin — **no token exposure in browser**
- Proxy intercepts only the **first frame** (must be `connect`), injects `params.auth.token` from DB, forces required scopes
- All subsequent frames pass through transparently bidirectionally
- Custom close codes: `4000` (invalid first frame), `4001` (no gateway config), `4002` (upstream error)
- 1:1 upstream socket per browser client — no multiplexing

### Session Queue Modes

| Mode                   | Behavior                                      | Use Case                                             |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `sequential` (default) | One turn at a time; later messages block      | Stateful conversations                               |
| `concurrent`           | All messages start immediately in parallel    | Independent parallel tasks; race conditions possible |
| `collect`              | Buffers burst messages into single batch turn | High-volume channels (Discord, Slack)                |

### Session Reset Policies

| Policy  | Behavior                 | Gotcha                                                        |
| ------- | ------------------------ | ------------------------------------------------------------- |
| `idle`  | Resets after inactivity  | Value is in **milliseconds**, not seconds                     |
| `daily` | Resets at midnight       | Uses **gateway's local timezone**, not user's                 |
| `off`   | Accumulates indefinitely | Must manually `compact` or history/token costs grow unbounded |

### Key Gotchas

- **`maxConcurrentTasks`** (default 5) caps simultaneous session processing gateway-wide, independent of per-session queue mode
- **`sessions.reset`** clears history but preserves config (agent, model, queue mode)
- **`sessions.compact`** summarizes old messages to control token growth without losing context
- **`auth.scopes`** in hello response may be a subset of what was requested — always check granted scopes

---

## Community Dashboard Analysis

### Ecosystem Gaps

- **No community project covers the full protocol** — all skip at least one of: cron, exec approvals, skills, channels, usage tracking
- **Auth is nearly absent** — only 1 of 13 projects has MFA; most assume trusted local network
- **Cost tracking underserved** — only 3 projects track it despite being standard gateway methods
- **Real-time is inconsistent** — mixing polling vs WebSocket; none implement full `connect.challenge` handshake with proper reconnect
- **Proxy pattern is unique to Terragon** — all others expose tokens client-side or run fully server-side

### What Patterns Work

- Chat-centric UI with collapsible tool result blocks
- Health/status cards in dashboard view
- Agent list with CRUD operations
- Session management with reset/delete controls

### Universal Missing Features

- No parallel agent execution across any dashboard
- No remote sandbox isolation
- No persistent audit log across sessions
- No multi-gateway federation
- No team/multi-user support

---

## Terragon's Existing Integration

### What Already Exists (Don't Rebuild)

- **`OpenClawClient`** — 37 RPC methods, singleton pattern, exponential backoff reconnect
- **`BrowserGatewayClient`** — thin browser-only client (4 methods: `chat.send`, `chat.abort`, `chat.history`, `exec.approvals.resolve`)
- **`GatewayProxy`** — server-side auth injection, scope enforcement, close code semantics
- **`OpenClawBridge`** — Node EventEmitter routing gateway events to PartyKit-style rooms
- **35+ typed protocol types** covering full OpenClaw v3 wire format
- **React hooks + Jotai atoms** — `connectionStateAtom`, `gatewayHealthAtom`, `openclawQueryKeys`
- **`classifyConnectError()`** — structured error classification reusable across components

### Terragon's Own Gaps

| Gap                                                          | Impact                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| Server actions create new WS per call (~1-2s overhead)       | No connection pooling                               |
| `BrowserGatewayClient` only exposes 4/37 methods             | Agent mgmt, cron, skills require server round-trips |
| Browser client ignores channel, cron, agent lifecycle events | Events pass through proxy but aren't consumed       |
| No request replay on reconnect                               | Transient disconnects drop in-flight calls          |
| Single-user only                                             | Proxy hardcodes `"default"` connection row          |
| Terminal/PTY types defined but no client methods             | Blocked entirely                                    |
| Memory and filesystem RPC missing from client                | Not wired                                           |

---

## Type System & State Management Implications

### Data Categories

| Category         | Real-time?      | Cacheable?       | State Management                          |
| ---------------- | --------------- | ---------------- | ----------------------------------------- |
| Chat events      | Yes (streaming) | No               | Append-only stream store keyed by `runId` |
| Exec approvals   | Yes (events)    | No               | Priority queue / modal interrupt          |
| Connection state | Yes             | No               | Global Jotai atom (singleton)             |
| Sessions         | Semi (poll)     | Yes (short TTL)  | React Query with invalidation             |
| Agents           | Mostly static   | Yes (long TTL)   | React Query                               |
| Models           | Static          | Yes              | React Query (fetch once)                  |
| Config           | Static          | Yes              | React Query (fetch once)                  |
| Cron jobs        | Low-frequency   | Yes (medium TTL) | React Query with polling                  |
| Channel status   | Periodic        | Yes (short TTL)  | React Query with polling                  |

### Key Type Shapes

- **`ChatMessage.content`** is `ChatContentBlock[]` — union of `text | thinking | tool_use | tool_result`
- **`OpenClawSession`** has `queueMode` and `resetPolicy` — affect UI behavior significantly
- **`SessionPreview`** is lightweight list shape; full `OpenClawSession` for detail — two fetch contexts needed
- **`ExecApprovalRequest`** requires immediate user action — `always_allow` creates persistent state change
- **`GatewayConfig`** is `Record<string, unknown>` — opaque, schema-driven via `ConfigSchema`
- **`CronJob`** has computed `nextRunAt` — display only, no client-side calculation needed
