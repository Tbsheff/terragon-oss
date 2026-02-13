import type { AIAgent } from "@/lib/types";

/**
 * Simplified agent icon for OpenClaw.
 * Uses text/emoji fallbacks instead of Next.js Image component.
 */
export function AgentIcon({ agent }: { agent: AIAgent }) {
  switch (agent) {
    case "claudeCode":
      return (
        <span
          className="flex-shrink-0 inline-flex items-center text-sm"
          title="Claude Code"
        >
          {">"}_
        </span>
      );
    case "amp":
      return (
        <span
          className="flex-shrink-0 inline-flex items-center text-sm"
          title="Amp"
        >
          Amp
        </span>
      );
    case "codex":
      return (
        <span
          className="flex-shrink-0 inline-flex items-center text-sm"
          title="Codex"
        >
          Codex
        </span>
      );
    case "gemini":
      return (
        <span
          className="flex-shrink-0 inline-flex items-center text-sm"
          title="Gemini"
        >
          Gemini
        </span>
      );
    case "opencode":
      return (
        <span
          className="flex-shrink-0 inline-flex items-center text-sm"
          title="Opencode"
        >
          OC
        </span>
      );
    default:
      return null;
  }
}
