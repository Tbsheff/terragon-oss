import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { kvStore } from "@/db/schema";
import { eq } from "drizzle-orm";
import { startPipelineFromIssue } from "@/server-actions/linear";

// ─────────────────────────────────────────────────
// Deduplication — track processed deliveries in memory
// (survives request lifecycle but resets on deploy)
// ─────────────────────────────────────────────────

const processedDeliveries = new Set<string>();
const MAX_DELIVERY_CACHE = 1000;

function markDelivery(deliveryId: string): boolean {
  if (processedDeliveries.has(deliveryId)) return false;
  if (processedDeliveries.size >= MAX_DELIVERY_CACHE) {
    // Evict oldest entries (Set preserves insertion order)
    const first = processedDeliveries.values().next().value;
    if (first) processedDeliveries.delete(first);
  }
  processedDeliveries.add(deliveryId);
  return true;
}

// ─────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────

async function getWebhookSecret(): Promise<string | null> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(eq(kvStore.key, "linear_webhook_secret"));
  return rows[0]?.value ?? null;
}

function verifySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ─────────────────────────────────────────────────
// Webhook configuration helper
// ─────────────────────────────────────────────────

async function getLinearWebhookConfig(): Promise<{
  triggerLabel: string;
  defaultRepo: string | null;
  defaultModel: string | null;
} | null> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(eq(kvStore.key, "linear_webhook_config"));
  if (!rows[0]?.value) return null;
  try {
    return JSON.parse(rows[0].value);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature
    const signature = request.headers.get("linear-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing Linear-Signature header" },
        { status: 401 },
      );
    }

    const secret = await getWebhookSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Deduplicate via delivery ID
    const deliveryId = request.headers.get("linear-delivery");
    if (deliveryId && !markDelivery(deliveryId)) {
      return NextResponse.json({ status: "duplicate", deliveryId });
    }

    // Parse body
    const payload = JSON.parse(rawBody) as LinearWebhookPayload;

    // Only handle Issue events
    if (payload.type !== "Issue") {
      return NextResponse.json({ status: "ignored", type: payload.type });
    }

    // Handle based on action
    switch (payload.action) {
      case "create":
      case "update":
        return await handleIssueEvent(payload);
      default:
        return NextResponse.json({
          status: "ignored",
          action: payload.action,
        });
    }
  } catch (err) {
    console.error("Linear webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────
// Issue event handler
// ─────────────────────────────────────────────────

async function handleIssueEvent(
  payload: LinearWebhookPayload,
): Promise<NextResponse> {
  const config = await getLinearWebhookConfig();
  const triggerLabel = config?.triggerLabel ?? "openclaw";

  // Check if the issue has the trigger label
  const labels = payload.data?.labels ?? [];
  const hasLabel = labels.some(
    (l: { name: string }) =>
      l.name.toLowerCase() === triggerLabel.toLowerCase(),
  );

  if (!hasLabel) {
    return NextResponse.json({
      status: "ignored",
      reason: "no trigger label",
    });
  }

  // For updates, only trigger if the label was just added
  if (payload.action === "update") {
    const addedLabels = payload.updatedFrom?.labelIds;
    // If labelIds didn't change, skip (avoids re-triggering on unrelated updates)
    if (!addedLabels) {
      return NextResponse.json({
        status: "ignored",
        reason: "label not newly added",
      });
    }
  }

  // Queue pipeline start async
  const issueId = payload.data?.id;
  if (!issueId) {
    return NextResponse.json({ error: "Missing issue ID" }, { status: 400 });
  }

  // Start pipeline asynchronously — don't block the webhook response
  startPipelineFromIssue(issueId, {
    githubRepoFullName: config?.defaultRepo ?? undefined,
    model: config?.defaultModel ?? undefined,
  }).catch((err) => {
    console.error(`Failed to start pipeline for issue ${issueId}:`, err);
  });

  return NextResponse.json({
    status: "accepted",
    issueId,
    action: "pipeline_queued",
  });
}

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type LinearWebhookPayload = {
  type: string;
  action: string;
  data?: {
    id: string;
    identifier?: string;
    title?: string;
    description?: string;
    labels?: { id: string; name: string }[];
    state?: { name: string; type: string };
    teamId?: string;
    [key: string]: unknown;
  };
  updatedFrom?: {
    labelIds?: string[];
    stateId?: string;
    [key: string]: unknown;
  };
  url?: string;
  createdAt?: string;
};
