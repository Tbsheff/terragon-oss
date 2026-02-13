import {
  setup,
  createActor,
  fromPromise,
  assign,
  type AnyActorRef,
} from "xstate";
import { MAX_REVIEW_RETRIES, type PipelineStage } from "@/lib/constants";
import type {
  PipelineState,
  PipelineStageHistory,
  PipelineStageStatus,
} from "@/hooks/use-pipeline";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────
// Pipeline mode check
// ─────────────────────────────────────────────────

/**
 * Check whether pipeline mode is enabled for a given thread/session.
 * When false, the system uses single-chat mode (one session, one conversation).
 * Pipeline mode is opt-in: only enabled when a pipelineTemplateId is provided.
 */
export function isPipelineEnabled(
  pipelineTemplateId: string | null | undefined,
): boolean {
  return !!pipelineTemplateId;
}

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type PipelineConfig = {
  threadId: string;
  templateId: string;
  /** Stages to include; others are skipped */
  enabledStages: PipelineStage[];
  /** Per-stage timeout in ms (default 10 min) */
  stageTimeoutMs?: number;
  /** Callback invoked when a stage executes (hook into OpenClaw agent) */
  onStageExecute?: (
    stage: PipelineStage,
    threadId: string,
  ) => Promise<StageResult>;
};

export type StageResult = {
  status: "passed" | "failed";
  agentId: string;
  sessionKey: string;
  feedback?: string;
};

type PipelineContext = {
  threadId: string;
  templateId: string;
  enabledStages: PipelineStage[];
  stageTimeoutMs: number;
  currentStageIndex: number;
  reviewRetryCount: number;
  stageHistory: PipelineStageHistory[];
  lastStageResult: StageResult | null;
};

type PipelineEvent =
  | { type: "START" }
  | { type: "STAGE_COMPLETE"; result: StageResult }
  | { type: "STAGE_FAILED"; error: string }
  | { type: "SKIP_STAGE" }
  | { type: "ABORT" };

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getCurrentStage(ctx: PipelineContext): PipelineStage | null {
  const stage = ctx.enabledStages[ctx.currentStageIndex];
  return stage ?? null;
}

function hasMoreStages(ctx: PipelineContext): boolean {
  return ctx.currentStageIndex + 1 < ctx.enabledStages.length;
}

function buildStageHistoryEntry(
  stage: PipelineStage,
  status: PipelineStageStatus,
  result?: StageResult | null,
): PipelineStageHistory {
  return {
    stage,
    agentId: result?.agentId ?? "",
    sessionKey: result?.sessionKey ?? "",
    status,
    startedAt: new Date().toISOString(),
    completedAt: status !== "running" ? new Date().toISOString() : undefined,
    retryCount: 0,
    feedback: result?.feedback,
  };
}

// ─────────────────────────────────────────────────
// Pipeline state serialization
// ─────────────────────────────────────────────────

export function contextToPipelineState(ctx: PipelineContext): PipelineState {
  const current = getCurrentStage(ctx);
  return {
    templateId: ctx.templateId,
    currentStage: current ?? "done",
    stageHistory: ctx.stageHistory,
  };
}

// ─────────────────────────────────────────────────
// Default stage executor (stub -- real impl calls OpenClaw agent)
// ─────────────────────────────────────────────────

async function defaultStageExecutor(
  stage: PipelineStage,
  threadId: string,
): Promise<StageResult> {
  return {
    status: "passed",
    agentId: `agent-${stage}`,
    sessionKey: `session-${threadId}-${stage}-${nanoid(6)}`,
  };
}

// ─────────────────────────────────────────────────
// Machine factory
// ─────────────────────────────────────────────────

export function createPipelineMachine(config: PipelineConfig) {
  const stageTimeoutMs = config.stageTimeoutMs ?? 10 * 60 * 1000;
  const executor = config.onStageExecute ?? defaultStageExecutor;

  return setup({
    types: {
      context: {} as PipelineContext,
      events: {} as PipelineEvent,
    },
    actors: {
      executeStage: fromPromise(
        async ({
          input,
        }: {
          input: { stage: PipelineStage; threadId: string };
        }) => {
          return executor(input.stage, input.threadId);
        },
      ),
    },
    guards: {
      reviewNeedsRetry: ({ context }) => {
        const stage = getCurrentStage(context);
        return (
          stage === "review" &&
          context.lastStageResult?.status === "failed" &&
          context.reviewRetryCount < MAX_REVIEW_RETRIES
        );
      },
      stageFailed: ({ context }) =>
        context.lastStageResult?.status === "failed",
      hasMoreStages: ({ context }) => hasMoreStages(context),
    },
    actions: {
      pushRunningEntry: assign({
        stageHistory: ({ context }) => {
          const stage = getCurrentStage(context);
          if (!stage) return context.stageHistory;
          return [
            ...context.stageHistory,
            buildStageHistoryEntry(stage, "running"),
          ];
        },
      }),
      updateStageFromResult: assign({
        lastStageResult: ({ event }) => {
          if ("output" in event) return event.output as StageResult;
          return null;
        },
        stageHistory: ({ context, event }) => {
          if (!("output" in event)) return context.stageHistory;
          const output = event.output as StageResult;
          const stage = getCurrentStage(context);
          return context.stageHistory.map((h) =>
            h.stage === stage && h.status === "running"
              ? {
                  ...h,
                  status: output.status as PipelineStageStatus,
                  agentId: output.agentId,
                  sessionKey: output.sessionKey,
                  completedAt: new Date().toISOString(),
                  feedback: output.feedback,
                  retryCount:
                    stage === "review"
                      ? context.reviewRetryCount
                      : h.retryCount,
                }
              : h,
          );
        },
      }),
      markStageFailed: assign({
        stageHistory: ({ context }) => {
          const stage = getCurrentStage(context);
          return context.stageHistory.map((h) =>
            h.stage === stage && h.status === "running"
              ? {
                  ...h,
                  status: "failed" as const,
                  completedAt: new Date().toISOString(),
                }
              : h,
          );
        },
      }),
      markStageTimedOut: assign({
        stageHistory: ({ context }) => {
          const stage = getCurrentStage(context);
          return context.stageHistory.map((h) =>
            h.stage === stage && h.status === "running"
              ? {
                  ...h,
                  status: "failed" as const,
                  completedAt: new Date().toISOString(),
                  feedback: "Stage timed out",
                }
              : h,
          );
        },
      }),
      markAborted: assign({
        stageHistory: ({ context }) => {
          const stage = getCurrentStage(context);
          return context.stageHistory.map((h) =>
            h.stage === stage && h.status === "running"
              ? {
                  ...h,
                  status: "failed" as const,
                  completedAt: new Date().toISOString(),
                  feedback: "Pipeline aborted",
                }
              : h,
          );
        },
      }),
      markStageSkipped: assign({
        stageHistory: ({ context }) => {
          const stage = getCurrentStage(context);
          return context.stageHistory.map((h) =>
            h.stage === stage &&
            (h.status === "failed" || h.status === "running")
              ? {
                  ...h,
                  status: "skipped" as const,
                  completedAt: new Date().toISOString(),
                }
              : h,
          );
        },
      }),
      reviewRetrySetup: assign({
        reviewRetryCount: ({ context }) => context.reviewRetryCount + 1,
        currentStageIndex: ({ context }) => {
          const implIdx = context.enabledStages.indexOf("implement");
          return implIdx >= 0 ? implIdx : context.currentStageIndex;
        },
      }),
      advanceStage: assign({
        currentStageIndex: ({ context }) => context.currentStageIndex + 1,
        reviewRetryCount: ({ context }) => {
          const nextIdx = context.currentStageIndex + 1;
          const nextStage = context.enabledStages[nextIdx];
          return nextStage !== "review" ? 0 : context.reviewRetryCount;
        },
      }),
    },
    delays: {
      STAGE_TIMEOUT: stageTimeoutMs,
    },
  }).createMachine({
    id: "pipeline",
    context: {
      threadId: config.threadId,
      templateId: config.templateId,
      enabledStages: config.enabledStages,
      stageTimeoutMs,
      currentStageIndex: 0,
      reviewRetryCount: 0,
      stageHistory: [],
      lastStageResult: null,
    },
    initial: "idle",
    states: {
      idle: {
        on: {
          START: { target: "running" },
        },
      },

      running: {
        initial: "executing",
        on: {
          ABORT: {
            target: "aborted",
            actions: "markAborted",
          },
        },
        states: {
          executing: {
            entry: "pushRunningEntry",
            invoke: {
              src: "executeStage",
              input: ({ context }) => ({
                stage: getCurrentStage(context)!,
                threadId: context.threadId,
              }),
              onDone: {
                target: "evaluating",
                actions: "updateStageFromResult",
              },
              onError: {
                target: "stageFailed",
                actions: "markStageFailed",
              },
            },
            after: {
              STAGE_TIMEOUT: {
                target: "stageFailed",
                actions: "markStageTimedOut",
              },
            },
          },

          evaluating: {
            always: [
              {
                guard: "reviewNeedsRetry",
                target: "reviewRetry",
              },
              {
                guard: "stageFailed",
                target: "stageFailed",
              },
              {
                guard: "hasMoreStages",
                target: "advancing",
              },
              {
                target: "#pipeline.done",
              },
            ],
          },

          reviewRetry: {
            entry: "reviewRetrySetup",
            always: "executing",
          },

          advancing: {
            entry: "advanceStage",
            always: "executing",
          },

          stageFailed: {
            on: {
              STAGE_COMPLETE: {
                target: "advancing",
                guard: "hasMoreStages",
              },
              SKIP_STAGE: [
                {
                  guard: "hasMoreStages",
                  target: "advancing",
                  actions: "markStageSkipped",
                },
                {
                  target: "#pipeline.done",
                  actions: "markStageSkipped",
                },
              ],
            },
          },
        },
      },

      done: {
        type: "final",
      },

      aborted: {
        type: "final",
      },
    },
  });
}

// ─────────────────────────────────────────────────
// Actor management (in-memory registry for running pipelines)
// ─────────────────────────────────────────────────

const activePipelines = new Map<string, AnyActorRef>();

export function getActivePipelineActor(
  threadId: string,
): AnyActorRef | undefined {
  return activePipelines.get(threadId);
}

export function setActivePipelineActor(
  threadId: string,
  actor: AnyActorRef,
): void {
  activePipelines.set(threadId, actor);
}

export function removeActivePipelineActor(threadId: string): void {
  activePipelines.delete(threadId);
}

export function createAndStartPipeline(
  config: PipelineConfig,
  onStateChange?: (state: PipelineState) => void,
): AnyActorRef {
  const machine = createPipelineMachine(config);
  const actor = createActor(machine);

  actor.subscribe((snapshot) => {
    const pipelineState = contextToPipelineState(snapshot.context);
    onStateChange?.(pipelineState);
  });

  setActivePipelineActor(config.threadId, actor);

  // Clean up when done
  actor.subscribe((snapshot) => {
    if (snapshot.status === "done") {
      removeActivePipelineActor(config.threadId);
    }
  });

  actor.start();
  actor.send({ type: "START" });

  return actor;
}
