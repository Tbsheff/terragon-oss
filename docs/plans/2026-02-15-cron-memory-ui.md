# Cron Job Management & Agent Memory UI Implementation Plan

Created: 2026-02-15
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
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes` > **Worktree:** No — working directly on current branch

## Summary

**Goal:** Replace the existing Terragon automations page with gateway cron job management, and add a new top-level Memory page for searching and browsing agent memory files.

**Architecture:** Both features follow the established OpenClaw pattern: TypeScript types → client RPC methods → server actions (ActionResult) → React Query hooks → UI pages. Cron replaces `/automations`, Memory gets a new `/memory` route and sidebar nav item.

**Tech Stack:** Next.js App Router, React Query, shadcn/ui, OpenClaw gateway WebSocket RPC

## Scope

### In Scope

- Cron types, client methods, server actions, React Query hooks
- Cron management UI: list jobs, create/edit form, toggle enable, delete, run now, run history
- Memory types, client methods, server actions, React Query hooks
- Memory UI: search bar with results, file viewer for reading memory files
- Sidebar nav: replace Automations icon/label with Cron, add Memory nav item
- Tests for all server actions

### Out of Scope

- Terragon automations DB table/schema changes (table stays, UI is removed)
- Cron delivery configuration (Slack/Discord/Telegram targeting) — deferred
- Memory write/edit operations (read-only browse + search)
- QMD backend configuration UI
- Sub-agent management UI

## Prerequisites

- OpenClaw gateway running with cron and memory features enabled
- Gateway connection established (existing connection infrastructure)

## Context for Implementer

> This section is critical for cross-session continuity.

- **Patterns to follow:**

  - Server actions: `src/server-actions/channels.ts:1-19` — ActionResult + getClient/notConnected pattern
  - Client RPC methods: `src/lib/openclaw-client.ts:414-419` — channelsStatus() pattern for new methods
  - React Query hooks: `src/queries/channel-queries.ts:1-15` — queryOptions + key factory pattern
  - UI pages: `src/app/(dashboard)/automations/page.tsx` — page layout with header, separator, card grid
  - Types: `src/lib/openclaw-types.ts` — type definitions at bottom of file

- **Conventions:**

  - Server actions use `"use server"` directive, import from `./action-utils`
  - Client methods unwrap response with `.then(res => res.field ?? fallback)`
  - Query keys use factory pattern: `{ all: [...], detail: (id) => [...] }`
  - Pages are `"use client"` components using `useQuery`/`useMutation`

- **Key files:**

  - `src/lib/openclaw-types.ts` — all gateway type definitions
  - `src/lib/openclaw-client.ts` — singleton WebSocket RPC client (currently ~580 lines)
  - `src/server-actions/action-utils.ts` — shared ActionResult, getClient, notConnected
  - `src/components/app-sidebar.tsx` — sidebar nav items array at line 44
  - `src/app/(dashboard)/automations/page.tsx` — page being replaced

- **Gotchas:**

  - `openclaw-client.ts` is over 500 lines (pre-existing); adding methods will increase it further. Keep methods minimal.
  - `getOpenClawClient()` returns `OpenClawClient` (never null). Use `getState() === "disconnected"` check.
  - The existing `/automations` page uses Terragon DB automations (`src/server-actions/automations.ts`), not gateway cron. The replacement page will call gateway RPC instead.

- **Domain context:**
  - **Gateway cron** operates on the gateway host, persisting jobs at `~/.openclaw/cron/jobs.json`. Jobs can be one-shot (`at`), interval (`every`), or recurring (`cron` expression). Jobs run either in the main session or an isolated session.
  - **Agent memory** is file-based Markdown in the workspace. `memory_search` does hybrid BM25+vector retrieval. `memory_get` reads specific files by path. Memory is per-agent.

## Runtime Environment

- **Start command:** `pnpm dev` (from monorepo root)
- **Port:** 3100 (Next.js custom server)
- **Health check:** Gateway connection status in sidebar footer
- **Restart procedure:** Dev server auto-reloads on file changes

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Cron types and client RPC methods
- [x] Task 2: Cron server actions
- [x] Task 3: Cron React Query hooks
- [x] Task 4: Cron management UI page
- [x] Task 5: Memory types and client RPC methods
- [x] Task 6: Memory server actions and React Query hooks
- [x] Task 7: Memory UI page
- [x] Task 8: Sidebar navigation updates

**Total Tasks:** 8 | **Completed:** 8 | **Remaining:** 0

## Implementation Tasks

### Task 1: Cron types and client RPC methods

**Objective:** Add TypeScript types for cron jobs and add RPC methods to `OpenClawClient` for all cron operations.

**Dependencies:** None

**Files:**

- Modify: `src/lib/openclaw-types.ts`
- Modify: `src/lib/openclaw-client.ts`

**Key Decisions / Notes:**

- Add types: `CronJob`, `CronSchedule`, `CronPayload`, `CronDelivery`, `CronRunEntry`
- `CronSchedule` is a discriminated union on `kind`: `"at" | "every" | "cron"`
- `CronPayload` is discriminated on `kind`: `"systemEvent" | "agentTurn"`
- Client methods: `cronList()`, `cronAdd(job)`, `cronUpdate(jobId, patch)`, `cronRemove(jobId)`, `cronRun(jobId)`, `cronRuns(jobId)`, `cronStatus()`
- Follow existing pattern: `sendRequest<{ jobs: CronJob[] }>("cron.list").then(res => res.jobs ?? ...)`

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `CronJob` type covers: name, jobId, agentId, enabled, schedule, sessionTarget, payload, delivery, deleteAfterRun
- [ ] All 7 client methods compile and send correct RPC method strings
- [ ] Existing client tests still pass

**Verify:**

- `npx vitest run --reporter=verbose` — all existing + new tests pass
- `npx tsc --noEmit` — zero type errors

### Task 2: Cron server actions

**Objective:** Create server actions for cron CRUD operations using the ActionResult pattern.

**Dependencies:** Task 1

**Files:**

- Create: `src/server-actions/cron.ts`
- Create: `src/server-actions/__tests__/cron.test.ts`

**Key Decisions / Notes:**

- Follow `src/server-actions/channels.ts` pattern exactly
- Functions: `listCronJobs()`, `getCronStatus()`, `addCronJob(params)`, `updateCronJob(jobId, patch)`, `removeCronJob(jobId)`, `runCronJob(jobId)`, `getCronRuns(jobId)`
- Each function: getClient() → null check → try/catch → ActionResult
- Test pattern: mock `getOpenClawClient`, verify RPC calls and ActionResult shape

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] 7 server action functions exported with correct ActionResult types
- [ ] Tests cover: success case, disconnected case, RPC error case for each function
- [ ] `"use server"` directive at top of file

**Verify:**

- `npx vitest run src/server-actions/__tests__/cron.test.ts` — all tests pass

### Task 3: Cron React Query hooks

**Objective:** Create React Query hooks with query key factories for cron operations.

**Dependencies:** Task 2

**Files:**

- Create: `src/queries/cron-queries.ts`

**Key Decisions / Notes:**

- Follow `src/queries/channel-queries.ts` pattern
- Query keys: `cronQueryKeys.all`, `.list()`, `.status()`, `.runs(jobId)`
- Export `cronListQueryOptions()` with 15s refetch interval (cron changes less frequently than channels)
- Export `cronRunsQueryOptions(jobId)` for run history
- Mutations handled inline in UI (same as automations page pattern)

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `cronListQueryOptions()` returns valid queryOptions with refetchInterval
- [ ] `cronRunsQueryOptions(jobId)` returns valid queryOptions
- [ ] Query key factory follows established pattern

**Verify:**

- `npx tsc --noEmit` — zero type errors

### Task 4: Cron management UI page

**Objective:** Replace the automations page with a gateway cron job management UI at `/automations`.

**Dependencies:** Task 3

**Files:**

- Modify: `src/app/(dashboard)/automations/page.tsx` (full rewrite)

**Key Decisions / Notes:**

- Keep same URL `/automations` to avoid breaking bookmarks; update page title to "Cron Jobs"
- Layout: header with title + "New Job" button → separator → job list as cards
- Each card shows: name, schedule badge (cron expression or interval), session target badge (main/isolated), enabled toggle, delete button, "Run Now" button
- Extract `CronJobForm` to `src/components/cron/cron-job-form.tsx` — form is complex enough to warrant its own file
- Create form: name, schedule type selector (at/every/cron), schedule config fields, session target (main/isolated), payload message text, agent selector (optional)
- Empty state with Clock icon and "No cron jobs" message; loading spinner while fetching; error card with retry on gateway disconnect
- Use `useMutation` for add/update/remove/run with query invalidation + `toast.success()`/`toast.error()` feedback
- Confirmation dialog before delete (follow `agent-manager.tsx` pattern with Dialog)
- Disable "Run Now" button while mutation is pending (`isPending` state)
- Follow the visual style of the existing automations page (Card grid, Badge colors, Tooltip actions)
- Pattern reference: `src/components/agents/agent-manager.tsx` for loading/error/empty states, confirmation dialogs, and toast feedback

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] Page lists cron jobs from gateway with name, schedule, and status badges
- [ ] Loading spinner shown while fetching, error card on gateway disconnect
- [ ] Create form supports cron, interval, and one-shot schedule types
- [ ] Enable/disable toggle calls `updateCronJob` with toast feedback
- [ ] "Run Now" button calls `runCronJob`, disabled while pending
- [ ] Delete button shows confirmation dialog before calling `removeCronJob`
- [ ] Empty state shows when no jobs exist
- [ ] Form extracted to `src/components/cron/cron-job-form.tsx`; page file stays under 300 lines

**Verify:**

- `npx tsc --noEmit` — zero type errors
- `npx vitest run` — all tests pass

### Task 5: Memory types and client RPC methods

**Objective:** Add TypeScript types for memory search/get and add RPC methods to `OpenClawClient`.

**Dependencies:** None (parallel with Tasks 1-4)

**Files:**

- Modify: `src/lib/openclaw-types.ts`
- Modify: `src/lib/openclaw-client.ts`

**Key Decisions / Notes:**

- Types: `MemorySearchResult` (snippets with file, lines, score), `MemorySearchParams` (query, agentId, limit), `MemoryFileContent` (path, content, lines)
- Client methods: `memorySearch(params)` and `memoryGet(agentId, path, options?)`
- `memorySearch` calls `"memory.search"` RPC, returns array of search results
- `memoryGet` calls `"memory.get"` RPC, returns file content

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `MemorySearchResult` type includes: text, filePath, lineStart, lineEnd, score
- [ ] `memorySearch()` sends correct RPC with query and agentId params
- [ ] `memoryGet()` sends correct RPC with agentId, path, optional lineStart/lineCount

**Verify:**

- `npx tsc --noEmit` — zero type errors

### Task 6: Memory server actions and React Query hooks

**Objective:** Create server actions and React Query hooks for memory search and file retrieval.

**Dependencies:** Task 5

**Files:**

- Create: `src/server-actions/memory.ts`
- Create: `src/server-actions/__tests__/memory.test.ts`
- Create: `src/queries/memory-queries.ts`

**Key Decisions / Notes:**

- Server actions: `searchMemory(agentId, query)` and `getMemoryFile(agentId, path)`
- Both use ActionResult pattern from `action-utils.ts`
- Query hooks: `memorySearchQueryOptions(agentId, query)` — enabled only when query is non-empty
- `memoryFileQueryOptions(agentId, path)` — for viewing a specific file
- No refetchInterval for memory (search on demand, not polling)

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] `searchMemory` and `getMemoryFile` server actions with ActionResult
- [ ] Tests cover success, disconnected, and error cases
- [ ] Query hooks use `enabled` flag to prevent empty queries

**Verify:**

- `npx vitest run src/server-actions/__tests__/memory.test.ts` — all tests pass

### Task 7: Memory UI page

**Objective:** Create a new `/memory` page with search bar and file viewer.

**Dependencies:** Task 6

**Files:**

- Create: `src/app/(dashboard)/memory/page.tsx`

**Key Decisions / Notes:**

- Layout: header with "Memory" title and agent selector dropdown → search bar → results list → file viewer panel
- Agent selector: dropdown populated via `listAgents()` from `src/server-actions/agents.ts` (existing server action, cross-module dependency)
- Search: text input with debounced query (300ms). Results show as cards with snippet text, file path, line range, score badge
- File viewer: clicking a result opens the full file below results. Show file path as header, content as monospace pre-formatted text
- Loading/error/empty states: loading spinner while searching, error card on gateway disconnect, "Select an agent" before selection, "Enter a search query" when agent selected, "No results" when search returns empty, graceful handling if agent has no memory files
- Keep page under 300 lines — extract components to `src/components/memory/` if needed

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] Agent selector dropdown populates from gateway
- [ ] Search input triggers memory_search with debounce
- [ ] Results display snippet text, file path, line range, and similarity score
- [ ] Clicking a result loads the full file via `getMemoryFile`
- [ ] Empty states for no agent, no query, and no results
- [ ] File stays under 300 lines

**Verify:**

- `npx tsc --noEmit` — zero type errors

### Task 8: Sidebar navigation updates

**Objective:** Update sidebar nav to reflect the renamed Automations → Cron and add Memory nav item.

**Dependencies:** Tasks 4, 7

**Files:**

- Modify: `src/components/app-sidebar.tsx`

**Key Decisions / Notes:**

- Change automations nav item: `{ href: "/automations", icon: Clock, label: "Cron Jobs" }` (swap Zap → Clock icon)
- Add memory nav item: `{ href: "/memory", icon: Brain, label: "Memory" }` — insert after Cron Jobs
- Import `Brain` from lucide-react (or `BookOpen` if Brain not available)

**Definition of Done:**

- [ ] All tests pass
- [ ] No diagnostics errors
- [ ] Sidebar shows "Cron Jobs" with Clock icon linking to `/automations`
- [ ] Sidebar shows "Memory" with Brain icon linking to `/memory`
- [ ] Active state highlights correctly for both routes

**Verify:**

- `npx tsc --noEmit` — zero type errors

## Testing Strategy

- **Unit tests:** Server actions for cron (7 functions x 3 cases each) and memory (2 functions x 3 cases each) using Vitest with mocked `getOpenClawClient`
- **Integration tests:** React Query hooks compile correctly with proper types (verified via tsc)
- **Manual verification:** Pages render, cron CRUD works against live gateway, memory search returns results

## Risks and Mitigations

| Risk                                                           | Likelihood | Impact | Mitigation                                                                                                      |
| -------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Gateway cron RPC method names differ from docs                 | Med        | Med    | Client methods use string literals; easy to fix if names differ. Test against live gateway during verification. |
| Memory search requires agent to have memory files              | Low        | Low    | Show "No memory files found" empty state. Memory feature degrades gracefully.                                   |
| openclaw-client.ts grows past 600 lines                        | High       | Low    | Keep new methods minimal (2-3 lines each). Defer refactoring to separate task.                                  |
| Automations page replacement breaks existing automations users | Med        | Med    | Keep same `/automations` URL. Terragon automation server actions remain in codebase for potential future use.   |

## Open Questions

- Exact RPC response shapes for `cron.list`, `cron.runs`, `memory.search`, `memory.get` may differ from documentation — will verify during implementation

### Deferred Ideas

- Cron delivery configuration UI (Slack/Discord/Telegram channel targeting)
- Memory write/edit from the UI
- Sub-agent management UI
- QMD memory backend configuration
- Cron run history with detailed logs
