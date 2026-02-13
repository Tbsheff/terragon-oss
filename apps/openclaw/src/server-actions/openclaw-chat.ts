"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";

/**
 * Send a message to the OpenClaw gateway via the session key.
 * The session key IS the thread ID in the new gateway-first model.
 */
export async function sendChatMessage(threadId: string, message: string) {
  const sessionKey = threadId;

  // Register session with bridge so gateway events route correctly
  try {
    const { getBridge } = await import("@/server/bridge-registry");
    const bridge = getBridge();
    if (bridge) {
      bridge.registerSession(sessionKey, threadId);
    }
  } catch {
    // Bridge may not be available
  }

  // Send to OpenClaw gateway
  const client = getOpenClawClient();
  await client.chatSend(sessionKey, message);

  return { ok: true };
}

/**
 * Abort the currently running chat on the OpenClaw gateway.
 */
export async function abortChat(threadId: string) {
  const sessionKey = threadId;

  const client = getOpenClawClient();
  await client.chatAbort(sessionKey);

  return { ok: true };
}

/**
 * Load chat history from the OpenClaw gateway for a session.
 */
export async function loadChatHistory(threadId: string) {
  const sessionKey = threadId;

  const client = getOpenClawClient();
  const history = await client.chatHistory(sessionKey);

  return { ok: true, history };
}
