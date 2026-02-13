"use server";

import { db } from "@/db";
import { credentials, openclawConnection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { OpenClawClient } from "@/lib/openclaw-client";

export async function listCredentials() {
  return db.select().from(credentials);
}

export async function createCredential(data: {
  provider: "anthropic" | "openai" | "google" | "amp" | "github";
  name: string;
  value: string;
}) {
  const now = new Date().toISOString();
  const id = nanoid();
  await db.insert(credentials).values({
    id,
    provider: data.provider,
    name: data.name,
    value: data.value,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

export async function deleteCredential(id: string) {
  await db.delete(credentials).where(eq(credentials.id, id));
  return { success: true };
}

export async function syncCredentialsToGateway(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const allCreds = await db.select().from(credentials);
    const conn = await db
      .select()
      .from(openclawConnection)
      .where(eq(openclawConnection.id, "default"));

    const connRow = conn[0];
    if (!connRow) {
      return { success: false, error: "No connection configured" };
    }

    const protocol = connRow.useTls ? "wss" : "ws";
    const url = `${protocol}://${connRow.host}:${connRow.port}`;

    const client = new OpenClawClient();
    await client.connect(url, connRow.authToken ?? "");

    // Build credentials map keyed by provider
    const credMap: Record<string, string> = {};
    for (const cred of allCreds) {
      // Use provider-specific env var naming
      const envKey = getEnvKeyForProvider(cred.provider, cred.name);
      credMap[envKey] = cred.value;
    }

    await client.configPatch({ credentials: credMap });
    client.disconnect();

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

function getEnvKeyForProvider(provider: string, name: string): string {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_API_KEY";
    case "amp":
      return "AMP_API_KEY";
    case "github":
      return "GITHUB_TOKEN";
    default:
      return name.toUpperCase().replace(/\s+/g, "_");
  }
}
