import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    pool: "forks",
    maxWorkers: process.env.CI ? 2 : 4,
    fileParallelism: true,
    maxConcurrency: 10,

    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "scripts/api-reference/**/*.test.ts"
    ],
    // Runs the built Worker in workerd; see apps/theoria/vitest.worker.config.ts.
    exclude: ["apps/theoria/test/worker/**", "**/node_modules/**"],
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000
  }
})
