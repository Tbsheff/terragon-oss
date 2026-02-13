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

  // Update thread status to working
  await db
    .update(thread)
    .set({ status: "working", updatedAt: new Date().toISOString() })
    .where(eq(thread.id, threadId));

  // Send to OpenClaw gateway
  const client = getOpenClawClient();
  await client.chatSend(
    sessionKey,
    { role: "user", content: [{ type: "text", text: message }] },
    { model: threadRow.model ?? undefined },
  );

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
