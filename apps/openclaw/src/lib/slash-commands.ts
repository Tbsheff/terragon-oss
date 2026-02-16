// ─────────────────────────────────────────────────
// Slash Command Registry
// ─────────────────────────────────────────────────

export type SlashCommandDef = {
  name: string;
  description: string;
  icon?: string;
  immediate?: boolean;
  argPlaceholder?: string;
};

export type SlashCommandContext = {
  threadId: string;
  sessionKey: string;
  onInject: (content: string, role: "system" | "user") => Promise<void>;
  onSwitchModel: (model: string) => Promise<void>;
  onSendMessage: (message: string) => void;
};

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: "compact",
    description: "Be extremely concise in responses",
    icon: "Minimize2",
    immediate: true,
  },
  {
    name: "clear",
    description: "Forget all previous context and start fresh",
    icon: "Trash2",
    immediate: true,
  },
  {
    name: "inject",
    description: "Inject a system message",
    icon: "Syringe",
    argPlaceholder: "<text>",
  },
  {
    name: "model",
    description: "Switch session model",
    icon: "Cpu",
    argPlaceholder: "<name>",
  },
  {
    name: "help",
    description: "Show available commands",
    icon: "HelpCircle",
    immediate: true,
  },
];

export type ParsedSlashCommand = { name: string; args: string } | null;

export function parseSlashCommand(text: string): ParsedSlashCommand {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (!name) return null;
  return { name, args };
}

function buildHelpText(): string {
  return SLASH_COMMANDS.map(
    (c) =>
      `/${c.name}${c.argPlaceholder ? ` ${c.argPlaceholder}` : ""} — ${c.description}`,
  ).join("\n");
}

/**
 * Execute a slash command. Returns a local message string if the command
 * produces output (e.g. /help), or null if it was handled silently.
 */
export async function executeSlashCommand(
  parsed: { name: string; args: string },
  ctx: SlashCommandContext,
): Promise<string | null> {
  switch (parsed.name) {
    case "compact":
      await ctx.onInject("Be extremely concise in responses", "system");
      return null;

    case "clear":
      await ctx.onInject(
        "Forget all previous context and start fresh",
        "system",
      );
      return null;

    case "inject": {
      if (!parsed.args) return "Usage: /inject <text>";
      await ctx.onInject(parsed.args, "system");
      return null;
    }

    case "model": {
      if (!parsed.args) return "Usage: /model <name>";
      await ctx.onSwitchModel(parsed.args);
      return null;
    }

    case "help":
      return buildHelpText();

    default:
      return `Unknown command: /${parsed.name}. Type /help for available commands.`;
  }
}
