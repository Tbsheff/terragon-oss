import type { AIAgent } from "@/lib/types";

/**
 * Agent icon for OpenClaw.
 * Handles dynamic agent IDs from the gateway with a generic fallback.
 */
export function AgentIcon({ agent }: { agent: AIAgent }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center text-sm"
      title={agent}
    >
      {">"}_
    </span>
  );
}
