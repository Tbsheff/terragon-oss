"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type OpenClawPromptBoxProps = {
  onSend: (message: string) => void;
  onStop: () => void;
  isWorking: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function OpenClawPromptBox({
  onSend,
  onStop,
  isWorking,
  disabled = false,
  placeholder = "Describe the task...",
}: OpenClawPromptBoxProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isWorking) return;
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  };

  return (
    <div className="border-t border-border/70 bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 shadow-sm transition-shadow duration-200 focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isWorking}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[36px] max-h-[200px] py-2 px-1",
          )}
        />

        {isWorking ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={onStop}
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop agent</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-8 w-8"
                disabled={!message.trim() || disabled}
                onClick={handleSend}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
        {isWorking ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Agent is working...
          </span>
        ) : (
          <span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
              Enter
            </kbd>
            {" to send, "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
              Shift+Enter
            </kbd>
            {" for new line"}
          </span>
        )}
      </div>
    </div>
  );
}
