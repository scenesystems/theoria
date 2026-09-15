import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/worker/*.spec.ts"],
    testTimeout: 30_000,
    fileParallelism: false
  }
})
