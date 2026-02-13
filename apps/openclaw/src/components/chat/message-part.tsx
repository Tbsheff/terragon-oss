import { memo } from "react";
import type { AllToolParts, UIPart, UIImagePart } from "@/lib/types";
import { TextPart } from "./text-part";
import { ImagePart } from "./image-part";
import { ToolPart } from "./tool-part";
import { ThinkingPart } from "./thinking-part";
import { useThread } from "./thread-context";

interface MessagePartProps {
  part: UIPart;
  onClick?: () => void;
  isLatest?: boolean;
}

export const MessagePart = memo(function MessagePart({
  part,
  onClick,
  isLatest = false,
}: MessagePartProps) {
  const { thread } = useThread();
  const githubRepoFullName = thread?.githubRepoFullName ?? undefined;

  switch (part.type) {
    case "text": {
      return (
        <TextPart text={part.text} githubRepoFullName={githubRepoFullName} />
      );
    }
    case "thinking": {
      return <ThinkingPart thinking={part.thinking} isLatest={isLatest} />;
    }
    case "tool": {
      const toolPart = part as AllToolParts;
      return <ToolPart toolPart={toolPart} />;
    }
    case "image": {
      const imagePart = part as UIImagePart;
      return <ImagePart imageUrl={imagePart.image_url} onClick={onClick} />;
    }
    case "rich-text": {
      // Simplified: render rich-text nodes as plain text
      const nodes = part.nodes;
      return (
        <div className="prose prose-sm max-w-none">
          {nodes.map((node, i) => (
            <span key={i}>{node.text}</span>
          ))}
        </div>
      );
    }
    case "pdf": {
      return (
        <div className="text-sm text-muted-foreground">
          [PDF: {part.filename || "document"}]
        </div>
      );
    }
    case "text-file": {
      return (
        <div className="text-sm text-muted-foreground">
          [File: {part.filename || "file"}]
        </div>
      );
    }
    default:
      return null;
  }
});
