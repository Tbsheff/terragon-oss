import React, { memo } from "react";
import type { AllToolParts, AIAgent } from "@/lib/types";
import { ReadTool } from "./tools/read-tool";
import { WriteTool } from "./tools/write-tool";
import { EditTool } from "./tools/edit-tool";
import { SearchTool } from "./tools/search-tool";
import { BashTool } from "./tools/bash-tool";
import { DefaultTool } from "./tools/default-tool";
import { Tool, ToolHeader, ToolContent } from "@/components/ai-elements/tool";

/**
 * Simplified normalizeToolCall for OpenClaw.
 * In the full Terragon codebase this maps agent-specific tool names
 * to canonical Claude tool names. Minimal normalization is needed
 * since OpenClaw agents use standard tool names.
 */
function normalizeToolCall<
  T extends { name: string; parameters: Record<string, any>; result?: string },
>(agent: AIAgent, toolCall: T): T {
  if (toolCall.name === "mcp__terry__SuggestFollowupTask") {
    return { ...toolCall, name: "SuggestFollowupTask" };
  }
  return toolCall;
}

function getToolState(toolPart: AllToolParts) {
  if (toolPart.status === "completed") return "output-available" as const;
  if (toolPart.status === "error") return "output-error" as const;
  return "input-available" as const;
}

function renderToolContent(toolPart: AllToolParts) {
  switch (toolPart.name) {
    case "Read":
      return (
        <ReadTool
          toolPart={toolPart as Extract<AllToolParts, { name: "Read" }>}
        />
      );
    case "Write":
      return (
        <WriteTool
          toolPart={toolPart as Extract<AllToolParts, { name: "Write" }>}
        />
      );
    case "Edit":
      if (
        toolPart.parameters &&
        "new_string" in toolPart.parameters &&
        "old_string" in toolPart.parameters
      ) {
        return (
          <EditTool
            toolPart={toolPart as Extract<AllToolParts, { name: "Edit" }>}
          />
        );
      }
      return <DefaultTool toolPart={toolPart} />;
    case "Grep":
    case "Glob":
      return (
        <SearchTool
          toolPart={
            toolPart as Extract<AllToolParts, { name: "Grep" | "Glob" }>
          }
        />
      );
    case "Bash":
      return (
        <BashTool
          toolPart={toolPart as Extract<AllToolParts, { name: "Bash" }>}
        />
      );
    default:
      return <DefaultTool toolPart={toolPart} />;
  }
}

const ToolPart = memo(function ToolPart({
  toolPart,
}: {
  toolPart: AllToolParts;
}) {
  toolPart = normalizeToolCall(toolPart.agent, toolPart);
  const state = getToolState(toolPart);

  return (
    <Tool>
      <ToolHeader
        title={toolPart.name}
        type="dynamic-tool"
        toolName={toolPart.name}
        state={state}
      />
      <ToolContent>{renderToolContent(toolPart)}</ToolContent>
    </Tool>
  );
});

export { ToolPart };
