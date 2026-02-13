import type { AgentRole } from "@/lib/agent-soul-generator";

// ─────────────────────────────────────────────────
// Specialized Roster Constants
// ─────────────────────────────────────────────────

export type RosterAgent = {
  role: AgentRole;
  name: string;
  emoji: string;
  model: string;
  description: string;
};

export const SPECIALIZED_ROSTER: RosterAgent[] = [
  {
    role: "brainstormer",
    name: "brainstormer",
    emoji: "\u{1F9E0}",
    model: "opus",
    description: "Explore approaches and ask questions before implementing",
  },
  {
    role: "planner",
    name: "planner",
    emoji: "\u{1F4CB}",
    model: "opus",
    description: "Create detailed implementation plans with file paths",
  },
  {
    role: "coder",
    name: "coder",
    emoji: "\u{1F4BB}",
    model: "sonnet",
    description: "Execute plans following project patterns",
  },
  {
    role: "reviewer",
    name: "reviewer",
    emoji: "\u{1F50D}",
    model: "opus",
    description: "13-category deep review of implementations",
  },
  {
    role: "tester",
    name: "tester",
    emoji: "\u{1F9EA}",
    model: "sonnet",
    description: "Run quality gates and write tests",
  },
];

export type SetupProgress = {
  agent: RosterAgent;
  status: "pending" | "creating" | "done" | "error";
  error?: string;
};
