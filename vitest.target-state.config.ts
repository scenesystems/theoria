import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1
      }
    },
    fileParallelism: true,
    maxConcurrency: 10,
    include: ["packages/*/test/target-state/**/*.test.ts"],
    passWithNoTests: true
  }
})
