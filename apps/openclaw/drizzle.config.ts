import { defineConfig } from "drizzle-kit";

const tursoUrl = process.env.TURSO_DB_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: tursoUrl ? "turso" : "sqlite",
  dbCredentials: tursoUrl
    ? {
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: "./data/openclaw.db",
      },
});
