/**
 * Stale Recovery Service
 *
 * Periodically checks for threads stuck in working/stopping status
 * that no longer have active gateway sessions. Marks them as working-done.
 */
import { db } from "@/db";
import { thread } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getOpenClawClient } from "@/lib/openclaw-client";

const INTERVAL_MS = 60_000;

export class StaleRecoveryService {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    // Run immediately, then every 60s
    this.check().catch(console.error);
    this.timer = setInterval(() => {
      this.check().catch(console.error);
    }, INTERVAL_MS);
    console.log("[stale-recovery] Started (60s interval)");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async check(): Promise<void> {
    try {
      const client = getOpenClawClient();
      if (client.getState() !== "connected") return;

      // Get active sessions from gateway
      let activeSessions: Set<string>;
      try {
        const sessions = await client.sessionsList();
        activeSessions = new Set(sessions.map((s) => s.key));
      } catch {
        // Gateway unavailable — skip this cycle
        return;
      }

      // Find threads stuck in working/stopping
      const stuckThreads = await db
        .select({ id: thread.id, status: thread.status })
        .from(thread)
        .where(sql`${thread.status} IN ('working', 'stopping')`);

      if (stuckThreads.length === 0) return;

      const now = new Date().toISOString();
      let recovered = 0;

      for (const t of stuckThreads) {
        // Check if any session key contains this thread's ID
        // Session keys follow the pattern: pipeline-{threadId}-{stage}-{nanoid}
        // or session-{threadId}
        const hasActiveSession = [...activeSessions].some((key) =>
          key.includes(t.id),
        );

        if (!hasActiveSession) {
          await db
            .update(thread)
            .set({ status: "working-done", updatedAt: now })
            .where(eq(thread.id, t.id));
          recovered++;
        }
      }

      if (recovered > 0) {
        console.log(`[stale-recovery] Recovered ${recovered} stale thread(s)`);
      }
    } catch (err) {
      console.error("[stale-recovery] Error:", err);
    }
  }
}
