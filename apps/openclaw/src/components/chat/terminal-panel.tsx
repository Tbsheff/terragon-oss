"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Terminal, Eye, Keyboard, X, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import type { ChatEventPayload } from "@/lib/openclaw-types";
import {
  XtermTerminal,
  type XtermTerminalHandle,
} from "@/components/terminal/xterm-terminal";
import "@/styles/xterm-override.css";

type TerminalPanelProps = {
  sessionKey: string;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * ANSI color helpers for terminal output formatting.
 */
const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
} as const;

function isBashTool(name: string): boolean {
  return name === "Bash" || name === "bash" || name === "exec";
}

/**
 * Live terminal panel for observing agent output or interacting with the workspace.
 *
 * Two modes:
 * - Observe (default): read-only xterm view of agent's Bash tool output in real-time
 * - Interactive: sends commands via chat.inject, shows response when it arrives
 */
export function TerminalPanel({
  sessionKey,
  isOpen,
  onClose,
}: TerminalPanelProps) {
  const [mode, setMode] = useState<"observe" | "interactive">("observe");
  const [isExpanded, setIsExpanded] = useState(false);
  const xtermRef = useRef<XtermTerminalHandle>(null);
  const [isReady, setIsReady] = useState(false);
  // Track which tool_use IDs we've already written to prevent duplicates
  const writtenToolIdsRef = useRef(new Set<string>());
  // Buffer for writes that arrive before terminal is ready
  const pendingWritesRef = useRef<string[]>([]);
  // Line buffer for interactive input
  const inputBufferRef = useRef("");

  // Flush pending writes when terminal becomes ready
  useEffect(() => {
    if (isReady && xtermRef.current && pendingWritesRef.current.length > 0) {
      for (const data of pendingWritesRef.current) {
        xtermRef.current.write(data);
      }
      pendingWritesRef.current = [];
    }
  }, [isReady]);

  /**
   * Safe write — buffers if terminal not ready yet.
   */
  const safeWrite = useCallback(
    (data: string) => {
      if (isReady && xtermRef.current) {
        xtermRef.current.write(data);
      } else {
        pendingWritesRef.current.push(data);
      }
    },
    [isReady],
  );

  // Subscribe to realtime chat events for this session to extract Bash output
  useRealtime({
    room: sessionKey,
    enabled: isOpen,
    onMessage: (msg) => {
      if (msg.type !== "thread-update" || !msg.data?.chatEvent) return;

      const chatEvent = msg.data.chatEvent as ChatEventPayload;
      const content = chatEvent.message?.content;
      if (!content) return;

      // Deduplicate and write Bash tool calls/results to xterm
      for (const block of content) {
        if (block.type === "tool_use" && isBashTool(block.name)) {
          if (writtenToolIdsRef.current.has(block.id)) continue;
          writtenToolIdsRef.current.add(block.id);

          const command = (block.input as Record<string, unknown>)[
            "command"
          ] as string | undefined;
          if (command) {
            safeWrite(
              `${ANSI.green}${ANSI.bold}$ ${ANSI.reset}${ANSI.green}${command}${ANSI.reset}\r\n`,
            );
          }
        }

        if (block.type === "tool_result") {
          const matchingToolUse = content.find(
            (b) => b.type === "tool_use" && b.id === block.tool_use_id,
          );
          if (
            matchingToolUse &&
            matchingToolUse.type === "tool_use" &&
            isBashTool(matchingToolUse.name)
          ) {
            if (writtenToolIdsRef.current.has(`result-${block.tool_use_id}`))
              continue;
            writtenToolIdsRef.current.add(`result-${block.tool_use_id}`);

            if (block.content) {
              const lines = block.content.split("\n");
              const color = block.is_error ? ANSI.red : "";
              const reset = block.is_error ? ANSI.reset : "";
              for (const line of lines) {
                safeWrite(`${color}${line}${reset}\r\n`);
              }
            }
          }
        }
      }
    },
  });

  // Write welcome message when terminal first becomes ready
  const hasWrittenWelcomeRef = useRef(false);
  useEffect(() => {
    if (isReady && xtermRef.current && !hasWrittenWelcomeRef.current) {
      hasWrittenWelcomeRef.current = true;
      xtermRef.current.writeMessage(`Connected to session: ${sessionKey}`);
      xtermRef.current.writeMessage(
        mode === "observe"
          ? "Observe mode — watching agent Bash output"
          : "Interactive mode — type commands to send via chat.inject",
      );
      xtermRef.current.write("\r\n");
    }
  }, [isReady, sessionKey, mode]);

  const handleInteractiveToggle = useCallback(() => {
    if (mode === "observe") {
      const confirmed = window.confirm(
        "Enable interactive terminal? Commands are sent via chat.inject — " +
          "typing simultaneously with the agent can cause state corruption.",
      );
      if (confirmed) {
        setMode("interactive");
        if (xtermRef.current) {
          xtermRef.current.writeMessage("--- Interactive mode enabled ---");
          xtermRef.current.write(
            `\r\n${ANSI.green}${ANSI.bold}$ ${ANSI.reset}`,
          );
        }
      }
    } else {
      setMode("observe");
      xtermRef.current?.writeMessage("--- Switched to observe mode ---");
    }
  }, [mode]);

  /**
   * Handle interactive terminal input.
   * Accumulates a line buffer and sends on Enter.
   */
  const handleData = useCallback(
    (data: string) => {
      if (mode !== "interactive") return;

      // Handle special keys
      for (const char of data) {
        if (char === "\r" || char === "\n") {
          // Enter: send the command
          xtermRef.current?.write("\r\n");
          const command = inputBufferRef.current.trim();
          inputBufferRef.current = "";

          if (command) {
            (async () => {
              try {
                const { sendTerminalCommand } = await import(
                  "@/server-actions/terminal"
                );
                const result = await sendTerminalCommand(sessionKey, command);
                if (!result.ok) {
                  xtermRef.current?.write(
                    `${ANSI.red}Error: ${result.error}${ANSI.reset}\r\n`,
                  );
                }
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Failed to send command",
                );
              }
              // Re-print prompt
              xtermRef.current?.write(
                `${ANSI.green}${ANSI.bold}$ ${ANSI.reset}`,
              );
            })();
          } else {
            // Empty enter — just re-print prompt
            xtermRef.current?.write(`${ANSI.green}${ANSI.bold}$ ${ANSI.reset}`);
          }
        } else if (char === "\x7f" || char === "\b") {
          // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            xtermRef.current?.write("\b \b");
          }
        } else if (char === "\x03") {
          // Ctrl-C: clear current input
          inputBufferRef.current = "";
          xtermRef.current?.write("^C\r\n");
          xtermRef.current?.write(`${ANSI.green}${ANSI.bold}$ ${ANSI.reset}`);
        } else if (char >= " ") {
          // Printable character
          inputBufferRef.current += char;
          xtermRef.current?.write(char);
        }
      }
    },
    [mode, sessionKey],
  );

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border/60 bg-sidebar transition-all",
        isExpanded ? "h-[60%]" : "h-64",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="font-[var(--font-cabin)] text-xs font-medium tracking-tight text-muted-foreground">
            Terminal
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "size-2 rounded-full",
                mode === "observe"
                  ? "bg-blue-400 animate-pulse"
                  : "bg-amber-400 animate-pulse",
              )}
            />
            <span className="text-[10px] font-medium text-muted-foreground">
              {mode === "observe" ? "Observe" : "Interactive"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInteractiveToggle}
            className={cn(
              "p-1 rounded-md transition-colors",
              mode === "interactive"
                ? "text-amber-400 hover:bg-amber-500/10"
                : "text-muted-foreground hover:bg-muted",
            )}
            aria-label={
              mode === "observe"
                ? "Enable interactive mode"
                : "Switch to observe mode"
            }
          >
            {mode === "observe" ? (
              <Eye className="size-3.5" />
            ) : (
              <Keyboard className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted-foreground hover:bg-muted rounded-md transition-colors"
            aria-label={isExpanded ? "Collapse terminal" : "Expand terminal"}
          >
            {isExpanded ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:bg-muted rounded-md transition-colors"
            aria-label="Close terminal"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* xterm terminal area */}
      <div className="flex-1 overflow-hidden p-1">
        <XtermTerminal
          ref={xtermRef}
          onData={handleData}
          disabled={mode === "observe"}
          onResize={() => {
            // Mark ready on first resize (means terminal is mounted and sized)
            if (!isReady) setIsReady(true);
          }}
        />
      </div>
    </div>
  );
}
