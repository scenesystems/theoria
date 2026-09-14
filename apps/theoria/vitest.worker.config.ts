import { defineConfig } from "vitest/config"

import { BalancedSequencer } from "./test/worker/sequencer.js"

/**
 * Runs the deployable Worker bundle in workerd against the real `dist/`.
 * Needs `bun run build:web && bun run deploy:dry-run` first, so it is kept out
 * of the default `vitest.config.ts` and runs via `bun run test:worker`.
 *
 * The files run one at a time: they measure motion and layout in a real
 * Chromium, and a second browser on the same runner would skew the timings.
 * CI runs the suite on several runners at once instead, each with one shard
 * (`bun run test:worker -- --shard=i/n`); the sequencer cuts the shards by
 * file size so the runners finish together (`test/worker/sequencer.ts`).
 */
export default defineConfig({
  test: {
    include: ["test/worker/**/*.test.ts"],
    environment: "node",
    env: { WRANGLER_SEND_METRICS: "false" },
    passWithNoTests: false,
    fileParallelism: false,
    sequence: { sequencer: BalancedSequencer },
    testTimeout: 60_000,
    hookTimeout: 120_000
  }
})
