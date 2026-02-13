import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
