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
  brainstorm: "border-primary/30 text-primary",
  plan: "border-blue-500/30 text-blue-600 dark:text-blue-400",
  implement: "border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
  review: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  test: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  ci: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
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
        <h1 className="text-lg font-semibold font-[var(--font-cabin)]">
          Templates
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pipeline and prompt templates for common workflows
        </p>
      </div>

      <Separator />

      <div className="px-6 pt-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "pipeline" | "prompt")}
        >
          <TabsList>
            <TabsTrigger value="pipeline">
              <Workflow className="h-3.5 w-3.5" />
              Pipeline Templates
            </TabsTrigger>
            <TabsTrigger value="prompt">
              <MessageSquareText className="h-3.5 w-3.5" />
              Prompt Templates
            </TabsTrigger>
          </TabsList>
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
        </Tabs>
      </div>
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
              <Wand2 className="h-3.5 w-3.5" />
              {isSeeding ? "Seeding..." : "Seed Defaults"}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>

      {showCreate && (
        <CreatePipelineTemplateForm onClose={() => setShowCreate(false)} />
      )}

      {templates.length === 0 && !showCreate && (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No pipeline templates yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Create a template or seed defaults to get started
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const stages: PipelineStage[] = JSON.parse(t.stages);
          return (
            <Card
              key={t.id}
              className="py-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
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
                        className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
        <div>
          <Label className="mb-1.5">Stages</Label>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((s) => (
              <Button
                key={s}
                variant={selectedStages.has(s) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const next = new Set(selectedStages);
                  if (next.has(s)) next.delete(s);
                  else next.add(s);
                  setSelectedStages(next);
                }}
              >
                {selectedStages.has(s) && <Check className="h-3 w-3" />}
                {PIPELINE_STAGE_LABELS[s]}
              </Button>
            ))}
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
          <Plus className="h-3.5 w-3.5" />
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
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono resize-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No prompt templates yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Create reusable prompt templates with variable placeholders
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const vars: string[] = t.variables ? JSON.parse(t.variables) : [];
          return (
            <Card
              key={t.id}
              className="py-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium">{t.name}</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete template</TooltipContent>
                  </Tooltip>
                </div>
                <p className="mt-1.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 border border-border/50">
                  {t.template}
                </p>
                {vars.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {vars.map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="text-[10px]"
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
