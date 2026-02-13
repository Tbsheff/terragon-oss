export const APP_NAME = "OpenClaw Dashboard";
export const DEFAULT_PORT = 3100;
export const WS_PATH = "/ws";

// Pipeline stages
export const PIPELINE_STAGES = [
  "brainstorm",
  "plan",
  "implement",
  "review",
  "test",
  "ci",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Pipeline stage display names
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  brainstorm: "Brainstorm",
  plan: "Plan",
  implement: "Implement",
  review: "Review",
  test: "Test",
  ci: "CI",
};

// Thread statuses that mean "actively working"
export const WORKING_STATUSES = ["queued", "working", "stopping"] as const;

// Max review retries before giving up
export const MAX_REVIEW_RETRIES = 3;
