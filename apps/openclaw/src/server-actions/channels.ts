"use server";

import { getClient, notConnected, type ActionResult } from "./action-utils";
import type { ChannelStatus } from "@/lib/openclaw-types";

export async function listChannels(): Promise<ActionResult<ChannelStatus[]>> {
  const client = getClient();
  if (!client) return notConnected();

  try {
    const channels = await client.channelsStatus();
    return { ok: true, data: channels };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
