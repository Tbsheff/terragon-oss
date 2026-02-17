"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createThread } from "@/server-actions/threads";
import { listAgents } from "@/server-actions/agents";
import { getSettings } from "@/server-actions/settings";
import { threadListQueryOptions } from "@/queries/thread-queries";
import { dashboardStatsQueryOptions } from "@/queries/dashboard-queries";
import { useRealtimeGlobal } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import {
  Rocket,
  Bug,
  FileText,
  RefreshCw,
  TestTube,
  Sparkles,
  Check,
  Loader2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { QuickStatsRow } from "@/components/dashboard/quick-stats-row";
import { ActiveAgentsPanel } from "@/components/dashboard/active-agents-panel";
import { ErrorFeed } from "@/components/dashboard/error-feed";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";

const QUICK_TEMPLATES = [
  {
    id: "feature-full",
    label: "Full Feature",
    icon: Sparkles,
    stages: "Brainstorm → Plan → Implement → Review → Test → CI",
  },
  {
    id: "feature-fast",
    label: "Fast Feature",
    icon: Rocket,
    stages: "Plan → Implement → Test → CI",
  },
  {
    id: "bugfix",
    label: "Bug Fix",
    icon: Bug,
    stages: "Implement → Test → CI",
  },
  {
    id: "refactor",
    label: "Refactor",
    icon: RefreshCw,
    stages: "Plan → Implement → Review → Test → CI",
  },
  { id: "docs", label: "Docs Only", icon: FileText, stages: "Implement → CI" },
  { id: "test", label: "Test Only", icon: TestTube, stages: "Implement → CI" },
] as const;

export function OpenClawDashboard() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [usePipeline, setUsePipeline] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("feature-fast");
  const [repoFullName, setRepoFullName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  // Subscribe to global real-time updates for auto-refresh
  useRealtimeGlobal();

  // Dashboard data
  const { data: stats } = useQuery(dashboardStatsQueryOptions());
  const { data: threads } = useQuery(
    threadListQueryOptions({ archived: false }),
  );
  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await listAgents();
      if (!result.ok) return [];
      return result.data;
    },
  });
  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

  // Pre-select user's default agent once settings load
  useEffect(() => {
    if (appSettings?.defaultAgent && !selectedAgentId) {
      setSelectedAgentId(appSettings.defaultAgent);
    }
  }, [appSettings?.defaultAgent, selectedAgentId]);

  const handleCreate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsCreating(true);
    try {
      const result = await createThread({
        name: prompt.slice(0, 100),
        agentId: selectedAgentId || undefined,
        githubRepoFullName: repoFullName || undefined,
        pipelineTemplateId: usePipeline ? selectedTemplate : undefined,
      });
      router.push(`/task/${result.id}`);
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsCreating(false);
    }
  }, [
    prompt,
    selectedAgentId,
    repoFullName,
    usePipeline,
    selectedTemplate,
    router,
  ]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      {/* Quick Stats Row -- full width */}
      <div className="mb-6">
        <QuickStatsRow stats={stats} />
      </div>

      {/* Two-column layout */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column (2/3): Active Agents + Recent Activity */}
        <div className="space-y-6 lg:col-span-2">
          <ActiveAgentsPanel threads={threads} />
          <RecentActivityFeed threads={threads} />
        </div>

        {/* Right column (1/3): New Task + Error Feed */}
        <div className="space-y-6">
          {/* New Task Card */}
          <Card
            className="animate-fade-in border-border/60 shadow-xs border-t-2 border-t-primary/20 [&:has(textarea:focus-visible)]:ring-1 [&:has(textarea:focus-visible)]:ring-primary/10 transition-shadow duration-200"
            style={{ animationDelay: "100ms" }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-[var(--font-cabin)] text-base tracking-tight text-balance">
                New Task
              </CardTitle>
              <CardDescription className="text-xs text-pretty">
                Tell your agents what to build
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {/* Prompt input */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a new tRPC endpoint for user preferences..."
                rows={3}
                className="w-full rounded-lg border border-input bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none resize-none transition-colors duration-150"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleCreate();
                  }
                }}
              />

              {/* Agent picker */}
              {agents && agents.length > 0 && (
                <div className="space-y-1">
                  <Label
                    htmlFor="agent-select"
                    className="text-xs text-muted-foreground"
                  >
                    Agent
                  </Label>
                  <Select
                    value={selectedAgentId}
                    onValueChange={setSelectedAgentId}
                  >
                    <SelectTrigger
                      size="sm"
                      id="agent-select"
                      className="h-8 text-sm"
                    >
                      <SelectValue placeholder="Select agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-1.5">
                            <span>{a.emoji ?? "🤖"}</span>
                            <span>{a.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Repo input */}
              <div className="space-y-1">
                <Label htmlFor="repo" className="text-xs text-muted-foreground">
                  Repository (optional)
                </Label>
                <Input
                  id="repo"
                  type="text"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  placeholder="owner/repo"
                  className="h-8 text-sm"
                />
              </div>

              <Separator className="opacity-60" />

              {/* Pipeline toggle — defaults to off (single-chat mode) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="pipeline-toggle"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                  >
                    <Workflow className="size-3.5" />
                    Pipeline mode
                  </Label>
                  <Switch
                    id="pipeline-toggle"
                    checked={usePipeline}
                    onCheckedChange={setUsePipeline}
                    className="scale-75 origin-right"
                  />
                </div>
                {!usePipeline && (
                  <p className="text-[11px] text-muted-foreground/60 text-pretty">
                    Single-chat mode: one session, one conversation.
                  </p>
                )}
              </div>

              {/* Pipeline template selection — only shown when pipeline is enabled */}
              {usePipeline && (
                <div className="animate-fade-in">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Pipeline Template
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_TEMPLATES.map((t, i) => {
                      const isSelected = selectedTemplate === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={cn(
                            "animate-fade-in flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-all duration-150 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                            isSelected
                              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                              : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03]",
                          )}
                          style={{
                            animationDelay: `${150 + i * 40}ms`,
                          }}
                        >
                          <t.icon
                            className={cn(
                              "size-3.5 shrink-0 transition-colors duration-150",
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate text-xs font-medium">
                            {t.label}
                          </span>
                          {isSelected && (
                            <Check className="ml-auto size-3 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Create button */}
              <Button
                size="default"
                className="w-full gap-2"
                onClick={handleCreate}
                disabled={!prompt.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Start Task
                  </>
                )}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
                <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                  ⌘
                </kbd>
                <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                  Enter
                </kbd>
                <span className="ml-0.5">to start</span>
              </p>
            </CardContent>
          </Card>

          {/* Error Feed */}
          <ErrorFeed errors={stats?.recentErrors} />
        </div>
      </div>
    </div>
  );
}
