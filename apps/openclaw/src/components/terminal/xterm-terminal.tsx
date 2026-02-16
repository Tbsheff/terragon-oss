"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { useTheme } from "next-themes";
import { DARK_THEME, LIGHT_THEME } from "./terminal-theme";

export type XtermTerminalHandle = {
  write: (data: string) => void;
  writeln: (data: string) => void;
  writeMessage: (data: string) => void;
  clear: () => void;
  focus: () => void;
  blur: () => void;
  getSelection: () => string | undefined;
  cols: () => number | undefined;
  rows: () => number | undefined;
  fit: () => void;
};

export type XtermTerminalProps = {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  disabled?: boolean;
  className?: string;
};

export const XtermTerminal = forwardRef<
  XtermTerminalHandle,
  XtermTerminalProps
>(({ onData, onResize, disabled = false, className = "" }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const dataDisposableRef = useRef<{ dispose(): void } | null>(null);
  const isInitializedRef = useRef(false);
  const { resolvedTheme } = useTheme();

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    let cleanup: (() => void) | undefined;

    const initTerminal = async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all(
        [
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
        ],
      );

      // Load xterm CSS dynamically (suppress TS error for CSS module)
      // @ts-expect-error -- CSS import has no type declarations
      await import("@xterm/xterm/css/xterm.css");

      if (!terminalRef.current) return;
      terminalRef.current.innerHTML = "";

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Courier New", "Menlo", monospace',
        cols: 80,
        rows: 24,
        theme: resolvedTheme === "dark" ? DARK_THEME : LIGHT_THEME,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(terminalRef.current);

      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Initial fit
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            fitAddon.fit();
          } catch {
            // Will fit on next resize
          }
        }, 0);
      });

      // Window resize handler
      const handleResize = () => {
        try {
          if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
            fitAddonRef.current.fit();
          }
        } catch {
          // Ignore fit errors during resize
        }
      };
      window.addEventListener("resize", handleResize);

      // Container resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (
          entry &&
          entry.contentRect.width > 0 &&
          entry.contentRect.height > 0
        ) {
          handleResize();
        }
      });
      resizeObserver.observe(terminalRef.current);

      cleanup = () => {
        window.removeEventListener("resize", handleResize);
        resizeObserver.disconnect();
        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }
        fitAddonRef.current = null;
        if (terminalRef.current) {
          terminalRef.current.innerHTML = "";
        }
        isInitializedRef.current = false;
      };
    };

    initTerminal();

    return () => {
      cleanup?.();
    };
  }, [resolvedTheme]);

  // Data input handler
  useEffect(() => {
    if (!xtermRef.current) return;

    const terminal = xtermRef.current;

    if (dataDisposableRef.current) {
      dataDisposableRef.current.dispose();
      dataDisposableRef.current = null;
    }

    terminal.options.disableStdin = disabled;

    if (!disabled && onData) {
      dataDisposableRef.current = terminal.onData(onData);
    }

    return () => {
      if (dataDisposableRef.current) {
        dataDisposableRef.current.dispose();
        dataDisposableRef.current = null;
      }
    };
  }, [disabled, onData]);

  // Theme changes
  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme =
      resolvedTheme === "dark" ? DARK_THEME : LIGHT_THEME;
  }, [resolvedTheme]);

  // Resize callback
  useEffect(() => {
    if (!xtermRef.current || !onResize) return;

    const terminal = xtermRef.current;
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const disposable = terminal.onResize((size) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        onResize(size.cols, size.rows);
      }, 300);
    });

    return () => {
      clearTimeout(resizeTimeout);
      disposable.dispose();
    };
  }, [onResize]);

  // Imperative handle
  useImperativeHandle(
    ref,
    () => ({
      write: (data: string) => xtermRef.current?.write(data),
      writeln: (data: string) => xtermRef.current?.writeln(data),
      writeMessage: (data: string) => {
        if (xtermRef.current?.buffer.active.cursorX !== 0) {
          xtermRef.current?.writeln("");
        }
        // Muted text via ANSI dim
        xtermRef.current?.writeln(`\x1b[2m${data}\x1b[0m`);
      },
      clear: () => xtermRef.current?.clear(),
      focus: () => xtermRef.current?.focus(),
      blur: () => xtermRef.current?.blur(),
      getSelection: () => xtermRef.current?.getSelection(),
      cols: () => xtermRef.current?.cols,
      rows: () => xtermRef.current?.rows,
      fit: () => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // Ignore fit errors
        }
      },
    }),
    [],
  );

  return (
    <div
      ref={terminalRef}
      className={`xterm-container ${className}`}
      onClick={() => xtermRef.current?.focus()}
      style={{
        cursor: "text",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    />
  );
});

XtermTerminal.displayName = "XtermTerminal";
