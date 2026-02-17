# OpenClaw WebSocket Protocol Reference

**Protocol Version: 3**

All communication uses **JSON text frames** over WebSocket. Binary frames are not used. Every frame is a single JSON object with a `type` discriminator.

## Frame Types

There are exactly three frame types.

### `req` -- Request (client to server)

```typescript
{
  type: "req";
  id: string;        // unique request ID (nanoid recommended)
  method: string;    // RPC method name, e.g. "chat.send"
  params?: object;   // method-specific parameters
}
```

The `id` field correlates requests with responses. Clients must generate unique IDs per request. The gateway responds with a `res` frame carrying the same `id`.

### `res` -- Response (server to client)

```typescript
{
  type: "res";
  id: string;        // matches the request's id
  ok: boolean;       // true on success, false on error
  payload?: object;  // result data (present when ok=true)
  error?: {          // error details (present when ok=false)
    code: string;
    message: string;
  };
}
```

Exactly one of `payload` or `error` is semantically meaningful based on the `ok` flag. Clients should check `ok` before accessing either field.

### `event` -- Server Push (server to client)

```typescript
{
  type: "event";
  event: string; // event name, e.g. "chat", "connect.challenge"
  payload: object; // event-specific data
  seq: number; // monotonically increasing sequence number
}
```

Events are unsolicited messages pushed by the gateway. The `seq` field increments per-connection and can be used to detect missed events after reconnection.

## Authentication Handshake

The connection handshake is a three-step process.

### Step 1: Challenge

Immediately after the WebSocket connection opens, the gateway sends a `connect.challenge` event:

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "a1b2c3d4e5f6",
    "ts": 1708099200000
  },
  "seq": 0
}
```

The `nonce` is a one-time value. The `ts` field is the server's Unix timestamp in milliseconds.

### Step 2: Connect Request

The client responds with a `connect` request containing its identity, requested capabilities, and credentials:

```json
{
  "type": "req",
  "id": "req_abc123",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "gateway-client",
      "version": "0.1.0",
      "platform": "darwin",
      "mode": "backend",
      "instanceId": "optional-unique-instance"
    },
    "role": "operator",
    "scopes": [
      "operator.read",
      "operator.write",
      "operator.admin",
      "operator.approvals",
      "operator.pairing"
    ],
    "caps": [],
    "auth": {
      "token": "<auth-token>"
    },
    "device": {
      "id": "device-id",
      "publicKey": "base64-public-key",
      "signature": "base64-signature",
      "signedAt": 1708099200000,
      "nonce": "a1b2c3d4e5f6"
    },
    "userAgent": "openclaw-dashboard/0.1.0 node/v20.0.0",
    "locale": "en"
  }
}
```

**Connect parameters:**

| Field               | Type       | Required | Description                                                                   |
| ------------------- | ---------- | -------- | ----------------------------------------------------------------------------- |
| `minProtocol`       | `number`   | Yes      | Minimum protocol version the client supports. Currently `3`.                  |
| `maxProtocol`       | `number`   | Yes      | Maximum protocol version the client supports. Currently `3`.                  |
| `client.id`         | `string`   | Yes      | Stable client identifier (e.g., `"gateway-client"`).                          |
| `client.version`    | `string`   | Yes      | Client software version.                                                      |
| `client.platform`   | `string`   | Yes      | Platform identifier: `"browser"`, `"darwin"`, `"linux"`, `"win32"`, `"node"`. |
| `client.mode`       | `string`   | Yes      | Operating mode: `"backend"` or `"interactive"`.                               |
| `client.instanceId` | `string`   | No       | Unique identifier for this specific client instance.                          |
| `role`              | `string`   | Yes      | Role requested: `"operator"` for human users.                                 |
| `scopes`            | `string[]` | Yes      | Permission scopes requested (see below).                                      |
| `caps`              | `string[]` | Yes      | Client capabilities (reserved for future use, send `[]`).                     |
| `auth`              | `object`   | No       | Authentication credentials. Contains `token` and/or `password`.               |
| `device`            | `object`   | No       | Device attestation for trusted-device flows.                                  |
| `userAgent`         | `string`   | No       | Descriptive user-agent string for logging.                                    |
| `locale`            | `string`   | No       | BCP-47 locale tag (e.g., `"en"`, `"en-US"`).                                  |

**Scopes:**

| Scope                | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `operator.read`      | Read sessions, agents, config, history, logs              |
| `operator.write`     | Send messages, create/modify agents and sessions          |
| `operator.admin`     | Modify gateway configuration, manage skills, apply config |
| `operator.approvals` | Receive and resolve exec approval requests                |
| `operator.pairing`   | Pair new devices and manage device trust                  |

### Step 3: Hello Response

On successful authentication, the gateway responds with a `res` frame containing a `hello` payload:

```json
{
  "type": "res",
  "id": "req_abc123",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 3,
    "features": {
      "methods": [
        "chat.send",
        "chat.abort",
        "chat.history",
        "chat.inject",
        "agents.list",
        "agents.create",
        "agents.update",
        "agents.delete",
        "sessions.list",
        "sessions.patch",
        "sessions.spawn",
        "config.get",
        "config.set",
        "config.patch",
        "cron.list",
        "cron.add",
        "cron.update",
        "cron.remove",
        "models.list",
        "health"
      ],
      "events": [
        "chat",
        "agent",
        "exec.approval.requested",
        "connect.challenge"
      ]
    },
    "snapshot": null,
    "auth": {
      "deviceToken": "dt_xxxx",
      "role": "operator",
      "scopes": ["operator.read", "operator.write", "operator.admin"],
      "issuedAtMs": 1708099200000
    },
    "policy": {
      "tickIntervalMs": 5000
    }
  }
}
```

**Hello payload fields:**

| Field                   | Type         | Description                                                     |
| ----------------------- | ------------ | --------------------------------------------------------------- |
| `type`                  | `"hello-ok"` | Discriminator confirming successful auth.                       |
| `protocol`              | `number`     | Negotiated protocol version (always `3` currently).             |
| `features.methods`      | `string[]`   | RPC methods available to this client given its role and scopes. |
| `features.events`       | `string[]`   | Event types this client will receive.                           |
| `snapshot`              | `unknown`    | Optional initial state snapshot (sessions, agents, etc.).       |
| `auth.deviceToken`      | `string`     | Issued device token for subsequent reconnections.               |
| `auth.role`             | `string`     | Granted role.                                                   |
| `auth.scopes`           | `string[]`   | Granted scopes (may be a subset of what was requested).         |
| `auth.issuedAtMs`       | `number`     | Token issue time (Unix ms).                                     |
| `policy.tickIntervalMs` | `number`     | Recommended heartbeat/poll interval in milliseconds.            |

## Connection State Machine

```
                    +--------------+
                    | disconnected |
                    +------+-------+
                           |
                    connect()
                           |
                    +------v-------+
                    |  connecting  |
                    +------+-------+
                           |
              connect.challenge received
                           |
                    +------v---------+
                    | authenticating |
                    +------+---------+
                           |
                  hello-ok received
                           |
                    +------v-------+
              +---->|  connected   |
              |     +------+-------+
              |            |
              |     connection lost
              |            |
              |     +------v--------+
              +-----| reconnecting  |
                    +------+--------+
                           |
                    max retries exceeded
                           |
                    +------v-------+
                    | disconnected |
                    +--------------+
```

**States:**

| State            | Description                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `disconnected`   | No active connection. Initial state and terminal state after max retries.                                                        |
| `connecting`     | WebSocket TCP handshake in progress.                                                                                             |
| `authenticating` | WebSocket open; `connect` request sent, awaiting `hello` response.                                                               |
| `connected`      | Handshake complete. RPC methods are available.                                                                                   |
| `reconnecting`   | Connection lost; the client is automatically re-establishing the WebSocket and re-authenticating. Pending requests are rejected. |

Reconnection uses exponential backoff: 1s initial delay, 1.5x growth factor, 10s maximum delay, 10 maximum retry attempts. After exhausting retries, the client transitions to `disconnected` and emits a `connect-error` event with code `GATEWAY_UNREACHABLE`.

## Error Codes

Structured errors returned in `res.error.code` or emitted as `GatewayConnectError` on connection failure:

| Code                  | Retryable | Description                                                                                          |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `AUTH_FAILED`         | No        | Authentication rejected. Token is invalid, expired, or revoked. Check the token in gateway settings. |
| `AUTH_TOKEN_MISSING`  | No        | No auth token was provided in the `connect` request. Set a token before connecting.                  |
| `PROTOCOL_MISMATCH`   | No        | Client and gateway do not share a compatible protocol version. Update the client or gateway.         |
| `GATEWAY_UNREACHABLE` | Yes       | TCP connection refused or DNS resolution failed. The gateway process may not be running.             |
| `GATEWAY_TIMEOUT`     | Yes       | The gateway did not respond within the request timeout (default: 30 seconds).                        |
| `RATE_LIMITED`        | Yes       | Too many requests. Back off and retry after a delay.                                                 |
| `INTERNAL_ERROR`      | Yes       | Unexpected server-side error. Retry may succeed.                                                     |
| `UNKNOWN`             | Yes       | Unclassified error. Treated as retryable by default.                                                 |

Error classification is performed client-side by inspecting the raw error code and message string. The `retryable` flag indicates whether the client should attempt automatic reconnection. Non-retryable errors (auth failures, protocol mismatches) require user intervention.

## Request Timeout

All RPC requests have a **30-second timeout** (`REQUEST_TIMEOUT_MS = 30_000`). If the gateway does not respond within this window, the pending promise rejects with a timeout error. Non-connect requests are additionally gated behind the authentication handshake -- if the handshake itself times out, all queued requests fail.

## Event Types

Key server-push events after connection:

| Event                     | Payload                         | Description                                                         |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `connect.challenge`       | `{ nonce: string, ts: number }` | Authentication challenge sent on WebSocket open.                    |
| `chat`                    | `ChatEventPayload`              | Streaming chat response: deltas, final messages, errors, and usage. |
| `agent`                   | `object`                        | Agent state change notifications.                                   |
| `exec.approval.requested` | `ExecApprovalRequest`           | A shell command requires operator approval before execution.        |

### Chat Event Payload

The `chat` event carries streaming AI responses:

```typescript
{
  runId: string;           // unique run identifier
  sessionKey: string;      // session this message belongs to
  seq: number;             // sequence number within the run
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: "user" | "assistant";
    content: (TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock)[];
  };
  error?: { code: string; message: string };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
}
```

- `state: "delta"` -- partial content update; accumulate with previous deltas.
- `state: "final"` -- complete message; the run is finished.
- `state: "aborted"` -- the run was cancelled via `chat.abort`.
- `state: "error"` -- the run failed; see `error` field.

### Exec Approval Request

When an agent attempts to run a shell command that requires operator approval:

```typescript
{
  id: string;              // approval request ID
  sessionKey: string;
  agentId: string;
  command: string;         // the command to execute
  args?: string[];         // command arguments
  cwd?: string;            // working directory
  requestedAt: string;     // ISO 8601 timestamp
}
```

Resolve with `exec.approvals.resolve`:

```json
{
  "type": "req",
  "id": "req_xyz",
  "method": "exec.approvals.resolve",
  "params": {
    "id": "<approval-id>",
    "decision": "allow_once"
  }
}
```

Decisions: `"allow_once"`, `"always_allow"`, `"deny"`.
