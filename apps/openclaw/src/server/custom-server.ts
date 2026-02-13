/**
 * Custom Next.js server with WebSocket support.
 *
 * Next.js doesn't support WebSocket upgrades in route handlers,
 * so we need a custom server that intercepts HTTP upgrade requests
 * and routes them to the broadcast WS server.
 *
 * Usage: node dist/server/custom-server.js
 * In development: handled via next.config.ts instrumentation
 */

// @ts-expect-error — @next/env ships with Next.js but has no type declarations
import { loadEnvConfig } from "@next/env";
import { createServer } from "http";
import next from "next";
import { parse } from "url";

// Load .env.local before anything else accesses process.env
loadEnvConfig(process.cwd());
import { LocalBroadcastServer } from "./broadcast";
import { OpenClawBridge } from "./openclaw-bridge";
import { getOpenClawClient } from "@/lib/openclaw-client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3100", 10);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Guard against HMR re-initialization in dev
  const globalForWss = globalThis as typeof globalThis & {
    __broadcastServer?: LocalBroadcastServer;
  };

  const broadcast =
    globalForWss.__broadcastServer ?? new LocalBroadcastServer();
  if (dev) {
    globalForWss.__broadcastServer = broadcast;
  }

  // Wire OpenClaw gateway → local broadcast bridge
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  if (gatewayUrl) {
    const bridge = new OpenClawBridge({
      broadcast,
      gatewayUrl,
      authToken: process.env.OPENCLAW_AUTH_TOKEN,
    });

    // Register bridge globally for server actions
    const { setBridge } = await import("./bridge-registry");
    setBridge(bridge);

    // Create gateway sync service (writes to DB before broadcasting)
    const { GatewaySyncService } = await import("./gateway-sync");
    const syncService = new GatewaySyncService(broadcast);
    bridge.setSyncService(syncService);

    const client = getOpenClawClient();

    client.on("chat", (payload) => bridge.onChatEvent(payload));
    client.on("agent", (event) =>
      bridge.onAgentEvent({
        type: "event",
        event: "agent",
        payload: event,
        seq: 0,
      }),
    );
    client.on("connected", () => bridge.onConnectionChange("connected"));
    client.on("disconnected", () => bridge.onConnectionChange("disconnected"));

    console.log(`> OpenClaw bridge connecting to ${gatewayUrl}`);

    // Pre-populate bridge sessions from DB (threads still in working state)
    try {
      const { db } = await import("@/db");
      const { thread, threadChat } = await import("@/db/schema");
      const { sql, eq, desc } = await import("drizzle-orm");
      const { getBridge } = await import("./bridge-registry");

      const workingThreads = await db
        .select({ id: thread.id })
        .from(thread)
        .where(sql`${thread.status} IN ('working', 'stopping')`);

      const activeBridge = getBridge();
      if (activeBridge && workingThreads.length > 0) {
        for (const t of workingThreads) {
          // Get the latest threadChat with a sessionKey
          const chats = await db
            .select({ sessionKey: threadChat.sessionKey })
            .from(threadChat)
            .where(eq(threadChat.threadId, t.id))
            .orderBy(desc(threadChat.createdAt))
            .limit(1);

          const sessionKey = chats[0]?.sessionKey;
          if (sessionKey) {
            activeBridge.registerSession(sessionKey, t.id);
          }
        }
        console.log(
          `> Pre-populated ${workingThreads.length} working thread session(s)`,
        );
      }
    } catch (err) {
      console.error("> Failed to pre-populate sessions:", err);
    }

    // Start stale recovery service
    const { StaleRecoveryService } = await import("./stale-recovery");
    const staleRecovery = new StaleRecoveryService();
    staleRecovery.start();
  } else {
    console.log(
      "> No OPENCLAW_GATEWAY_URL set — bridge disabled (UI-only mode)",
    );
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // Handle WebSocket upgrades
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "/", true);

    // Don't intercept Next.js HMR WebSocket
    if (pathname === "/_next/webpack-hmr") {
      return;
    }

    // Route /ws to our broadcast server
    if (pathname === "/ws") {
      broadcast.handleUpgrade(req, socket, head);
      return;
    }

    // Reject unknown WebSocket paths
    socket.destroy();
  });

  server.listen(port, () => {
    console.log(`> OpenClaw Dashboard ready on http://${hostname}:${port}`);
    console.log(`> WebSocket broadcast on ws://${hostname}:${port}/ws`);
  });
}

main().catch((err) => {
  console.error("Failed to start custom server:", err);
  process.exit(1);
});
