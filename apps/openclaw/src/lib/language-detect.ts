import type { BundledLanguage } from "shiki";

const EXTENSION_MAP: Record<string, BundledLanguage> = {
  // TypeScript / JavaScript
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",

  // Python
  py: "python",
  pyi: "python",
  pyx: "python",

  // Rust
  rs: "rust",

  // Go
  go: "go",
  mod: "go",

  // Ruby
  rb: "ruby",
  rake: "ruby",
  gemspec: "ruby",

  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",

  // Markup / Data
  md: "markdown",
  mdx: "mdx",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "xml",

  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",

  // Database
  sql: "sql",
  prisma: "prisma",

  // Config
  env: "dotenv",
  dockerfile: "dockerfile",
  graphql: "graphql",
  gql: "graphql",

  // Systems
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",

  // JVM
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  gradle: "groovy",

  // Other
  swift: "swift",
  php: "php",
  lua: "lua",
  r: "r",
  dart: "dart",
  zig: "zig",
  elixir: "elixir",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hcl: "hcl",
  tf: "hcl",
  nim: "nim",
  makefile: "makefile",
  cmake: "cmake",
  diff: "diff",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
};

/** Special filenames that map to a language regardless of extension */
const FILENAME_MAP: Record<string, BundledLanguage> = {
  Makefile: "makefile",
  CMakeLists: "cmake",
  Dockerfile: "dockerfile",
  Containerfile: "dockerfile",
  Gemfile: "ruby",
  Rakefile: "ruby",
  Justfile: "makefile",
};

/**
 * Detect Shiki BundledLanguage from a file path.
 * Falls back to "text" for unknown extensions.
 */
export function detectLanguage(filePath: string): BundledLanguage {
  // Check filename matches first (e.g. Makefile, Dockerfile)
  const filename = filePath.split("/").pop() ?? "";
  const baseName = filename.split(".")[0] ?? "";

  if (filename in FILENAME_MAP) {
    return FILENAME_MAP[filename]!;
  }
  if (baseName in FILENAME_MAP) {
    return FILENAME_MAP[baseName]!;
  }

  // Extract extension
  const ext = filename.includes(".")
    ? (filename.split(".").pop()?.toLowerCase() ?? "")
    : "";

  return EXTENSION_MAP[ext] ?? ("text" as BundledLanguage);
}
