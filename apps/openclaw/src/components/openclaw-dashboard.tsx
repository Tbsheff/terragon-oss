"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createThread } from "@/server-actions/threads";
import { cn } from "@/lib/utils";
import {
  Rocket,
  Bug,
  FileText,
  RefreshCw,
  TestTube,
  Sparkles,
} from "lucide-react";

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
  const [selectedTemplate, setSelectedTemplate] = useState("feature-fast");
  const [repoFullName, setRepoFullName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsCreating(true);
    try {
      const result = await createThread({
        name: prompt.slice(0, 100),
        githubRepoFullName: repoFullName || undefined,
        pipelineTemplateId: selectedTemplate,
      });
      router.push(`/task/${result.id}`);
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsCreating(false);
    }
  }, [prompt, repoFullName, selectedTemplate, router]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">New Task</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Describe what you want the agents to build
        </p>

        {/* Prompt input */}
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Add a new tRPC endpoint for user preferences with Zod validation and Vitest tests"
            rows={4}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleCreate();
              }
            }}
          />
        </div>

        {/* Repo input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Repository (optional)
          </label>
          <input
            type="text"
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            placeholder="owner/repo"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Pipeline template selection */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Pipeline
          </label>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                  selectedTemplate === t.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{t.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {t.stages}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!prompt.trim() || isCreating}
          className={cn(
            "w-full rounded-lg py-2.5 text-sm font-medium transition-colors",
            prompt.trim() && !isCreating
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {isCreating ? "Creating..." : "Start Task"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ⌘+Enter to start
        </p>
      </div>
    </div>
  );
}
