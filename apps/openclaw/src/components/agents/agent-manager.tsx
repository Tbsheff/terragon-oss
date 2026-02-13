"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Bot,
  AlertTriangle,
  Sparkles,
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
import { cn } from "@/lib/utils";
import type { OpenClawAgent } from "@/lib/openclaw-types";
import { listAgents, createAgent, deleteAgent } from "@/server-actions/agents";
import { AgentRosterSetup } from "@/components/agents/agent-roster-setup";

// ─────────────────────────────────────────────────

export function AgentManager() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OpenClawAgent | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await listAgents();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Roster</h1>
          <p className="text-sm text-muted-foreground">
            Manage your specialized coding agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="h-4 w-4" />
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
              <Button>
                <Plus className="h-4 w-4" />
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

      {/* Loading */}
      {agentsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading agents...
          </span>
        </div>
      )}

      {/* Error */}
      {agentsQuery.isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Failed to load agents
              </p>
              <p className="text-xs text-muted-foreground">
                {agentsQuery.error.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => agentsQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {agentsQuery.data && agentsQuery.data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              No agents yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create one manually or use One-Click Setup for the full roster.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRosterOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                One-Click Setup
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent grid */}
      {agentsQuery.data && agentsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agentsQuery.data.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={() => setDeleteTarget(agent)}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
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
// Agent Card
// ─────────────────────────────────────────────────

function AgentCard({
  agent,
  onDelete,
}: {
  agent: OpenClawAgent;
  onDelete: () => void;
}) {
  return (
    <Link href={`/agents/${agent.id}`} className="group block">
      <Card className="transition-colors hover:border-primary/40 hover:bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{agent.emoji ?? "🤖"}</span>
              <div>
                <CardTitle className="text-base">{agent.name}</CardTitle>
                {agent.model && (
                  <span className="inline-block mt-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {agent.model}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </CardHeader>
        {agent.description && (
          <CardContent className="pt-0">
            <CardDescription className="line-clamp-2">
              {agent.description}
            </CardDescription>
          </CardContent>
        )}
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
      className="space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. coder"
          required
          className={cn(
            "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Emoji</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🤖"
            maxLength={4}
            className={cn(
              "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-ring",
            )}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={cn(
              "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring",
            )}
          >
            <option value="opus">opus</option>
            <option value="sonnet">sonnet</option>
            <option value="haiku">haiku</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent do?"
          className={cn(
            "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}
