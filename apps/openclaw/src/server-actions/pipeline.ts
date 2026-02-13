"use server";

import { db } from "@/db";
import { thread, threadChat, pipelineTemplate } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/constants";
import {
  createAndStartPipeline,
  getActivePipelineActor,
  removeActivePipelineActor,
  type PipelineConfig,
  type StageResult,
} from "@/lib/pipeline-engine";
import type { PipelineState } from "@/hooks/use-pipeline";
import { getOpenClawClient } from "@/lib/openclaw-client";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

async function persistPipelineState(
  threadId: string,
  state: PipelineState,
): Promise<void> {
  await db
    .update(thread)
    .set({
      pipelineState: JSON.stringify(state),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(thread.id, threadId));
}

async function getThreadRow(threadId: string) {
  const rows = await db
    .select()
    .from(thread)
    .where(eq(thread.id, threadId))
    .limit(1);
  return rows[0] ?? null;
}

async function getTemplateStages(templateId: string): Promise<PipelineStage[]> {
  const rows = await db
    .select()
    .from(pipelineTemplate)
    .where(eq(pipelineTemplate.id, templateId))
    .limit(1);

  const row = rows[0];
  if (!row) return [...PIPELINE_STAGES];

  try {
    return JSON.parse(row.stages) as PipelineStage[];
  } catch {
    return [...PIPELINE_STAGES];
  }
}

/** Execute a pipeline stage by sending a prompt to an OpenClaw agent session */
async function executeStage(
  stage: PipelineStage,
  threadId: string,
): Promise<StageResult> {
  const client = getOpenClawClient();
  if (client.getState() === "disconnected") {
    return {
      status: "failed",
      agentId: "",
      sessionKey: "",
      feedback: "OpenClaw client not connected",
    };
  }

  const sessionKey = `pipeline-${threadId}-${stage}-${nanoid(6)}`;
  const agentId = `agent-${stage}`;

  // Create a thread_chat record for this pipeline stage
  const chatId = nanoid();
  await db.insert(threadChat).values({
    id: chatId,
    threadId,
    agent: agentId,
    status: "working",
    sessionKey,
    pipelineStage: stage,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    // Send the stage prompt to the agent
    const stagePrompts: Record<PipelineStage, string> = {
      brainstorm:
        "Analyze the task and brainstorm possible approaches. List pros/cons for each approach. Do NOT implement anything yet.",
      plan: "Create a detailed implementation plan with specific file paths and changes. Do NOT write code yet.",
      implement:
        "Implement the changes according to the plan. Write production-quality code.",
      review:
        "Review the implementation. Check for bugs, edge cases, and adherence to project patterns. Reply with APPROVE if good, or NEEDS_WORK with feedback.",
      test: "Run the existing test suite and write any missing tests for the implementation.",
      ci: "Run the CI pipeline (lint, type-check, build, test). Report results.",
    };

    await client.chatSend(sessionKey, {
      role: "user",
      content: [{ type: "text", text: stagePrompts[stage] }],
    });

    // Update chat status
    await db
      .update(threadChat)
      .set({
        status: "complete",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threadChat.id, chatId));

    // For review stage, parse the agent output for APPROVE/NEEDS_WORK
    if (stage === "review") {
      const history = await client.chatHistory(sessionKey);
      const lastMessage = history[history.length - 1];
      const text =
        lastMessage?.messages
          ?.filter((m) => m.role === "assistant")
          .flatMap((m) => m.content)
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n") ?? "";

      if (text.includes("NEEDS_WORK")) {
        return {
          status: "failed",
          agentId,
          sessionKey,
          feedback: text,
        };
      }
    }

    return {
      status: "passed",
      agentId,
      sessionKey,
    };
  } catch (err) {
    await db
      .update(threadChat)
      .set({
        status: "working-error",
        errorMessage: (err as Error).message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threadChat.id, chatId));

    return {
      status: "failed",
      agentId,
      sessionKey,
      feedback: (err as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────

/** Start a pipeline for a thread using a template */
export async function startPipeline(
  threadId: string,
  templateId: string,
): Promise<ActionResult<PipelineState>> {
  try {
    const threadRow = await getThreadRow(threadId);
    if (!threadRow) return { ok: false, error: "Thread not found" };

    // Don't start if already running
    if (getActivePipelineActor(threadId)) {
      return {
        ok: false,
        error: "Pipeline is already running for this thread",
      };
    }

    const enabledStages = await getTemplateStages(templateId);

    const pipelineConfig: PipelineConfig = {
      threadId,
      templateId,
      enabledStages,
      onStageExecute: executeStage,
    };

    // Update thread status
    await db
      .update(thread)
      .set({ status: "working", updatedAt: new Date().toISOString() })
      .where(eq(thread.id, threadId));

    let latestState: PipelineState | null = null;

    createAndStartPipeline(pipelineConfig, async (state) => {
      latestState = state;
      await persistPipelineState(threadId, state);

      // Update thread status when pipeline completes
      if (state.currentStage === "done") {
        const allPassed = state.stageHistory.every(
          (h) => h.status === "passed" || h.status === "skipped",
        );
        await db
          .update(thread)
          .set({
            status: allPassed ? "complete" : "working-error",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(thread.id, threadId));
      }
    });

    // Return the initial state
    const initialState: PipelineState = {
      templateId,
      currentStage: enabledStages[0] ?? "done",
      stageHistory: [],
    };

    await persistPipelineState(threadId, initialState);

    return { ok: true, data: latestState ?? initialState };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Manually advance the pipeline to the next stage */
export async function advancePipeline(threadId: string): Promise<ActionResult> {
  try {
    const actor = getActivePipelineActor(threadId);
    if (!actor) {
      return { ok: false, error: "No active pipeline for this thread" };
    }

    actor.send({
      type: "STAGE_COMPLETE",
      result: {
        status: "passed",
        agentId: "manual",
        sessionKey: "manual-advance",
      },
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Retry the current stage */
export async function retryStage(threadId: string): Promise<ActionResult> {
  try {
    const actor = getActivePipelineActor(threadId);
    if (!actor) {
      // Try to resume from persisted state
      const threadRow = await getThreadRow(threadId);
      if (!threadRow?.pipelineState) {
        return { ok: false, error: "No pipeline state found" };
      }

      const state = JSON.parse(threadRow.pipelineState) as PipelineState;
      if (state.currentStage === "done") {
        return { ok: false, error: "Pipeline is already complete" };
      }

      // Restart pipeline from current stage
      const enabledStages = await getTemplateStages(state.templateId);
      const stageIdx = enabledStages.indexOf(
        state.currentStage as PipelineStage,
      );
      const remainingStages =
        stageIdx >= 0 ? enabledStages.slice(stageIdx) : enabledStages;

      const pipelineConfig: PipelineConfig = {
        threadId,
        templateId: state.templateId,
        enabledStages: remainingStages,
        onStageExecute: executeStage,
      };

      createAndStartPipeline(pipelineConfig, async (newState) => {
        // Merge with existing history
        const merged: PipelineState = {
          ...newState,
          stageHistory: [
            ...state.stageHistory.filter((h) => h.status !== "running"),
            ...newState.stageHistory,
          ],
        };
        await persistPipelineState(threadId, merged);
      });

      await db
        .update(thread)
        .set({ status: "working", updatedAt: new Date().toISOString() })
        .where(eq(thread.id, threadId));

      return { ok: true, data: undefined };
    }

    // If actor exists but is in failed state, send skip to advance past it
    actor.send({ type: "SKIP_STAGE" });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Cancel a running pipeline */
export async function cancelPipeline(threadId: string): Promise<ActionResult> {
  try {
    const actor = getActivePipelineActor(threadId);
    if (actor) {
      actor.send({ type: "ABORT" });
      removeActivePipelineActor(threadId);
    }

    // Update thread status
    await db
      .update(thread)
      .set({
        status: "working-error",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(thread.id, threadId));

    // Update pipeline state
    const threadRow = await getThreadRow(threadId);
    if (threadRow?.pipelineState) {
      const state = JSON.parse(threadRow.pipelineState) as PipelineState;
      // Mark any running stages as failed
      state.stageHistory = state.stageHistory.map((h) =>
        h.status === "running"
          ? {
              ...h,
              status: "failed" as const,
              completedAt: new Date().toISOString(),
              feedback: "Pipeline cancelled",
            }
          : h,
      );
      await persistPipelineState(threadId, state);
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Get the current pipeline state for a thread */
export async function getPipelineState(
  threadId: string,
): Promise<ActionResult<PipelineState | null>> {
  try {
    const threadRow = await getThreadRow(threadId);
    if (!threadRow) return { ok: false, error: "Thread not found" };

    if (!threadRow.pipelineState) {
      return { ok: true, data: null };
    }

    const state = JSON.parse(threadRow.pipelineState) as PipelineState;
    return { ok: true, data: state };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────
// Pipeline Template helpers
// ─────────────────────────────────────────────────

export async function listPipelineTemplates(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      description: string | null;
      stages: PipelineStage[];
      isDefault: boolean;
    }>
  >
> {
  try {
    const rows = await db.select().from(pipelineTemplate);
    const templates = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      stages: JSON.parse(r.stages) as PipelineStage[],
      isDefault: r.isDefault,
    }));
    return { ok: true, data: templates };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createPipelineTemplate(opts: {
  name: string;
  description?: string;
  stages: PipelineStage[];
  isDefault?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const id = nanoid();
    await db.insert(pipelineTemplate).values({
      id,
      name: opts.name,
      description: opts.description ?? null,
      stages: JSON.stringify(opts.stages),
      isDefault: opts.isDefault ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
