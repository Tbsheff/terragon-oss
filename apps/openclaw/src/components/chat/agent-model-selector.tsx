"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        className="h-7 w-auto min-w-0 gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value} className="text-xs">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
