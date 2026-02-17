"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { listAgents } from "@/server-actions/agents";
import { ThreadListItem } from "./thread-list-item";
import { ChevronRight, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadListItem as ThreadListItemType } from "@/server-actions/threads";

export function ThreadListGrouped({ archived }: { archived: boolean }) {
  const { data: threads } = useQuery(threadListQueryOptions({ archived }));

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await listAgents();
      if (!result.ok) return [];
      return result.data;
    },
  });

  const groups = useMemo(() => {
    if (!threads?.length) return [];
    const map = new Map<string, ThreadListItemType[]>();
    for (const t of threads) {
      const key = t.agent || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Sort groups by most recent thread's updatedAt
    return Array.from(map.entries())
      .map(([agentId, items]) => ({
        agentId,
        agent: agents?.find((a) => a.id === agentId),
        threads: items,
      }))
      .sort((a, b) => {
        const aTime = new Date(a.threads[0]?.updatedAt ?? 0).getTime();
        const bTime = new Date(b.threads[0]?.updatedAt ?? 0).getTime();
        return bTime - aTime;
      });
  }, [threads, agents]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (agentId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  if (!threads?.length) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-muted-foreground">
        <Leaf className="size-5 opacity-40" />
        <p className="text-xs text-pretty">No threads</p>
      </div>
    );
  }

  // If only one group, render threads directly without group header
  if (groups.length === 1) {
    const group = groups[0]!;
    return (
      <div className="flex flex-col gap-0.5">
        {group.threads.map((thread, index) => (
          <ThreadListItem key={thread.id} thread={thread} index={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.agentId);
        const agentName = group.agent?.name ?? group.agentId;
        const agentEmoji = group.agent?.emoji ?? "";

        return (
          <div key={group.agentId}>
            {/* Group header */}
            <button
              onClick={() => toggleCollapse(group.agentId)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={cn(
                  "size-3 shrink-0 transition-transform duration-150",
                  !isCollapsed && "rotate-90",
                )}
              />
              {agentEmoji && <span className="text-xs">{agentEmoji}</span>}
              <span className="truncate">{agentName}</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
                {group.threads.length}
              </span>
            </button>

            {/* Thread items */}
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5">
                {group.threads.map((thread, index) => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
