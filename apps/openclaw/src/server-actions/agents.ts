"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";
import type { OpenClawAgent, OpenClawAgentFile } from "@/lib/openclaw-types";
import { generateSoulMd } from "@/lib/agent-soul-generator";
import { SPECIALIZED_ROSTER } from "@/lib/agent-roster";

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function getClient() {
  const client = getOpenClawClient();
  if (client.getState() === "disconnected") {
    return null;
  }
  return client;
}

function notConnected(): ActionResult<never> {
  return { ok: false, error: "OpenClaw client is not connected" };
}

// ─────────────────────────────────────────────────
// Agent CRUD
// ─────────────────────────────────────────────────

export async function listAgents(): Promise<ActionResult<OpenClawAgent[]>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const agents = await client.agentsList();
    return { ok: true, data: agents };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createAgent(
  data: Omit<OpenClawAgent, "id" | "createdAt" | "updatedAt">,
): Promise<ActionResult<OpenClawAgent>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const agent = await client.agentsCreate(data);
    return { ok: true, data: agent };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateAgent(
  id: string,
  updates: Partial<Omit<OpenClawAgent, "id">>,
): Promise<ActionResult<OpenClawAgent>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const agent = await client.agentsUpdate(id, updates);
    return { ok: true, data: agent };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteAgent(
  id: string,
): Promise<ActionResult<Record<string, unknown>>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const result = await client.agentsDelete(id);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────
// Agent Files
// ─────────────────────────────────────────────────

export async function getAgentFiles(
  agentId: string,
): Promise<ActionResult<OpenClawAgentFile[]>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const files = await client.agentsFilesList(agentId);
    return { ok: true, data: files };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getAgentFile(
  agentId: string,
  filename: string,
): Promise<ActionResult<OpenClawAgentFile>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const file = await client.agentsFilesGet(agentId, filename);
    return { ok: true, data: file };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function setAgentFile(
  agentId: string,
  filename: string,
  content: string,
): Promise<ActionResult<Record<string, unknown>>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const result = await client.agentsFilesSet(agentId, filename, content);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────
// Fleet Status — agents paired with session activity
// ─────────────────────────────────────────────────

export type AgentFleetStatus = "running" | "idle" | "error" | "approval";

export type AgentWithStatus = OpenClawAgent & {
  fleetStatus: AgentFleetStatus;
  activeSessions: number;
};

export async function listAgentsWithStatus(): Promise<
  ActionResult<AgentWithStatus[]>
> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const [agents, sessions] = await Promise.all([
      client.agentsList(),
      client.sessionsList(),
    ]);

    const result: AgentWithStatus[] = agents.map((agent) => {
      const agentSessions = sessions.filter((s) => s.agentId === agent.id);
      const hasRecent = agentSessions.some((s) => {
        if (!s.lastMessageAt) return false;
        const age = Date.now() - new Date(s.lastMessageAt).getTime();
        return age < 5 * 60 * 1000; // active within last 5 minutes
      });

      let fleetStatus: AgentFleetStatus = "idle";
      if (hasRecent) fleetStatus = "running";

      return {
        ...agent,
        fleetStatus,
        activeSessions: agentSessions.length,
      };
    });

    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────
// Specialized Roster Setup
// ─────────────────────────────────────────────────

export async function setupSpecializedRoster(
  repoClaudeMd?: string,
): Promise<ActionResult<OpenClawAgent[]>> {
  const client = getClient();
  if (!client) return notConnected();

  const created: OpenClawAgent[] = [];

  try {
    for (const roster of SPECIALIZED_ROSTER) {
      const agent = await client.agentsCreate({
        name: roster.name,
        emoji: roster.emoji,
        model: roster.model,
        description: roster.description,
      });

      // Set SOUL.md for the agent
      const soulContent = generateSoulMd(roster.role, repoClaudeMd);
      await client.agentsFilesSet(agent.id, "SOUL.md", soulContent);

      created.push(agent);
    }

    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
