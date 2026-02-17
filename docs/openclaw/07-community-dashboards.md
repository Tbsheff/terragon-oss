# Community Dashboards & Management Projects

A survey of community-built OpenClaw dashboard and management projects, plus related Claude Code ecosystem tools.

---

## OpenClaw-Native Dashboards

### 1. ClawWork (880 stars)

**Repository:** github.com/HKUDS/ClawWork
**Stack:** Python
**What it does:** Positions itself as an "AI Coworker" layer on top of OpenClaw. Goes beyond a simple dashboard by adding task-level metrics, structured workflows, and a planning layer that breaks user goals into subtasks dispatched to OpenClaw agents.
**Differentiator:** Task decomposition engine with per-subtask cost/token tracking. The closest thing to an orchestration layer rather than a pure monitoring UI.
**Gaps:** Python-only backend makes it harder to embed in TypeScript/Next.js stacks. No WebSocket proxy pattern -- exposes tokens client-side.

---

### 2. WebClaw (482 stars)

**Repository:** github.com/ibelick/webclaw
**Stack:** TypeScript
**What it does:** Fast, polished web client for the OpenClaw gateway. Focuses on chat UX -- clean message rendering, streaming responses, tool call visualization.
**Differentiator:** Speed and UI quality. Feels production-grade rather than a weekend project.
**Gaps:** Chat-focused -- limited agent/session management, no cron or channel views.

---

### 3. Mission Control / manish-raana (178 stars)

**Repository:** github.com/manish-raana (Mission Control)
**Stack:** Convex, React, Tailwind CSS
**What it does:** Real-time dashboard with agent tracking, task status boards, and live event feeds. Uses Convex for reactive data sync instead of polling.
**Differentiator:** Convex-backed reactivity gives near-instant UI updates without manual WebSocket plumbing. Good agent/task tracking views.
**Gaps:** Convex dependency adds infrastructure overhead. No cost tracking or exec approval handling.

---

### 4. ClawHost (126 stars)

**Repository:** github.com/ClawHost
**Stack:** TypeScript
**What it does:** One-click deploy and management tool for OpenClaw gateways. Handles provisioning, configuration, and lifecycle management of gateway instances.
**Differentiator:** Deployment automation -- fills the gap between "I have the binary" and "it's running in production." Useful for teams managing multiple gateways.
**Gaps:** Thin on runtime monitoring. Once the gateway is deployed, you need a separate dashboard for ongoing visibility.

---

### 5. tugcantopaloglu/openclaw-dashboard (49 stars)

**Repository:** github.com/tugcantopaloglu/openclaw-dashboard
**Stack:** Zero external dependencies, file-based storage
**What it does:** Secure monitoring dashboard with full auth (login + TOTP MFA), cost tracking, live event feed, and a memory file browser. All state persisted to files -- no database required.
**Differentiator:** Security-first design (TOTP MFA is rare in community dashboards). Memory browser for inspecting agent memory files. Zero-dep philosophy keeps the attack surface small.
**Gaps:** File-based storage limits scalability. No WebSocket streaming for real-time updates -- relies on polling.

---

### 6. mudrii/openclaw-dashboard (43 stars)

**Repository:** github.com/mudrii/openclaw-dashboard
**Stack:** Zero external dependencies
**What it does:** Lightweight command center with cost summary cards, cron job tracking, and system health monitoring. Designed as a quick-glance operational dashboard.
**Differentiator:** Extremely minimal -- no build step, no dependencies. Cost cards and cron tracking in a single page.
**Gaps:** No auth, no real-time streaming, no agent management. Read-only monitoring only.

---

### 7. 0xChris-Defi/openclaw-dashboard (7 stars)

**Repository:** github.com/0xChris-Defi/openclaw-dashboard
**Stack:** React 19, Tailwind CSS 4, Express 4
**What it does:** Modern React dashboard with Express backend proxy. Standard CRUD views for agents, sessions, and config.
**Differentiator:** Uses the latest React 19 and Tailwind v4. Clean separation between frontend (React) and backend (Express proxy).
**Gaps:** Early stage. Limited feature coverage compared to more mature dashboards.

---

### 8. silicondawn/memory-viewer (6 stars)

**Repository:** github.com/silicondawn/memory-viewer
**Stack:** Not specified (likely JavaScript)
**What it does:** Dedicated browser for agent memory files. Lets you inspect, search, and navigate the memory store that agents build up over time.
**Differentiator:** Single-purpose tool that does one thing well. Useful alongside any dashboard that lacks memory inspection.
**Gaps:** Memory-only -- no chat, no agent management, no session views.

---

### 9. realriplab/Openclaw-Dasboard (2 stars)

**Repository:** github.com/realriplab/Openclaw-Dasboard
**Stack:** Astro
**What it does:** Real-time monitoring dashboard built with Astro for fast static-first rendering with islands of interactivity.
**Differentiator:** Astro framework -- unusual choice that gives excellent initial load performance via partial hydration.
**Gaps:** Very early stage. Astro's island architecture can make complex real-time features harder to implement.

---

### 10. jgarzik/botmaker

**Repository:** github.com/jgarzik/botmaker
**Stack:** Not specified
**What it does:** UI for creating, configuring, and monitoring bots. Focuses on the agent definition workflow rather than runtime monitoring.
**Differentiator:** Agent creation UX -- visual configuration of agent parameters, system prompts, and tool permissions.
**Gaps:** Less focus on runtime monitoring and live event streams.

---

### 11. rshodoskar-star/openclaw-desktop

**Repository:** github.com/rshodoskar-star/openclaw-desktop
**Stack:** Electron, React
**What it does:** Desktop client with 8 distinct pages covering agents, sessions, config, health, and more. Native desktop app experience.
**Differentiator:** Desktop-native via Electron. Persistent system tray presence, native notifications, multi-window support.
**Gaps:** Electron overhead. No web deployment option.

---

### 12. grp06/openclaw-studio

**Repository:** github.com/grp06/openclaw-studio
**Stack:** Desktop app with vendored gateway client
**What it does:** Desktop application that bundles its own gateway client implementation rather than depending on an external library. Provides a studio-style editing environment for agents.
**Differentiator:** Vendored client means no version drift with the gateway -- the client and UI ship as a matched pair.
**Gaps:** Vendored client requires manual updates when the gateway protocol changes. Less community reuse of the client code.

---

### 13. ClawController (clawcontroller.com)

**Repository:** clawcontroller.com (official site)
**Stack:** Not open-source (commercial/official)
**What it does:** Official management dashboard for OpenClaw. Full-featured: agent CRUD, session management, cron scheduling, cost tracking, channel management, exec approvals.
**Differentiator:** Official -- tracks the gateway protocol closely. Most complete feature coverage.
**Gaps:** Not open-source. Less customizable than community alternatives.

---

## Comparison Matrix

| Project         | Stars | Stack        | Real-time | Auth      | Cost Tracking | Agent MGMT  | Cron | Exec Approvals |
| --------------- | ----- | ------------ | --------- | --------- | ------------- | ----------- | ---- | -------------- |
| ClawWork        | 880   | Python       | Partial   | No        | Yes           | Yes         | No   | No             |
| WebClaw         | 482   | TS           | Yes       | No        | No            | Limited     | No   | No             |
| Mission Control | 178   | Convex/React | Yes       | No        | No            | Yes         | No   | No             |
| ClawHost        | 126   | TS           | No        | No        | No            | Deploy-only | No   | No             |
| tugcantopaloglu | 49    | Zero-dep     | Polling   | Yes (MFA) | Yes           | No          | No   | No             |
| mudrii          | 43    | Zero-dep     | Polling   | No        | Yes           | No          | Yes  | No             |
| 0xChris-Defi    | 7     | React 19     | Partial   | No        | No            | Yes         | No   | No             |
| silicondawn     | 6     | JS           | No        | No        | No            | No          | No   | No             |
| realriplab      | 2     | Astro        | Yes       | No        | No            | No          | No   | No             |
| ClawController  | N/A   | Commercial   | Yes       | Yes       | Yes           | Yes         | Yes  | Yes            |

---

## Claude Code Ecosystem Dashboards

Several projects target the broader Claude Code / coding agent ecosystem. While not OpenClaw-native, they solve adjacent problems and may inform OpenClaw dashboard design.

- **async-code** -- Async task runner for Claude Code. Manages multiple coding tasks concurrently, similar to Terragon's core value prop but without remote sandboxes.

- **claude-code-ui** -- Web UI wrapper for Claude Code CLI. Renders streaming tool calls, diffs, and bash output in a browser.

- **CUI (Claude UI)** -- Minimal chat interface for Claude API interactions. Focused on prompt engineering and conversation management.

- **Companion** -- Sidecar app that monitors Claude Code sessions and provides supplementary context, file trees, and quick actions.

- **CloudCLI** -- Cloud-hosted Claude Code sessions with persistent state. Browser-based terminal with Claude Code pre-installed.

- **Claudia** -- Claude Code orchestrator for multi-agent workflows. Defines agent graphs and routes tasks between specialized Claude instances.

- **claude-swarm** -- Multi-agent coordination layer. Spawns and manages parallel Claude Code processes with shared context and inter-agent messaging.

- **CCPM (Claude Code Project Manager)** -- Project management overlay for Claude Code. Tracks tasks, estimates, and progress across multiple coding sessions.

- **OpenHands** -- Open-source AI software engineering platform. Not Claude-specific but supports Claude as a backend. Full IDE-in-browser with agent capabilities.

- **OpenCode** -- Open-source Claude Code alternative. Terminal-based coding assistant with tool use, file editing, and bash execution.

---

## Key Takeaways

1. **No community project covers the full protocol.** Most dashboards implement chat + agents but skip cron, exec approvals, skills, channels, and usage tracking.

2. **Auth is rare.** Only tugcantopaloglu and ClawController implement authentication. Most dashboards assume a trusted local network.

3. **The proxy pattern is uncommon.** Terragon's `GatewayProxy` approach (server-side token injection) is not replicated in any community dashboard. Most either expose tokens in the browser or run entirely server-side.

4. **Real-time is inconsistent.** Some use WebSocket streaming, some poll. No community project implements the full event subscription model with `connect.challenge` handshake and reconnection logic.

5. **Cost tracking is underserved.** Only 3 projects track costs despite `usage.status` and `usage.cost` being standard gateway RPC methods.
