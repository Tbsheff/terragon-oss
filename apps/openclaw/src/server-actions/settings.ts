"use server";

import { db } from "@/db";
import { settings, openclawConnection, githubAuth } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OpenClawClient } from "@/lib/openclaw-client";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

// ─────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────

export async function getSettings() {
  const now = new Date().toISOString();
  await db
    .insert(settings)
    .values({ id: "default", createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.id, "default"));
  return rows[0] ?? null;
}

export async function updateSettings(data: {
  defaultModel?: string;
  defaultAgent?: string;
  theme?: "light" | "dark" | "system";
  branchPrefix?: string;
  autoCreatePR?: boolean;
  prType?: "draft" | "ready";
  autoCloseDraftPRs?: boolean;
  maxConcurrentTasks?: number;
  notificationsEnabled?: boolean;
}) {
  const now = new Date().toISOString();
  await db
    .insert(settings)
    .values({ id: "default", ...data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...data, updatedAt: now },
    });
  return getSettings();
}

// ─────────────────────────────────────────────────
// Connection
// ─────────────────────────────────────────────────

function parseGatewayUrl(): { host: string; port: number; useTls: boolean } {
  const raw = process.env.OPENCLAW_GATEWAY_URL;
  if (!raw) return { host: "localhost", port: 18789, useTls: false };
  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 18789,
      useTls: url.protocol === "wss:",
    };
  } catch {
    return { host: "localhost", port: 18789, useTls: false };
  }
}

export async function getConnection() {
  const defaults = parseGatewayUrl();
  const now = new Date().toISOString();
  await db
    .insert(openclawConnection)
    .values({
      id: "default",
      host: defaults.host,
      port: defaults.port,
      useTls: defaults.useTls,
      authToken: process.env.OPENCLAW_AUTH_TOKEN ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(openclawConnection)
    .where(eq(openclawConnection.id, "default"));
  return rows[0] ?? null;
}

export async function updateConnection(data: {
  host?: string;
  port?: number;
  authToken?: string | null;
  useTls?: boolean;
  maxConcurrentTasks?: number;
}) {
  const now = new Date().toISOString();
  await db
    .insert(openclawConnection)
    .values({
      id: "default",
      host: data.host ?? parseGatewayUrl().host,
      port: data.port ?? parseGatewayUrl().port,
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: openclawConnection.id,
      set: { ...data, updatedAt: now },
    });
  return getConnection();
}

/**
 * Load upstream gateway URL + token for the WS proxy.
 * Server-only — called directly from the custom server, not via RPC.
 */
export async function loadUpstreamSettings(): Promise<{
  url: string;
  token: string;
}> {
  const conn = await getConnection();
  if (!conn) return { url: "", token: "" };
  const protocol = conn.useTls ? "wss" : "ws";
  return {
    url: `${protocol}://${conn.host}:${conn.port}/ws`,
    token: conn.authToken ?? "",
  };
}

export async function testConnection(): Promise<{
  success: boolean;
  status?: string;
  version?: string;
  dbStatus?: string;
  error?: string;
}> {
  try {
    const conn = await getConnection();
    if (!conn) {
      return { success: false, error: "No connection configured" };
    }

    const protocol = conn.useTls ? "wss" : "ws";
    const url = `${protocol}://${conn.host}:${conn.port}/ws`;

    const client = new OpenClawClient();
    const hello = await client.connect(url, conn.authToken ?? "");
    const health = await client.health();

    // Also verify DB connectivity
    let dbHealthy = true;
    try {
      const { db: dbInstance } = await import("@/db");
      const { sql: sqlTag } = await import("drizzle-orm");
      await dbInstance.run(sqlTag`SELECT 1`);
    } catch {
      dbHealthy = false;
    }

    client.disconnect();

    // Update last health check
    const now = new Date().toISOString();
    await db
      .update(openclawConnection)
      .set({
        lastHealthCheck: now,
        lastHealthStatus: health.ok ? "healthy" : "unhealthy",
        updatedAt: now,
      })
      .where(eq(openclawConnection.id, "default"));

    return {
      success: true,
      status: health.ok ? "ok" : "error",
      version: health.version ?? `protocol-v${hello.protocol}`,
      dbStatus: dbHealthy ? "ok" : "error",
    };
  } catch (err) {
    console.error("[testConnection] failed:", err);
    const now = new Date().toISOString();
    await db
      .update(openclawConnection)
      .set({
        lastHealthCheck: now,
        lastHealthStatus: "unhealthy",
        updatedAt: now,
      })
      .where(eq(openclawConnection.id, "default"));

    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

// ─────────────────────────────────────────────────
// GitHub Auth
// ─────────────────────────────────────────────────

export async function getGithubAuth() {
  const rows = await db
    .select()
    .from(githubAuth)
    .where(eq(githubAuth.id, "default"));
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0] ?? null;
  if (row?.personalAccessToken && isEncrypted(row.personalAccessToken)) {
    return { ...row, personalAccessToken: decrypt(row.personalAccessToken) };
  }
  return row;
}

export async function updateGithubAuth(data: {
  personalAccessToken?: string | null;
  username?: string | null;
}) {
  const now = new Date().toISOString();
  const encryptedData = { ...data };
  if (data.personalAccessToken) {
    encryptedData.personalAccessToken = encrypt(data.personalAccessToken);
  }
  await db
    .insert(githubAuth)
    .values({
      id: "default",
      ...encryptedData,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: githubAuth.id,
      set: { ...encryptedData, updatedAt: now },
    });
  return getGithubAuth();
}

export async function validateGithubPAT(
  token: string,
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) {
      return { valid: false, error: `GitHub API returned ${res.status}` };
    }
    const data = (await res.json()) as { login?: string };
    return { valid: true, username: data.login };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Validation failed",
    };
  }
}
