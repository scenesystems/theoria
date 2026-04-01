import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: process.env.CI ? 2 : 4,
        minForks: 1
      }
    },
    fileParallelism: true,
    maxConcurrency: 10,

    include: ["packages/*/test/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000
  },
  coverage: {
    provider: "v8",
    all: true,
    reporter: ["text", "lcov", "html"],
    reportsDirectory: "coverage",
    include: [
      "packages/*/src/**/*.ts"
    ],
    exclude: [
      "**/*.test.ts",
      "**/*.d.ts",
      "**/dist/**",
      "**/.tsbuild/**"
    ]
  }
})
