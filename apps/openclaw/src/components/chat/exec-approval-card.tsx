"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldX, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ExecApprovalDecision } from "@/lib/openclaw-types";
import { resolveExecApproval } from "@/server-actions/exec-approvals";

type ExecApprovalCardProps = {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  agentId: string;
};

export function ExecApprovalCard({
  id,
  command,
  args,
  cwd,
  agentId,
}: ExecApprovalCardProps) {
  const [resolved, setResolved] = useState<ExecApprovalDecision | null>(null);

  const mutation = useMutation({
    mutationFn: async (decision: ExecApprovalDecision) => {
      const result = await resolveExecApproval(id, decision);
      if (!result.ok) throw new Error(result.error);
      return decision;
    },
    onSuccess: (decision) => {
      setResolved(decision);
    },
    onError: (err: Error) => {
      toast.error(`Approval failed: ${err.message}`);
    },
  });

  const fullCommand = args?.length ? `${command} ${args.join(" ")}` : command;

  if (resolved) {
    return (
      <div
        className={cn(
          "animate-fade-in flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
          resolved === "deny"
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
        )}
      >
        {resolved === "deny" ? (
          <ShieldX className="size-4 shrink-0" />
        ) : (
          <ShieldCheck className="size-4 shrink-0" />
        )}
        <code className="truncate font-mono text-xs">{fullCommand}</code>
        <span className="ml-auto shrink-0 text-xs font-medium">
          {resolved === "allow_once"
            ? "Allowed"
            : resolved === "always_allow"
              ? "Always allowed"
              : "Denied"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-fade-in rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-xs",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Shield className="size-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-[var(--font-cabin)] text-sm font-medium tracking-tight text-balance text-foreground">
            Exec approval requested
          </p>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
            Agent <code className="text-foreground">{agentId}</code> wants to
            run:
          </p>
          <div
            className={cn(
              "mt-2 flex items-center gap-2 rounded-md border border-border/60",
              "bg-muted/20 px-3 py-2",
            )}
          >
            <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="truncate font-mono text-xs text-foreground">
              {fullCommand}
            </code>
          </div>
          {cwd && (
            <p className="mt-1.5 text-[11px] text-pretty text-muted-foreground">
              in <code>{cwd}</code>
            </p>
          )}
        </div>
      </div>

      <Separator className="my-3 opacity-60" />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label="Allow command once"
          className={cn(
            "h-7 border-primary/30 text-primary hover:bg-primary/10",
          )}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("allow_once")}
        >
          Allow once
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Always allow this command"
          className={cn(
            "h-7 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10",
          )}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("always_allow")}
        >
          Always allow
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Deny command execution"
          className={cn(
            "h-7 border-destructive/30 text-destructive hover:bg-destructive/10",
          )}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("deny")}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
