"use client";

import { queryOptions } from "@tanstack/react-query";
import { getAgentFiles, getAgentFile } from "@/server-actions/agents";
import type { OpenClawAgentFile } from "@/lib/openclaw-types";

/** Query key factories for agent file operations */
export const fileQueryKeys = {
  all: ["agent-files"] as const,
  list: (agentId: string) => ["agent-files", "list", agentId] as const,
  detail: (agentId: string, filename: string) =>
    ["agent-files", "detail", agentId, filename] as const,
};

/** Query options for listing all files in an agent workspace */
export function agentFilesQueryOptions(agentId: string) {
  return queryOptions<OpenClawAgentFile[]>({
    queryKey: fileQueryKeys.list(agentId),
    queryFn: async () => {
      const result = await getAgentFiles(agentId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!agentId,
    staleTime: 10_000,
  });
}

/** Query options for fetching a single agent file */
export function agentFileQueryOptions(agentId: string, filename: string) {
  return queryOptions<OpenClawAgentFile>({
    queryKey: fileQueryKeys.detail(agentId, filename),
    queryFn: async () => {
      const result = await getAgentFile(agentId, filename);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!agentId && !!filename,
    staleTime: 5_000,
  });
}
