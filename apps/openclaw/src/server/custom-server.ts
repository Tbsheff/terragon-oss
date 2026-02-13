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

import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { LocalBroadcastServer } from "./broadcast";

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
