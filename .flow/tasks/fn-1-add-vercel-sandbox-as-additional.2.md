# fn-1-add-vercel-sandbox-as-additional.2 Add environment config, feature flags, and settings UI

## Description

Wire up environment variables, feature flags, and the settings UI so users can select Vercel as a sandbox provider (gated behind feature flags, following the Daytona pattern).

**Size:** M
**Files:**

- `packages/env/src/apps-www.ts`
- `packages/shared/src/model/feature-flags-definitions.ts`
- `apps/www/src/agent/sandbox.ts` (getSandboxProvider function only)
- `apps/www/src/components/settings/sandbox-provider-selector.tsx`
- `apps/www/src/app/(sidebar)/(site-header)/settings/sandbox/page.tsx`
- `apps/www/.env.example`
- `packages/sandbox/.env.example`

## Approach

- Add env vars to `packages/env/src/apps-www.ts:69-70` following Daytona pattern: `VERCEL_SANDBOX_TOKEN: str({ default: "", allowEmpty: true })`, `VERCEL_SANDBOX_TEAM_ID: str({ default: "", allowEmpty: true })`, `VERCEL_SANDBOX_PROJECT_ID: str({ default: "", allowEmpty: true })`
- Add feature flags to `packages/shared/src/model/feature-flags-definitions.ts:54-85` following Daytona pattern:
  - `vercelOptionsForSandboxProvider` (gates settings UI)
  - `forceVercelSandbox` (forces all users to Vercel)
- Update `getSandboxProvider()` at `apps/www/src/agent/sandbox.ts:391-425`:
  - Add `forceVercelSandbox` check before `forceDaytonaSandbox`
  - Add `case "vercel": return "vercel"` in switch
- Update selector at `apps/www/src/components/settings/sandbox-provider-selector.tsx:35` — add `<SelectItem value="vercel">Vercel</SelectItem>`
- Gate "Vercel" option visibility behind `vercelOptionsForSandboxProvider` feature flag (follow Daytona gating pattern in sandbox settings page)
- Update `UserSettings["sandboxProvider"]` type to include `"vercel"` if needed

## Key context

- The `sandboxProvider` field in `userSettings` DB table is typed as `SandboxProvider | "default"` — adding "vercel" to SandboxProvider (Task 1) should flow through automatically
- The exhaustive switch in `getSandboxProvider()` at line 422 uses `never` check — adding "vercel" without a case will cause a compile error (good — forces us to handle it)

## Acceptance

- [ ] `VERCEL_SANDBOX_TOKEN`, `VERCEL_SANDBOX_TEAM_ID`, `VERCEL_SANDBOX_PROJECT_ID` defined in `packages/env/src/apps-www.ts` (optional, empty default)
- [ ] Feature flags `vercelOptionsForSandboxProvider` and `forceVercelSandbox` defined in feature-flags-definitions.ts
- [ ] `getSandboxProvider()` handles `"vercel"` case and respects `forceVercelSandbox` flag
- [ ] Settings UI shows Vercel option when `vercelOptionsForSandboxProvider` flag is enabled
- [ ] `.env.example` files updated with Vercel vars
- [ ] `pnpm tsc-check` passes

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
