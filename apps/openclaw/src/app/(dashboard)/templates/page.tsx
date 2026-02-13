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
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/constants";
import {
  Workflow,
  MessageSquareText,
  Plus,
  Trash2,
  Wand2,
  Check,
} from "lucide-react";

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
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">Templates</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pipeline and prompt templates for common workflows
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border px-6">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
            activeTab === "pipeline"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Workflow className="h-3.5 w-3.5" />
          Pipeline Templates
        </button>
        <button
          onClick={() => setActiveTab("prompt")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
            activeTab === "prompt"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Prompt Templates
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "pipeline" ? (
          <PipelineTemplatesList
            templates={pipelineTemplates ?? []}
            onSeed={() => seedMutation.mutate()}
            isSeeding={seedMutation.isPending}
          />
        ) : (
          <PromptTemplatesList templates={promptTemplates ?? []} />
        )}
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
            <button
              onClick={onSeed}
              disabled={isSeeding}
              className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {isSeeding ? "Seeding..." : "Seed Defaults"}
            </button>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </button>
        </div>
      </div>

      {showCreate && (
        <CreatePipelineTemplateForm onClose={() => setShowCreate(false)} />
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const stages: PipelineStage[] = JSON.parse(t.stages);
          return (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{t.name}</h3>
                    {t.isDefault && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stages.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {PIPELINE_STAGE_LABELS[s]}
                  </span>
                ))}
              </div>
            </div>
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
    <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Stages
        </p>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => {
                const next = new Set(selectedStages);
                if (next.has(s)) next.delete(s);
                else next.add(s);
                setSelectedStages(next);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
                selectedStages.has(s)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {selectedStages.has(s) && <Check className="h-3 w-3" />}
              {PIPELINE_STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || selectedStages.size === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Create
        </button>
      </div>
    </div>
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Template text — use {variable} for fill-in fields"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || !template.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {templates.map((t) => {
          const vars: string[] = t.variables ? JSON.parse(t.variables) : [];
          return (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium">{t.name}</h3>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                {t.template}
              </p>
              {vars.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {vars.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {"{"}
                      {v}
                      {"}"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
