# Session Management

Sessions are the primary unit of agent interaction in OpenClaw. Each session binds an agent, a model, and a conversation history together under a unique key. Sessions support queue modes for concurrency control, reset policies for lifecycle management, and sub-agent spawning for delegation.

## Session Keys

Session keys are free-form strings that identify a session. By convention:

| Pattern                  | Example                       | Use Case                                        |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `"main"`                 | `"main"`                      | Default session for direct interaction          |
| `"discord:channel:<id>"` | `"discord:channel:123456789"` | Channel-bound session (one per Discord channel) |
| `"isolated"`             | `"isolated"`                  | Ephemeral session for one-off tasks             |
| Custom                   | `"review-pr-42"`              | Task-specific session key                       |

The session key is passed to every chat and session RPC method.

## Session Properties

```typescript
type OpenClawSession = {
  key: string;
  agentId?: string;
  model?: string;
  thinking?: "off" | "low" | "medium" | "high";
  createdAt?: string;
  lastMessageAt?: string;
  messageCount?: number;
  queueMode?: "sequential" | "concurrent" | "collect";
  resetPolicy?: { type: "idle" | "daily" | "off"; value?: number };
  verboseLevel?: number;
};
```

### Property Details

| Property        | Type                                        | Description                                                      |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `key`           | `string`                                    | Unique session identifier                                        |
| `agentId`       | `string?`                                   | Agent bound to this session (determines system prompt and tools) |
| `model`         | `string?`                                   | Model override (e.g. `"sonnet"`, `"opus"`)                       |
| `thinking`      | `"off" \| "low" \| "medium" \| "high"`      | Extended thinking budget for the model                           |
| `messageCount`  | `number?`                                   | Total messages in the session history                            |
| `queueMode`     | `"sequential" \| "concurrent" \| "collect"` | How incoming messages are queued                                 |
| `resetPolicy`   | `{ type, value? }`                          | When to auto-reset conversation history                          |
| `verboseLevel`  | `number?`                                   | Controls detail level of agent responses                         |
| `createdAt`     | `string?`                                   | ISO timestamp of session creation                                |
| `lastMessageAt` | `string?`                                   | ISO timestamp of the most recent message                         |

## Session Operations

All session operations are RPC methods sent over the WebSocket connection.

### List Sessions

```typescript
// Returns all active sessions
const sessions: OpenClawSession[] = await client.sessionsList();
```

RPC method: `sessions.list`

### Spawn Sub-Agent Session

Create a new session bound to a specific agent. Used for delegation (e.g. a planner agent spawning a coder agent for implementation).

```typescript
type SpawnSessionParams = {
  agentId: string; // Required: which agent to run
  model?: string; // Optional model override
  sessionKey?: string; // Optional key (auto-generated if omitted)
  systemPrompt?: string; // Optional system prompt override
};

const session = await client.sessionsSpawn({
  agentId: "coder",
  model: "sonnet",
  sessionKey: "implement-feature-x",
  systemPrompt: "Implement the feature according to the plan...",
});
```

RPC method: `sessions.spawn`

### Patch Session

Update session settings without resetting the conversation:

```typescript
const updated = await client.sessionsPatch("main", {
  model: "opus",
  agentId: "reviewer",
});
```

RPC method: `sessions.patch` with `{ key, ...settings }`

### Preview Session

Get a lightweight summary of a session without loading full history:

```typescript
type SessionPreview = {
  key: string;
  summary?: string;
  messageCount?: number;
  lastMessageAt?: string;
};

const preview = await client.sessionsPreview("main");
```

RPC method: `sessions.preview`

### Reset Session

Clear the conversation history while preserving the session configuration (agent, model, queue mode, etc.):

```typescript
await client.sessionsReset("main");
```

RPC method: `sessions.reset`

### Delete Session

Remove the session entirely:

```typescript
await client.sessionsDelete("isolated");
```

RPC method: `sessions.delete`

### Compact Session

Compress the conversation history by summarizing older messages. Reduces token usage on subsequent turns while preserving context:

```typescript
await client.sessionsCompact("main");
```

RPC method: `sessions.compact`

## Queue Modes

Queue modes control how a session handles multiple incoming messages.

### Sequential (Default)

Messages are processed **one at a time** in order. If a message arrives while the agent is responding, it waits in the queue until the current turn completes.

```
Message A -> [processing] -> done
Message B -> [waiting] -> [processing] -> done
Message C -> [waiting] -> [waiting] -> [processing] -> done
```

Best for: conversational interactions where order matters.

### Concurrent

Messages are processed **in parallel**. Each incoming message starts a new agent turn immediately, regardless of whether previous turns have completed.

```
Message A -> [processing] ---------> done
Message B -> [processing] -----> done
Message C -> [processing] -> done
```

Best for: independent tasks that do not depend on each other's results.

### Collect

Messages are **batched** together. Incoming messages accumulate in a buffer. The agent processes the entire batch as a single turn once the collection window closes (triggered by a pause in incoming messages or a configurable threshold).

```
Message A -> [buffer]
Message B -> [buffer]
Message C -> [buffer] -> [processing all together] -> done
```

Best for: high-volume channels (e.g. Discord) where many messages arrive in bursts and should be processed as a single context.

## Reset Policies

Reset policies control automatic conversation history management.

### Idle

The session resets after a period of inactivity. The `value` field specifies the idle timeout in milliseconds.

```typescript
resetPolicy: { type: "idle", value: 3600000 }  // Reset after 1 hour idle
```

### Daily

The session resets at midnight (gateway local time) every day. No `value` needed.

```typescript
resetPolicy: {
  type: "daily";
}
```

### Off

No automatic reset. The session accumulates history indefinitely (use `compact` to manage token growth).

```typescript
resetPolicy: {
  type: "off";
}
```

## Chat Injection

Inject messages into a session without triggering an agent response. Useful for seeding context, providing instructions, or inserting system-level information.

```typescript
type InjectParams = {
  sessionKey: string;
  content: string;
  role?: "system" | "user"; // defaults to "system"
};

// Inject a system message
await client.chatInject({
  sessionKey: "main",
  content: "The user's timezone is America/New_York",
  role: "system",
});

// Inject a user message (without triggering response)
await client.chatInject({
  sessionKey: "main",
  content: "Context: PR #42 was merged 5 minutes ago",
  role: "user",
});
```

RPC method: `chat.inject`

The server action wrapper provides the same functionality:

```typescript
// Server action
await injectChatContext(threadId, "context string", "system");
```

## Chat Streaming

Chat events are delivered as a stream of `ChatEventPayload` frames over the WebSocket connection.

### Event Structure

```typescript
type ChatEventPayload = {
  runId: string; // Unique ID for this agent turn
  sessionKey: string; // Session that generated the event
  seq: number; // Sequence number within the run
  state: "delta" | "final" | "aborted" | "error";
  message?: ChatMessage; // Partial or complete message
  error?: { code: string; message: string };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
};
```

### Event States

| State     | Meaning                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `delta`   | Partial update -- new content appended to the current message. Streamed continuously as the model generates output. |
| `final`   | Agent turn complete. The `message` field contains the full response. `usage` is populated with token counts.        |
| `aborted` | Turn was cancelled (via `chat.abort` or session reset).                                                             |
| `error`   | Turn failed. The `error` field contains a structured error code and message.                                        |

### Lifecycle

```
delta -> delta -> delta -> ... -> final
                                  (or aborted)
                                  (or error)
```

### Subscribing to Events

```typescript
client.on("chat", (event: ChatEventPayload) => {
  switch (event.state) {
    case "delta":
      // Append partial content to UI
      break;
    case "final":
      // Show complete response, update usage counters
      break;
    case "aborted":
      // Show "cancelled" indicator
      break;
    case "error":
      // Display error message
      break;
  }
});
```

### Aborting a Turn

```typescript
await client.chatAbort("main");
```

RPC method: `chat.abort` with `{ sessionKey }`

## Usage Tracking

Token usage and cost are tracked per session and available at both the session and global level.

### Per-Turn Usage

Every `final` chat event includes usage data:

```typescript
usage?: {
  inputTokens: number;
  outputTokens: number;
  totalCost?: number;
};
```

### Global Usage

```typescript
type UsageStatus = {
  inputTokens: number;
  outputTokens: number;
  totalCost?: number;
  periodStart?: string;
  periodEnd?: string;
  sessions?: number; // Number of active sessions
};

const usage = await client.usageStatus();
```

### Cost Breakdown

```typescript
type UsageCost = {
  totalCost: number;
  breakdown?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  periodStart?: string;
  periodEnd?: string;
};

const cost = await client.usageCost({
  periodStart: "2026-02-01T00:00:00Z",
  periodEnd: "2026-02-16T00:00:00Z",
});
```

### Chat History

Full conversation history for a session:

```typescript
type ChatHistoryEntry = {
  runId: string;
  sessionKey: string;
  messages: ChatMessage[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
  };
  startedAt: string;
  completedAt?: string;
};

const history = await client.chatHistory("main");
```

RPC method: `chat.history` with `{ sessionKey }`

## Session Concurrency

The `maxConcurrentTasks` setting on the gateway connection controls how many sessions can process messages simultaneously:

```typescript
// In the openclawConnection schema:
maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
```

This is a gateway-level limit, not per-session. Individual session concurrency is governed by the session's `queueMode`.
