"use server";

import { db } from "@/db";
import { pipelineTemplate, promptTemplate } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { PipelineStage } from "@/lib/constants";

// ─────────────────────────────────────────────────
// Pipeline Templates
// ─────────────────────────────────────────────────

export async function listPipelineTemplates() {
  return db.select().from(pipelineTemplate).orderBy(pipelineTemplate.name);
}

export async function getPipelineTemplate(id: string) {
  const [row] = await db
    .select()
    .from(pipelineTemplate)
    .where(eq(pipelineTemplate.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPipelineTemplate(data: {
  name: string;
  description?: string;
  stages: PipelineStage[];
  isDefault?: boolean;
}) {
  const id = nanoid();
  await db.insert(pipelineTemplate).values({
    id,
    name: data.name,
    description: data.description ?? null,
    stages: JSON.stringify(data.stages),
    isDefault: data.isDefault ?? false,
  });
  return { ok: true as const, id };
}

export async function updatePipelineTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    stages?: PipelineStage[];
    isDefault?: boolean;
  },
) {
  await db
    .update(pipelineTemplate)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.stages !== undefined && { stages: JSON.stringify(data.stages) }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pipelineTemplate.id, id));
  return { ok: true as const };
}

export async function deletePipelineTemplate(id: string) {
  await db.delete(pipelineTemplate).where(eq(pipelineTemplate.id, id));
  return { ok: true as const };
}

/**
 * Seed the default pipeline templates if none exist.
 */
export async function seedDefaultTemplates() {
  const existing = await db.select().from(pipelineTemplate).limit(1);
  if (existing.length > 0) return { ok: true as const, seeded: false };

  const defaults: Array<{
    id: string;
    name: string;
    description: string;
    stages: PipelineStage[];
    isDefault: boolean;
  }> = [
    {
      id: "feature-full",
      name: "Full Feature",
      description: "Complete pipeline with brainstorming and review",
      stages: ["brainstorm", "plan", "implement", "review", "test", "ci"],
      isDefault: false,
    },
    {
      id: "feature-fast",
      name: "Fast Feature",
      description: "Skip brainstorming, jump to planning",
      stages: ["plan", "implement", "test", "ci"],
      isDefault: true,
    },
    {
      id: "bugfix",
      name: "Bug Fix",
      description: "Quick fix pipeline",
      stages: ["implement", "test", "ci"],
      isDefault: false,
    },
    {
      id: "refactor",
      name: "Refactor",
      description: "Code improvement with review",
      stages: ["plan", "implement", "review", "test", "ci"],
      isDefault: false,
    },
    {
      id: "docs",
      name: "Docs Only",
      description: "Documentation changes",
      stages: ["implement", "ci"],
      isDefault: false,
    },
    {
      id: "test",
      name: "Test Only",
      description: "Add test coverage",
      stages: ["implement", "ci"],
      isDefault: false,
    },
  ];

  await db.insert(pipelineTemplate).values(
    defaults.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      stages: JSON.stringify(t.stages),
      isDefault: t.isDefault,
    })),
  );

  return { ok: true as const, seeded: true };
}

// ─────────────────────────────────────────────────
// Prompt Templates
// ─────────────────────────────────────────────────

export async function listPromptTemplates() {
  return db.select().from(promptTemplate).orderBy(promptTemplate.name);
}

export async function getPromptTemplate(id: string) {
  const [row] = await db
    .select()
    .from(promptTemplate)
    .where(eq(promptTemplate.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPromptTemplate(data: {
  name: string;
  description?: string;
  template: string;
  pipelineTemplateId?: string;
}) {
  const id = nanoid();
  // Extract {variables} from template
  const variables = [
    ...new Set(Array.from(data.template.matchAll(/\{(\w+)\}/g), (m) => m[1]!)),
  ];

  await db.insert(promptTemplate).values({
    id,
    name: data.name,
    description: data.description ?? null,
    template: data.template,
    variables: JSON.stringify(variables),
    pipelineTemplateId: data.pipelineTemplateId ?? null,
  });
  return { ok: true as const, id };
}

export async function updatePromptTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    template?: string;
    pipelineTemplateId?: string | null;
  },
) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.pipelineTemplateId !== undefined)
    updates.pipelineTemplateId = data.pipelineTemplateId;
  if (data.template !== undefined) {
    updates.template = data.template;
    const variables = [
      ...new Set(
        Array.from(data.template.matchAll(/\{(\w+)\}/g), (m) => m[1]!),
      ),
    ];
    updates.variables = JSON.stringify(variables);
  }

  await db.update(promptTemplate).set(updates).where(eq(promptTemplate.id, id));
  return { ok: true as const };
}

export async function deletePromptTemplate(id: string) {
  await db.delete(promptTemplate).where(eq(promptTemplate.id, id));
  return { ok: true as const };
}
