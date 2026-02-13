"use server";

import { Octokit } from "octokit";
import { db } from "@/db";
import { githubAuth, githubPR, githubCheckRun, thread } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getSettings } from "@/server-actions/settings";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type PRStatusData = {
  id: string;
  prNumber: number;
  prStatus: string;
  prTitle: string | null;
  prUrl: string | null;
  checksStatus: string | null;
  mergeableState: string | null;
  headBranch: string | null;
  baseBranch: string | null;
  repoFullName: string;
};

type CheckRunData = {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
};

// ─────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────

export async function getGitHubAuth(): Promise<
  ActionResult<{ token: string; username: string | null }>
> {
  const rows = await db
    .select()
    .from(githubAuth)
    .where(eq(githubAuth.id, "default"));

  const row = rows[0];
  if (!row?.personalAccessToken) {
    return {
      ok: false,
      error: "GitHub PAT not configured. Set it in Settings > GitHub.",
    };
  }

  return {
    ok: true,
    data: { token: row.personalAccessToken, username: row.username },
  };
}

function getOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

// ─────────────────────────────────────────────────
// Create Pull Request
// ─────────────────────────────────────────────────

export async function createPullRequest(
  threadId: string,
  options?: {
    title?: string;
    body?: string;
    draft?: boolean;
    baseBranch?: string;
  },
): Promise<ActionResult<PRStatusData>> {
  try {
    const authResult = await getGitHubAuth();
    if (!authResult.ok) return authResult;

    const { token } = authResult.data;
    const octokit = getOctokit(token);

    // Get thread details
    const threadRows = await db
      .select()
      .from(thread)
      .where(eq(thread.id, threadId))
      .limit(1);

    const t = threadRows[0];
    if (!t) return { ok: false, error: "Thread not found" };
    if (!t.githubRepoFullName)
      return { ok: false, error: "Thread has no GitHub repo configured" };
    if (!t.githubBranch)
      return { ok: false, error: "Thread has no branch set" };

    const [owner, repo] = t.githubRepoFullName.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    // Get settings for PR defaults
    const appSettings = await getSettings();
    const isDraft = options?.draft ?? appSettings?.prType === "draft";
    const base = options?.baseBranch ?? t.baseBranch ?? "main";

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: options?.title ?? t.name ?? `OpenClaw: ${threadId}`,
      body:
        options?.body ??
        `Created by OpenClaw pipeline.\n\nThread: \`${threadId}\``,
      head: t.githubBranch,
      base,
      draft: isDraft,
    });

    // Store PR in database
    const prId = nanoid();
    const now = new Date().toISOString();
    await db.insert(githubPR).values({
      id: prId,
      threadId,
      repoFullName: t.githubRepoFullName,
      prNumber: pr.number,
      prStatus: pr.draft ? "draft" : "open",
      prTitle: pr.title,
      prUrl: pr.html_url,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      checksStatus: "none",
      createdAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      data: {
        id: prId,
        prNumber: pr.number,
        prStatus: pr.draft ? "draft" : "open",
        prTitle: pr.title,
        prUrl: pr.html_url,
        checksStatus: "none",
        mergeableState: null,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        repoFullName: t.githubRepoFullName,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create PR",
    };
  }
}

// ─────────────────────────────────────────────────
// Get PR Status
// ─────────────────────────────────────────────────

export async function getPRStatus(
  prId: string,
): Promise<ActionResult<PRStatusData>> {
  try {
    const authResult = await getGitHubAuth();
    if (!authResult.ok) return authResult;

    const { token } = authResult.data;
    const octokit = getOctokit(token);

    // Get PR from DB
    const rows = await db
      .select()
      .from(githubPR)
      .where(eq(githubPR.id, prId))
      .limit(1);

    const prRow = rows[0];
    if (!prRow) return { ok: false, error: "PR not found in database" };

    const [owner, repo] = prRow.repoFullName.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    // Fetch current state from GitHub
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prRow.prNumber,
    });

    let prStatus: "draft" | "open" | "closed" | "merged" = "open";
    if (pr.merged) prStatus = "merged";
    else if (pr.state === "closed") prStatus = "closed";
    else if (pr.draft) prStatus = "draft";

    const mergeableState = pr.mergeable_state as
      | "clean"
      | "dirty"
      | "blocked"
      | "unknown"
      | "unstable"
      | undefined;

    // Update DB
    const now = new Date().toISOString();
    await db
      .update(githubPR)
      .set({
        prStatus,
        prTitle: pr.title,
        mergeableState: mergeableState ?? "unknown",
        updatedAt: now,
      })
      .where(eq(githubPR.id, prId));

    return {
      ok: true,
      data: {
        id: prId,
        prNumber: prRow.prNumber,
        prStatus,
        prTitle: pr.title,
        prUrl: prRow.prUrl,
        checksStatus: prRow.checksStatus,
        mergeableState: mergeableState ?? "unknown",
        headBranch: prRow.headBranch,
        baseBranch: prRow.baseBranch,
        repoFullName: prRow.repoFullName,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to get PR status",
    };
  }
}

// ─────────────────────────────────────────────────
// Poll Check Status
// ─────────────────────────────────────────────────

export async function pollCheckStatus(prId: string): Promise<
  ActionResult<{
    checksStatus: string;
    checks: CheckRunData[];
  }>
> {
  try {
    const authResult = await getGitHubAuth();
    if (!authResult.ok) return authResult;

    const { token } = authResult.data;
    const octokit = getOctokit(token);

    // Get PR from DB
    const rows = await db
      .select()
      .from(githubPR)
      .where(eq(githubPR.id, prId))
      .limit(1);

    const prRow = rows[0];
    if (!prRow) return { ok: false, error: "PR not found in database" };

    const [owner, repo] = prRow.repoFullName.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    // Get the PR head SHA
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prRow.prNumber,
    });

    const headSha = pr.head.sha;

    // Fetch check runs for the commit
    const { data: checkData } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: headSha,
    });

    const now = new Date().toISOString();
    const checkResults: CheckRunData[] = [];

    // Clear old check runs for this PR
    await db.delete(githubCheckRun).where(eq(githubCheckRun.githubPRId, prId));

    for (const run of checkData.check_runs) {
      const checkId = nanoid();
      const status = run.status as "queued" | "in_progress" | "completed";
      const conclusion = run.conclusion as
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "skipped"
        | "timed_out"
        | "action_required"
        | null;

      await db.insert(githubCheckRun).values({
        id: checkId,
        githubPRId: prId,
        checkRunId: String(run.id),
        name: run.name,
        status,
        conclusion,
        detailsUrl: run.details_url ?? null,
        createdAt: now,
        updatedAt: now,
      });

      checkResults.push({
        id: checkId,
        name: run.name,
        status,
        conclusion,
        detailsUrl: run.details_url ?? null,
      });
    }

    // Determine aggregate checks status
    let checksStatus: "none" | "pending" | "success" | "failure" | "unknown" =
      "none";

    if (checkResults.length > 0) {
      const hasFailure = checkResults.some(
        (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
      );
      const allComplete = checkResults.every((c) => c.status === "completed");
      const hasPending = checkResults.some(
        (c) => c.status === "queued" || c.status === "in_progress",
      );

      if (hasFailure) checksStatus = "failure";
      else if (hasPending) checksStatus = "pending";
      else if (allComplete) checksStatus = "success";
      else checksStatus = "unknown";
    }

    // Update PR record
    await db
      .update(githubPR)
      .set({ checksStatus, updatedAt: now })
      .where(eq(githubPR.id, prId));

    return {
      ok: true,
      data: { checksStatus, checks: checkResults },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to poll check status",
    };
  }
}

// ─────────────────────────────────────────────────
// Get PRs for a thread
// ─────────────────────────────────────────────────

export async function getThreadPRs(
  threadId: string,
): Promise<ActionResult<PRStatusData[]>> {
  try {
    const rows = await db
      .select()
      .from(githubPR)
      .where(eq(githubPR.threadId, threadId));

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        prNumber: r.prNumber,
        prStatus: r.prStatus,
        prTitle: r.prTitle,
        prUrl: r.prUrl,
        checksStatus: r.checksStatus,
        mergeableState: r.mergeableState,
        headBranch: r.headBranch,
        baseBranch: r.baseBranch,
        repoFullName: r.repoFullName,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to get thread PRs",
    };
  }
}
