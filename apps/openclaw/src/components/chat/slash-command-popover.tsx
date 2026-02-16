"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SLASH_COMMANDS, type SlashCommandDef } from "@/lib/slash-commands";

type SlashCommandPopoverProps = {
  filter: string; // text after "/"
  onSelect: (command: SlashCommandDef) => void;
  onClose: () => void;
};

export function SlashCommandPopover({
  filter,
  onSelect,
  onClose,
}: SlashCommandPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = SLASH_COMMANDS.filter((c) =>
    c.name.toLowerCase().startsWith(filter.toLowerCase()),
  );

  const handleSelect = useCallback(
    (name: string) => {
      const cmd = SLASH_COMMANDS.find((c) => c.name === name);
      if (cmd) onSelect(cmd);
    },
    [onSelect],
  );

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1 w-72",
        "rounded-lg border border-border/60 bg-popover shadow-md",
      )}
      role="listbox"
      aria-label="Slash commands"
    >
      <Command className="rounded-lg" shouldFilter={false}>
        <CommandList>
          <CommandEmpty className="py-3 text-center text-xs text-pretty text-muted-foreground">
            No commands found
          </CommandEmpty>
          <CommandGroup>
            {filtered.map((cmd) => (
              <CommandItem
                key={cmd.name}
                value={cmd.name}
                onSelect={handleSelect}
                className="cursor-pointer gap-2"
              >
                <span className="shrink-0 font-mono text-xs text-primary">
                  /{cmd.name}
                </span>
                {cmd.argPlaceholder && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {cmd.argPlaceholder}
                  </span>
                )}
                <span className="ml-auto truncate text-xs text-pretty text-muted-foreground/70">
                  {cmd.description}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        {filtered.length > 0 && (
          <div
            className={cn(
              "flex items-center gap-3 border-t border-border/60 px-3 py-1.5",
              "text-[11px] text-muted-foreground/60",
            )}
          >
            <span>
              <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                ↑↓
              </kbd>
              {" navigate"}
            </span>
            <span>
              <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                ↵
              </kbd>
              {" select"}
            </span>
            <span>
              <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                esc
              </kbd>
              {" close"}
            </span>
          </div>
        )}
      </Command>
    </div>
  );
}
