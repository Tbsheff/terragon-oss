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
import { useOpenDiff } from "@/hooks/use-file-panel";

export function EditTool({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Edit" }>;
}) {
  return (
    <GenericToolPart
      toolName="Update"
      toolArg={formatToolParameters(toolPart.parameters, {
        keyOrder: ["file_path"],
        excludeKeys: ["old_string", "new_string", "expected_replacements"],
      })}
      toolStatus={toolPart.status}
    >
      <ToolPartEditResult toolPart={toolPart} />
    </GenericToolPart>
  );
}

function ToolPartEditResult({
  toolPart,
}: {
  toolPart: Extract<AllToolParts, { name: "Edit" }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const openDiff = useOpenDiff();

  const handleOpenDiff = () => {
    if (toolPart.status !== "completed") return;
    openDiff({
      path: toolPart.parameters.file_path,
      oldString: toolPart.parameters.old_string,
      newString: toolPart.parameters.new_string,
    });
  };

  if (toolPart.status === "pending") {
    return (
      <GenericToolPartContentOneLine toolStatus="pending">
        Editing...
      </GenericToolPartContentOneLine>
    );
  }
  if (toolPart.status === "error") {
    return (
      <GenericToolPartContentResultWithLines
        toolStatus="error"
        lines={toolPart.result?.split("\n") ?? []}
      />
    );
  }
  return (
    <GenericToolPartContent toolStatus={toolPart.status}>
      <GenericToolPartContentRow index={0}>
        <span>
          <span className="font-semibold">
            <span className="text-green-700">
              +{toolPart.parameters.new_string.split("\n").length}
            </span>{" "}
            <span className="text-red-700">
              -{toolPart.parameters.old_string.split("\n").length}
            </span>
          </span>{" "}
          <GenericToolPartClickToExpand
            label={expanded ? "Hide diff" : "Show diff"}
            onClick={() => setExpanded((x) => !x)}
          />{" "}
          <GenericToolPartClickToExpand label="Open" onClick={handleOpenDiff} />
        </span>
      </GenericToolPartContentRow>
      {expanded && (
        <GenericToolPartContentRow index={1} className="pr-2">
          <pre className="max-h-[350px] overflow-auto text-xs whitespace-pre-wrap border border-border rounded-md p-2">
            <div className="text-red-700">
              {toolPart.parameters.old_string.split("\n").map((line, i) => (
                <div key={`old-${i}`}>- {line}</div>
              ))}
            </div>
            <div className="text-green-700">
              {toolPart.parameters.new_string.split("\n").map((line, i) => (
                <div key={`new-${i}`}>+ {line}</div>
              ))}
            </div>
          </pre>
        </GenericToolPartContentRow>
      )}
    </GenericToolPartContent>
  );
}
