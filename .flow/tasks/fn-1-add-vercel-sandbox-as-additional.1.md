# fn-1-add-vercel-sandbox-as-additional.1 Implement core VercelProvider and VercelSession

## Description

Implement the core Vercel sandbox provider by creating `VercelProvider` (implements `ISandboxProvider`) and `VercelSession` (implements `ISandboxSession`), then register it in the type system and factory.

**Size:** M
**Files:**

- `packages/sandbox/src/providers/vercel-provider.ts` (NEW)
- `packages/types/src/sandbox.ts`
- `packages/sandbox/src/provider.ts`
- `packages/sandbox/package.json`

## Approach

- Follow the Daytona provider pattern at `packages/sandbox/src/providers/daytona-provider.ts`
- Use `@vercel/sandbox` SDK v1.4.1: `Sandbox.create()`, `Sandbox.get()`, `sandbox.runCommand()`, `sandbox.snapshot()`, `sandbox.stop()`
- Working directory: `HOME_DIR = "vercel/sandbox"`, `REPO_DIR = "project"` (under `/vercel/sandbox/project`)
- Command execution: wrap Vercel's `sandbox.runCommand({ cmd: 'bash', args: ['-c', command] })` to match `ISandboxSession.runCommand(command: string)` interface
- stdout/stderr: Vercel returns async functions — `await result.stdout()` and `await result.stderr()`
- Background commands: use `sandbox.runCommand({ cmd, args, detached: true })`
- File ops: `sandbox.writeFiles([{ path, content: Buffer.from(data) }])` and `sandbox.readFileToBuffer({ path })`
- Hibernation: `sandbox.snapshot()` returns `{ snapshotId }` — store it for later resume. Snapshot stops the sandbox automatically.
- Resume: `Sandbox.create({ source: { type: 'snapshot', snapshotId } })` — returns a **new** sandbox with a **new** `sandboxId`
- Auth env vars: `VERCEL_SANDBOX_TOKEN`, `VERCEL_SANDBOX_TEAM_ID`, `VERCEL_SANDBOX_PROJECT_ID`
- Use `retryAsync()` from `@terragon/utils/retry` for create/resume operations (follow Daytona pattern)
- `extendLife`: call `sandbox.extendTimeout(ms)`

## Key context

- Vercel `runCommand` stdout/stderr are async functions, not strings: `await result.stdout()` — this is the biggest API mismatch
- Vercel sandbox runs as `vercel-sandbox` user with sudo, not root
- `sandbox.runCommand('bash', ['-c', 'your shell command'])` for shell syntax (pipes, redirects)
- Reference implementations: `firecrawl/open-lovable` lib/sandbox/providers/vercel-provider.ts, `vercel-labs/coding-agent-template` lib/sandbox/creation.ts

## Acceptance

- [ ] `SandboxProvider` type in `packages/types/src/sandbox.ts` includes `"vercel"`
- [ ] `VercelSession` implements all `ISandboxSession` methods: `runCommand`, `runBackgroundCommand`, `readTextFile`, `writeTextFile`, `writeFile`, `hibernate`, `shutdown`
- [ ] `VercelProvider` implements all `ISandboxProvider` methods: `getOrCreateSandbox`, `getSandboxOrNull`, `hibernateById`, `extendLife`
- [ ] Factory in `packages/sandbox/src/provider.ts` routes `"vercel"` to `VercelProvider`
- [ ] `@vercel/sandbox` added as dependency in `packages/sandbox/package.json`
- [ ] `pnpm tsc-check` passes

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
