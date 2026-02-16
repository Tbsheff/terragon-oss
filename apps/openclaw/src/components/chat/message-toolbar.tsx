"use client";

import { Copy, GitFork, Pencil, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>

      {showFork && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onFork(messageIndex)}
            >
              <GitFork className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fork from here</TooltipContent>
        </Tooltip>
      )}

      {showEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEditResend(messageIndex)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
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
