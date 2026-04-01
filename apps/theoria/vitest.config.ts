import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "happy-dom",
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
})
