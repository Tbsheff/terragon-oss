"use server";

import { db } from "@/db";
import { openclawConnection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OpenClawClient } from "@/lib/openclaw-client";
import type { GatewayConfig } from "@/lib/openclaw-types";

async function getClientConnection() {
  const conn = await db
    .select()
    .from(openclawConnection)
    .where(eq(openclawConnection.id, "default"));

  const connRow = conn[0];
  if (!connRow) {
    throw new Error("No connection configured");
  }

  const protocol = connRow.useTls ? "wss" : "ws";
  const url = `${protocol}://${connRow.host}:${connRow.port}`;

  const client = new OpenClawClient();
  await client.connect(url, connRow.authToken ?? "");
  return client;
}

export async function getGatewayConfig(): Promise<{
  success: boolean;
  config?: GatewayConfig;
  error?: string;
}> {
  try {
    const client = await getClientConnection();
    const config = await client.configGet();
    client.disconnect();
    return { success: true, config };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get config",
    };
  }
}

export async function updateGatewayConfig(
  patch: Partial<GatewayConfig>,
): Promise<{ success: boolean; config?: GatewayConfig; error?: string }> {
  try {
    const client = await getClientConnection();
    const config = await client.configPatch(patch);
    client.disconnect();
    return { success: true, config };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update config",
    };
  }
}

export async function getHealthStatus(): Promise<{
  success: boolean;
  health?: {
    status: string;
    version?: string;
    uptime?: number;
    activeSessions?: number;
    cpu?: number;
    memory?: number;
  };
  error?: string;
}> {
  try {
    const client = await getClientConnection();
    const health = await client.health();
    client.disconnect();
    return { success: true, health };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get health",
    };
  }
}
