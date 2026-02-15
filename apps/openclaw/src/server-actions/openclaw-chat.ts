"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";
import type { ChatHistoryEntry } from "@/lib/openclaw-types";

// ─────────────────────────────────────────────────
// Chat Actions
// ─────────────────────────────────────────────────

/**
 * Send a message to the OpenClaw gateway via the session key.
 * The session key IS the thread ID in the new gateway-first model.
 */
export async function sendChatMessage(
  threadId: string,
  message: string,
): Promise<ActionResult<void>> {
  const client = getClient();
  if (!client) return notConnected();

  const sessionKey = threadId;

  try {
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
    await client.chatSend(sessionKey, message);

    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Abort the currently running chat on the OpenClaw gateway.
 */
export async function abortChat(threadId: string): Promise<ActionResult<void>> {
  const client = getClient();
  if (!client) return notConnected();

  const sessionKey = threadId;

  try {
    await client.chatAbort(sessionKey);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Load chat history from the OpenClaw gateway for a session.
 */
export async function loadChatHistory(
  threadId: string,
): Promise<ActionResult<ChatHistoryEntry[]>> {
  const client = getClient();
  if (!client) return notConnected();

  const sessionKey = threadId;

  try {
    const history = await client.chatHistory(sessionKey);
    return { ok: true, data: history };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Inject a system or user message into a session without triggering agent response.
 * Useful for seeding context or providing instructions.
 */
export async function injectChatContext(
  threadId: string,
  content: string,
  role: "system" | "user" = "system",
): Promise<ActionResult<void>> {
  const client = getClient();
  if (!client) return notConnected();

  const sessionKey = threadId;

  try {
    await client.chatInject({ sessionKey, content, role });
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
