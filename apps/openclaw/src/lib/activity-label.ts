import type { PipelineStage } from "@/lib/constants";

const STAGE_LABELS: Record<PipelineStage, string> = {
  brainstorm: "Brainstorming approach...",
  plan: "Writing plan...",
  implement: "Writing code...",
  review: "Reviewing changes...",
  test: "Running tests...",
  ci: "Waiting for CI...",
};

/**
 * Human-readable activity label for the current pipeline state + thread status.
 */
export function getActivityLabel(
  stage: PipelineStage | "done" | null,
  status: string,
): string | null {
  if (status === "complete" || status === "working-done") return "Complete";
  if (status === "working-error") return "Error encountered";

  if (stage === "done") return "Complete";
  if (stage && stage in STAGE_LABELS)
    return STAGE_LABELS[stage as PipelineStage];

  if (status === "working" || status === "stopping") return "Starting up...";
  return null;
}
