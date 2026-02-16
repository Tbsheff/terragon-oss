# fn-1-add-vercel-sandbox-as-additional.4 Terminal, broadcast, documentation and env file updates

## Description

Update terminal support, broadcast service, and documentation to handle the new Vercel provider. Fix all TypeScript exhaustiveness checks across the codebase.

**Size:** M
**Files:**

- `apps/www/src/lib/sandbox-terminal.ts`
- `apps/broadcast/src/sandbox.ts`
- `AGENTS.md`
- `apps/www/.env.example`
- `packages/sandbox/.env.example`
- `packages/debug-scripts/.env.example`
- `apps/broadcast/.env.example`
- `apps/docs/content/docs/configuration/environment-setup/sandbox.mdx` (if exists)

## Approach

### Terminal support

- Add `case "vercel": return false` in `isSandboxTerminalSupported()` at `apps/www/src/lib/sandbox-terminal.ts:3-19`

### Broadcast service

- In `apps/broadcast/src/sandbox.ts`, add `"vercel"` case in `resumeSandboxSession()` — mark as unsupported (same as Daytona at line 90)
- The broadcast service directly imports `@e2b/code-interpreter` for PTY — no Vercel SDK import needed since terminal is unsupported

### Exhaustiveness checks

- All `switch` statements on `SandboxProvider` use `never` exhaustiveness checks — adding `"vercel"` to the union type (Task 1) will cause compile errors everywhere it's not handled
- Search for `_exhaustiveCheck: never` across the codebase and add `"vercel"` cases
- Key locations: `apps/www/src/lib/sandbox-terminal.ts`, `apps/broadcast/src/sandbox.ts`, `packages/sandbox/src/provider.ts`, `apps/www/src/agent/sandbox.ts`

### Documentation

- Update `AGENTS.md`: add Vercel to technology stack, sandbox providers list, environment variables section
- Update `.env.example` files with `VERCEL_SANDBOX_TOKEN`, `VERCEL_SANDBOX_TEAM_ID`, `VERCEL_SANDBOX_PROJECT_ID`
- Update docs site sandbox page if it exists

## Key context

- The broadcast service has a known issue: "partykit deployment doesn't like the daytona sdk" (comment at `apps/broadcast/src/sandbox.ts:90`). Do NOT import `@vercel/sandbox` in broadcast — just return unsupported.
- `parseBroadcastChannel()` at `packages/types/src/broadcast.ts:136-168` defaults to "e2b" if provider is missing — ensure "vercel" is handled in any channel parsing

## Acceptance

- [ ] `isSandboxTerminalSupported("vercel")` returns `false`
- [ ] Broadcast service handles "vercel" provider without errors (returns unsupported)
- [ ] All TypeScript exhaustiveness checks pass for "vercel" — `pnpm tsc-check` clean
- [ ] AGENTS.md updated with Vercel provider info
- [ ] All `.env.example` files include Vercel environment variables
- [ ] No `@vercel/sandbox` import in broadcast service (PartyKit compatibility)

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
