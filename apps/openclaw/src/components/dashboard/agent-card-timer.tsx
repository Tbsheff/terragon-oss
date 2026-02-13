"use client";

import { useElapsedTime } from "@/hooks/use-elapsed-time";

type AgentCardTimerProps = {
  startedAt: string | null;
};

export function AgentCardTimer({ startedAt }: AgentCardTimerProps) {
  const elapsed = useElapsedTime(startedAt);
  if (!elapsed) return null;

  return (
    <span className="text-[10px] font-mono text-primary tabular-nums">
      {elapsed}
    </span>
  );
}
