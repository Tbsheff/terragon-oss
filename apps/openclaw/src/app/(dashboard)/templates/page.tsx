"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPipelineTemplates,
  createPipelineTemplate,
  deletePipelineTemplate,
  seedDefaultTemplates,
  listPromptTemplates,
  createPromptTemplate,
  deletePromptTemplate,
} from "@/server-actions/templates";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Workflow,
  MessageSquareText,
  Plus,
  Trash2,
  Wand2,
  Check,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STAGE_BADGE_COLORS: Record<string, string> = {
  brainstorm: "bg-primary/10 text-primary border-primary/20",
  plan: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  implement:
    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  review:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  test: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  ci: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pipeline" | "prompt">("pipeline");

  // Pipeline templates
  const { data: pipelineTemplates } = useQuery({
    queryKey: ["pipeline-templates"],
    queryFn: listPipelineTemplates,
  });

  // Prompt templates
  const { data: promptTemplates } = useQuery({
    queryKey: ["prompt-templates"],
    queryFn: listPromptTemplates,
  });

  const seedMutation = useMutation({
    mutationFn: seedDefaultTemplates,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] }),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3">
        <h1 className="text-lg font-semibold font-[var(--font-cabin)] text-balance">
          Templates
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
          Pipeline and prompt templates for common workflows
        </p>
      </div>

      <Separator />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "pipeline" | "prompt")}
        className="flex flex-1 flex-col min-h-0"
      >
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="pipeline">
              <Workflow className="size-3.5" />
              Pipeline Templates
            </TabsTrigger>
            <TabsTrigger value="prompt">
              <MessageSquareText className="size-3.5" />
              Prompt Templates
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <TabsContent value="pipeline" className="mt-6">
            <PipelineTemplatesList
              templates={pipelineTemplates ?? []}
              onSeed={() => seedMutation.mutate()}
              isSeeding={seedMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="prompt" className="mt-6">
            <PromptTemplatesList templates={promptTemplates ?? []} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function PipelineTemplatesList({
  templates,
  onSeed,
  isSeeding,
}: {
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
    stages: string;
    isDefault: boolean;
  }>;
  onSeed: () => void;
  isSeeding: boolean;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deletePipelineTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] }),
  });

  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSeed}
              disabled={isSeeding}
            >
              <Wand2 className="size-3.5" />
              {isSeeding ? "Seeding..." : "Seed Defaults"}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="size-3.5" />
            Create
          </Button>
        </div>
      </div>

      {showCreate && (
        <CreatePipelineTemplateForm onClose={() => setShowCreate(false)} />
      )}

      {templates.length === 0 && !showCreate && (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No pipeline templates yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Create a template or seed defaults to get started
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onSeed}
              disabled={isSeeding}
            >
              <Wand2 className="size-3.5" />
              {isSeeding ? "Seeding..." : "Seed Defaults"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const stages: PipelineStage[] = JSON.parse(t.stages);
          return (
            <Card
              key={t.id}
              className="group py-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{t.name}</h3>
                      {t.isDefault && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border border-primary/20"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${t.name}`}
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete template</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stages.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className={cn("text-[10px]", STAGE_BADGE_COLORS[s])}
                    >
                      {PIPELINE_STAGE_LABELS[s]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CreatePipelineTemplateForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStages, setSelectedStages] = useState<Set<PipelineStage>>(
    new Set(["plan", "implement", "test", "ci"]),
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createPipelineTemplate({
        name,
        description: description || undefined,
        stages: PIPELINE_STAGES.filter((s) => selectedStages.has(s)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-templates"] });
      onClose();
    },
  });

  return (
    <Card className="border-primary/30 py-0 animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pipeline-name">Name</Label>
          <Input
            id="pipeline-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pipeline-description">Description</Label>
          <Input
            id="pipeline-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Stages</Label>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((s) => {
              const isSelected = selectedStages.has(s);
              return (
                <Button
                  key={s}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    !isSelected &&
                      "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    const next = new Set(selectedStages);
                    if (next.has(s)) next.delete(s);
                    else next.add(s);
                    setSelectedStages(next);
                  }}
                >
                  {isSelected && <Check className="size-3" />}
                  {PIPELINE_STAGE_LABELS[s]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || selectedStages.size === 0}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PromptTemplatesList({
  templates,
}: {
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
    template: string;
    variables: string | null;
  }>;
}) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createPromptTemplate({ name, template }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-templates"] });
      setShowCreate(false);
      setName("");
      setTemplate("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePromptTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="size-3.5" />
          Create
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/30 py-0 animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-name">Name</Label>
              <Input
                id="prompt-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-template">Template</Label>
              <textarea
                id="prompt-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Template text — use {variable} for fill-in fields"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono resize-none shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || !template.trim()}
              >
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 && !showCreate && (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No prompt templates yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Create reusable prompt templates with variable placeholders
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-3.5" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const vars: string[] = t.variables ? JSON.parse(t.variables) : [];
          return (
            <Card
              key={t.id}
              className="group py-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium">{t.name}</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${t.name}`}
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete template</TooltipContent>
                  </Tooltip>
                </div>
                <p className="mt-1.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded-md px-2.5 py-2 border border-border/50 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                  {t.template}
                </p>
                {vars.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {vars.map((v) => (
                      <Badge
                        key={v}
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-mono"
                      >
                        {"{"}
                        {v}
                        {"}"}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
