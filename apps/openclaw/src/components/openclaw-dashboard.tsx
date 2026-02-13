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
  Check,
  Loader2,
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
      <div className="w-full max-w-2xl animate-fade-in">
        <Card className="shadow-sm border-t-2 border-t-primary/20 [&:has(textarea:focus-visible)]:ring-1 [&:has(textarea:focus-visible)]:ring-primary/10 transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-[var(--font-cabin)] text-xl tracking-tight">
              New Task
            </CardTitle>
            <CardDescription>
              Tell your agents what to build — they'll handle the rest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Prompt input */}
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a new tRPC endpoint for user preferences with Zod validation and Vitest tests"
                rows={4}
                className="w-full rounded-lg border border-input bg-muted/30 shadow-inner px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none resize-none transition-colors duration-150"
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
                {QUICK_TEMPLATES.map((t, i) => {
                  const isSelected = selectedTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={cn(
                        "animate-fade-in flex flex-col items-start rounded-lg border p-3 text-left transition-all duration-200 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                          : "border-border bg-card hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
                      )}
                      style={{
                        animationDelay: `${i * 50}ms`,
                        animationFillMode: "both",
                      }}
                    >
                      <div className="flex w-full items-center gap-2 mb-1">
                        <t.icon
                          className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        <span className="text-xs font-medium">{t.label}</span>
                        {isSelected && (
                          <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {t.stages}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Create button */}
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleCreate}
              disabled={!prompt.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Start Task
                </>
              )}
            </Button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                ⌘
              </kbd>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                Enter
              </kbd>
              <span className="ml-0.5">to start</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
