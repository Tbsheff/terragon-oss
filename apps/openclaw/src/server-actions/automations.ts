"use server";

import { db } from "@/db";
import { automations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export type AutomationRow = typeof automations.$inferSelect;

export type TriggerConfig =
  | { type: "cron"; expression: string; timezone?: string }
  | { type: "linear"; teamId: string; labelFilter: string }
  | { type: "github-pr"; repoFullName: string; event: "opened" | "labeled" };

export async function listAutomations(): Promise<AutomationRow[]> {
  return db.select().from(automations).orderBy(automations.name);
}

export async function getAutomation(id: string): Promise<AutomationRow | null> {
  const [row] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1);
  return row ?? null;
}

export async function createAutomation(data: {
  name: string;
  description?: string;
  triggerType: "cron" | "linear" | "github-pr";
  triggerConfig: TriggerConfig;
  prompt: string;
  pipelineTemplateId?: string;
  environmentId?: string;
}) {
  const id = nanoid();

  // Calculate next run for cron triggers
  let nextRunAt: string | null = null;
  if (data.triggerType === "cron") {
    // Simple: set to now + 1 hour as placeholder (real cron parsing would use a library)
    nextRunAt = new Date(Date.now() + 3600_000).toISOString();
  }

  await db.insert(automations).values({
    id,
    name: data.name,
    description: data.description ?? null,
    triggerType: data.triggerType,
    triggerConfig: JSON.stringify(data.triggerConfig),
    prompt: data.prompt,
    pipelineTemplateId: data.pipelineTemplateId ?? null,
    environmentId: data.environmentId ?? null,
    nextRunAt,
    enabled: true,
  });

  return { ok: true as const, id };
}

export async function updateAutomation(
  id: string,
  data: {
    name?: string;
    description?: string;
    triggerType?: "cron" | "linear" | "github-pr";
    triggerConfig?: TriggerConfig;
    prompt?: string;
    pipelineTemplateId?: string | null;
    environmentId?: string | null;
    enabled?: boolean;
  },
) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.triggerType !== undefined) updates.triggerType = data.triggerType;
  if (data.triggerConfig !== undefined)
    updates.triggerConfig = JSON.stringify(data.triggerConfig);
  if (data.prompt !== undefined) updates.prompt = data.prompt;
  if (data.pipelineTemplateId !== undefined)
    updates.pipelineTemplateId = data.pipelineTemplateId;
  if (data.environmentId !== undefined)
    updates.environmentId = data.environmentId;
  if (data.enabled !== undefined) updates.enabled = data.enabled;

  await db.update(automations).set(updates).where(eq(automations.id, id));
  return { ok: true as const };
}

export async function deleteAutomation(id: string) {
  await db.delete(automations).where(eq(automations.id, id));
  return { ok: true as const };
}

export async function toggleAutomation(id: string, enabled: boolean) {
  await db
    .update(automations)
    .set({ enabled, updatedAt: new Date().toISOString() })
    .where(eq(automations.id, id));
  return { ok: true as const };
}
