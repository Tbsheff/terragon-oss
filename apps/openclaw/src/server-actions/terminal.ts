"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";

/**
 * Send a terminal command to the gateway using chat.inject as a user message.
 * This is an interim approach — when the gateway adds PTY RPC methods,
 * this should be replaced with direct terminal.input calls.
 */
export async function sendTerminalCommand(
  sessionKey: string,
  command: string,
): Promise<ActionResult<void>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    await client.chatInject({
      sessionKey,
      content: command,
      role: "user",
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
