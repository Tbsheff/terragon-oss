# Authentication

OpenClaw uses a layered authentication model: token-based auth for gateway access, device authentication with public key signatures, tool-access profiles per agent, and an exec approval system for command execution control.

## Token-Based Authentication

### Configuration

The gateway auth token can be set in two ways:

1. **Gateway config**: `gateway.auth.token` in the gateway configuration
2. **Environment variable**: `OPENCLAW_AUTH_TOKEN`

The environment variable is read at startup and used as the default when no token is stored in the database. See `apps/openclaw/src/server-actions/settings.ts`:

```typescript
authToken: process.env.OPENCLAW_AUTH_TOKEN ?? null,
```

### Wire Protocol

Clients authenticate during the WebSocket handshake by sending a `connect` request as the first frame after the socket opens. The token is passed inside `params.auth.token`:

```typescript
type ConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  role: string; // e.g. "operator"
  scopes: string[]; // e.g. ["operator.read", "operator.write", ...]
  caps: string[];
  auth?: { token?: string; password?: string };
  userAgent?: string;
  locale?: string;
};
```

For **WebSocket** connections, the token is included in the connect request's `params.auth.token` field.

For **HTTP** connections, the token is sent as a standard `Authorization: Bearer <token>` header.

### Connect Handshake Flow

1. Client opens a WebSocket connection to the gateway
2. Gateway sends a `connect.challenge` event containing a `nonce` and `ts`
3. Client responds with a `connect` request including auth credentials and requested scopes
4. Gateway validates and responds with a `HelloPayload`:

```typescript
type HelloPayload = {
  type?: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};
```

### Connection States

The client transitions through these states during authentication:

```
disconnected -> connecting -> authenticating -> connected
                                             -> reconnecting (on drop)
```

Defined as:

```typescript
type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";
```

### Error Classification

Authentication failures are classified into structured error codes:

| Code                  | Retryable | Meaning                       |
| --------------------- | --------- | ----------------------------- |
| `AUTH_FAILED`         | No        | Token invalid or unauthorized |
| `AUTH_TOKEN_MISSING`  | No        | No token provided             |
| `PROTOCOL_MISMATCH`   | No        | Incompatible protocol version |
| `GATEWAY_UNREACHABLE` | Yes       | Cannot reach the gateway      |
| `GATEWAY_TIMEOUT`     | Yes       | Connection timed out          |
| `RATE_LIMITED`        | Yes       | Throttled by the gateway      |
| `INTERNAL_ERROR`      | Yes       | Server-side error             |
| `UNKNOWN`             | Yes       | Unclassified error            |

## Pairing Flow

New nodes authenticate through a pairing flow:

1. The operator initiates pairing from the dashboard (requires `operator.pairing` scope)
2. The gateway generates a short-lived pairing code with a **5-minute expiry**
3. The new node presents the pairing code during its connect handshake
4. On successful pairing, the gateway issues a fresh auth token via **token rotation** -- the pairing code is invalidated and replaced with a long-lived device token
5. The device token is returned in the hello response at `auth.deviceToken`

Subsequent connections use the device token directly, bypassing the pairing flow.

## Device Authentication

Devices can authenticate using public key signatures in addition to (or instead of) token auth. The `ConnectParams.device` field carries the signature payload:

```typescript
device?: {
  id: string;           // Stable device identifier
  publicKey: string;    // Device's public key
  signature: string;    // Signed challenge (nonce + timestamp)
  signedAt: number;     // Signature timestamp (ms)
  nonce?: string;       // Challenge nonce from connect.challenge
};
```

The gateway verifies the signature against the registered public key for the device ID. This allows headless nodes to authenticate without storing a plaintext token.

## Scopes and Roles

Clients request a **role** and a set of **scopes** during the connect handshake. The dashboard client requests:

```typescript
const CONNECT_ROLE = "operator";
const CONNECT_SCOPES = [
  "operator.read", // Read sessions, agents, config
  "operator.write", // Send messages, modify sessions
  "operator.admin", // Manage agents, config, credentials
  "operator.approvals", // Resolve exec approval requests
  "operator.pairing", // Initiate device pairing
];
```

The gateway's `GatewayProxy` always ensures `operator.read` and `operator.write` scopes are present when proxying connections.

## Tool Access Profiles

Tool access is governed by **profiles** that define which tools an agent can use:

| Profile     | Description                                 |
| ----------- | ------------------------------------------- |
| `minimal`   | Basic text-only interaction, no tool access |
| `coding`    | File system, shell, and git tools           |
| `messaging` | Channel and communication tools             |
| `full`      | All available tools                         |

### Per-Agent Allow/Deny Lists

In addition to profiles, individual agents can have explicit **allow** and **deny** lists for fine-grained tool access control:

- **Allow list**: Only the specified tools are available (overrides profile)
- **Deny list**: The specified tools are blocked (applied on top of profile)

This is configured per-agent in the agent definition on the gateway.

## Terragon GatewayProxy Pattern

The Terragon dashboard uses a **server-side WebSocket proxy** so the browser never handles or exposes the auth token. Implemented in `apps/openclaw/src/server/gateway-proxy.ts`:

### How It Works

1. **Browser connects** to `/api/gateway/ws` (same-origin, no token needed)
2. The `GatewayProxy` intercepts the first `connect` request frame
3. It loads the auth token from the database via `loadUpstreamSettings()`
4. It **injects** `params.auth.token` into the connect frame
5. It ensures `operator.read` and `operator.write` scopes are always present
6. It opens an upstream WebSocket to the real gateway and forwards the modified connect frame
7. All subsequent frames are forwarded **bidirectionally** without modification

```
Browser <--ws--> /api/gateway/ws (proxy) <--ws--> Gateway :18789/ws
              no token needed              token injected server-side
```

### Key Implementation Details

- Uses `ws` library with `noServer: true` for HTTP upgrade handling
- The proxy intercepts only the first message; all subsequent frames pass through transparently
- Close and error events propagate in both directions
- Browser client omits `auth` from connect params entirely (proxy handles it):

```typescript
// In BrowserGatewayClient:
auth: undefined,  // Proxy injects the token server-side
```

### Error Codes

The proxy uses custom WebSocket close codes:

| Code   | Meaning                                          |
| ------ | ------------------------------------------------ |
| `4000` | First message was not a valid connect request    |
| `4001` | No gateway connection configured in the database |
| `4002` | Upstream connection error                        |

## Exec Approval System

The exec approval system controls command execution within agent sessions. When an agent attempts to run a command that requires approval, the gateway emits an `exec.approval.requested` event.

### Approval Request

```typescript
type ExecApprovalRequest = {
  id: string; // Unique approval request ID
  sessionKey: string; // Session that triggered the request
  agentId: string; // Agent attempting the command
  command: string; // The command to execute
  args?: string[]; // Command arguments
  cwd?: string; // Working directory
  requestedAt: string; // ISO timestamp
};
```

### Decisions

Each approval can be resolved with one of three decisions:

```typescript
type ExecApprovalDecision = "allow_once" | "always_allow" | "deny";
```

| Decision       | Effect                                  |
| -------------- | --------------------------------------- |
| `allow_once`   | Permit this single execution            |
| `always_allow` | Permit this command pattern permanently |
| `deny`         | Block execution                         |

### RPC Methods

The client provides these methods for managing approvals:

- `exec.approvals.list` -- List pending approval requests
- `exec.approvals.resolve` -- Resolve a request with a decision (`{ id, decision }`)
- `exec.approvals.overrides` -- Get all stored overrides (pattern -> decision map)
- `exec.approvals.overrides.set` -- Set a persistent override for a command pattern

### Override Storage

Persistent overrides (from `always_allow` or global deny rules) are stored in:

```
~/.openclaw/exec-approvals.json
```

This file maps command patterns to decisions, allowing the gateway to auto-resolve matching commands without prompting the operator.
