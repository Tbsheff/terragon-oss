# Implementation Plans

Strategic and technical plans for building the OpenClaw dashboard on Terragon's infrastructure.

---

## 1. MVP Architecture

### Key Insight: Not Greenfield

`apps/openclaw/` already has ~70% of the MVP built: DB schema, server actions, queries, chat UI, gateway proxy, parallel views, dashboard stats, file browser, terminal components. **The MVP is wiring existing pieces together.**

### Folder Structure (Additions Only)

```
apps/openclaw/src/
├── app/(dashboard)/
│   ├── layout.tsx              ← exists; add gateway status indicator
│   ├── (chat)/
│   │   ├── page.tsx            ← new-thread home (exists)
│   │   └── task/[id]/          ← thread detail (exists)
│   ├── parallel/page.tsx       ← multi-pane view (exists)
│   ├── board/page.tsx          ← kanban (exists)
│   ├── agents/                 ← agent CRUD (exists)
│   ├── automations/            ← cron/triggers (exists)
│   └── settings/               ← gateway/credentials/github (exists)
├── components/
│   ├── gateway-provider.tsx    ← exists
│   ├── notification-provider.tsx ← exists
│   └── dashboard/              ← quick-stats, active-agents, feeds (exist)
├── server/
│   ├── gateway-proxy.ts        ← exists; WS auth injection
│   ├── openclaw-bridge.ts      ← exists; event broadcasting
│   └── broadcast.ts            ← exists
└── hooks/
    ├── use-gateway-client.ts   ← exists; singleton WS lifecycle
    └── use-realtime.ts         ← exists; bridge event subscription
```

### Data Flow

```
Gateway :18789 (WS)
    ↓
/api/gateway/ws (GatewayProxy — intercepts connect, injects auth)
    ↓ bidirectional frames
BrowserGatewayClient (singleton in browser)
    ↓ chat/agent events
useRealtime hook → React Query invalidation / Jotai atoms
    ↓
UI components (re-render on state change)

Server actions → OpenClawClient RPC (Node-side, for mutations)
    ↓ result
React Query refetch / optimistic update
```

### Database (Already Defined)

```
settings          — gateway URL, auth token, default model/agent
credentials       — encrypted API keys
environment       — per-repo env vars, MCP config
threads           — metadata overlay on gateway sessions (title, repo, branch)
kvStore           — generic key-value (session meta, pipeline state)
cronJobs          — scheduled task definitions
channels          — Discord/Slack channel bindings
execApprovals     — pending approval requests cache
```

Gateway is source of truth for sessions; local DB stores UI-only metadata.

### MVP Build Order

1. **Gateway connection** — verify `custom-server.ts` registers WS upgrade for `/api/gateway/ws`; settings page for host/port/token
2. **Thread list + chat** — wire existing `(chat)/page.tsx` and `task/[id]/page.tsx` to real gateway sessions
3. **Real-time invalidation** — ensure `use-realtime.ts` bridge events trigger `queryClient.invalidateQueries`
4. **Exec approvals** — surface `exec.approval.requested` events in UI; wire resolve server action
5. **Agents page** — connect existing CRUD components to gateway RPC
6. **Settings** — gateway URL/token, default agent/model (exists)

**Defer**: parallel view, board, automations/cron, file browser, pipeline, resource cost charts

---

## 2. UI Component Hierarchy

### Component Tree

```
GatewayProvider (context: BrowserGatewayClient + ConnectionState)
  NotificationProvider
    AppSidebar
      NavRail (Dashboard, Chat, Agents, Sessions, Cron, Settings)
      ThreadListSidebar
    <Outlet>
      DashboardPage
        QuickStatsRow              [EXISTS]
        ActiveAgentsPanel          [EXISTS]
        RecentActivityFeed         [EXISTS]
        ErrorFeed                  [EXISTS]
        NewTaskCard                [EXISTS]

      ChatPage / task/[id]
        OpenClawChatHeader         [EXISTS]
        OpenClawChatUI             [EXISTS]
          ChatMessages             [EXISTS]
          ExecApprovalCard         [EXISTS]
          TerminalPanel            [EXISTS]
        OpenClawPromptbox          [EXISTS]

      AgentsPage
        AgentManager               [EXISTS]
        AgentDetailView            [EXISTS]
        AgentRosterSetup           [EXISTS]

      SessionsPage                 [NEW]
        SessionsTable              [NEW]
        SessionDetailSheet         [NEW]

      SettingsPage
        ConnectionSettings         [EXISTS]
        GatewayConfigEditor        [NEW]
        ChannelsPanel              [NEW]
        SkillsPanel                [NEW]

      ResourcePage
        ResourceDashboard          [EXISTS]
        CostChart                  [EXISTS]

      CronPage
        (cron/* components)        [EXISTS]

      ParallelView
        ParallelGrid               [EXISTS]
        ParallelPane               [EXISTS]
```

### New Components Needed

| Component             | Purpose                                                     | Data Source                                          |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `SessionsTable`       | List all sessions with status, message count, last activity | `sessions.list` RPC                                  |
| `SessionDetailSheet`  | Patch model, compact, reset, delete a session               | `sessions.*` RPC                                     |
| `GatewayConfigEditor` | JSON/form view of gateway config with hot-reload            | `config.get` / `config.patch` / `config.apply`       |
| `ChannelsPanel`       | Channel connection status and logout controls               | `channels.status` / `channels.logout`                |
| `SkillsPanel`         | Skills browser with install/update from ClawHub             | `skills.status` / `skills.install` / `skills.update` |

### State Management

**Jotai atoms (global, persistent across navigations):**

```ts
connectionStateAtom: ConnectionState          // EXISTS
gatewayHealthAtom: HealthStatus | null        // EXISTS
execApprovalsAtom: ExecApprovalRequest[]      // NEW — pending approvals badge
activeSessionKeyAtom: string | null           // NEW — currently focused session
```

**React Query (server-fetched, cached):**

```ts
["agents"]          → listAgents()
["sessions"]        → sessionsList()
["config"]          → configGet()
["health"]          → getHealthStatus()       // polled 30s, EXISTS
["usage", period]   → usageStatus() / usageCost()
["cron"]            → cronList()
["channels"]        → channelsStatus()
["skills"]          → skillsStatus()
["threads", filter] → threadListQueryOptions  // EXISTS
```

### Real-time Update Strategy

```
LocalBroadcastServer (:3100) ← OpenClawBridge ← OpenClawClient ← Gateway events
       |
   useRealtimeGlobal() / useRealtime(threadId)
       |
   invalidateQueries(["threads"])   on thread-update
   invalidateQueries(["agents"])    on agent-update
   setAtom(execApprovalsAtom)       on exec-approval event
   setAtom(connectionStateAtom)     on connection-status event
```

Chat streaming handled directly by `BrowserGatewayClient` via `ChatEventPayload` — no React Query for in-flight messages.

---

## 3. WebSocket & Streaming

### Connection Management

Two client tiers, one protocol:

- **`OpenClawClient`** — Node/server-side, connects directly to gateway with `ws://` URL + token
- **`BrowserGatewayClient`** — Browser-side, connects to same-origin proxy `/api/gateway/ws`; auth omitted

State machine (already implemented): `disconnected` → `connecting` → `authenticating` → `connected` → `reconnecting` → `disconnected`

Handshake gate: all non-`connect` RPCs block on `readyPromise`, opens after `hello-ok`.

### Chat Streaming Architecture

Per-runId accumulator pattern needed:

```ts
type RunBuffer = {
  runId: string;
  chunks: string[];
  done: boolean;
};

// Map<runId, RunBuffer> in app state
// On delta: append to buffer, trigger incremental render
// On final: flush buffer, store complete message, update usage
// On aborted/error: clear buffer, show terminal state
```

Sequence gap detection: compare last-known `seq` against incoming events on reconnect — call `chat.history` to backfill if gap detected.

### Reconnection Handling

Config (do not change): 1s → 1.5x → 10s max, 10 retries.

On reconnect:

1. `rejectAllPending("Connection lost")` — fail in-flight RPCs immediately
2. Reset `readyPromise` gate
3. Re-send `connect` frame (proxy re-injects token)
4. After `hello-ok`: resume event subscription, backfill via `chat.history` for active `runId`

### Multi-Agent Message Routing

Routing key is `sessionKey` — every `chat` event carries it. Each session maps 1:1 to an agent.

Maintain `Map<sessionKey, RunBuffer>` in app state. `exec.approval.requested` events route to global approval queue.

### Proxy Bug: Challenge-Response Gap

**Current issue**: GatewayProxy opens upstream, waits for `open`, then immediately sends the intercepted connect frame. But the gateway sends `connect.challenge` first and expects challenge-driven flow.

**Recommended fix**: Proxy completes challenge-response with upstream gateway itself, then presents already-authenticated tunnel to browser. Browser sees clean `hello-ok` without needing to know about the challenge.

---

## 4. Multi-Agent Orchestration

### Core Mapping

| Primitive          | OpenClaw Mechanism                 | Terragon Mapping                |
| ------------------ | ---------------------------------- | ------------------------------- |
| Agent identity     | `agents.create` + `OpenClawAgent`  | 1 agent def per role            |
| Isolated workspace | `agentId.workspace` field          | Per-thread git branch / sandbox |
| Session            | `sessions.spawn` with `sessionKey` | 1 session per Terragon thread   |
| Parallelism        | `queueMode: "concurrent"`          | N threads run concurrently      |
| Gateway cap        | `maxConcurrentTasks` (default 5)   | User plan tier limit            |
| Sequencing         | `queueMode: "sequential"`          | Pipeline stages                 |
| Lifecycle          | `sessions.reset/delete/compact`    | Archive / cleanup               |

### Session Isolation

Each thread maps to one session:

```ts
sessionKey = "thread:<threadId>"     // e.g. "thread:abc123"
agentId    = <role>                  // "coder" | "reviewer" | "planner"
model      = <user preference>
queueMode  = "sequential"
resetPolicy = { type: "idle", value: 3_600_000 }  // 1hr auto-reset
```

Session keys namespaced so same gateway hosts sessions for multiple threads without collision. `sessions.spawn` called lazily on first `chat.send`.

### Parallel Execution (Terragon's Differentiator)

Multiple threads run **concurrently across sessions**, not within a single session:

```
Thread A → session "thread:A" (sequential) → sandbox-A → branch feature/A
Thread B → session "thread:B" (sequential) → sandbox-B → branch feature/B
Thread C → session "thread:C" (concurrent) → sandbox-C → multiple sub-tasks
```

Gateway-level concurrency capped via `maxConcurrentTasks`. Terragon enforces per-user limits upstream in XState machine before any gateway call.

### Sub-Agent Delegation

Planner spawns coder via `sessions.spawn` with derived key:

```ts
sessionKey = "thread:<threadId>:subtask:<subtaskId>";
systemPrompt = "<injected plan from parent session>";
```

### Task Queuing

| Level         | Mechanism                                            | Controls                 |
| ------------- | ---------------------------------------------------- | ------------------------ |
| Cross-thread  | XState states (`queued`, `queued-tasks-concurrency`) | Concurrency tier limit   |
| Within-thread | OpenClaw `queueMode: "sequential"`                   | In-order processing      |
| Follow-up     | Existing follow-up queue                             | Post-completion chaining |
| Scheduled     | OpenClaw `cron.add` with `sessionTarget: "isolated"` | Automations              |

### Agent Lifecycle

```
CREATE  → agents.create (once, idempotent by role name)
SPAWN   → sessions.spawn (per thread, lazy)
WORK    → chat.send → stream ChatEventPayload
COMPACT → sessions.compact (when messageCount > ~50)
ABORT   → chat.abort
ARCHIVE → sessions.delete (archived) OR sessions.reset (reused)
```

On sandbox hibernation: call `sessions.compact` first to preserve context, then let idle `resetPolicy` trigger.

### Gaps to Address

| Gap                                           | Fix                                                           |
| --------------------------------------------- | ------------------------------------------------------------- |
| Server actions create new WS per call         | Persistent `OpenClawClient` singleton with connection pooling |
| `BrowserGatewayClient` only exposes 4 methods | Add `sessionsSpawn`, `execApprovalsList` for richer UI        |
| Pipeline state lost on restart                | Persist XState snapshot to DB alongside thread row            |
| `maxConcurrentTasks` is gateway-global        | Enforce per-user limit in Terragon before reaching gateway    |

---

## 5. Strategic Roadmap

### Phase 1 — MVP (2 weeks)

**Goal**: Working dashboard users can immediately compare against community alternatives.

| Feature                 | Why First                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| Connection setup UI     | Gate to everything; host/port/token stored in `openclaw_connection` |
| Chat interface          | Primary interaction; 4 browser client methods already wired         |
| Health status card      | Uptime, CPU/mem, active sessions via single `health` RPC            |
| Session list + controls | Reset, delete, compact — core fleet management                      |
| Usage/cost panel        | `usage.status` + `usage.cost` — immediate value                     |
| Exec approvals inbox    | Events already bridged; unresolved = agent blocked                  |

All protocol client code exists. Zero new protocol work required.

### Phase 2 — Core (4 weeks)

**Goal**: Features that every community dashboard lacks simultaneously.

| Feature                  | Competitive Gap Closed                    |
| ------------------------ | ----------------------------------------- |
| Agent CRUD + file editor | SOUL.md, MEMORY.md editing inline         |
| Cron job manager         | Visual schedule builder + run history     |
| Channel status panel     | Slack/Discord/WhatsApp connect states     |
| Skills browser           | Install/update from 5,700+ skill registry |
| Log tail viewer          | Level/session filtering                   |
| Config editor            | Schema-validated form with hot-reload     |
| Exec approval overrides  | Pattern-based persistent rules manager    |

No community project covers cron + exec approvals + channels + skills simultaneously.

### Phase 3 — Moat (8 weeks)

**Goal**: Features structurally impossible for single-user local dashboards.

| Feature                       | Why Unique                                                           |
| ----------------------------- | -------------------------------------------------------------------- |
| **Parallel agent dispatch**   | N sessions simultaneously, compare outputs side-by-side              |
| **Remote sandbox execution**  | E2B/Daytona sandboxes as session targets, not user's machine         |
| **Pipeline orchestration UI** | Visual XState editor (brainstorm → plan → implement → review → test) |
| **Multi-gateway federation**  | Route tasks across multiple gateway connections                      |
| **Async task queue**          | Fire-and-forget with webhook/Slack delivery                          |
| **Persistent audit log**      | All approvals, config changes, pipeline transitions in Postgres      |

### Competitive Positioning

| Dimension         | Community Dashboards     | Terragon                            |
| ----------------- | ------------------------ | ----------------------------------- |
| Agent parallelism | Sequential only          | N parallel in isolated sandboxes    |
| Auth model        | Token in browser or none | Server-side proxy, never in browser |
| Infrastructure    | User's local machine     | Cloud sandboxes (E2B, Daytona)      |
| State persistence | Files or memory          | Postgres, multi-user capable        |
| Protocol coverage | Chat + agents (partial)  | All 37 RPC methods                  |

**The moat**: Terragon can run 10 OpenClaw agents in parallel on 10 separate remote sandboxes, compare results, and deliver the best one to Slack. No local dashboard can do this architecturally.

### Technical Risks

| Risk                                                              | Mitigation                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Gateway protocol instability** (pre-1.0)                        | Pin gateway version; version-gate schema; use `features.methods` from `HelloPayload` to degrade gracefully |
| **Single-gateway architecture** (hardcoded `"default"` row)       | Add `userId` + `connectionId` columns before user data accumulates                                         |
| **Server action connection overhead** (1-2s per call)             | Persistent singleton connection pool                                                                       |
| **Exec approval UX latency** (auto-deny on disconnect)            | Approval buffering with email/Slack fallback before 30s timeout                                            |
| **Sandbox-to-gateway networking** (E2B can't reach local gateway) | Require Tailscale/ngrok; later offer hosted gateway relay                                                  |
