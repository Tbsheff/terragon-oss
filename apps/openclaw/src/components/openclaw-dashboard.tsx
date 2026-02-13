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
        <Card>
          <CardHeader>
            <CardTitle>New Task</CardTitle>
            <CardDescription>
              Describe what you want the agents to build
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt input */}
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a new tRPC endpoint for user preferences with Zod validation and Vitest tests"
                rows={4}
                className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleCreate();
                  }
                }}
              />
            </div>

            {/* Repo input */}
            <div className="space-y-1">
              <Label htmlFor="repo">Repository (optional)</Label>
              <Input
                id="repo"
                type="text"
                value={repoFullName}
                onChange={(e) => setRepoFullName(e.target.value)}
                placeholder="owner/repo"
              />
            </div>

            <Separator className="my-4" />

            {/* Pipeline template selection */}
            <div>
              <Label className="mb-2 block">Pipeline</Label>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-3 text-left transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
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
            <Button
              size="lg"
              className="w-full"
              onClick={handleCreate}
              disabled={!prompt.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Start Task"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              ⌘+Enter to start
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
