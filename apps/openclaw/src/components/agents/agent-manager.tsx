"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Bot,
  AlertTriangle,
  Sparkles,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OpenClawAgent } from "@/lib/openclaw-types";
import {
  createAgent,
  deleteAgent,
  listAgentsWithStatus,
  type AgentFleetStatus,
  type AgentWithStatus,
} from "@/server-actions/agents";
import { AgentRosterSetup } from "@/components/agents/agent-roster-setup";
import { createThread } from "@/server-actions/threads";

// ─────────────────────────────────────────────────

export function AgentManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OpenClawAgent | null>(null);

  const startChat = useCallback(
    async (agent: AgentWithStatus) => {
      try {
        const result = await createThread({
          name: `Chat with ${agent.name}`,
          agentId: agent.id,
        });
        router.push(`/task/${result.id}`);
      } catch (err) {
        toast.error(`Failed to start chat: ${(err as Error).message}`);
      }
    },
    [router],
  );

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await listAgentsWithStatus();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    refetchInterval: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteAgent(id);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-cabin)] text-xl font-semibold tracking-tight">
            Agent Roster
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your specialized coding agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-border/60">
                <Sparkles className="size-4" />
                One-Click Setup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Roster Setup</DialogTitle>
                <DialogDescription>
                  Create all 5 specialized agents with pre-configured SOUL.md
                  files.
                </DialogDescription>
              </DialogHeader>
              <AgentRosterSetup
                onComplete={() => {
                  setRosterOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["agents"] });
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="size-4" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Agent</DialogTitle>
                <DialogDescription>
                  Add a new agent to your roster.
                </DialogDescription>
              </DialogHeader>
              <CreateAgentForm
                onCreated={() => {
                  setCreateOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["agents"] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading skeleton */}
      {agentsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="flex h-full flex-col border-border/60 shadow-xs"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-14 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="mt-1.5 h-4 w-2/3 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {agentsQuery.isError && (
        <Card className="animate-fade-in border-destructive/50 bg-destructive/5 shadow-xs">
          <CardContent className="flex items-center gap-3 px-5 py-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">
                Failed to load agents
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {agentsQuery.error.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-border/60"
              onClick={() => agentsQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {agentsQuery.data && agentsQuery.data.length === 0 && (
        <Card className="animate-fade-in border-dashed border-border/60 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Bot className="size-8 text-muted-foreground/50" />
            </div>
            <p className="mt-5 font-[var(--font-cabin)] text-base font-semibold tracking-tight text-foreground">
              No agents yet
            </p>
            <p className="mt-1.5 max-w-xs text-center text-sm text-muted-foreground">
              Create one manually or use One-Click Setup to scaffold the full
              roster of specialized agents.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-border/60"
                onClick={() => setRosterOpen(true)}
              >
                <Sparkles className="size-3.5" />
                One-Click Setup
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-3.5" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent grid */}
      {agentsQuery.data && agentsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {agentsQuery.data.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              onDelete={() => setDeleteTarget(agent)}
              onChat={() => startChat(agent)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border/60"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Fleet Status Badge
// ─────────────────────────────────────────────────

const fleetStatusConfig: Record<
  AgentFleetStatus,
  { color: string; pulseColor?: string; label: string }
> = {
  running: {
    color: "bg-green-500",
    pulseColor: "bg-green-400",
    label: "Running",
  },
  idle: { color: "bg-zinc-400", label: "Idle" },
  error: { color: "bg-red-500", label: "Error" },
  approval: {
    color: "bg-amber-500",
    pulseColor: "bg-amber-400",
    label: "Awaiting Approval",
  },
};

function FleetStatusDot({ status }: { status: AgentFleetStatus }) {
  const config = fleetStatusConfig[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative flex size-4 items-center justify-center shrink-0">
          {config.pulseColor && (
            <span
              className={cn(
                "absolute inline-flex size-2 animate-ping rounded-full opacity-75",
                config.pulseColor,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full",
              config.color,
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────
// Agent Card
// ─────────────────────────────────────────────────

function AgentCard({
  agent,
  index,
  onDelete,
  onChat,
}: {
  agent: AgentWithStatus;
  index: number;
  onDelete: () => void;
  onChat: () => void;
}) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="animate-fade-in group block opacity-0 [animation-fill-mode:forwards]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Card className="flex h-full flex-col border-t-2 border-t-primary/20 border-border/60 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xl">
                {agent.emoji ?? "🤖"}
                <span className="absolute -right-0.5 -top-0.5">
                  <FleetStatusDot status={agent.fleetStatus} />
                </span>
              </span>
              <div className="min-w-0">
                <CardTitle className="font-[var(--font-cabin)] truncate text-base tracking-tight">
                  {agent.name}
                </CardTitle>
                <div className="mt-1 flex items-center gap-1.5">
                  {agent.model && (
                    <Badge variant="secondary" className="text-[10px]">
                      {agent.model}
                    </Badge>
                  )}
                  {agent.activeSessions > 0 && (
                    <Badge
                      variant="outline"
                      className="tabular-nums text-[10px] border-border/60"
                    >
                      {agent.activeSessions} session
                      {agent.activeSessions !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Chat with ${agent.name}`}
                    className="size-7 opacity-0 transition-all group-hover:opacity-100 hover:text-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChat();
                    }}
                  >
                    <MessageSquare className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chat with {agent.name}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${agent.name}`}
                    className="size-7 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete agent</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <CardDescription className="line-clamp-2 min-h-[2.5rem]">
            {agent.description || "No description"}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─────────────────────────────────────────────────
// Create Agent Form
// ─────────────────────────────────────────────────

function CreateAgentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [model, setModel] = useState("sonnet");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await createAgent({
        name: name.trim(),
        emoji: emoji.trim() || undefined,
        model,
        description: description.trim() || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Agent created");
      onCreated();
    },
    onError: (err: Error) => {
      toast.error(`Create failed: ${err.message}`);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="agent-name">Name *</Label>
        <Input
          id="agent-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. coder"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="agent-emoji">Emoji</Label>
          <Input
            id="agent-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🤖"
            maxLength={4}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-model">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="agent-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opus">opus</SelectItem>
              <SelectItem value="sonnet">sonnet</SelectItem>
              <SelectItem value="haiku">haiku</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-description">Description</Label>
        <Input
          id="agent-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent do?"
        />
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="submit"
          disabled={!name.trim() || mutation.isPending}
          className="bg-primary text-primary-foreground"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}
