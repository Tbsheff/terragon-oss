"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import { StageBadge } from "./stage-badge";
import { Settings2, RotateCcw } from "lucide-react";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type PipelineConfigProps = {
  /** Currently selected stages */
  selectedStages: PipelineStage[];
  /** Called when stages change */
  onStagesChange: (stages: PipelineStage[]) => void;
  /** Disable editing */
  disabled?: boolean;
  className?: string;
};

// ─────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────

const PRESETS: { label: string; stages: PipelineStage[] }[] = [
  {
    label: "Full Pipeline",
    stages: [...PIPELINE_STAGES],
  },
  {
    label: "Quick (Plan + Implement)",
    stages: ["plan", "implement"],
  },
  {
    label: "With Review",
    stages: ["plan", "implement", "review"],
  },
  {
    label: "CI Only",
    stages: ["implement", "test", "ci"],
  },
];

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export function PipelineConfig({
  selectedStages,
  onStagesChange,
  disabled = false,
  className,
}: PipelineConfigProps) {
  const [showPresets, setShowPresets] = useState(false);

  function toggleStage(stage: PipelineStage) {
    if (disabled) return;
    if (selectedStages.includes(stage)) {
      // Don't allow deselecting all stages
      if (selectedStages.length <= 1) return;
      onStagesChange(selectedStages.filter((s) => s !== stage));
    } else {
      // Insert in pipeline order
      const newStages = PIPELINE_STAGES.filter(
        (s) => selectedStages.includes(s) || s === stage,
      );
      onStagesChange([...newStages]);
    }
  }

  function applyPreset(stages: PipelineStage[]) {
    if (disabled) return;
    onStagesChange([...stages]);
    setShowPresets(false);
  }

  function resetToDefault() {
    if (disabled) return;
    onStagesChange([...PIPELINE_STAGES]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Settings2 className="size-4 text-muted-foreground" />
          Pipeline Stages
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            disabled={disabled}
            className={cn(
              "text-xs px-2 py-1 rounded-md transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            disabled={disabled}
            className={cn(
              "p-1 rounded-md transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-label="Reset to all stages"
            title="Reset to all stages"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Presets dropdown */}
      {showPresets && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const isActive =
              JSON.stringify(preset.stages) === JSON.stringify(selectedStages);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.stages)}
                disabled={disabled}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md border transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Stage toggles */}
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((stage) => {
          const isSelected = selectedStages.includes(stage);
          return (
            <button
              key={stage}
              type="button"
              onClick={() => toggleStage(stage)}
              disabled={disabled}
              className={cn(
                "group relative transition-all",
                !isSelected && "opacity-40 hover:opacity-70",
                disabled && "cursor-not-allowed",
              )}
            >
              <StageBadge
                stage={stage}
                status={isSelected ? "passed" : "skipped"}
              />
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground text-pretty">
        {selectedStages.length} of {PIPELINE_STAGES.length} stages selected
        {selectedStages.length < PIPELINE_STAGES.length && (
          <>
            {" "}
            &mdash; Skipping:{" "}
            {PIPELINE_STAGES.filter((s) => !selectedStages.includes(s))
              .map((s) => PIPELINE_STAGE_LABELS[s])
              .join(", ")}
          </>
        )}
      </p>
    </div>
  );
}
