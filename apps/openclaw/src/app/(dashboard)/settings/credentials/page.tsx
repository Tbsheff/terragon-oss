"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Key, Loader2, Plus, Trash2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  listCredentials,
  createCredential,
  deleteCredential,
  syncCredentialsToGateway,
} from "@/server-actions/credentials";

type Provider = "anthropic" | "openai" | "google" | "amp" | "github";

const providerLabels: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  amp: "Amp",
  github: "GitHub",
};

export default function CredentialsSettingsPage() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [newProvider, setNewProvider] = useState<Provider>("anthropic");
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const { data: creds, isLoading } = useQuery({
    queryKey: ["settings", "credentials"],
    queryFn: () => listCredentials(),
  });

  function handleAdd() {
    if (!newName.trim() || !newValue.trim()) {
      toast.error("Name and value are required");
      return;
    }
    startTransition(async () => {
      try {
        await createCredential({
          provider: newProvider,
          name: newName.trim(),
          value: newValue.trim(),
        });
        await queryClient.invalidateQueries({
          queryKey: ["settings", "credentials"],
        });
        setNewName("");
        setNewValue("");
        setShowAdd(false);
        toast.success("Credential added");
      } catch {
        toast.error("Failed to add credential");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteCredential(id);
        await queryClient.invalidateQueries({
          queryKey: ["settings", "credentials"],
        });
        setDeleteConfirm(null);
        toast.success("Credential deleted");
      } catch {
        toast.error("Failed to delete credential");
      }
    });
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const result = await syncCredentialsToGateway();
      if (result.success) {
        toast.success("Credentials synced to gateway");
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    } catch {
      toast.error("Sync failed unexpectedly");
    } finally {
      setIsSyncing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md border-border/60" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 border-border/60" />
            <Skeleton className="h-4 w-48 border-border/60" />
          </div>
        </div>
        <Skeleton className="h-px w-full border-border/60" />
        <Skeleton className="h-[300px] w-full rounded-xl border-border/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Back to settings"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to settings</TooltipContent>
        </Tooltip>
        <div>
          <h1 className="font-[var(--font-cabin)] text-2xl font-bold tracking-tight text-balance">
            Credentials
          </h1>
          <p className="text-xs text-muted-foreground text-pretty">
            Manage API keys for AI providers
          </p>
        </div>
      </div>
      <Separator className="mb-6 opacity-60" />

      <Card className="animate-fade-in border-t-2 border-t-primary/20 border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-[var(--font-cabin)] text-base tracking-tight">
                API Keys
              </CardTitle>
              <CardDescription className="text-xs">
                Stored credentials used by the OpenClaw gateway
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || !creds?.length}
              >
                {isSyncing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                Sync to Gateway
              </Button>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="mr-1.5 size-3.5" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAdd && (
            <div className="animate-fade-in rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Provider
                </Label>
                <Select
                  value={newProvider}
                  onValueChange={(v) => setNewProvider(v as Provider)}
                >
                  <SelectTrigger className="bg-muted/20 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(providerLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="credName"
                  className="text-xs text-muted-foreground"
                >
                  Name
                </Label>
                <Input
                  id="credName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Production API Key"
                  className="bg-muted/20 border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="credValue"
                  className="text-xs text-muted-foreground"
                >
                  API Key
                </Label>
                <Input
                  id="credValue"
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="sk-..."
                  className="bg-muted/20 border-border/60"
                />
              </div>
              <Separator className="opacity-60" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    setNewName("");
                    setNewValue("");
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Add Credential
                </Button>
              </div>
            </div>
          )}

          {creds && creds.length > 0 ? (
            <div className="divide-y divide-border/40 rounded-md border border-border/60">
              {creds.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Key className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium truncate">
                        {cred.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {providerLabels[cred.provider as Provider] ??
                          cred.provider}{" "}
                        &middot; Added{" "}
                        <span className="tabular-nums">
                          {new Date(cred.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {cred.provider}
                    </span>
                    {deleteConfirm === cred.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDelete(cred.id)}
                          disabled={isPending}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${cred.name}`}
                        onClick={() => setDeleteConfirm(cred.id)}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showAdd && (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 py-8 text-center">
                <Key className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No credentials configured yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Add your first credential
                </Button>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
