/**
 * Local WebSocket broadcast server.
 * Replaces PartyKit for single-user local use.
 *
 * Clients connect via ws://localhost:3100/ws?room={threadId}
 * Server broadcasts messages to all clients in the same room.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

type BroadcastClient = WebSocket & { rooms: Set<string> };

export class LocalBroadcastServer {
  private wss: WebSocketServer;
  private rooms = new Map<string, Set<BroadcastClient>>();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const client = ws as BroadcastClient;
      client.rooms = new Set();

      // Parse room from URL query param
      const url = new URL(req.url ?? "/", "http://localhost");
      const room = url.searchParams.get("room");
      if (room) {
        this.joinRoom(client, room);
      }

      // Handle messages from client (e.g., room join/leave, terminal input)
      client.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "join" && msg.room) {
            this.joinRoom(client, msg.room);
          } else if (msg.type === "leave" && msg.room) {
            this.leaveRoom(client, msg.room);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      client.on("close", () => {
        for (const room of client.rooms) {
          this.leaveRoom(client, room);
        }
      });
    });
  }

  /** Handle HTTP → WebSocket upgrade */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  /** Broadcast a message to all clients in a room */
  broadcast(room: string, message: unknown): void {
    const clients = this.rooms.get(room);
    if (!clients) return;
    const data =
      typeof message === "string" ? message : JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Broadcast to all connected clients regardless of room */
  broadcastAll(message: unknown): void {
    const data =
      typeof message === "string" ? message : JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private joinRoom(client: BroadcastClient, room: string): void {
    client.rooms.add(room);
    let roomClients = this.rooms.get(room);
    if (!roomClients) {
      roomClients = new Set();
      this.rooms.set(room, roomClients);
    }
    roomClients.add(client);
  }

  private leaveRoom(client: BroadcastClient, room: string): void {
    client.rooms.delete(room);
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(client);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /** Number of connected clients */
  get clientCount(): number {
    return this.wss.clients.size;
  }

  /** Close the server */
  close(): void {
    this.wss.close();
  }
}
