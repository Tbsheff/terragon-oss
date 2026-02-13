"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Terminal, Eye, Keyboard, X, Maximize2, Minimize2 } from "lucide-react";

type TerminalPanelProps = {
  sessionKey: string;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Live terminal panel for observing agent output or interacting with the Mac Mini workspace.
 *
 * Two modes:
 * - Observe (default): read-only view of agent's terminal output in real-time
 * - Interactive: full terminal connected to the Mac Mini workspace (explicit safety toggle)
 */
export function TerminalPanel({
  sessionKey,
  isOpen,
  onClose,
}: TerminalPanelProps) {
  const [mode, setMode] = useState<"observe" | "interactive">("observe");
  const [isExpanded, setIsExpanded] = useState(false);
  const [lines, setLines] = useState<string[]>([
    "$ Connected to OpenClaw session: " + sessionKey,
    "Waiting for agent output...",
  ]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const handleInteractiveToggle = useCallback(() => {
    if (mode === "observe") {
      // Show confirmation before enabling interactive mode
      const confirmed = window.confirm(
        "Enable interactive terminal? The Mac Mini is not sandboxed — " +
          "typing simultaneously with the agent can cause state corruption.",
      );
      if (confirmed) {
        setMode("interactive");
        setLines((prev) => [...prev, "--- Interactive mode enabled ---"]);
      }
    } else {
      setMode("observe");
      setLines((prev) => [...prev, "--- Switched to observe mode ---"]);
    }
  }, [mode]);

  const handleSendInput = useCallback(() => {
    if (!inputValue.trim() || mode !== "interactive") return;
    setLines((prev) => [...prev, `$ ${inputValue}`]);
    // In a real implementation, this would send the input to the OpenClaw
    // gateway via the exec tool or PTY session
    setInputValue("");
  }, [inputValue, mode]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border bg-[#0d0d14] transition-all",
        isExpanded ? "h-[60%]" : "h-64",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Terminal
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              mode === "observe"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-amber-500/10 text-amber-400",
            )}
          >
            {mode === "observe" ? "Observe" : "Interactive"}
          </span>
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
            title={
              mode === "observe"
                ? "Enable interactive mode"
                : "Switch to observe mode"
            }
          >
            {mode === "observe" ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <Keyboard className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.startsWith("$")
                ? "text-emerald-400"
                : line.startsWith("---")
                  ? "text-amber-400/60"
                  : "text-muted-foreground/80",
            )}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Interactive input */}
      {mode === "interactive" && (
        <div className="flex items-center border-t border-border/50 px-3 py-1.5">
          <span className="text-xs text-emerald-400 font-mono mr-2">$</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendInput()}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
