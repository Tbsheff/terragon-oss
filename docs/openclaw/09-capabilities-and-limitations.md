# Capabilities and Limitations

What the OpenClaw gateway can and cannot do, derived from the Protocol v3 RPC surface, client implementations, and gateway architecture.

---

## Capabilities

### Multi-Platform Messaging

The gateway connects to external messaging platforms through its **channels** subsystem. Each channel reports its type, connection status, account binding, DM/group policies, and last activity via `channels.status`. Channels can be disconnected individually with `channels.logout`.

Supported channel types (configured in `~/.openclaw/openclaw.json`):

- WhatsApp
- Telegram
- Slack
- Discord
- Signal
- iMessage
- Microsoft Teams
- Google Chat
- Matrix
- Zalo
- WebChat (built-in web UI)

Channel features available through agent tools and skills:

- **Inline buttons** -- interactive message components
- **Polls** -- structured multi-choice responses
- **Reactions** -- emoji reactions on messages
- **Search** -- message history search across channels
- **Threads** -- threaded replies within channels
- **Broadcast** -- send a single message to multiple channels via `CronDelivery.channels`

### Browser Automation via CDP

Browser control is available through the gateway's tool/skill system using Chrome DevTools Protocol. Capabilities include:

- **Tab management** -- open, close, navigate, switch between browser tabs
- **Screenshots** -- capture visible viewport or full-page screenshots
- **DOM snapshots** -- structured element tree extraction (see limitations for element cap)
- **Interaction** -- click, type, hover, drag on page elements
- **Forms** -- fill, submit, and interact with form controls
- **File uploads** -- programmatic file upload through input elements
- **Cookies** -- read, write, and clear browser cookies
- **Device emulation** -- simulate mobile devices, screen sizes, and user agents
- **Geolocation** -- override GPS coordinates for location-aware pages

### Shell Execution with Approval Gates

Agents can execute shell commands through the `Bash` tool. All shell execution is governed by the **exec approval** system:

| RPC Method                     | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `exec.approvals.list`          | List pending approval requests                       |
| `exec.approvals.resolve`       | Resolve with `allow_once`, `always_allow`, or `deny` |
| `exec.approvals.overrides`     | List persistent pattern-based overrides              |
| `exec.approvals.overrides.set` | Set a pattern override for future auto-resolution    |

Approval requests include the command, arguments, working directory, requesting agent ID, and session key. The `exec.approval.requested` event is pushed to all connected operators in real time.

Persistent overrides are stored in `~/.openclaw/exec-approvals.json` as a pattern-to-decision map.

### Cron Scheduling

The `cron.*` RPC namespace provides full scheduled task management:

| Schedule Kind | Description                                              |
| ------------- | -------------------------------------------------------- |
| `at`          | One-shot execution at a specific datetime                |
| `every`       | Recurring at a fixed interval (`intervalMs`)             |
| `cron`        | Recurring via standard cron expressions (timezone-aware) |

Each cron job specifies:

- **Agent assignment** -- optional `agentId` to handle the job
- **Session target** -- `"main"` (shared session) or `"isolated"` (fresh session per run)
- **Payload** -- either a `systemEvent` (event name + data) or an `agentTurn` (message string)
- **Delivery** -- optional `channels` array for multi-channel broadcast
- **Auto-delete** -- `deleteAfterRun` flag for one-shot jobs

RPC methods: `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run` (manual trigger), `cron.runs` (execution history), `cron.status` (subsystem health).

### Agent Management

Full CRUD for agent definitions with per-agent file storage:

- **Create/update/delete agents** -- set name, emoji, model preference, workspace, description
- **Agent files** -- each agent has named files (e.g., `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `MEMORY.md`) managed via `agents.files.list`, `agents.files.get`, `agents.files.set`
- **Model selection** -- per-agent model override (e.g., `opus`, `sonnet`)
- **Specialized roster** -- pre-built agent roles (brainstormer, planner, coder, reviewer, tester) with auto-generated system prompts
- **Fleet status** -- combined agent + session view showing active/idle/error status per agent

### Session Orchestration

Sessions are the unit of conversation between operators and agents:

| RPC Method         | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `sessions.list`    | List all sessions with metadata                               |
| `sessions.patch`   | Update model, agent, thinking level, queue mode, reset policy |
| `sessions.spawn`   | Create a sub-agent session with custom system prompt          |
| `sessions.preview` | Lightweight summary (message count, last activity)            |
| `sessions.reset`   | Clear history, keep session alive                             |
| `sessions.delete`  | Permanently remove session                                    |
| `sessions.compact` | Summarize context to reduce token usage                       |

Session settings include:

- **Thinking level** -- `off`, `low`, `medium`, `high`
- **Queue mode** -- `sequential`, `concurrent`, `collect`
- **Reset policy** -- `idle` (auto-reset after inactivity), `daily`, `off`
- **Verbose level** -- controls detail of agent responses

### Memory

Agent memory is managed through markdown-based files (notably `MEMORY.md` in the agent file system). The gateway supports:

- **Markdown-based storage** -- persistent memory stored as agent files
- **Optional vector search** -- semantic retrieval over memory contents
- **Hybrid search** -- 70/30 weighted blend of vector and text-based search

### Web Search and Web Fetch

Available through agent tools:

- **Web search** -- powered by Brave and Perplexity backends. Supports domain allow/block lists via `WebSearch` tool parameters (`allowed_domains`, `blocked_domains`)
- **Web fetch** -- fetch any URL with readability extraction. The `WebFetch` tool takes a URL and a processing prompt, converts HTML to markdown, and returns extracted content (see limitations for character cap)

### Node Control

Gateway nodes (devices running the gateway or connected as agents) support:

- **Camera capture** -- take photos from connected cameras
- **Screen recording** -- capture screen activity
- **Location** -- GPS/location reporting from the device
- **Notifications** -- desktop notification delivery to connected operators

### Skills (ClawHub Registry)

The skills system extends gateway capabilities through a plugin architecture:

| RPC Method       | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `skills.status`  | List installed skills and count of available skills                              |
| `skills.bins`    | Browse the ClawHub registry (name, description, version, author, download count) |
| `skills.install` | Install a skill by ID                                                            |
| `skills.update`  | Update an installed skill to latest version                                      |

The registry hosts 5,700+ skills covering browser automation, integrations, utilities, and more.

### Configuration Management

Full runtime configuration control without restarting the gateway:

| RPC Method      | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `config.get`    | Read full configuration                                                 |
| `config.set`    | Replace entire configuration                                            |
| `config.patch`  | Merge partial updates                                                   |
| `config.schema` | Get schema with property types, descriptions, defaults, and constraints |
| `config.apply`  | Hot-reload affected subsystems                                          |

Configuration is persisted in `~/.openclaw/openclaw.json`.

### Usage and Cost Tracking

| RPC Method     | Purpose                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `usage.status` | Current period summary: input/output tokens, cost, session count, period bounds |
| `usage.cost`   | Detailed cost breakdown by model for a custom time range                        |

Per-run usage is also included in `ChatEventPayload` on `final` state events.

### Log Tailing

| RPC Method  | Purpose                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `logs.tail` | Tail recent logs with optional filters: `lines`, `level` (`debug`/`info`/`warn`/`error`), `sessionKey` |

Each log entry includes timestamp, level, message, source, session key, and agent ID.

### Pipeline Orchestration (Dashboard Feature)

The Terragon dashboard adds a pipeline engine on top of the gateway's session system:

- **Stages**: brainstorm, plan, implement, review, test, CI
- **XState machine** -- manages stage transitions, retry logic, timeout handling
- **Review retry** -- up to 3 automatic retries when review stage returns `NEEDS_WORK`
- **Per-stage timeout** -- configurable (default 10 minutes)
- **Pipeline templates** -- reusable stage configurations

### Chat Operations

| RPC Method     | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| `chat.send`    | Send a message with idempotency key; streaming response via events |
| `chat.abort`   | Cancel a running agent turn                                        |
| `chat.history` | Full conversation history with usage stats                         |
| `chat.inject`  | Insert system/user message without triggering agent response       |

Chat events stream as `delta` (partial), `final` (complete), `aborted`, or `error` states.

### Health Monitoring

The `health` RPC returns:

- **Status** -- overall ok/error flag
- **Version** -- gateway software version
- **Uptime** -- seconds since start
- **Active sessions** -- current session count
- **CPU/Memory** -- resource utilization percentages
- **Channel status** -- per-channel health
- **Usage** -- aggregate token usage and cost

### OpenAI-Compatible HTTP API

The gateway exposes HTTP endpoints for interoperability with OpenAI SDK clients:

| Endpoint                    | Description                 |
| --------------------------- | --------------------------- |
| `POST /v1/chat/completions` | OpenAI Chat Completions API |
| `POST /v1/responses`        | OpenAI Responses API        |
| `POST /tools/invoke`        | Direct tool invocation      |

---

## Limitations

### Concurrency

- **Cron max concurrent runs**: 1 per job by default (configurable via gateway config)

### Timeouts

- **RPC request timeout**: 30 seconds (`REQUEST_TIMEOUT_MS = 30_000`). All RPC calls -- including gated requests waiting for the handshake -- will reject after this window.
- **Memory search timeout**: 4,000ms default for vector/hybrid search operations

### Content Limits

- **Browser DOM snapshot**: 200 element limit per snapshot extraction
- **Web fetch content**: 50,000 character maximum per fetched page

### Exec Approval Behavior

- **Fallback on miss**: `deny`. If an exec approval request is not resolved by any connected operator and no matching override exists, the command is denied by default.

### Reconnection

- **Max WebSocket reconnect attempts**: 10. After exhausting retries (1s initial delay, 1.5x growth factor, 10s max delay), the client transitions to `disconnected` and emits `GATEWAY_UNREACHABLE`.

### Architecture Constraints

- **Single gateway per host**: No built-in multi-gateway orchestration. Each host runs one gateway process on a single port (default 18789). Cross-gateway coordination requires external tooling.
- **HTTP API coverage**: Only OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/responses`) and tool invocation (`/tools/invoke`) are available over HTTP. The full RPC method set (agents, sessions, cron, config, skills, logs, etc.) requires a WebSocket connection.
- **Single operator model**: No built-in multi-user management, access control lists, or per-user permissions. The gateway operates with a single auth token. Role-based access is limited to the scope system (`operator.read`, `operator.write`, `operator.admin`, `operator.approvals`, `operator.pairing`).

### Tool Access

- **Tool policies restrict capabilities per provider/agent**: Each agent can be assigned a tool access profile (`minimal`, `coding`, `messaging`, `full`) with optional per-agent allow/deny lists. An agent cannot use tools outside its granted profile unless explicitly overridden.

### Terminal / PTY

- **Types defined, not yet implemented**: The codebase defines `TerminalOpenParams`, `TerminalInputParams`, `TerminalResizeParams`, `TerminalCloseParams`, and `TerminalOutputEvent` types but no corresponding RPC methods exist on the gateway yet. Terminal commands are currently routed through `chat.inject` as a workaround.

### Pipeline Limitations

- **Max review retries**: 3 (`MAX_REVIEW_RETRIES`). After 3 failed review cycles (implement -> review -> NEEDS_WORK), the pipeline stage fails.
- **Stage timeout**: 10 minutes default per stage. Configurable via `stageTimeoutMs` in pipeline config.
- **In-memory actor registry**: Active pipeline state machines are held in memory. If the process restarts, running pipelines are lost (persisted state in kvStore allows manual resume).
