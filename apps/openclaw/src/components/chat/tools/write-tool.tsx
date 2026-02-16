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

export function WriteTool({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Write" }>;
}) {
  return (
    <GenericToolPart
      toolName="Write"
      toolArg={formatToolParameters(toolPart.parameters, {
        keyOrder: ["file_path"],
        excludeKeys: ["content"],
      })}
      toolStatus={toolPart.status}
    >
      <WriteToolContent toolPart={toolPart} />
    </GenericToolPart>
  );
}

function WriteToolContent({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Write" }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const openFile = useOpenFile();

  const handleOpenInPanel = () => {
    if (toolPart.status !== "completed") return;
    openFile({
      path: toolPart.parameters.file_path,
      content: toolPart.parameters.content,
      language: detectLanguage(toolPart.parameters.file_path),
    });
  };

  if (toolPart.status === "pending") {
    return (
      <GenericToolPartContentOneLine toolStatus="pending">
        Writing...
      </GenericToolPartContentOneLine>
    );
  }
  if (toolPart.status === "error") {
    return (
      <GenericToolPartContentResultWithLines
        lines={toolPart.result.split("\n")}
        toolStatus="error"
      />
    );
  }
  return (
    <GenericToolPartContent toolStatus={toolPart.status}>
      <GenericToolPartContentRow index={0}>
        <span>
          Wrote{" "}
          <span className="font-semibold">
            {toolPart.parameters.content.split("\n").length}
          </span>{" "}
          lines{" "}
          <GenericToolPartClickToExpand
            label={expanded ? "Hide lines" : "Show lines"}
            onClick={() => setExpanded((x) => !x)}
          />{" "}
          <GenericToolPartClickToExpand
            label="Open"
            onClick={handleOpenInPanel}
          />
        </span>
      </GenericToolPartContentRow>
      {expanded && (
        <GenericToolPartContentRow index={1} className="pr-2">
          <pre className="max-h-[350px] overflow-auto text-xs whitespace-pre-wrap border border-border rounded-md p-2">
            {toolPart.parameters.content}
          </pre>
        </GenericToolPartContentRow>
      )}
    </GenericToolPartContent>
  );
}
