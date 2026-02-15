import { queryOptions } from "@tanstack/react-query";
import { listChannels } from "@/server-actions/channels";

export const channelQueryKeys = {
  all: ["channels"] as const,
  status: () => [...channelQueryKeys.all, "status"] as const,
};

export function channelStatusQueryOptions() {
  return queryOptions({
    queryKey: channelQueryKeys.status(),
    queryFn: listChannels,
    refetchInterval: 30000, // Refetch every 30s
  });
}
