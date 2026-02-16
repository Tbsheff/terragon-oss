"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";
import { setSessionMeta, getSessionMeta } from "./session-meta-store";
import { compactHistoryUpTo } from "@/lib/history-utils";

export async function forkThread(opts: {
  sourceThreadId: string;
  forkAtMessageIndex: number;
  newMessage: string;
  name?: string;
}): Promise<ActionResult<{ id: string }>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    // 1. Load source history
    const history = await client.chatHistory(opts.sourceThreadId);

    // 2. Compact history up to fork point
    const compactedHistory = compactHistoryUpTo(
      history,
      opts.forkAtMessageIndex,
    );

    // 3. Generate new session key
    const { nanoid } = await import("nanoid");
    const sessionKey = `session-${nanoid()}`;

    // 4. Spawn new session
    await client.sessionsSpawn({ agentId: "claudeCode", sessionKey });

    // 5. Inject compacted context
    await client.chatInject({
      sessionKey,
      content: compactedHistory,
      role: "system",
    });

    // 6. Send the new message
    await client.chatSend(sessionKey, opts.newMessage);

    // 7. Get source metadata for naming
    const sourceMeta = await getSessionMeta(opts.sourceThreadId);
    const sourceName = sourceMeta?.name ?? "Untitled";

    // 8. Store fork metadata
    await setSessionMeta(sessionKey, {
      name: opts.name ?? `Fork of ${sourceName}`,
      parentThreadId: opts.sourceThreadId,
      forkMessageIndex: opts.forkAtMessageIndex,
      archived: false,
    });

    // 9. Register with bridge
    try {
      const { getBridge } = await import("@/server/bridge-registry");
      getBridge()?.registerSession(sessionKey, sessionKey);
    } catch {
      // Bridge may not be available
    }

    return { ok: true, data: { id: sessionKey } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
