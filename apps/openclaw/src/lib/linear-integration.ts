import { LinearClient } from "@linear/sdk";
import { createThread } from "@/server-actions/threads";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | undefined | null;
  url: string;
  state: { name: string; type: string } | null;
  labels: { name: string }[];
  assignee: { name: string; email: string } | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LinearStatusUpdate =
  | "started"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────
// Client factory
// ─────────────────────────────────────────────────

let cachedClient: LinearClient | null = null;

export function getLinearClient(apiKey: string): LinearClient {
  if (cachedClient) return cachedClient;
  cachedClient = new LinearClient({ apiKey });
  return cachedClient;
}

export function resetLinearClient(): void {
  cachedClient = null;
}

// ─────────────────────────────────────────────────
// Poll Linear Issues
// ─────────────────────────────────────────────────

export async function pollLinearIssues(
  apiKey: string,
  teamId: string,
  labelFilter?: string,
): Promise<ActionResult<LinearIssue[]>> {
  try {
    const client = getLinearClient(apiKey);
    const team = await client.team(teamId);

    const issuesConnection = await team.issues({
      filter: {
        ...(labelFilter ? { labels: { name: { eq: labelFilter } } } : {}),
        state: { type: { nin: ["completed", "cancelled"] } },
      },
      first: 50,
    });

    const issues: LinearIssue[] = [];

    for (const issue of issuesConnection.nodes) {
      const state = await issue.state;
      const labelsConn = await issue.labels();
      const assignee = await issue.assignee;

      issues.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        state: state ? { name: state.name, type: state.type } : null,
        labels: labelsConn.nodes.map((l) => ({ name: l.name })),
        assignee: assignee
          ? { name: assignee.name, email: assignee.email }
          : null,
        priority: issue.priority,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      });
    }

    return { ok: true, data: issues };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to poll Linear issues",
    };
  }
}

// ─────────────────────────────────────────────────
// Create Thread from Linear Issue
// ─────────────────────────────────────────────────

export async function createThreadFromIssue(
  issue: LinearIssue,
  opts?: {
    githubRepoFullName?: string;
    model?: string;
    pipelineTemplateId?: string;
  },
): Promise<ActionResult<{ threadId: string }>> {
  try {
    const result = await createThread({
      name: `${issue.identifier}: ${issue.title}`,
      githubRepoFullName: opts?.githubRepoFullName,
      model: opts?.model,
      pipelineTemplateId: opts?.pipelineTemplateId,
    });

    return { ok: true, data: { threadId: result.id } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to create thread from issue",
    };
  }
}

// ─────────────────────────────────────────────────
// Update Linear Issue Status
// ─────────────────────────────────────────────────

export async function updateLinearIssueStatus(
  apiKey: string,
  issueId: string,
  status: LinearStatusUpdate,
): Promise<ActionResult<void>> {
  try {
    const client = getLinearClient(apiKey);
    const issue = await client.issue(issueId);
    const team = await issue.team;
    if (!team) return { ok: false, error: "Issue has no team" };

    // Get workflow states for the team
    const states = await team.states();
    const stateTypeMap: Record<LinearStatusUpdate, string> = {
      started: "started",
      in_progress: "started",
      in_review: "started",
      done: "completed",
      cancelled: "cancelled",
    };

    const stateNameHints: Record<LinearStatusUpdate, string[]> = {
      started: ["In Progress", "Started"],
      in_progress: ["In Progress"],
      in_review: ["In Review", "Review"],
      done: ["Done", "Completed"],
      cancelled: ["Cancelled", "Canceled"],
    };

    const targetType = stateTypeMap[status];
    const nameHints = stateNameHints[status];

    // Try to find a matching state by name first, then fall back to type
    let targetState = states.nodes.find((s) =>
      nameHints.some((hint) => s.name.toLowerCase() === hint.toLowerCase()),
    );

    if (!targetState) {
      targetState = states.nodes.find((s) => s.type === targetType);
    }

    if (!targetState) {
      return {
        ok: false,
        error: `No matching workflow state for status: ${status}`,
      };
    }

    await client.updateIssue(issueId, { stateId: targetState.id });

    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update Linear issue status",
    };
  }
}

// ─────────────────────────────────────────────────
// Comment on Issue
// ─────────────────────────────────────────────────

export async function commentOnIssue(
  apiKey: string,
  issueId: string,
  comment: string,
): Promise<ActionResult<{ commentId: string }>> {
  try {
    const client = getLinearClient(apiKey);
    const result = await client.createComment({
      issueId,
      body: comment,
    });

    const commentPayload = await result.comment;
    return {
      ok: true,
      data: { commentId: commentPayload?.id ?? "unknown" },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to comment on issue",
    };
  }
}

// ─────────────────────────────────────────────────
// Link PR to Issue
// ─────────────────────────────────────────────────

export async function linkPRToIssue(
  apiKey: string,
  issueId: string,
  prUrl: string,
): Promise<ActionResult<void>> {
  try {
    const client = getLinearClient(apiKey);

    // Create an attachment linking the PR
    await client.createAttachment({
      issueId,
      url: prUrl,
      title: `Pull Request: ${prUrl.split("/").pop()}`,
      subtitle: "GitHub PR",
      iconUrl: "https://github.githubassets.com/favicons/favicon.svg",
    });

    // Also add a comment for visibility
    await client.createComment({
      issueId,
      body: `Pull request opened: ${prUrl}`,
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to link PR to issue",
    };
  }
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

export function buildPromptFromIssue(issue: LinearIssue): string {
  const parts = [`# ${issue.identifier}: ${issue.title}`];

  if (issue.description) {
    parts.push("", issue.description);
  }

  if (issue.labels.length > 0) {
    parts.push("", `Labels: ${issue.labels.map((l) => l.name).join(", ")}`);
  }

  parts.push("", `Linear URL: ${issue.url}`);

  return parts.join("\n");
}
