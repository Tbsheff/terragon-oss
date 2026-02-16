import { getOpenClawClient } from "@/lib/openclaw-client";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function getClient() {
  const client = getOpenClawClient();
  if (client.getState() === "disconnected") {
    return null;
  }
  return client;
}

export function notConnected(): ActionResult<never> {
  return { ok: false, error: "OpenClaw client is not connected" };
}
