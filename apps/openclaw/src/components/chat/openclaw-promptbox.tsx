"use client";

import { useState, useCallback, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { PlusIcon } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { SlashCommandPopover } from "./slash-command-popover";
import { AgentModelSelector } from "./agent-model-selector";
import { ContextInjectionDialog } from "./context-injection-dialog";
import {
  parseSlashCommand,
  executeSlashCommand,
  type SlashCommandDef,
  type SlashCommandContext,
} from "@/lib/slash-commands";

type OpenClawPromptBoxProps = {
  onSend: (message: string) => void;
  onStop: () => void;
  isWorking: boolean;
  disabled?: boolean;
  placeholder?: string;
  slashCommandContext?: SlashCommandContext;
  currentModel?: string;
  onModelChange?: (model: string) => void;
};

export function OpenClawPromptBox({
  onSend,
  onStop,
  isWorking,
  disabled = false,
  placeholder = "Describe the task...",
  slashCommandContext,
  currentModel = "claude-sonnet-4-5-20250929",
  onModelChange,
}: OpenClawPromptBoxProps) {
  const [input, setInput] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showInjectDialog, setShowInjectDialog] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track slash command state from input changes
  const handleInputChange = useCallback((value: string) => {
    setInput(value);

    if (value.startsWith("/")) {
      const afterSlash = value.slice(1).split(" ")[0] ?? "";
      // Only show menu if no space yet (still typing command name)
      if (!value.includes(" ") || value.indexOf(" ") > value.length - 1) {
        setSlashFilter(afterSlash);
        setShowSlashMenu(true);
      } else {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
    }
  }, []);

  const handleSlashSelect = useCallback(
    (cmd: SlashCommandDef) => {
      setShowSlashMenu(false);

      if (cmd.immediate && slashCommandContext) {
        // Execute immediately
        setInput("");
        executeSlashCommand(
          { name: cmd.name, args: "" },
          slashCommandContext,
        ).then((result) => {
          if (result) {
            setLocalMessage(result);
            // Auto-clear after 5s
            setTimeout(() => setLocalMessage(null), 5000);
          }
        });
      } else {
        // Replace input with command + space for args
        setInput(`/${cmd.name} `);
        textareaRef.current?.focus();
      }
    },
    [slashCommandContext],
  );

  const handleSubmit = useCallback(
    async (msg: { text: string }, _e: FormEvent<HTMLFormElement>) => {
      const trimmed = msg.text.trim();
      if (!trimmed || disabled) return;

      // Check for slash command
      const parsed = parseSlashCommand(trimmed);
      if (parsed && slashCommandContext) {
        setInput("");
        setShowSlashMenu(false);
        const result = await executeSlashCommand(parsed, slashCommandContext);
        if (result) {
          setLocalMessage(result);
          setTimeout(() => setLocalMessage(null), 5000);
        }
        return;
      }

      setInput("");
      onSend(trimmed);
    },
    [disabled, onSend, slashCommandContext],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSlashMenu && e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }

      if (showSlashMenu && e.key === "Tab") {
        // Let cmdk handle Tab for selection — prevent default tab behavior
        e.preventDefault();
      }
    },
    [showSlashMenu],
  );

  const handleInject = useCallback(
    async (content: string, role: "system" | "user") => {
      if (slashCommandContext) {
        await slashCommandContext.onInject(content, role);
      }
    },
    [slashCommandContext],
  );

  const status = isWorking ? "streaming" : "ready";

  return (
    <div className="shrink-0 border-t border-border/50 bg-card/80 backdrop-blur-sm p-4">
      <div className="relative">
        {showSlashMenu && (
          <SlashCommandPopover
            filter={slashFilter}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        )}

        <PromptInput
          onSubmit={handleSubmit}
          className="rounded-lg border border-border/50 bg-card shadow-sm transition-shadow duration-200 focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10"
        >
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={placeholder}
            disabled={disabled || isWorking}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <PromptInputFooter>
            <div className="flex items-center gap-1">
              <AgentModelSelector
                currentModel={currentModel}
                onModelChange={onModelChange ?? (() => {})}
                disabled={disabled || isWorking}
              />
              {slashCommandContext && (
                <PromptInputButton
                  tooltip="Inject context"
                  onClick={() => setShowInjectDialog(true)}
                >
                  <PlusIcon className="size-4" />
                </PromptInputButton>
              )}
            </div>
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              disabled={disabled}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>

      {/* Local message display (e.g. /help output) */}
      {localMessage && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border/50 bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {localMessage}
        </pre>
      )}

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
              /
            </kbd>
            {" for commands"}
          </span>
        )}
      </div>

      {slashCommandContext && (
        <ContextInjectionDialog
          open={showInjectDialog}
          onOpenChange={setShowInjectDialog}
          onInject={handleInject}
        />
      )}
    </div>
  );
}
