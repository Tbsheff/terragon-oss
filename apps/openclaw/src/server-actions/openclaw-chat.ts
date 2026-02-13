"use server";

import { db } from "@/db";
import { thread, threadChat } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOpenClawClient } from "@/lib/openclaw-client";

/**
 * Send a message to the OpenClaw gateway via the thread's active session.
 * Updates thread status to "working" and sends the message via chatSend().
 */
export async function sendChatMessage(threadId: string, message: string) {
  // Get thread to find the active session
  const [threadRow] = await db
    .select()
    .from(thread)
    .where(eq(thread.id, threadId))
    .limit(1);

  if (!threadRow) throw new Error(`Thread ${threadId} not found`);

  // Get or create the active chat session
  const chats = await db
    .select()
    .from(threadChat)
    .where(eq(threadChat.threadId, threadId))
    .orderBy(threadChat.createdAt);

  const activeChat = chats[chats.length - 1];
  if (!activeChat) throw new Error("No chat session found");

  const sessionKey = activeChat.sessionKey || `session-${threadId}`;

  // Register session with bridge so gateway events route to this thread
  try {
    const { getBridge } = await import("@/server/bridge-registry");
    const bridge = getBridge();
    if (bridge) {
      bridge.registerSession(sessionKey, threadId);
    } else {
      console.warn(
        "[openclaw-chat] Bridge not initialized — realtime events will not be delivered for session:",
        sessionKey,
      );
    }
  } catch (err) {
    console.warn(
      "[openclaw-chat] Failed to register session with bridge:",
      err,
    );
  }

  // Update thread status to working (capture previous for rollback)
  const previousStatus = threadRow.status;
  await db
    .update(thread)
    .set({ status: "working", updatedAt: new Date().toISOString() })
    .where(eq(thread.id, threadId));

  // Send to OpenClaw gateway — rollback status on failure
  const client = getOpenClawClient();
  try {
    await client.chatSend(sessionKey, message, {
      model: threadRow.model ?? undefined,
    });
  } catch (err) {
    await db
      .update(thread)
      .set({ status: previousStatus, updatedAt: new Date().toISOString() })
      .where(eq(thread.id, threadId));
    throw err;
  }

  return { ok: true };
}

/**
 * Abort the currently running chat on the OpenClaw gateway.
 */
export async function abortChat(threadId: string) {
  const chats = await db
    .select()
    .from(threadChat)
    .where(eq(threadChat.threadId, threadId))
    .orderBy(threadChat.createdAt);

  const activeChat = chats[chats.length - 1];
  if (!activeChat) return { ok: false, error: "No active chat" };

  const sessionKey = activeChat.sessionKey || `session-${threadId}`;

  const client = getOpenClawClient();
  await client.chatAbort(sessionKey);

  // Update thread status
  await db
    .update(thread)
    .set({ status: "stopping", updatedAt: new Date().toISOString() })
    .where(eq(thread.id, threadId));

  return { ok: true };
}

/**
 * Load chat history from the OpenClaw gateway for a session.
 */
export async function loadChatHistory(threadId: string) {
  const chats = await db
    .select()
    .from(threadChat)
    .where(eq(threadChat.threadId, threadId))
    .orderBy(threadChat.createdAt);

  const activeChat = chats[chats.length - 1];
  if (!activeChat) return { ok: false, history: [] };

  const sessionKey = activeChat.sessionKey || `session-${threadId}`;

  const client = getOpenClawClient();
  const history = await client.chatHistory(sessionKey);

  return { ok: true, history };
}
