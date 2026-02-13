"use server";

import { listThreads } from "@/server-actions/threads";

export type EnrichedThreadListItem = {
  id: string;
  name: string | null;
  status: string;
  agent: string;
  model: string | null;
  githubRepoFullName: string | null;
  pipelineState: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  latestPR: {
    prNumber: number;
    prStatus: string;
    prUrl: string | null;
  } | null;
  hasError: boolean;
};

export async function listThreadsEnriched(): Promise<EnrichedThreadListItem[]> {
  const threads = await listThreads();

  // Enrich with GitHub PR data where applicable
  const enriched: EnrichedThreadListItem[] = [];

  for (const t of threads) {
    let latestPR: EnrichedThreadListItem["latestPR"] = null;

    // If thread has a GitHub repo, try to find PRs via Octokit
    if (t.githubRepoFullName) {
      try {
        const { getGitHubAuth } = await import("@/server-actions/github");
        const authResult = await getGitHubAuth();
        if (authResult.ok) {
          const { Octokit } = await import("octokit");
          const octokit = new Octokit({ auth: authResult.data.token });
          const [owner, repo] = t.githubRepoFullName.split("/");

          if (owner && repo) {
            // Search for PRs that match the session key pattern in head branch
            const { data: prs } = await octokit.rest.pulls.list({
              owner,
              repo,
              state: "all",
              per_page: 1,
              sort: "created",
              direction: "desc",
            });

            const pr = prs[0];
            if (pr) {
              latestPR = {
                prNumber: pr.number,
                prStatus: pr.draft
                  ? "draft"
                  : pr.merged_at
                    ? "merged"
                    : pr.state === "closed"
                      ? "closed"
                      : "open",
                prUrl: pr.html_url,
              };
            }
          }
        }
      } catch {
        // GitHub unavailable — skip PR enrichment
      }
    }

    enriched.push({
      id: t.id,
      name: t.name,
      status: t.status,
      agent: t.agent,
      model: t.model,
      githubRepoFullName: t.githubRepoFullName,
      pipelineState: t.pipelineState,
      archived: t.archived,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      latestPR,
      hasError: t.status === "working-error",
    });
  }

  return enriched;
}
