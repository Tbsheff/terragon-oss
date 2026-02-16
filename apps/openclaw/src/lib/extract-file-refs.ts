import type { UIMessage, UIPart, AllToolParts } from "@/lib/types";
import { formatReadResult } from "@/components/chat/tools/read-tool";

/**
 * Walk UIMessage[] and extract file paths + latest content from
 * Read, Write, and Edit tool results.
 * Returns Map<path, latestContent>.
 */
export function extractFileRefs(messages: UIMessage[]): Map<string, string> {
  const fileMap = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role !== "agent") continue;

    for (const part of msg.parts) {
      extractFromPart(part, fileMap);
    }
  }

  return fileMap;
}

function extractFromPart(part: UIPart, fileMap: Map<string, string>) {
  if (part.type !== "tool") return;

  const toolPart = part as AllToolParts;

  // Only process completed (non-error) tool results
  if (toolPart.status !== "completed") return;

  switch (toolPart.name) {
    case "Read": {
      const params = toolPart.parameters as { file_path: string };
      const content = formatReadResult(toolPart.result);
      fileMap.set(params.file_path, content);
      break;
    }
    case "Write": {
      const params = toolPart.parameters as {
        file_path: string;
        content: string;
      };
      fileMap.set(params.file_path, params.content);
      break;
    }
    case "Edit": {
      const params = toolPart.parameters as {
        file_path: string;
        old_string: string;
        new_string: string;
      };
      // If we already have content for this file, apply the edit
      const existing = fileMap.get(params.file_path);
      if (existing) {
        fileMap.set(
          params.file_path,
          existing.replace(params.old_string, params.new_string),
        );
      }
      break;
    }
    case "MultiEdit": {
      const params = toolPart.parameters as {
        file_path: string;
        edits: Array<{ old_string: string; new_string: string }>;
      };
      let existing = fileMap.get(params.file_path);
      if (existing) {
        for (const edit of params.edits) {
          existing = existing.replace(edit.old_string, edit.new_string);
        }
        fileMap.set(params.file_path, existing);
      }
      break;
    }
  }

  // Recurse into nested tool parts
  if ("parts" in toolPart && Array.isArray(toolPart.parts)) {
    for (const nested of toolPart.parts) {
      extractFromPart(nested, fileMap);
    }
  }
}
