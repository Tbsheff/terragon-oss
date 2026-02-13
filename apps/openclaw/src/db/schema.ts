import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─────────────────────────────────────────────────
// Thread — task/conversation container
// ─────────────────────────────────────────────────
export const thread = sqliteTable("thread", {
  id: text("id").primaryKey(),
  name: text("name"),
  status: text("status", {
    enum: [
      "draft",
      "queued",
      "working",
      "stopping",
      "working-done",
      "working-error",
      "complete",
    ],
  })
    .notNull()
    .default("draft"),
  agent: text("agent").notNull().default("claudeCode"),
  model: text("model"),
  githubRepoFullName: text("github_repo_full_name"),
  githubBranch: text("github_branch"),
  baseBranch: text("base_branch"),
  pipelineState: text("pipeline_state"), // JSON — PipelineState
  tokenUsage: text("token_usage"), // JSON — cost tracking
  environmentId: text("environment_id").references(() => environment.id),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// ThreadChat — multi-chat per thread (one per pipeline stage)
// ─────────────────────────────────────────────────
export const threadChat = sqliteTable("thread_chat", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => thread.id, { onDelete: "cascade" }),
  agent: text("agent").notNull().default("claudeCode"),
  model: text("model"),
  status: text("status", {
    enum: [
      "draft",
      "queued",
      "working",
      "stopping",
      "working-done",
      "working-error",
      "complete",
    ],
  })
    .notNull()
    .default("draft"),
  messages: text("messages"), // JSON — DBMessage[]
  sessionKey: text("session_key"), // OpenClaw session key
  pipelineStage: text("pipeline_stage"), // which pipeline stage this chat is for
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Environment — per-repo env vars & MCP config
// ─────────────────────────────────────────────────
export const environment = sqliteTable("environment", {
  id: text("id").primaryKey(),
  githubRepoFullName: text("github_repo_full_name").notNull().unique(),
  envVars: text("env_vars"), // JSON — Record<string, string>
  mcpConfig: text("mcp_config"), // JSON — MCP server config
  setupScript: text("setup_script"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Settings — single-row app preferences
// ─────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  defaultModel: text("default_model").default("sonnet"),
  defaultAgent: text("default_agent").default("claudeCode"),
  theme: text("theme", { enum: ["light", "dark", "system"] }).default("dark"),
  branchPrefix: text("branch_prefix").default("openclaw/"),
  autoCreatePR: integer("auto_create_pr", { mode: "boolean" }).default(true),
  prType: text("pr_type", { enum: ["draft", "ready"] }).default("draft"),
  autoCloseDraftPRs: integer("auto_close_draft_prs", {
    mode: "boolean",
  }).default(false),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(3),
  notificationsEnabled: integer("notifications_enabled", {
    mode: "boolean",
  }).default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Credentials — agent API keys (encrypted)
// ─────────────────────────────────────────────────
export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  provider: text("provider", {
    enum: ["anthropic", "openai", "google", "amp", "github"],
  }).notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(), // AES-256-GCM encrypted
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// GitHub PR tracking
// ─────────────────────────────────────────────────
export const githubPR = sqliteTable("github_pr", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => thread.id, { onDelete: "cascade" }),
  repoFullName: text("repo_full_name").notNull(),
  prNumber: integer("pr_number").notNull(),
  prStatus: text("pr_status", {
    enum: ["draft", "open", "closed", "merged"],
  }).notNull(),
  prTitle: text("pr_title"),
  prUrl: text("pr_url"),
  headBranch: text("head_branch"),
  baseBranch: text("base_branch"),
  checksStatus: text("checks_status", {
    enum: ["none", "pending", "success", "failure", "unknown"],
  }).default("none"),
  mergeableState: text("mergeable_state", {
    enum: ["clean", "dirty", "blocked", "unknown", "unstable"],
  }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// GitHub check runs
// ─────────────────────────────────────────────────
export const githubCheckRun = sqliteTable("github_check_run", {
  id: text("id").primaryKey(),
  githubPRId: text("github_pr_id")
    .notNull()
    .references(() => githubPR.id, { onDelete: "cascade" }),
  checkRunId: text("check_run_id").notNull(),
  name: text("name").notNull(),
  status: text("status", {
    enum: ["queued", "in_progress", "completed"],
  }).notNull(),
  conclusion: text("conclusion", {
    enum: [
      "success",
      "failure",
      "neutral",
      "cancelled",
      "skipped",
      "timed_out",
      "action_required",
    ],
  }),
  detailsUrl: text("details_url"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// GitHub auth — PAT storage
// ─────────────────────────────────────────────────
export const githubAuth = sqliteTable("github_auth", {
  id: text("id").primaryKey().default("default"),
  personalAccessToken: text("personal_access_token"), // AES-256-GCM encrypted
  username: text("username"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Automations — scheduled/triggered tasks
// ─────────────────────────────────────────────────
export const automations = sqliteTable("automations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type", {
    enum: ["cron", "linear", "github-pr"],
  }).notNull(),
  triggerConfig: text("trigger_config").notNull(), // JSON — trigger-specific config
  pipelineTemplateId: text("pipeline_template_id").references(
    () => pipelineTemplate.id,
  ),
  prompt: text("prompt").notNull(),
  environmentId: text("environment_id").references(() => environment.id),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// OpenClaw connection — Mac Mini gateway config
// ─────────────────────────────────────────────────
export const openclawConnection = sqliteTable("openclaw_connection", {
  id: text("id").primaryKey().default("default"),
  host: text("host").notNull().default("mac-mini.tailnet"),
  port: integer("port").notNull().default(18789),
  authToken: text("auth_token"),
  useTls: integer("use_tls", { mode: "boolean" }).notNull().default(false),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
  lastHealthCheck: text("last_health_check"),
  lastHealthStatus: text("last_health_status", {
    enum: ["healthy", "unhealthy", "unknown"],
  }).default("unknown"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Pipeline templates — saved pipeline configurations
// ─────────────────────────────────────────────────
export const pipelineTemplate = sqliteTable("pipeline_template", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stages: text("stages").notNull(), // JSON — PipelineStage[]
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// Prompt templates — saved prompts with variables
// ─────────────────────────────────────────────────
export const promptTemplate = sqliteTable("prompt_template", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  template: text("template").notNull(), // e.g. "Add tests for {component} in {package}"
  variables: text("variables"), // JSON — string[] of variable names
  pipelineTemplateId: text("pipeline_template_id").references(
    () => pipelineTemplate.id,
  ),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─────────────────────────────────────────────────
// KV Store — feature flags & app config
// ─────────────────────────────────────────────────
export const kvStore = sqliteTable("kv_store", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
