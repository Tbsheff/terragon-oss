"use client";

import { Copy, GitFork, Pencil, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UIMessage } from "@/lib/types";

type MessageToolbarProps = {
  message: UIMessage;
  messageIndex: number;
  isAgentWorking: boolean;
  onFork?: (messageIndex: number) => void;
  onEditResend?: (messageIndex: number) => void;
};

export function MessageToolbar({
  message,
  messageIndex,
  isAgentWorking,
  onFork,
  onEditResend,
}: MessageToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const textContent = extractTextContent(message);
    if (!textContent) return;
    navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message]);

  const showFork = message.role === "agent" && !isAgentWorking && onFork;
  const showEdit = message.role === "user" && !isAgentWorking && onEditResend;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity",
        {
          "justify-start": message.role === "agent",
          "justify-end": message.role === "user",
        },
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy message"}
            title={copied ? "Copied" : "Copy message"}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>

      {showFork && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
              onClick={() => onFork(messageIndex)}
              aria-label="Fork from here"
              title="Fork from here"
            >
              <GitFork className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Fork from here</TooltipContent>
        </Tooltip>
      )}

      {showEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
              onClick={() => onEditResend(messageIndex)}
              aria-label="Edit and resend"
              title="Edit & resend"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Edit &amp; resend</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function extractTextContent(message: UIMessage): string {
  if (message.role === "system") return "";
  return message.parts
    .map((p) => {
      if (p.type === "text") return p.text;
      if (p.type === "thinking" && "thinking" in p) return p.thinking;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
