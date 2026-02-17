# OpenClaw Gateway Overview

## What Is the Gateway?

The OpenClaw Gateway is a WebSocket RPC server that acts as the central hub for AI agents, messaging channels, sessions, browser automation, cron scheduling, memory, and shell execution. It runs as a single local process, started via:

```bash
openclaw gateway
```

The default listen port is **18789**. The gateway advertises itself on the local network via Bonjour/mDNS for zero-configuration discovery by clients.

## Architecture

The gateway follows a **hub-and-spoke** model. A single Gateway process owns all state and coordinates every subsystem:

```
  +-----------+     +-----------+     +--------+
  | Browser   |     | CLI       |     | Daemon |
  | (Operator)|     | (Operator)|     | (Agent)|
  +-----+-----+     +-----+-----+     +----+---+
        |                 |                 |
        |    WebSocket    |    WebSocket    |
        +--------+--------+--------+-------+
                 |                 |
           +-----+-----------------+-----+
           |       OpenClaw Gateway      |
           |   (single process, :18789)  |
           +-----------------------------+
           | Agents | Sessions | Channels|
           | Cron   | Memory   | Shell   |
           +-----------------------------+
```

Clients connect as **operators** (human users) or **agents** (AI daemons). All communication flows through the gateway; clients never talk directly to each other.

## Connection Methods

### WebSocket (primary)

The primary interface. Clients open a persistent WebSocket connection for bidirectional RPC and server-push events.

**Direct connection:**

```
ws://localhost:18789/ws
```

**Browser proxy connection** (through Terragon's Next.js backend):

```
wss://<host>/api/gateway/ws
```

The browser proxy (`GatewayProxy`) intercepts the initial `connect` request, injects the auth token server-side, and then transparently forwards all subsequent frames in both directions. This avoids exposing the auth token to client-side JavaScript.

### HTTP Endpoints

| Method | Path                   | Description                                                                                                        |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/`                    | Control UI -- serves the gateway's built-in web dashboard                                                          |
| `GET`  | `/ws`                  | WebSocket upgrade endpoint for RPC clients                                                                         |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions API, allowing any OpenAI SDK or tool to target the gateway as a drop-in backend |
| `POST` | `/v1/responses`        | OpenAI Responses API-compatible endpoint                                                                           |
| `POST` | `/tools/invoke`        | Direct tool invocation endpoint for external integrations                                                          |

The `/v1/chat/completions` and `/v1/responses` endpoints make the gateway interoperable with any client that speaks the OpenAI HTTP API.

## Environment Variables

| Variable               | Description                                                                                                                                    | Default                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `OPENCLAW_GATEWAY_URL` | Full WebSocket URL to the gateway (e.g., `ws://localhost:18789/ws`). Used by the `OpenClawClient` singleton to auto-connect on initialization. | None -- must be set explicitly |
| `OPENCLAW_AUTH_TOKEN`  | Bearer token for authenticating with the gateway. Sent inside the `connect` request's `auth.token` field.                                      | `""` (empty)                   |

## Configuration

The gateway reads its configuration from:

```
~/.openclaw/openclaw.json
```

This JSON file controls agent definitions, channel bindings, cron schedules, model preferences, and other gateway-level settings. Changes can also be applied at runtime via the `config.get`, `config.set`, `config.patch`, and `config.apply` RPC methods over WebSocket.

## RPC Method Categories

The gateway exposes the following method namespaces over WebSocket RPC:

| Namespace          | Examples                                                                                                                         | Purpose                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `connect`          | `connect`                                                                                                                        | Authentication handshake          |
| `health`           | `health`                                                                                                                         | Gateway status and diagnostics    |
| `chat.*`           | `chat.send`, `chat.abort`, `chat.history`, `chat.inject`                                                                         | Conversational AI turns           |
| `agents.*`         | `agents.list`, `agents.create`, `agents.update`, `agents.delete`                                                                 | Agent CRUD                        |
| `agents.files.*`   | `agents.files.list`, `agents.files.get`, `agents.files.set`                                                                      | Agent file management             |
| `sessions.*`       | `sessions.list`, `sessions.patch`, `sessions.spawn`, `sessions.preview`, `sessions.reset`, `sessions.delete`, `sessions.compact` | Session lifecycle                 |
| `models.*`         | `models.list`                                                                                                                    | Available model enumeration       |
| `config.*`         | `config.get`, `config.set`, `config.patch`, `config.schema`, `config.apply`                                                      | Runtime configuration             |
| `cron.*`           | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, `cron.status`                                    | Scheduled task management         |
| `channels.*`       | `channels.status`, `channels.logout`                                                                                             | Messaging channel management      |
| `exec.approvals.*` | `exec.approvals.list`, `exec.approvals.resolve`, `exec.approvals.overrides`, `exec.approvals.overrides.set`                      | Shell execution approval workflow |
| `usage.*`          | `usage.status`, `usage.cost`                                                                                                     | Token usage and cost tracking     |
| `skills.*`         | `skills.status`, `skills.bins`, `skills.install`, `skills.update`                                                                | Skill/plugin management           |
| `logs.*`           | `logs.tail`                                                                                                                      | Log streaming                     |

## Client Implementations

Terragon provides two TypeScript client implementations:

- **`OpenClawClient`** (`openclaw-client.ts`) -- Full-featured client for Node.js and browser environments. Handles the `connect.challenge` event from the gateway, supports auto-reconnection via `reconnecting-websocket`, and exposes every RPC method namespace.

- **`BrowserGatewayClient`** (`browser-gateway-client.ts`) -- Lightweight browser-only client. Connects through the same-origin WebSocket proxy (which handles auth injection), so it skips the `connect.challenge` flow and sends `connect` immediately on WebSocket open. Exposes only chat-related methods.

Both clients use a singleton pattern and automatically gate non-connect RPC calls until the authentication handshake completes.
