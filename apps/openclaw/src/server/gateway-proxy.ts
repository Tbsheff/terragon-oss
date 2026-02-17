/**
 * Same-origin WebSocket proxy for the OpenClaw gateway.
 *
 * Browser connects to /api/gateway/ws (no token needed).
 * The proxy intercepts the first "connect" request, injects
 * the auth token from the DB, then forwards all subsequent
 * frames bidirectionally.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type UpstreamSettings = { url: string; token: string };

// ─────────────────────────────────────────────────
// GatewayProxy
// ─────────────────────────────────────────────────

export class GatewayProxy {
  private wss: WebSocketServer;
  private loadSettings: () => Promise<UpstreamSettings>;

  constructor(loadSettings: () => Promise<UpstreamSettings>) {
    this.loadSettings = loadSettings;
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (client) => this.onConnection(client));
  }

  /** Handle HTTP → WebSocket upgrade for /api/gateway/ws */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws);
    });
  }

  private async onConnection(client: WebSocket): Promise<void> {
    let upstream: WebSocket | null = null;
    let settingsLoaded = false;

    client.on("message", async (data) => {
      const raw = typeof data === "string" ? data : data.toString();

      // Before upstream is connected, intercept the first message
      if (!settingsLoaded) {
        settingsLoaded = true;
        try {
          const frame = JSON.parse(raw);

          // Must be a connect request
          if (frame.type !== "req" || frame.method !== "connect") {
            client.close(4000, "First message must be a connect request");
            return;
          }

          const settings = await this.loadSettings();
          if (!settings.url) {
            client.close(4001, "No gateway connection configured");
            return;
          }

          // Inject auth token into connect params
          if (!frame.params) frame.params = {};
          if (!frame.params.auth) frame.params.auth = {};
          frame.params.auth.token = settings.token;

          // Ensure operator.read/write scopes are always requested
          if (Array.isArray(frame.params.scopes)) {
            const scopes = new Set(frame.params.scopes as string[]);
            scopes.add("operator.read");
            scopes.add("operator.write");
            frame.params.scopes = [...scopes];
          }

          console.log("[GatewayProxy] connect scopes:", frame.params.scopes);

          // Open upstream connection to real gateway
          upstream = new WebSocket(settings.url);

          upstream.on("open", () => {
            console.log("[GatewayProxy] upstream connected, sending auth");
            upstream!.send(JSON.stringify(frame));
          });

          // Forward upstream → client
          upstream.on("message", (upData) => {
            const raw = typeof upData === "string" ? upData : upData.toString();
            try {
              const f = JSON.parse(raw);
              if (f.type === "res") {
                if (f.error) {
                  console.log(
                    `[GatewayProxy] upstream res: FAIL ${f.error.code}: ${f.error.message}`,
                  );
                } else if (f.ok) {
                  // Log features from hello response
                  if (f.payload?.features) {
                    const feat = f.payload.features as Record<string, unknown>;
                    console.log(
                      `[GatewayProxy] hello features: methods=${JSON.stringify(feat.methods)}`,
                    );
                  } else {
                    console.log(`[GatewayProxy] upstream res: OK`);
                  }
                }
              }
            } catch {}
            if (client.readyState === WebSocket.OPEN) {
              client.send(raw);
            }
          });

          upstream.on("close", (code, reason) => {
            if (client.readyState === WebSocket.OPEN) {
              client.close(code, reason.toString());
            }
          });

          upstream.on("error", (err) => {
            console.error("[GatewayProxy] upstream error:", err.message);
            if (client.readyState === WebSocket.OPEN) {
              client.close(4002, "Upstream connection error");
            }
          });
        } catch {
          client.close(4000, "Invalid first message");
        }
        return;
      }

      // After connect: forward client → upstream transparently
      if (upstream && upstream.readyState === WebSocket.OPEN) {
        try {
          const f = JSON.parse(raw);
          console.log(`[GatewayProxy] client→upstream: ${f.method ?? f.type}`);
        } catch {}
        upstream.send(raw);
      }
    });

    client.on("close", () => {
      if (upstream) {
        upstream.close();
        upstream = null;
      }
    });

    client.on("error", (err) => {
      console.error("[GatewayProxy] client error:", err.message);
      if (upstream) {
        upstream.close();
        upstream = null;
      }
    });
  }
}
