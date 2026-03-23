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

    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["packages/*/test/target-state/**/*.test.ts"],
    passWithNoTests: true
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
