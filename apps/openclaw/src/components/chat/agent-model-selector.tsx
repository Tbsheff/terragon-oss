"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { value: "claude-opus-4-6", label: "Opus 4" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

type AgentModelSelectorProps = {
  currentModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
};

export function AgentModelSelector({
  currentModel,
  onModelChange,
  disabled,
}: AgentModelSelectorProps) {
  return (
    <Select
      value={currentModel}
      onValueChange={onModelChange}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Select model"
        className={cn(
          "h-7 w-auto min-w-0 gap-1 rounded-md border border-border/60 bg-muted/30 px-2",
          "text-xs text-muted-foreground/80 shadow-none",
          "transition-colors hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-lg border border-border/60">
        {AVAILABLE_MODELS.map((m) => (
          <SelectItem
            key={m.value}
            value={m.value}
            className="text-xs rounded-md"
          >
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
