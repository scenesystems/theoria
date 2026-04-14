/**
 * Copy package-owned Amp fixture assets into the publish directory.
 *
 * Run: bun run scripts/copy-open-agent-trace-fixtures-to-dist.ts
 */
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Schema } from "effect"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptDirectory)
const sourceFixtureRoot = join(packageRoot, "fixtures", "open-agent-trace", "amp")
const distFixtureRoot = join(packageRoot, "dist", "fixtures", "open-agent-trace", "amp")
const assetDirectories = Arr.make("raw", "derived", "implementationStrategy")

class FixtureAssetCopyError extends Schema.TaggedError<FixtureAssetCopyError>()(
  "FixtureAssetCopyError",
  { path: Schema.String, message: Schema.String }
) {}

const copyAssetDirectory = (directoryName: string) => {
  const sourcePath = join(sourceFixtureRoot, directoryName)
  const targetPath = join(distFixtureRoot, directoryName)

  return existsSync(sourcePath)
    ? Effect.try({
      try: () => {
        mkdirSync(distFixtureRoot, { recursive: true })
        cpSync(sourcePath, targetPath, { force: true, recursive: true })

        return targetPath
      },
      catch: () =>
        new FixtureAssetCopyError({
          path: sourcePath,
          message: `failed to copy '${directoryName}' Amp fixture assets into dist`
        })
    })
    : Effect.fail(
      new FixtureAssetCopyError({
        path: sourcePath,
        message: `missing '${directoryName}' Amp fixture assets at source`
      })
    )
}

const program = Effect.forEach(assetDirectories, copyAssetDirectory, { concurrency: 1 }).pipe(
  Effect.tap((copiedPaths) =>
    Effect.log("copy-open-agent-trace-fixtures-to-dist", {
      copiedPaths,
      distFixtureRoot
    })
  )
)

BunRuntime.runMain(program)
