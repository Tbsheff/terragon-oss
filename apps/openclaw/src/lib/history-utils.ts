import type {
  ChatHistoryEntry,
  ChatMessage,
  ChatContentBlock,
} from "./openclaw-types";

/**
 * Compact chat history up to (and including) a given message index into a
 * single text block suitable for injecting as fork context.
 *
 * The message index is a flat index across all messages in all history entries.
 */
export function compactHistoryUpTo(
  history: ChatHistoryEntry[],
  messageIndex: number,
): string {
  const lines: string[] = ["## Conversation Context (forked)", ""];

  let idx = 0;
  for (const entry of history) {
    for (const msg of entry.messages) {
      if (idx > messageIndex) break;
      lines.push(formatMessage(msg));
      idx++;
    }
    if (idx > messageIndex) break;
  }

  return lines.join("\n");
}

function formatMessage(msg: ChatMessage): string {
  const role = msg.role === "user" ? "User" : "Assistant";
  const parts = msg.content.map(formatBlock).filter(Boolean);
  return `**${role}**: ${parts.join(" ")}`;
}

function formatBlock(block: ChatContentBlock): string {
  switch (block.type) {
    case "text":
      return block.text.trim();
    case "thinking":
      return "";
    case "tool_use":
      return `[tool: ${block.name}(${summarizeInput(block.input)})]`;
    case "tool_result":
      return block.is_error
        ? `[tool error: ${truncate(block.content, 120)}]`
        : `[tool result: ${truncate(block.content, 120)}]`;
  }
}

function summarizeInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return "";
  // Show first key=value pair, truncated
  const [key, val] = entries[0]!;
  const valStr = typeof val === "string" ? val : JSON.stringify(val);
  return `${key}=${truncate(valStr, 80)}${entries.length > 1 ? ", ..." : ""}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
