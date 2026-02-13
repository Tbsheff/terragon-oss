"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="border-t border-border p-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
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
            "focus:outline-none disabled:opacity-50",
            "min-h-[36px] max-h-[200px] py-2 px-1",
          )}
        />

        {isWorking ? (
          <button
            onClick={onStop}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            title="Stop agent"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              message.trim() && !disabled
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        {isWorking
          ? "Agent is working... Press stop to abort."
          : "Enter to send, Shift+Enter for new line"}
      </p>
    </div>
  );
}
