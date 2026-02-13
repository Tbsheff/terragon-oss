"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Save, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listAgents, updateAgent } from "@/server-actions/agents";
import { AgentFileEditor } from "@/components/agents/agent-file-editor";

// ─────────────────────────────────────────────────

export function AgentDetailView({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const agentQuery = useQuery({
    queryKey: ["agents", agentId],
    queryFn: async () => {
      const result = await listAgents();
      if (!result.ok) throw new Error(result.error);
      const agent = result.data.find((a) => a.id === agentId);
      if (!agent) throw new Error("Agent not found");
      return agent;
    },
  });

  const agent = agentQuery.data;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const result = await updateAgent(agentId, {
        name: editName.trim() || undefined,
        emoji: editEmoji.trim() || undefined,
        model: editModel || undefined,
        description: editDescription.trim() || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent updated");
    },
    onError: (err: Error) => {
      toast.error(`Update failed: ${err.message}`);
    },
  });

  function startEditing() {
    if (!agent) return;
    setEditName(agent.name);
    setEditEmoji(agent.emoji ?? "");
    setEditModel(agent.model ?? "sonnet");
    setEditDescription(agent.description ?? "");
    setEditing(true);
  }

  if (agentQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading agent...
        </span>
      </div>
    );
  }

  if (agentQuery.isError) {
    return (
      <div className="space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agents
        </Link>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Failed to load agent
              </p>
              <p className="text-xs text-muted-foreground">
                {agentQuery.error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to agents
      </Link>

      {/* Agent info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{agent.emoji ?? "🤖"}</span>
              <div>
                <CardTitle className="text-xl">{agent.name}</CardTitle>
                {agent.model && (
                  <span className="inline-block mt-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {agent.model}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          {agent.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {agent.description}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Edit dialog (inline) */}
      {editing && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Edit Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={cn(
                    "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Emoji</label>
                  <input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    maxLength={4}
                    className={cn(
                      "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <select
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
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
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className={cn(
                    "w-full rounded-md border bg-muted/30 px-3 py-2 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workspace files */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Workspace Files</h2>
        <AgentFileEditor agentId={agentId} />
      </div>
    </div>
  );
}
