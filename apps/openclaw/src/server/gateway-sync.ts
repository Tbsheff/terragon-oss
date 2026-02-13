/**
 * Gateway Sync Service
 *
 * Listens to bridge events, writes state changes to DB,
 * THEN broadcasts to UI. Fixes the broadcast-before-write race.
 */
import { db } from "@/db";
import { thread, threadChat } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { LocalBroadcastServer } from "./broadcast";
import type { ChatEventPayload } from "@/lib/openclaw-types";

export class GatewaySyncService {
  private broadcast: LocalBroadcastServer;

  constructor(broadcast: LocalBroadcastServer) {
    this.broadcast = broadcast;
  }

  /** Process a chat event: write to DB, then broadcast */
  async onChatEvent(
    payload: ChatEventPayload,
    threadId: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Map gateway state to thread status
    type ThreadStatus = typeof thread.$inferInsert.status;
    const statusMap: Record<string, ThreadStatus> = {
      final: "complete",
      error: "working-error",
      aborted: "working-done",
      working: "working",
    };
    const newStatus = statusMap[payload.state] ?? ("working" as ThreadStatus);

    // 1. Write thread status to DB
    await db
      .update(thread)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(thread.id, threadId));

    // 2. Update the thread chat record if we can find it by sessionKey
    const chatRows = await db
      .select()
      .from(threadChat)
      .where(eq(threadChat.sessionKey, payload.sessionKey))
      .limit(1);

    if (chatRows[0]) {
      const chatStatus =
        payload.state === "final"
          ? "complete"
          : payload.state === "error"
            ? "working-error"
            : payload.state === "aborted"
              ? "working-done"
              : "working";

      await db
        .update(threadChat)
        .set({
          status: chatStatus,
          errorMessage:
            payload.state === "error"
              ? (payload.error?.message ?? null)
              : undefined,
          updatedAt: now,
        })
        .where(eq(threadChat.id, chatRows[0].id));
    }

    // 3. Write token usage if present
    if (payload.usage) {
      await db
        .update(thread)
        .set({
          tokenUsage: JSON.stringify(payload.usage),
          updatedAt: now,
        })
        .where(eq(thread.id, threadId));
    }

    // 4. THEN broadcast to UI clients
    this.broadcast.broadcast(threadId, {
      type: "thread-update",
      threadId,
      data: {
        messagesUpdated: true,
        threadStatusUpdated: newStatus,
      },
    });

    // 5. Broadcast thread-list-update globally so dashboard refreshes
    this.broadcast.broadcastAll({
      type: "thread-list-update",
    });
  }
}
