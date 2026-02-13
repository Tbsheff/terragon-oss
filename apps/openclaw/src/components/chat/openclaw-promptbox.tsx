"use client";

import { useCallback } from "react";
import type { FormEvent } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

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
  const handleSubmit = useCallback(
    (msg: { text: string }, _e: FormEvent<HTMLFormElement>) => {
      const trimmed = msg.text.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
    },
    [disabled, onSend],
  );

  const status = isWorking ? "streaming" : "ready";

  return (
    <div className="shrink-0 border-t border-border/50 bg-card/80 backdrop-blur-sm p-4">
      <PromptInput
        onSubmit={handleSubmit}
        className="rounded-lg border border-border/50 bg-card shadow-sm transition-shadow duration-200 focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          disabled={disabled || isWorking}
        />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit
            status={status}
            onStop={onStop}
            disabled={disabled}
          />
        </PromptInputFooter>
      </PromptInput>

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
