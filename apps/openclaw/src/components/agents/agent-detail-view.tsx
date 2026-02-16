"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Pencil,
  Save,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { listAgents, updateAgent } from "@/server-actions/agents";
import { createThread } from "@/server-actions/threads";
import { AgentFileEditor } from "@/components/agents/agent-file-editor";

// ─────────────────────────────────────────────────

export function AgentDetailView({ agentId }: { agentId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
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

  const startChat = useCallback(async () => {
    if (!agent) return;
    setChatLoading(true);
    try {
      const result = await createThread({
        name: `Chat with ${agent.name}`,
        agentId: agent.id,
      });
      router.push(`/task/${result.id}`);
    } catch (err) {
      toast.error(`Failed to start chat: ${(err as Error).message}`);
      setChatLoading(false);
    }
  }, [agent, router]);

  if (agentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-28 rounded" />
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </div>
            <Skeleton className="mt-3 h-4 w-3/4 rounded" />
          </CardHeader>
        </Card>
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-[480px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (agentQuery.isError) {
    return (
      <div className="space-y-4">
        <Link
          href="/agents"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to agents
        </Link>
        <Card className="animate-fade-in border-destructive/50 bg-destructive/5 shadow-xs">
          <CardContent className="flex items-center gap-3 px-5 py-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">
                Failed to load agent
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {agentQuery.error.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-border/60"
              onClick={() => agentQuery.refetch()}
            >
              Retry
            </Button>
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
        className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to agents
      </Link>

      {/* Agent info card */}
      <Card
        className="animate-fade-in border-t-2 border-t-primary/20 border-border/60 shadow-xs"
        style={{ animationDelay: "0ms" }}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
                {agent.emoji ?? "🤖"}
              </span>
              <div className="min-w-0">
                <CardTitle className="font-[var(--font-cabin)] text-xl tracking-tight">
                  {agent.name}
                </CardTitle>
                {agent.model && (
                  <Badge variant="secondary" className="mt-1.5">
                    {agent.model}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground"
                onClick={startChat}
                disabled={chatLoading}
              >
                {chatLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="size-3.5" />
                )}
                Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border/60"
                onClick={startEditing}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </div>
          {agent.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {agent.description}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Edit dialog (inline) */}
      {editing && (
        <Card
          className="animate-fade-in border-t-2 border-t-primary/20 border-border/60 bg-primary/[0.02] shadow-xs"
          style={{ animationDelay: "60ms" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="font-[var(--font-cabin)] text-base tracking-tight">
              Edit Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-emoji">Emoji</Label>
                  <Input
                    id="edit-emoji"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    maxLength={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-model">Model</Label>
                  <Select value={editModel} onValueChange={setEditModel}>
                    <SelectTrigger id="edit-model">
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
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <Separator />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border/60"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workspace files */}
      <div
        className="animate-fade-in opacity-0 [animation-fill-mode:forwards]"
        style={{ animationDelay: "120ms" }}
      >
        <Separator className="mb-6" />
        <h2 className="font-[var(--font-cabin)] mb-4 text-lg font-semibold tracking-tight">
          Workspace Files
        </h2>
        <AgentFileEditor agentId={agentId} />
      </div>
    </div>
  );
}
