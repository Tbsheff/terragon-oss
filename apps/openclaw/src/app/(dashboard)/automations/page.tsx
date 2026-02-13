"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAutomations,
  createAutomation,
  deleteAutomation,
  toggleAutomation,
  type TriggerConfig,
} from "@/server-actions/automations";
import { cn } from "@/lib/utils";
import {
  Zap,
  Plus,
  Trash2,
  Clock,
  GitPullRequest,
  LayoutList,
  Power,
  PowerOff,
} from "lucide-react";

const TRIGGER_ICONS = {
  cron: Clock,
  linear: LayoutList,
  "github-pr": GitPullRequest,
} as const;

const TRIGGER_LABELS = {
  cron: "Scheduled (Cron)",
  linear: "Linear Issue",
  "github-pr": "GitHub PR",
} as const;

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: automationList } = useQuery({
    queryKey: ["automations"],
    queryFn: listAutomations,
  });

  const deleteMut = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["automations"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleAutomation(id, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["automations"] }),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Automations</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled and event-triggered task pipelines
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Automation
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showCreate && (
          <CreateAutomationForm onClose={() => setShowCreate(false)} />
        )}

        <div className="grid gap-3 mt-4">
          {(automationList ?? []).map((auto) => {
            const TriggerIcon =
              TRIGGER_ICONS[auto.triggerType as keyof typeof TRIGGER_ICONS] ??
              Zap;
            const config: TriggerConfig = JSON.parse(auto.triggerConfig);

            return (
              <div
                key={auto.id}
                className={cn(
                  "rounded-lg border bg-card p-4",
                  auto.enabled
                    ? "border-border"
                    : "border-border/50 opacity-60",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <TriggerIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h3 className="text-sm font-medium">{auto.name}</h3>
                      {auto.description && (
                        <p className="text-xs text-muted-foreground">
                          {auto.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        toggleMut.mutate({
                          id: auto.id,
                          enabled: !auto.enabled,
                        })
                      }
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        auto.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                      title={auto.enabled ? "Disable" : "Enable"}
                    >
                      {auto.enabled ? (
                        <Power className="h-3.5 w-3.5" />
                      ) : (
                        <PowerOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(auto.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {
                      TRIGGER_LABELS[
                        auto.triggerType as keyof typeof TRIGGER_LABELS
                      ]
                    }
                  </span>
                  {config.type === "cron" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {config.expression}
                    </span>
                  )}
                  {config.type === "linear" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      label: {config.labelFilter}
                    </span>
                  )}
                  {config.type === "github-pr" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {config.repoFullName} ({config.event})
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground/70 truncate font-mono">
                  {auto.prompt}
                </p>
              </div>
            );
          })}

          {(automationList ?? []).length === 0 && !showCreate && (
            <div className="text-center py-12">
              <Zap className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No automations yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Create one to run tasks on a schedule or in response to events
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateAutomationForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<
    "cron" | "linear" | "github-pr"
  >("cron");
  const [cronExpression, setCronExpression] = useState("0 9 * * 1-5");
  const [linearLabel, setLinearLabel] = useState("agent");
  const [githubRepo, setGithubRepo] = useState("");
  const [prompt, setPrompt] = useState("");

  const createMut = useMutation({
    mutationFn: () => {
      let triggerConfig: TriggerConfig;
      if (triggerType === "cron") {
        triggerConfig = { type: "cron", expression: cronExpression };
      } else if (triggerType === "linear") {
        triggerConfig = {
          type: "linear",
          teamId: "",
          labelFilter: linearLabel,
        };
      } else {
        triggerConfig = {
          type: "github-pr",
          repoFullName: githubRepo,
          event: "opened",
        };
      }
      return createAutomation({ name, triggerType, triggerConfig, prompt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Automation name"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Trigger
        </p>
        <div className="flex gap-2">
          {(["cron", "linear", "github-pr"] as const).map((t) => {
            const Icon = TRIGGER_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => setTriggerType(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                  triggerType === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {TRIGGER_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      {triggerType === "cron" && (
        <input
          type="text"
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          placeholder="Cron expression (e.g. 0 9 * * 1-5)"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}
      {triggerType === "linear" && (
        <input
          type="text"
          value={linearLabel}
          onChange={(e) => setLinearLabel(e.target.value)}
          placeholder="Linear label filter (e.g. agent)"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}
      {triggerType === "github-pr" && (
        <input
          type="text"
          value={githubRepo}
          onChange={(e) => setGithubRepo(e.target.value)}
          placeholder="owner/repo"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Prompt for the pipeline"
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => createMut.mutate()}
          disabled={!name.trim() || !prompt.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </div>
  );
}
