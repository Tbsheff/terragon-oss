"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";
import type { OpenClawSession } from "@/lib/openclaw-types";

/**
 * Patch session settings (model, agentId, etc.) on the gateway.
 */
export async function patchSession(
  sessionKey: string,
  settings: { model?: string; agentId?: string },
): Promise<ActionResult<OpenClawSession>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const session = await client.sessionsPatch(sessionKey, settings);
    return { ok: true, data: session };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
