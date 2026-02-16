"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getAgentFiles, setAgentFile } from "@/server-actions/agents";

// ─────────────────────────────────────────────────

const WORKSPACE_FILES = [
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "MEMORY.md",
] as const;

type WorkspaceFile = (typeof WORKSPACE_FILES)[number];

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─────────────────────────────────────────────────

export function AgentFileEditor({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceFile>("SOUL.md");
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filesQuery = useQuery({
    queryKey: ["agent-files", agentId],
    queryFn: async () => {
      const result = await getAgentFiles(agentId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  // Sync fetched files into local buffers (only for non-dirty files)
  const files = filesQuery.data;
  useEffect(() => {
    if (!files) return;
    const next: Record<string, string> = {};
    for (const f of files) {
      if (!dirty[f.name]) {
        next[f.name] = f.content;
      }
    }
    setBuffers((prev) => ({ ...prev, ...next }));
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async ({
      filename,
      content,
    }: {
      filename: string;
      content: string;
    }) => {
      const result = await setAgentFile(agentId, filename, content);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      setSaveStatus("saved");
      setDirty((prev) => ({ ...prev, [variables.filename]: false }));
      queryClient.invalidateQueries({ queryKey: ["agent-files", agentId] });
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: (err: Error) => {
      setSaveStatus("error");
      toast.error(`Save failed: ${err.message}`);
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const handleChange = useCallback(
    (filename: string, value: string) => {
      setBuffers((prev) => ({ ...prev, [filename]: value }));
      setDirty((prev) => ({ ...prev, [filename]: true }));
      setSaveStatus("idle");

      // Auto-save after 2s of inactivity
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        setSaveStatus("saving");
        saveMutation.mutate({ filename, content: value });
      }, 2000);
    },
    [saveMutation],
  );

  const handleManualSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const content = buffers[activeTab] ?? "";
    setSaveStatus("saving");
    saveMutation.mutate({ filename: activeTab, content });
  }, [activeTab, buffers, saveMutation]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  if (filesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-[480px] w-full rounded-lg" />
      </div>
    );
  }

  if (filesQuery.isError) {
    return (
      <div className="animate-fade-in flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-xs">!</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Failed to load agent files</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {filesQuery.error.message}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => filesQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as WorkspaceFile)}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            {WORKSPACE_FILES.map((f) => (
              <TabsTrigger key={f} value={f} className="relative">
                {f}
                {dirty[f] && (
                  <span className="absolute -right-0.5 -top-0.5 size-1.5 animate-pulse rounded-full bg-primary" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-2">
            <SaveStatusIndicator status={saveStatus} />
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              disabled={!dirty[activeTab] && saveStatus !== "idle"}
            >
              <Save className="size-3.5" />
              Save
            </Button>
          </div>
        </div>

        {WORKSPACE_FILES.map((f) => (
          <TabsContent key={f} value={f} className="mt-3">
            <textarea
              value={buffers[f] ?? ""}
              onChange={(e) => handleChange(f, e.target.value)}
              placeholder={`# ${f}\n\nStart writing...`}
              spellCheck={false}
              className={cn(
                "w-full min-h-[480px] resize-y rounded-lg border border-border bg-muted/30 p-4",
                "font-mono text-sm leading-relaxed text-foreground",
                "placeholder:text-muted-foreground/40",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
                "transition-colors duration-150",
              )}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "animate-fade-in flex items-center gap-1.5 text-xs font-medium",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-primary",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3" />
          Saved
        </>
      )}
      {status === "error" && "Save failed"}
    </span>
  );
}
