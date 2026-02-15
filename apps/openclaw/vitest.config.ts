import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    silent: "passed-only",
    env: {
      OPENCLAW_GATEWAY_URL: "ws://localhost:18789",
      OPENCLAW_AUTH_TOKEN: "test-token",
    },
  },
});
