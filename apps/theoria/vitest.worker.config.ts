import { defineConfig } from "vitest/config"

/**
 * Runs the deployable Worker bundle in workerd against the real `dist/`.
 * Needs `bun run build:web && bun run deploy:dry-run` first, so it is kept out
 * of the default `vitest.config.ts` and runs via `bun run test:worker`.
 */
export default defineConfig({
  test: {
    include: ["test/worker/**/*.test.ts"],
    environment: "node",
    env: { WRANGLER_SEND_METRICS: "false" },
    passWithNoTests: false,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000
  }
})
