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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  cron: "border-blue-500/30 text-blue-600 dark:text-blue-400",
  linear: "border-purple-500/30 text-purple-600 dark:text-purple-400",
  "github-pr": "border-orange-500/30 text-orange-600 dark:text-orange-400",
};

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
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold font-[var(--font-cabin)]">
              Automations
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled and event-triggered task pipelines
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5" />
            New Automation
          </Button>
        </div>
      </div>
      <Separator />

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
              <Card
                key={auto.id}
                className={cn(
                  "py-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                  !auto.enabled && "opacity-60",
                )}
              >
                <CardContent className="p-4">
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-7 w-7",
                              auto.enabled &&
                                "text-emerald-500 hover:bg-emerald-500/10",
                            )}
                            onClick={() =>
                              toggleMut.mutate({
                                id: auto.id,
                                enabled: !auto.enabled,
                              })
                            }
                          >
                            {auto.enabled ? (
                              <Power className="h-3.5 w-3.5" />
                            ) : (
                              <PowerOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {auto.enabled ? "Disable" : "Enable"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteMut.mutate(auto.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete automation</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        TRIGGER_BADGE_COLORS[auto.triggerType],
                      )}
                    >
                      {
                        TRIGGER_LABELS[
                          auto.triggerType as keyof typeof TRIGGER_LABELS
                        ]
                      }
                    </Badge>
                    {config.type === "cron" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          TRIGGER_BADGE_COLORS[auto.triggerType],
                        )}
                      >
                        {config.expression}
                      </Badge>
                    )}
                    {config.type === "linear" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          TRIGGER_BADGE_COLORS[auto.triggerType],
                        )}
                      >
                        label: {config.labelFilter}
                      </Badge>
                    )}
                    {config.type === "github-pr" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          TRIGGER_BADGE_COLORS[auto.triggerType],
                        )}
                      >
                        {config.repoFullName} ({config.event})
                      </Badge>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground/70 truncate font-mono rounded-md bg-muted/30 px-2 py-1 border border-border/30">
                    {auto.prompt}
                  </p>
                </CardContent>
              </Card>
            );
          })}

          {(automationList ?? []).length === 0 && !showCreate && (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No automations yet
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Create one to run tasks on a schedule or in response to events
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Automation
                </Button>
              </CardContent>
            </Card>
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
    <Card className="border-primary/30 py-0 animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="automation-name" className="text-xs">
            Name
          </Label>
          <Input
            id="automation-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation name"
          />
        </div>

        <div>
          <Label className="text-xs mb-1.5">Trigger</Label>
          <div className="flex gap-2">
            {(["cron", "linear", "github-pr"] as const).map((t) => {
              const Icon = TRIGGER_ICONS[t];
              return (
                <Button
                  key={t}
                  variant={triggerType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTriggerType(t)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {TRIGGER_LABELS[t]}
                </Button>
              );
            })}
          </div>
        </div>

        {triggerType === "cron" && (
          <div className="space-y-1.5">
            <Label htmlFor="cron-expression" className="text-xs">
              Cron Expression
            </Label>
            <Input
              id="cron-expression"
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="Cron expression (e.g. 0 9 * * 1-5)"
              className="font-mono"
            />
          </div>
        )}
        {triggerType === "linear" && (
          <div className="space-y-1.5">
            <Label htmlFor="linear-label" className="text-xs">
              Label Filter
            </Label>
            <Input
              id="linear-label"
              type="text"
              value={linearLabel}
              onChange={(e) => setLinearLabel(e.target.value)}
              placeholder="Linear label filter (e.g. agent)"
            />
          </div>
        )}
        {triggerType === "github-pr" && (
          <div className="space-y-1.5">
            <Label htmlFor="github-repo" className="text-xs">
              Repository
            </Label>
            <Input
              id="github-repo"
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="owner/repo"
            />
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt for the pipeline"
          rows={2}
          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm resize-none shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || !prompt.trim()}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
