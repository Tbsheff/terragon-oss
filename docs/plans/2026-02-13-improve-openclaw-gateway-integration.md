# Improve OpenClaw Gateway Integration Implementation Plan

Created: 2026-02-13
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No

> **Status Lifecycle:** PENDING → COMPLETE → VERIFIED
> **Iterations:** Tracks implement→verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes` > **Worktree:** Set at plan creation (from dispatcher). `No` works directly on current branch

## Summary

**Goal:** Close the gaps between what the OpenClaw gateway exposes and what the dashboard actually uses — real dashboard stats, channel status visibility, proper session lifecycle (`sessions.spawn`, `chat.inject`), and richer session state.

**Architecture:** Extend `OpenClawClient` with missing RPC methods, enrich server actions to pull real data from the gateway, add new server actions + query hooks for channels and usage data, and wire gateway events into the bridge for real-time updates.

**Tech Stack:** TypeScript, Vitest, Next.js server actions, React Query, Jotai atoms, OpenClaw WebSocket RPC

## Scope

### In Scope

- Set up vitest test infrastructure in apps/openclaw
- Add missing RPC methods to `OpenClawClient`: `sessions.spawn`, `chat.inject`, `channels.status`
- Extend `HealthStatus` type with additional gateway status fields (version, uptime already there — add usage data)
- Enrich `OpenClawSession` type with queue mode, reset policies, verbose level (thinking + messageCount already exist)
- Fix `dashboard-stats.ts` to pull real usage/token/error data from gateway `health()` + session data
- Add channel status server action + React Query hook + types
- Use `sessions.spawn` in `createThread` with fallback to local-only on failure
- Add `chat.inject` server action for seeding system context
- Add channel event handler in bridge for real-time UI updates (if gateway emits them)
- Fix N+1 query in `listThreads` with batch metadata loading
- Standardize error handling in `openclaw-chat.ts` to use `ActionResult` pattern

### Out of Scope

- Cron/webhook automation management UI (gateway has it, but separate feature)
- Device token management (rotate/revoke)
- Agent memory (SQLite vector search) integration
- Multi-agent orchestration (nodes system)
- Changes to the main Terragon app (apps/www) — this is apps/openclaw only
- `sessions.history` — redundant with existing `chatHistory()` method; defer until a distinct use case arises

## Prerequisites

- OpenClaw gateway running and accessible via WebSocket
- Existing `apps/openclaw` custom server architecture with WS proxy + bridge

## Context for Implementer

> This section is critical for cross-session continuity.

- **Patterns to follow:** Server actions in `apps/openclaw/src/server-actions/` should follow `ActionResult<T>` pattern (see `agents.ts:12`). All return `{ ok: true, data } | { ok: false, error }`. NOTE: `openclaw-chat.ts` currently does NOT follow this pattern — fix as part of Task 5.
- **RPC client pattern:** `OpenClawClient` at `apps/openclaw/src/lib/openclaw-client.ts` wraps WebSocket RPC. Each method calls `this.sendRequest<T>(method, params)`. Methods unwrap `{ items: T[] }` response envelopes.
- **Client singleton:** ALL new server actions MUST use `getOpenClawClient()` singleton and the `getClient()` / `notConnected()` pattern from `agents.ts`. Do NOT follow the fresh-connection-per-call pattern in `gateway.ts` — that's an anti-pattern.
- **Event bridge:** `OpenClawBridge` at `apps/openclaw/src/server/openclaw-bridge.ts` receives events from `OpenClawClient.on()` and broadcasts to UI via `LocalBroadcastServer`. `broadcastAll()` sends to ALL connected WebSocket clients (not room-specific). `useRealtimeGlobal()` subscribes to room `__global__` but `broadcastAll` iterates `wss.clients` directly, so global events ARE received.
- **Query hooks:** Define query keys in `apps/openclaw/src/hooks/use-openclaw.ts` (or domain-specific files like `queries/thread-queries.ts`). Use `queryOptions()` from TanStack Query.
- **Types:** OpenClaw wire types in `apps/openclaw/src/lib/openclaw-types.ts`. Add new types here. NOTE: `OpenClawSession` already has `thinking` and `messageCount` fields — do not re-add.
- **Session metadata:** Local session metadata stored in SQLite `kv_store` table via `threads.ts`. Gateway sessions don't store our metadata (name, archived, github info). Current key format: `session-meta:{sessionKey}`.
- **Existing HealthStatus:** Already includes `version`, `uptime`, `activeSessions`, `cpu`, `memory`, `channels` fields. Don't create a separate `GatewayStatus` type — extend `HealthStatus` if needed.
- **Key files to read first:**
  - `src/lib/openclaw-client.ts` — WS RPC client (all gateway communication)
  - `src/lib/openclaw-types.ts` — Wire types (check existing fields before adding)
  - `src/server/openclaw-bridge.ts` — Event forwarding
  - `src/server/custom-server.ts` — Wiring it all together
  - `src/server-actions/threads.ts` — Thread CRUD (uses sessions.list + kvStore)
  - `src/server-actions/dashboard-stats.ts` — Dashboard stats (mostly zeros)
  - `src/server-actions/agents.ts` — Reference for ActionResult + getClient pattern

## Runtime Environment

- **Start command:** `node dist/server/custom-server.js` (dev: `pnpm -C apps/openclaw dev`)
- **Port:** 3100
- **Health check:** Browser health polling via `useConnection` hook → `testConnection` server action
- **WebSocket endpoints:** `/ws` (broadcast), `/api/gateway/ws` (gateway proxy)

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Set up vitest in apps/openclaw
- [x] Task 2: Extend OpenClawClient with missing RPC methods
- [x] Task 3: Enrich session lifecycle (sessions.spawn + richer types)
- [x] Task 4: Add channel status support
- [x] Task 5: Fix dashboard stats with real gateway data
- [x] Task 6: Add chat.inject + standardize openclaw-chat error handling
- [x] Task 7: Wire new events into bridge + realtime hooks

**Total Tasks:** 7 | **Completed:** 7 | **Remaining:** 0

## Implementation Tasks

### Task 1: Set up vitest in apps/openclaw

**Objective:** Add vitest test infrastructure so all subsequent tasks can write and run tests.

**Dependencies:** None

**Files:**

- Modify: `apps/openclaw/package.json` (add vitest devDependency + test script)
- Create: `apps/openclaw/vitest.config.ts`
- Create: `apps/openclaw/src/lib/__tests__/smoke.test.ts` (minimal smoke test)

**Key Decisions / Notes:**

- Install `vitest` as devDependency
- Create `vitest.config.ts` with path aliases matching `tsconfig.json` (@ → ./src/\*)
- Add `"test": "vitest run"` script to package.json
- Write one smoke test to verify the setup works
- Follow vitest config pattern from `apps/www/vitest.config.ts` or `packages/shared/vitest.config.ts` if they exist

**Definition of Done:**

- [ ] `pnpm -C apps/openclaw test` runs and passes
- [ ] Path aliases (@/) resolve correctly in tests
- [ ] No diagnostics errors

**Verify:**

- `pnpm -C apps/openclaw test`

---

### Task 2: Extend OpenClawClient with missing RPC methods

**Objective:** Add `sessions.spawn`, `chat.inject`, and `channels.status` methods to `OpenClawClient`. Extend `HealthStatus` if the gateway provides richer status data.

**Dependencies:** Task 1

**Files:**

- Modify: `apps/openclaw/src/lib/openclaw-types.ts`
- Modify: `apps/openclaw/src/lib/openclaw-client.ts`
- Create: `apps/openclaw/src/lib/__tests__/openclaw-client.test.ts`

**Key Decisions / Notes:**

- Do NOT add a separate `gatewayStatus()` method — the existing `health()` method and `HealthStatus` type already include version, uptime, activeSessions, cpu, memory, channels. Extend `HealthStatus` with a `usage?: { inputTokens; outputTokens; totalCost }` field if the gateway's health response includes it.
- `sessions.spawn` creates a new gateway session. Add `SpawnSessionParams` type: `{ agentId: string; model?: string; sessionKey?: string; systemPrompt?: string }`. The `sessionKey` param lets us pass our preferred key to the gateway (preserving backward compat).
- `chat.inject` sends a system/context message into a session without triggering agent response. Add `InjectParams` type: `{ sessionKey: string; content: string; role?: "system" | "user" }`.
- `channels.status` returns status of all configured channels. Add `ChannelStatus` type.
- Follow existing unwrap pattern: `.then(res => res.items ?? res)`
- **Discovery note:** If a method doesn't exist on the gateway (RPC returns unknown method error), the client should handle gracefully. The `HelloPayload.features.methods` field from the connect handshake lists available methods — check this if possible.

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `sessionsSpawn()` method exists with `SpawnSessionParams` input
- [ ] `chatInject()` method exists with `InjectParams`
- [ ] `channelsStatus()` method exists returning `ChannelStatus[]`
- [ ] `HealthStatus` extended with usage field (if applicable)
- [ ] Types defined: `SpawnSessionParams`, `InjectParams`, `ChannelStatus`

**Verify:**

- `pnpm -C apps/openclaw test -- src/lib/__tests__/openclaw-client.test.ts`

---

### Task 3: Enrich session lifecycle (sessions.spawn + richer types)

**Objective:** Enrich `OpenClawSession` with new gateway-provided fields. Use `sessions.spawn` in `createThread` with fallback to local-only on failure.

**Dependencies:** Task 2

**Files:**

- Modify: `apps/openclaw/src/lib/openclaw-types.ts` (extend `OpenClawSession` — only NEW fields)
- Modify: `apps/openclaw/src/server-actions/threads.ts`
- Create: `apps/openclaw/src/server-actions/__tests__/threads.test.ts`

**Key Decisions / Notes:**

- `OpenClawSession` already has `thinking` and `messageCount` — do NOT re-add. Only add genuinely new fields: `queueMode?: "sequential"|"concurrent"|"collect"`, `resetPolicy?: { type: "idle"|"daily"|"off"; value?: number }`, `verboseLevel?: number`
- **createThread migration strategy:** Call `sessions.spawn` with our locally-generated session key as a param (`sessionKey: session-{nanoid}`). If the gateway supports passing a key, it uses ours (backward compat). If not, use the gateway-returned key and store a mapping. If `sessions.spawn` fails (network error, gateway down), fall back to local-only creation (current behavior) so thread creation always succeeds.
- Update `sessionToThreadListItem` status mapping to be richer: use `messageCount` from gateway, derive status from `lastMessageAt` recency (within 60s → "working", older → "working-done", no messages → "draft")
- **Fix N+1 query:** Batch-load all session metadata in a single DB query (`SELECT * FROM kv_store WHERE key LIKE 'session-meta:%'`) then join in-memory with gateway sessions, instead of calling `getSessionMeta()` per session.
- Use `getClient()` / `notConnected()` pattern from `agents.ts`

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `OpenClawSession` includes queueMode, resetPolicy, verboseLevel (NOT re-adding thinking/messageCount)
- [ ] `createThread` calls `sessions.spawn` with fallback to local-only on failure
- [ ] Thread status mapping uses messageCount and lastMessageAt for richer states
- [ ] `listThreads` uses batch metadata loading (no N+1)

**Verify:**

- `pnpm -C apps/openclaw test -- src/server-actions/__tests__/threads.test.ts`

---

### Task 4: Add channel status support

**Objective:** Add server action and types for fetching channel statuses from the gateway, plus a React Query hook.

**Dependencies:** Task 2

**Files:**

- Create: `apps/openclaw/src/server-actions/channels.ts`
- Create: `apps/openclaw/src/queries/channel-queries.ts`
- Create: `apps/openclaw/src/server-actions/__tests__/channels.test.ts`

**Key Decisions / Notes:**

- `ChannelStatus` type (defined in Task 2): `{ id: string; type: string; connected: boolean; accountId?: string; dmPolicy?: string; groupPolicy?: string; lastActivity?: string; error?: string }`
- Server action `listChannels()` calls `client.channelsStatus()` and returns `ActionResult<ChannelStatus[]>`
- Use `getClient()` / `notConnected()` pattern from `agents.ts`
- Query hook follows pattern in `queries/thread-queries.ts` with `queryOptions`
- Query key: `["channels", "status"]`, refetch every 30s
- Channel types are left as `string` (not union) since gateway may support channels not in our list

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `listChannels()` server action returns channel statuses from gateway
- [ ] `channelStatusQueryOptions()` React Query hook defined with 30s refetch
- [ ] Query key factory `channelQueryKeys` defined

**Verify:**

- `pnpm -C apps/openclaw test -- src/server-actions/__tests__/channels.test.ts`

---

### Task 5: Fix dashboard stats with real gateway data

**Objective:** Replace hardcoded zeros in `getDashboardStats()` with real data from gateway health + session list.

**Dependencies:** Task 2

**Files:**

- Modify: `apps/openclaw/src/server-actions/dashboard-stats.ts`
- Create: `apps/openclaw/src/server-actions/__tests__/dashboard-stats.test.ts`

**Key Decisions / Notes:**

- Use the existing `client.health()` method (NOT a separate gatewayStatus) for CPU, memory, uptime, version, activeSessions
- Call `client.sessionsList()` directly (once) instead of going through `listThreads()` to avoid the double RPC call + N+1 metadata queries
- Use `Promise.all([client.health(), client.sessionsList()])` for parallel fetching
- Derive `completedTodayCount` by filtering sessions where `lastMessageAt` is within today (UTC)
- Derive `errorCount` by counting sessions with error indicators
- For `tokenUsageSummary`: use health response usage data if available, else aggregate from sessions
- `queuedCount`: count sessions in queued/pending state if distinguishable
- Extend `DashboardStats.gatewayHealth` type to include `version` and `uptime` fields
- Handle gateway unavailable gracefully (keep zero fallback)

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `completedTodayCount` reflects sessions completed today (not hardcoded 0)
- [ ] `errorCount` reflects sessions with errors (not hardcoded 0)
- [ ] `gatewayHealth` includes version and uptime fields
- [ ] Uses `Promise.all` for parallel health + sessions fetch
- [ ] Graceful fallback to zeros when gateway is disconnected

**Verify:**

- `pnpm -C apps/openclaw test -- src/server-actions/__tests__/dashboard-stats.test.ts`

---

### Task 6: Add chat.inject + standardize openclaw-chat error handling

**Objective:** Add `injectChatContext` server action and migrate existing `openclaw-chat.ts` functions to use `ActionResult` pattern.

**Dependencies:** Task 2

**Files:**

- Modify: `apps/openclaw/src/server-actions/openclaw-chat.ts`
- Create: `apps/openclaw/src/server-actions/__tests__/openclaw-chat.test.ts`

**Key Decisions / Notes:**

- Add `injectChatContext(threadId: string, content: string, role?: "system" | "user")` server action
- Calls `client.chatInject(sessionKey, { content, role })`
- Migrate ALL existing functions (`sendChatMessage`, `abortChat`, `loadChatHistory`) to use `ActionResult` pattern with try/catch + `getClient()` / `notConnected()` guards. Current functions throw on error and have inconsistent return shapes.
- Return `ActionResult<void>` for inject and abort, `ActionResult<{ history }>` for loadChatHistory
- Follow `agents.ts` error handling pattern

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `injectChatContext()` server action calls `chat.inject` on gateway
- [ ] All functions in openclaw-chat.ts use ActionResult pattern
- [ ] All functions use getClient()/notConnected() guard
- [ ] Error handling returns structured result (never throws)

**Verify:**

- `pnpm -C apps/openclaw test -- src/server-actions/__tests__/openclaw-chat.test.ts`

---

### Task 7: Wire new events into bridge + realtime hooks

**Objective:** Forward channel status changes from the gateway through the bridge to the UI. Add defensive event wiring that handles missing events gracefully.

**Dependencies:** Task 2, Task 4

**Files:**

- Modify: `apps/openclaw/src/server/openclaw-bridge.ts`
- Modify: `apps/openclaw/src/server/custom-server.ts`
- Modify: `apps/openclaw/src/hooks/use-realtime.ts`
- Create: `apps/openclaw/src/server/__tests__/openclaw-bridge.test.ts`

**Key Decisions / Notes:**

- Add `onChannelEvent(payload)` to `OpenClawBridge` — broadcasts `{ type: "channel-update", data: payload }` to all clients via `broadcastAll()`
- Wire `client.on("channels", ...)` in `custom-server.ts` to `bridge.onChannelEvent()` — this is speculative (gateway may not emit channel events). If the event never fires, channel updates rely on the 30s polling from Task 4's query hook.
- In `useRealtimeGlobal()`, handle `"channel-update"` by invalidating `["channels", "status"]` query
- Wire `client.on("tick", ...)` for periodic state refresh — invalidate dashboard stats on tick
- `broadcastAll()` sends to all `wss.clients` directly — confirmed to be received by `useRealtimeGlobal()` which subscribes to `__global__` room (the room subscription is for broadcast filtering, but broadcastAll bypasses room filtering)
- Add `OpenClawBroadcastMessage` types for new event shapes

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `OpenClawBridge` has `onChannelEvent()` method
- [ ] `custom-server.ts` wires channel + tick events to bridge
- [ ] `useRealtimeGlobal()` handles `channel-update` and `tick` event types
- [ ] Channel status query invalidated on channel-update events

**Verify:**

- `pnpm -C apps/openclaw test -- src/server/__tests__/openclaw-bridge.test.ts`

## Testing Strategy

- **Unit tests:** Mock `OpenClawClient` WebSocket to test RPC method wrappers, server action logic, bridge event routing. Mock `db` for KV metadata queries.
- **Integration tests:** Test full flow from server action → client → mock gateway response
- **Manual verification:** Connect to running gateway, verify dashboard shows real stats, channel status appears, `createThread` creates gateway session, `chat.inject` seeds context

## Risks and Mitigations

| Risk                                            | Likelihood | Impact | Mitigation                                                                                                                                                    |
| ----------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway RPC methods don't match expected names  | Medium     | Medium | Handle "unknown method" errors gracefully; fall back to existing methods. Check `HelloPayload.features.methods` at connect time.                              |
| `sessions.spawn` doesn't accept our session key | Medium     | High   | If key param isn't accepted, use gateway-returned key and store a local mapping `session-meta:{gatewayKey}`. Fall back to local-only if spawn fails entirely. |
| Gateway doesn't emit channel events             | Medium     | Low    | Channel status updates fall back to 30s polling via React Query refetchInterval. Event wiring is additive, not required.                                      |
| Gateway unavailable degrades dashboard          | Medium     | Medium | All stats fall back to zeros when gateway is disconnected; show "disconnected" state clearly.                                                                 |
| N+1 batch fix changes listThreads behavior      | Low        | Medium | Test both empty and populated kv_store scenarios. Ensure LIKE query correctly matches `session-meta:%` prefix.                                                |

## Open Questions

- Whether `sessions.spawn` accepts a `sessionKey` parameter for us to pass our preferred key (backward compat strategy depends on this)
- Exact fields in the gateway `health` response beyond what `HealthStatus` already defines (usage data?)
- Whether the gateway emits `channels` events or requires polling only

### Deferred Ideas

- Channel management UI (login/logout, pair new channels)
- Cron job management from dashboard
- Agent memory search/browse UI
- Multi-node orchestration visibility
- `sessions.history` consumer (currently no distinct use case vs `chatHistory`)
