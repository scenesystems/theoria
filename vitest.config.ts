import { Boolean, Config, Effect, String } from "effect"
import { defineConfig } from "vitest/config"

const maxWorkers = Effect.runSync(
  Config.string("CI").pipe(
    Config.withDefault(""),
    Config.map(String.isNonEmpty),
    Config.map(Boolean.match({ onFalse: () => 4, onTrue: () => 2 }))
  )
)

export default defineConfig({
  test: {
    pool: "forks",
    maxWorkers,
    fileParallelism: true,
    maxConcurrency: 10,
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
    // Every test file belongs to exactly one project. Packages and scripts run
    // in Node; the app's project (happy-dom) is its own vitest.config.ts, so
    // `bun run test` here and `bun run test` in apps/theoria agree.
    projects: [
      {
        extends: true,
        test: {
          name: "packages",
          include: ["packages/*/test/**/*.test.ts", "scripts/api-reference/**/*.test.ts"],
          exclude: ["**/node_modules/**"]
        }
      },
      "apps/theoria/vitest.config.ts"
    ]
  }
})
