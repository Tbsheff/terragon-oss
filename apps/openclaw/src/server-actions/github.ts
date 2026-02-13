"use server";

import { Octokit } from "octokit";
import { db } from "@/db";
import { githubAuth } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/server-actions/settings";
import { decrypt, isEncrypted } from "@/lib/crypto";
import { getThread } from "@/server-actions/threads";

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

  const token = isEncrypted(row.personalAccessToken)
    ? decrypt(row.personalAccessToken)
    : row.personalAccessToken;

  return {
    ok: true,
    data: { token, username: row.username },
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

    // Get thread details from gateway session metadata
    const t = await getThread(threadId);
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

    return {
      ok: true,
      data: {
        id: `pr-${pr.number}`,
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
// Get PR Status (fetch live from GitHub)
// ─────────────────────────────────────────────────

export async function getPRStatus(
  prId: string,
): Promise<ActionResult<PRStatusData>> {
  try {
    const authResult = await getGitHubAuth();
    if (!authResult.ok) return authResult;

    const { token } = authResult.data;
    const octokit = getOctokit(token);

    // prId format: "owner/repo#number" or legacy DB id
    // Try to parse as "owner/repo#number"
    const match = prId.match(/^(.+?)#(\d+)$/);
    if (!match) {
      return { ok: false, error: `Cannot parse PR identifier: ${prId}` };
    }

    const [, repoFullName, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr!, 10);
    const [owner, repo] = repoFullName!.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    let prStatus: "draft" | "open" | "closed" | "merged" = "open";
    if (pr.merged) prStatus = "merged";
    else if (pr.state === "closed") prStatus = "closed";
    else if (pr.draft) prStatus = "draft";

    const mergeableState = (pr.mergeable_state as string) ?? "unknown";

    return {
      ok: true,
      data: {
        id: prId,
        prNumber,
        prStatus,
        prTitle: pr.title,
        prUrl: pr.html_url,
        checksStatus: null,
        mergeableState,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        repoFullName: repoFullName!,
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
// Poll Check Status (fetch live from GitHub)
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

    const match = prId.match(/^(.+?)#(\d+)$/);
    if (!match) {
      return { ok: false, error: `Cannot parse PR identifier: ${prId}` };
    }

    const [, repoFullName, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr!, 10);
    const [owner, repo] = repoFullName!.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const headSha = pr.head.sha;

    const { data: checkData } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: headSha,
    });

    const checkResults: CheckRunData[] = checkData.check_runs.map((run) => ({
      id: String(run.id),
      name: run.name,
      status: run.status,
      conclusion: run.conclusion ?? null,
      detailsUrl: run.details_url ?? null,
    }));

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
// Get PRs for a thread (fetch from GitHub API)
// ─────────────────────────────────────────────────

export async function getThreadPRs(
  threadId: string,
): Promise<ActionResult<PRStatusData[]>> {
  try {
    const t = await getThread(threadId);
    if (!t) return { ok: false, error: "Thread not found" };
    if (!t.githubRepoFullName) return { ok: true, data: [] };

    const authResult = await getGitHubAuth();
    if (!authResult.ok) return authResult;

    const { token } = authResult.data;
    const octokit = getOctokit(token);
    const [owner, repo] = t.githubRepoFullName.split("/");
    if (!owner || !repo) return { ok: false, error: "Invalid repo full name" };

    // List PRs for the head branch if available
    const params: Parameters<typeof octokit.rest.pulls.list>[0] = {
      owner,
      repo,
      state: "all",
      per_page: 10,
      sort: "created",
      direction: "desc",
    };

    if (t.githubBranch) {
      params.head = `${owner}:${t.githubBranch}`;
    }

    const { data: prs } = await octokit.rest.pulls.list(params);

    return {
      ok: true,
      data: prs.map((pr) => ({
        id: `${t.githubRepoFullName}#${pr.number}`,
        prNumber: pr.number,
        prStatus: pr.draft
          ? "draft"
          : pr.merged_at
            ? "merged"
            : pr.state === "closed"
              ? "closed"
              : "open",
        prTitle: pr.title,
        prUrl: pr.html_url,
        checksStatus: null,
        mergeableState: null,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        repoFullName: t.githubRepoFullName!,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to get thread PRs",
    };
  }
}
