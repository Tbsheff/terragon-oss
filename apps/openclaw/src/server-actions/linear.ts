"use server";

import { db } from "@/db";
import { kvStore } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  pollLinearIssues,
  createThreadFromIssue,
  updateLinearIssueStatus,
  commentOnIssue,
  type LinearIssue,
  type LinearStatusUpdate,
} from "@/lib/linear-integration";
import { startPipeline } from "@/server-actions/pipeline";
import { getThread, updateThread } from "@/server-actions/threads";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type LinearFilters = {
  teamId: string;
  labelFilter?: string;
};

// ─────────────────────────────────────────────────
// API key helper
// ─────────────────────────────────────────────────

async function getLinearApiKey(): Promise<string | null> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(eq(kvStore.key, "linear_api_key"));
  return rows[0]?.value ?? null;
}

// ─────────────────────────────────────────────────
// Get Linear Issues
// ─────────────────────────────────────────────────

export async function getLinearIssues(
  filters: LinearFilters,
): Promise<ActionResult<LinearIssue[]>> {
  const apiKey = await getLinearApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Linear API key not configured. Add 'linear_api_key' in settings.",
    };
  }

  return pollLinearIssues(apiKey, filters.teamId, filters.labelFilter);
}

// ─────────────────────────────────────────────────
// Start Pipeline from Linear Issue
// ─────────────────────────────────────────────────

export async function startPipelineFromIssue(
  issueId: string,
  opts?: {
    teamId?: string;
    githubRepoFullName?: string;
    model?: string;
    pipelineTemplateId?: string;
    prompt?: string;
  },
): Promise<ActionResult<{ threadId: string }>> {
  const apiKey = await getLinearApiKey();
  if (!apiKey) {
    return { ok: false, error: "Linear API key not configured" };
  }

  try {
    // Fetch the issue from Linear
    const { LinearClient } = await import("@linear/sdk");
    const client = new LinearClient({ apiKey });
    const rawIssue = await client.issue(issueId);

    const state = await rawIssue.state;
    const labelsConn = await rawIssue.labels();
    const assignee = await rawIssue.assignee;

    const issue: LinearIssue = {
      id: rawIssue.id,
      identifier: rawIssue.identifier,
      title: rawIssue.title,
      description: rawIssue.description,
      url: rawIssue.url,
      state: state ? { name: state.name, type: state.type } : null,
      labels: labelsConn.nodes.map((l) => ({ name: l.name })),
      assignee: assignee
        ? { name: assignee.name, email: assignee.email }
        : null,
      priority: rawIssue.priority,
      createdAt: rawIssue.createdAt,
      updatedAt: rawIssue.updatedAt,
    };

    // Create thread from the issue
    const threadResult = await createThreadFromIssue(issue, {
      githubRepoFullName: opts?.githubRepoFullName,
      model: opts?.model,
      pipelineTemplateId: opts?.pipelineTemplateId,
    });

    if (!threadResult.ok) return threadResult;

    // Update Linear status to "In Progress"
    await updateLinearIssueStatus(apiKey, issueId, "started");

    // Comment on the issue
    await commentOnIssue(
      apiKey,
      issueId,
      `OpenClaw pipeline started. Thread: \`${threadResult.data.threadId}\``,
    );

    // Store the Linear issue ID in the thread's metadata
    await updateThread(threadResult.data.threadId, {
      pipelineState: JSON.stringify({ linearIssueId: issueId }),
    });

    // Start the pipeline (fire and forget — pipeline module handles async execution)
    const templateId = opts?.pipelineTemplateId ?? "default";
    startPipeline(threadResult.data.threadId, templateId).catch(() => {
      // Pipeline start failures are logged internally
    });

    return { ok: true, data: { threadId: threadResult.data.threadId } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to start pipeline from issue",
    };
  }
}

// ─────────────────────────────────────────────────
// Sync Linear Status
// ─────────────────────────────────────────────────

export async function syncLinearStatus(
  threadId: string,
): Promise<ActionResult<void>> {
  const apiKey = await getLinearApiKey();
  if (!apiKey) {
    return { ok: false, error: "Linear API key not configured" };
  }

  try {
    // Get thread from gateway session metadata
    const t = await getThread(threadId);
    if (!t) return { ok: false, error: "Thread not found" };

    // Parse pipeline state to extract Linear issue ID
    const pipelineState = t.pipelineState ? JSON.parse(t.pipelineState) : null;
    const linearIssueId = pipelineState?.linearIssueId as string | undefined;

    if (!linearIssueId) {
      return { ok: false, error: "Thread has no linked Linear issue" };
    }

    // Map thread status to Linear status
    const statusMap: Record<string, LinearStatusUpdate> = {
      draft: "started",
      queued: "started",
      working: "in_progress",
      stopping: "in_progress",
      "working-done": "in_review",
      "working-error": "in_progress",
      complete: "done",
    };

    const linearStatus = statusMap[t.status] ?? "in_progress";

    const updateResult = await updateLinearIssueStatus(
      apiKey,
      linearIssueId,
      linearStatus,
    );
    if (!updateResult.ok) return updateResult;

    // Add a status comment
    const statusComment = getStatusComment(t.status);
    if (statusComment) {
      await commentOnIssue(apiKey, linearIssueId, statusComment);
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to sync Linear status",
    };
  }
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getStatusComment(threadStatus: string): string | null {
  switch (threadStatus) {
    case "working":
      return "OpenClaw agent is working on this issue...";
    case "working-done":
      return "OpenClaw agent completed work. Ready for review.";
    case "working-error":
      return "OpenClaw agent encountered an error. Manual intervention may be needed.";
    case "complete":
      return "OpenClaw pipeline completed successfully.";
    default:
      return null;
  }
}
