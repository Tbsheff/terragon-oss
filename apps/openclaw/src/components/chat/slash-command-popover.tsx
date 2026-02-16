"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
      className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md border border-border bg-popover shadow-md"
    >
      <Command className="rounded-md" shouldFilter={false}>
        <CommandList>
          <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
            No commands found
          </CommandEmpty>
          <CommandGroup>
            {filtered.map((cmd) => (
              <CommandItem
                key={cmd.name}
                value={cmd.name}
                onSelect={handleSelect}
                className="cursor-pointer"
              >
                <span className="font-mono text-xs text-primary">
                  /{cmd.name}
                </span>
                {cmd.argPlaceholder && (
                  <span className="text-xs text-muted-foreground">
                    {cmd.argPlaceholder}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground truncate">
                  {cmd.description}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
