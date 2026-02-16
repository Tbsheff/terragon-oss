# fn-1-add-vercel-sandbox-as-additional.3 Handle snapshot hibernation, sandbox ID mutation, and fast resume

## Description

Handle the three critical behavioral differences between Vercel and E2B: (1) sandbox ID changes on snapshot restore, (2) fast resume must always restart daemon for Vercel, (3) hibernation uses snapshot + cold restart.

**Size:** M
**Files:**

- `apps/www/src/agent/sandbox.ts` (getOrCreateSandboxForThread — sandbox ID update logic)
- `packages/sandbox/src/setup.ts` (setupSandboxEveryTime — force daemon restart for Vercel)
- `packages/sandbox/src/sandbox.ts` (orchestration layer — pass provider info for conditional logic)

## Approach

### Sandbox ID mutation on restore

In `getOrCreateSandboxForThread()` at `apps/www/src/agent/sandbox.ts:277-287`, the current code only writes `codesandboxId` when `!thread.codesandboxId`. For Vercel, the ID changes on every snapshot restore. Modify to:

- Always update `codesandboxId` when the session's `sandboxId` differs from `thread.codesandboxId`
- This is safe for E2B/Daytona too (their IDs don't change, so the update is a no-op)

### Fast resume daemon restart

In `setupSandboxEveryTime()` at `packages/sandbox/src/setup.ts:204-233`, when `fastResume=true`, daemon restart is skipped (line 214: `if (!options.fastResume)`). For Vercel, processes are always killed on snapshot, so daemon must always restart.

- Add check: if `session.sandboxProvider === "vercel"`, always call `restartDaemonIfNotRunning()` regardless of `fastResume`
- Keep existing fast resume optimization for E2B (processes survive pause)

### Snapshot-based hibernation

The `VercelProvider.hibernateById()` (from Task 1) calls `sandbox.snapshot()` which stops the sandbox. The `VercelSession` needs to store the `snapshotId` so resume can use it.

- Store snapshotId in VercelSession after snapshot
- On `getOrCreateSandbox(sandboxId, ...)`: if sandboxId is a snapshotId, create from snapshot via `Sandbox.create({ source: { type: 'snapshot', snapshotId } })`
- Design decision: the `codesandboxId` stored in DB for Vercel threads will be the snapshotId (not the sandbox ID), since sandbox IDs are ephemeral

## Key context

- `restartDaemonIfNotRunning()` at `packages/sandbox/src/daemon.ts` checks if daemon process is running and restarts if not — this is the key function that must always run for Vercel
- Redis keys are prefixed with sandbox ID: `sandbox-active-thread-chats:{id}`, `sandbox-terminal-status:{id}` — these naturally expire (24h TTL at `apps/www/src/agent/sandbox-resource.ts:39`) so stale keys from old sandbox IDs are self-cleaning
- The `onStatusUpdate` callback at `apps/www/src/agent/sandbox.ts:255-274` receives `sandboxId` — ensure the new ID is passed after snapshot restore

## Acceptance

- [ ] `codesandboxId` in DB is updated when session sandboxId differs from stored thread.codesandboxId (handles Vercel ID mutation)
- [ ] `setupSandboxEveryTime()` always calls `restartDaemonIfNotRunning()` when provider is "vercel", regardless of fastResume flag
- [ ] Vercel hibernation flow: snapshot() → store snapshotId → resume creates new sandbox from snapshot
- [ ] Existing E2B/Daytona fast resume behavior is preserved (no regression)
- [ ] `pnpm tsc-check` passes

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
