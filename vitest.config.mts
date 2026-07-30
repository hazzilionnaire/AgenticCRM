import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests hit a real Postgres; .env.test points them at a throwaway
// database so a test run can never touch development data.
loadEnv({ path: ".env.test", override: true, quiet: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The integration suites share one database and truncate between tests, so
    // they must not run concurrently with each other.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
