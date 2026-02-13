"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SPECIALIZED_ROSTER,
  type SetupProgress,
  createAgent,
  setAgentFile,
} from "@/server-actions/agents";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          One-Click Roster Setup
        </CardTitle>
        <CardDescription>
          Create 5 specialized agents pre-configured with SOUL.md files for
          brainstorming, planning, coding, reviewing, and testing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {progress.map((item, i) => (
            <RosterProgressItem key={i} item={item} />
          ))}
        </div>

        <Button
          onClick={() => setupMutation.mutate()}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up roster...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Create All 5 Agents
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────

function RosterProgressItem({ item }: { item: SetupProgress }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
        item.status === "done" && "border-green-500/30 bg-green-500/5",
        item.status === "error" && "border-destructive/30 bg-destructive/5",
        item.status === "creating" && "border-primary/30 bg-primary/5",
      )}
    >
      <span className="text-lg">{item.agent.emoji}</span>
      <div className="flex-1">
        <div className="font-medium">{item.agent.name}</div>
        <div className="text-xs text-muted-foreground">
          {item.agent.description}
        </div>
        {item.error && (
          <div className="mt-1 text-xs text-destructive">{item.error}</div>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">
          {item.agent.model}
        </span>
        <StatusIcon status={item.status} />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SetupProgress["status"] }) {
  switch (status) {
    case "pending":
      return (
        <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
      );
    case "creating":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}
