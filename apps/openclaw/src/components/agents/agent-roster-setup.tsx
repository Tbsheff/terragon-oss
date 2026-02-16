"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SPECIALIZED_ROSTER, type SetupProgress } from "@/lib/agent-roster";
import { createAgent, setAgentFile } from "@/server-actions/agents";
import { generateSoulMd } from "@/lib/agent-soul-generator";

// ─────────────────────────────────────────────────

export function AgentRosterSetup({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<SetupProgress[]>(
    SPECIALIZED_ROSTER.map((agent) => ({
      agent,
      status: "pending",
    })),
  );
  const [isRunning, setIsRunning] = useState(false);

  const updateProgress = useCallback(
    (index: number, update: Partial<SetupProgress>) => {
      setProgress((prev) =>
        prev.map((p, i) => (i === index ? { ...p, ...update } : p)),
      );
    },
    [],
  );

  const setupMutation = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      const created: string[] = [];

      for (let i = 0; i < SPECIALIZED_ROSTER.length; i++) {
        const roster = SPECIALIZED_ROSTER[i]!;
        updateProgress(i, { status: "creating" });

        try {
          const result = await createAgent({
            name: roster.name,
            emoji: roster.emoji,
            model: roster.model,
            description: roster.description,
          });

          if (!result.ok) {
            updateProgress(i, { status: "error", error: result.error });
            continue;
          }

          // Set SOUL.md
          const soulContent = generateSoulMd(roster.role);
          const fileResult = await setAgentFile(
            result.data.id,
            "SOUL.md",
            soulContent,
          );

          if (!fileResult.ok) {
            updateProgress(i, {
              status: "error",
              error: `Agent created but SOUL.md failed: ${fileResult.error}`,
            });
          } else {
            updateProgress(i, { status: "done" });
          }

          created.push(result.data.id);
        } catch (err) {
          updateProgress(i, {
            status: "error",
            error: (err as Error).message,
          });
        }
      }

      return created;
    },
    onSuccess: (created) => {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      const succeeded = created.length;
      const total = SPECIALIZED_ROSTER.length;
      if (succeeded === total) {
        toast.success(`All ${total} agents created successfully`);
      } else {
        toast.warning(
          `${succeeded}/${total} agents created. Check errors above.`,
        );
      }
      onComplete?.();
    },
    onError: (err: Error) => {
      setIsRunning(false);
      toast.error(`Setup failed: ${err.message}`);
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        {progress.map((item, i) => (
          <RosterProgressItem key={i} item={item} index={i} />
        ))}
      </div>

      <Button
        onClick={() => setupMutation.mutate()}
        disabled={isRunning}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Setting up roster...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Create All 5 Agents
          </>
        )}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────

function RosterProgressItem({
  item,
  index,
}: {
  item: SetupProgress;
  index: number;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in opacity-0 [animation-fill-mode:forwards]",
        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-200",
        item.status === "pending" && "border-border bg-card",
        item.status === "done" && "border-primary/30 bg-primary/5",
        item.status === "error" && "border-destructive/30 bg-destructive/5",
        item.status === "creating" && "border-primary/40 bg-primary/10",
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base">
        {item.agent.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{item.agent.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.agent.description}
        </div>
        {item.error && (
          <div className="mt-1 truncate text-xs text-destructive">
            {item.error}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {item.agent.model}
        </Badge>
        <StatusIcon status={item.status} />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SetupProgress["status"] }) {
  switch (status) {
    case "pending":
      return (
        <div className="size-4 rounded-full border-2 border-muted-foreground/20" />
      );
    case "creating":
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="size-4 text-primary" />;
    case "error":
      return <XCircle className="size-4 text-destructive" />;
  }
}
