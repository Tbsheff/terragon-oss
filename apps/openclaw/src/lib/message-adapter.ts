/**
 * Message Adapter Layer
 *
 * Bridges OpenClaw chat events into DBMessage[] format that toUIMessages() expects.
 * This is the critical transform that enables reusing Terragon's entire rendering layer.
 *
 * Pipeline: OpenClaw events → openClawToDBMessages() → DBMessage[] → toUIMessages() → UIMessage[]
 */

import type {
  ChatContentBlock,
  ChatEventPayload,
  ChatHistoryEntry,
  ChatMessage,
} from "./openclaw-types";

// ─────────────────────────────────────────────────
// DBMessage types (mirrored from @terragon/shared)
// Defined locally to avoid PG dependency
// ─────────────────────────────────────────────────

export type DBTextPart = { type: "text"; text: string };
export type DBThinkingPart = { type: "thinking"; thinking: string };
export type DBImagePart = {
  type: "image";
  mime_type: string;
  image_url: string;
};

export type DBUserMessage = {
  type: "user";
  model: string | null;
  parts: DBTextPart[];
  timestamp?: string;
};

export type DBAgentMessage = {
  type: "agent";
  parent_tool_use_id: string | null;
  parts: (DBTextPart | DBThinkingPart)[];
};

export type DBToolCall = {
  type: "tool-call";
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  parent_tool_use_id: string | null;
};

export type DBToolResult = {
  type: "tool-result";
  id: string;
  is_error: boolean | null;
  parent_tool_use_id: string | null;
  result: string;
};

export type DBStopMessage = { type: "stop" };

export type DBErrorMessage = {
  type: "error";
  error_type?: string;
  error_info?: string;
  timestamp?: string;
};

export type DBResultMetaMessage = {
  type: "meta";
  subtype: "result-success" | "result-error-max-turns" | "result-error";
  cost_usd: number;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result?: string;
  session_id: string;
};

export type DBMessage =
  | DBUserMessage
  | DBAgentMessage
  | DBToolCall
  | DBToolResult
  | DBStopMessage
  | DBErrorMessage
  | DBResultMetaMessage;

// ─────────────────────────────────────────────────
// Tool Name Normalization
// Pi agent uses lowercase tool names → map to Terragon renderer names
// ─────────────────────────────────────────────────

const TOOL_NAME_MAP: Record<string, string> = {
  // Pi tool names → Terragon tool names
  exec: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  multi_edit: "MultiEdit",
  glob: "Glob",
  grep: "Grep",
  ls: "LS",
  bash: "Bash",
  web_search: "WebSearch",
  web_fetch: "WebFetch",
  notebook_read: "NotebookRead",
  notebook_edit: "NotebookEdit",
  todo_read: "TodoRead",
  todo_write: "TodoWrite",
  // Pass through already-normalized names
  Bash: "Bash",
  Read: "Read",
  Write: "Write",
  Edit: "Edit",
  MultiEdit: "MultiEdit",
  Glob: "Glob",
  Grep: "Grep",
  LS: "LS",
  WebSearch: "WebSearch",
  WebFetch: "WebFetch",
};

function normalizeToolName(name: string): string {
  return TOOL_NAME_MAP[name] ?? name;
}

/**
 * Normalize tool parameters to match what Terragon renderers expect.
 * Pi uses slightly different param names for some tools.
 */
function normalizeToolParams(
  name: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = normalizeToolName(name);

  switch (normalized) {
    case "Bash":
      // Pi uses "command" which matches Terragon
      return {
        command: input["command"] ?? input["cmd"] ?? "",
        description: input["description"] ?? undefined,
        timeout: input["timeout"] ?? undefined,
      };
    case "Read":
      return {
        file_path: input["file_path"] ?? input["path"] ?? "",
        limit: input["limit"] ?? undefined,
        offset: input["offset"] ?? undefined,
      };
    case "Write":
      return {
        file_path: input["file_path"] ?? input["path"] ?? "",
        content: input["content"] ?? "",
      };
    case "Edit":
      return {
        file_path: input["file_path"] ?? input["path"] ?? "",
        old_string: input["old_string"] ?? input["old"] ?? "",
        new_string: input["new_string"] ?? input["new"] ?? "",
        replace_all: input["replace_all"] ?? false,
      };
    case "Glob":
      return {
        pattern: input["pattern"] ?? "",
        path: input["path"] ?? undefined,
      };
    case "Grep":
      return {
        pattern: input["pattern"] ?? "",
        path: input["path"] ?? undefined,
        include: input["include"] ?? undefined,
      };
    default:
      return input;
  }
}

// ─────────────────────────────────────────────────
// Core Adapter: OpenClaw chat messages → DBMessage[]
// ─────────────────────────────────────────────────

/**
 * Convert a single OpenClaw ChatMessage (from history or streaming) into DBMessage[].
 * A single ChatMessage may produce multiple DBMessages because tool_use and tool_result
 * are flattened into separate entries.
 */
function chatMessageToDBMessages(msg: ChatMessage): DBMessage[] {
  const result: DBMessage[] = [];

  if (msg.role === "user") {
    const textParts: DBTextPart[] = [];
    for (const block of msg.content) {
      if (block.type === "text") {
        textParts.push({ type: "text", text: block.text });
      }
    }
    if (textParts.length > 0) {
      result.push({
        type: "user",
        model: null,
        parts: textParts,
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  }

  // Assistant message — process each content block
  const agentParts: (DBTextPart | DBThinkingPart)[] = [];

  for (const block of msg.content) {
    switch (block.type) {
      case "text":
        // Flush accumulated agent parts before tool blocks
        if (agentParts.length > 0) {
          // Don't flush yet — text parts are part of the agent message
        }
        agentParts.push({ type: "text", text: block.text });
        break;

      case "thinking":
        agentParts.push({ type: "thinking", thinking: block.thinking });
        break;

      case "tool_use": {
        // Flush any accumulated text/thinking parts as an agent message
        if (agentParts.length > 0) {
          result.push({
            type: "agent",
            parent_tool_use_id: null,
            parts: [...agentParts],
          });
          agentParts.length = 0;
        }

        result.push({
          type: "tool-call",
          id: block.id,
          name: normalizeToolName(block.name),
          parameters: normalizeToolParams(block.name, block.input),
          parent_tool_use_id: null,
        });
        break;
      }

      case "tool_result": {
        result.push({
          type: "tool-result",
          id: block.tool_use_id,
          is_error: block.is_error ?? false,
          parent_tool_use_id: null,
          result:
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content),
        });
        break;
      }
    }
  }

  // Flush remaining agent parts
  if (agentParts.length > 0) {
    result.push({
      type: "agent",
      parent_tool_use_id: null,
      parts: agentParts,
    });
  }

  return result;
}

/**
 * Convert a full OpenClaw chat history (array of messages) into DBMessage[].
 * This is the main entry point for loading existing conversation history.
 */
export function openClawHistoryToDBMessages(
  history: ChatHistoryEntry[],
): DBMessage[] {
  const result: DBMessage[] = [];

  for (const entry of history) {
    for (const msg of entry.messages) {
      result.push(...chatMessageToDBMessages(msg));
    }

    // Add a result meta message at the end of each completed run
    if (entry.completedAt) {
      result.push({
        type: "meta",
        subtype: "result-success",
        cost_usd: entry.usage?.totalCost ?? 0,
        duration_ms: entry.completedAt
          ? new Date(entry.completedAt).getTime() -
            new Date(entry.startedAt).getTime()
          : 0,
        duration_api_ms: 0,
        is_error: false,
        num_turns: entry.messages.length,
        session_id: entry.sessionKey,
      });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────
// Streaming Adapter: process individual chat events
// ─────────────────────────────────────────────────

/**
 * Accumulates streaming deltas into complete messages.
 * Create one per session/thread to track state across events.
 */
export class StreamingMessageAccumulator {
  private currentContent: ChatContentBlock[] = [];
  private currentRunId: string | null = null;

  /**
   * Process a streaming chat event and return any new DBMessages to append.
   * Returns empty array for delta events (accumulates internally),
   * returns complete messages for final/aborted/error events.
   */
  processEvent(payload: ChatEventPayload): DBMessage[] {
    const { runId, state, message, error } = payload;

    // New run — reset accumulator
    if (runId !== this.currentRunId) {
      this.currentContent = [];
      this.currentRunId = runId;
    }

    switch (state) {
      case "delta": {
        // Accumulate content blocks from delta
        if (message?.content) {
          for (const block of message.content) {
            this.mergeContentBlock(block);
          }
        }
        // Return newly completed tool results and tool calls
        return this.extractCompletedBlocks();
      }

      case "final": {
        // Final message — convert all accumulated content
        const finalMessage: ChatMessage = {
          role: "assistant",
          content: message?.content ?? this.currentContent,
        };
        const dbMessages = chatMessageToDBMessages(finalMessage);

        // Add stop message
        dbMessages.push({ type: "stop" });

        // Reset accumulator
        this.currentContent = [];
        this.currentRunId = null;

        return dbMessages;
      }

      case "aborted": {
        const dbMessages: DBMessage[] = [];
        // Flush any accumulated content
        if (this.currentContent.length > 0) {
          dbMessages.push(
            ...chatMessageToDBMessages({
              role: "assistant",
              content: this.currentContent,
            }),
          );
        }
        dbMessages.push({ type: "stop" });
        this.currentContent = [];
        this.currentRunId = null;
        return dbMessages;
      }

      case "error": {
        const dbMessages: DBMessage[] = [];
        dbMessages.push({
          type: "error",
          error_type: error?.code ?? "unknown",
          error_info: error?.message ?? "Unknown error",
          timestamp: new Date().toISOString(),
        });
        this.currentContent = [];
        this.currentRunId = null;
        return dbMessages;
      }

      default:
        return [];
    }
  }

  /**
   * Merge a streaming content block into the accumulator.
   * For text/thinking, appends to the last block of the same type.
   * For tool_use/tool_result, adds as new blocks.
   */
  private mergeContentBlock(block: ChatContentBlock): void {
    const last = this.currentContent[this.currentContent.length - 1];

    if (block.type === "text" && last?.type === "text") {
      // Append text to existing text block
      (last as { type: "text"; text: string }).text += block.text;
    } else if (block.type === "thinking" && last?.type === "thinking") {
      // Append thinking to existing thinking block
      (last as { type: "thinking"; thinking: string }).thinking +=
        block.thinking;
    } else {
      // New block type or new tool — push as new entry
      this.currentContent.push({ ...block });
    }
  }

  /**
   * Extract any tool_result blocks that are new since the last extraction.
   * This enables incremental rendering of tool results during streaming.
   */
  private extractCompletedBlocks(): DBMessage[] {
    // During streaming deltas, we return incremental text/thinking updates
    // so the UI can show streaming text
    const result: DBMessage[] = [];
    // For now, we don't emit anything during deltas — we wait for final
    // This keeps the accumulator simple and avoids duplicate rendering
    return result;
  }

  /** Reset accumulator state */
  reset(): void {
    this.currentContent = [];
    this.currentRunId = null;
  }
}
