import React, { useState } from "react";
import type { AllToolParts } from "@/lib/types";
import {
  GenericToolPart,
  GenericToolPartContent,
  GenericToolPartContentRow,
  GenericToolPartClickToExpand,
  GenericToolPartContentOneLine,
  GenericToolPartContentResultWithLines,
} from "./generic-ui";
import { formatToolParameters } from "./utils";
import { useOpenFile } from "@/hooks/use-file-panel";
import { detectLanguage } from "@/lib/language-detect";

export function ReadTool({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Read" }>;
}) {
  return (
    <GenericToolPart
      toolName="Read"
      toolArg={formatToolParameters(toolPart.parameters, {
        keyOrder: ["file_path", "offset", "limit"],
      })}
      toolStatus={toolPart.status}
    >
      <ReadToolContent toolPart={toolPart} />
    </GenericToolPart>
  );
}

function stripSystemReminder(content: string): string {
  const systemReminderPattern =
    /\n<system-reminder>[\s\S]*?<\/system-reminder>\s*$/;
  return content.replace(systemReminderPattern, "");
}

export function formatReadResult(result: string) {
  const strippedResult = stripSystemReminder(result);
  const lines = strippedResult.split("\n");
  let allMatch = true;
  const formattedLines = lines.map((line) => {
    const match = line.match(/^\s*(?:(?:\d+\t)|(?:\d+→\t?))(.*)$/);
    if (match) {
      return match[1];
    }
    allMatch = false;
    return line;
  });
  if (allMatch) {
    return formattedLines.join("\n");
  }
  return strippedResult;
}

function ReadToolContent({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Read" }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const openFile = useOpenFile();

  const handleOpenInPanel = () => {
    if (toolPart.status !== "completed") return;
    const content = formatReadResult(toolPart.result);
    openFile({
      path: toolPart.parameters.file_path,
      content,
      language: detectLanguage(toolPart.parameters.file_path),
    });
  };

  if (toolPart.status === "pending") {
    return (
      <GenericToolPartContentOneLine toolStatus="pending">
        Reading...
      </GenericToolPartContentOneLine>
    );
  }
  if (toolPart.status === "error") {
    return (
      <GenericToolPartContentResultWithLines
        lines={stripSystemReminder(toolPart.result).split("\n")}
        toolStatus="error"
      />
    );
  }
  const formattedResult = formatReadResult(toolPart.result);
  return (
    <GenericToolPartContent toolStatus={toolPart.status}>
      <GenericToolPartContentRow index={0}>
        <span>
          Read{" "}
          <span className="font-semibold">
            {formattedResult.split("\n").length}
          </span>{" "}
          lines
        </span>{" "}
        <GenericToolPartClickToExpand
          label={expanded ? "Hide lines" : "Show lines"}
          onClick={() => setExpanded((x) => !x)}
        />{" "}
        <GenericToolPartClickToExpand
          label="Open"
          onClick={handleOpenInPanel}
        />
      </GenericToolPartContentRow>
      {expanded && (
        <GenericToolPartContentRow index={1} className="pr-2">
          <pre className="max-h-[350px] overflow-auto text-xs whitespace-pre-wrap border border-border rounded-md p-2">
            {formattedResult}
          </pre>
        </GenericToolPartContentRow>
      )}
    </GenericToolPartContent>
  );
}
