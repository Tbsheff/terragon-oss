"use server";

import { getOpenClawClient } from "@/lib/openclaw-client";
import type {
  ExecApprovalDecision,
  ExecApprovalRequest,
} from "@/lib/openclaw-types";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function resolveExecApproval(
  id: string,
  decision: ExecApprovalDecision,
): Promise<ActionResult> {
  const client = getOpenClawClient();
  if (client.getState() === "disconnected") {
    return { ok: false, error: "Gateway not connected" };
  }

  try {
    await client.execApprovalsResolve(id, decision);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function listPendingApprovals(): Promise<
  ActionResult<ExecApprovalRequest[]>
> {
  const client = getOpenClawClient();
  if (client.getState() === "disconnected") {
    return { ok: false, error: "Gateway not connected" };
  }

  try {
    const approvals = await client.execApprovalsList();
    return { ok: true, data: approvals };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
