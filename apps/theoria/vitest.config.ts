import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Needs a built Worker bundle; run with `bun run test:worker`.
    exclude: ["test/worker/**", "**/node_modules/**"],
    environment: "happy-dom",
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
})
