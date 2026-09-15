import { Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Number } from "effect"

import { checkBuildOutput } from "../app/server/config/build-output.js"

/**
 * Fails unless a Theoria build directory is deployable (`checkBuildOutput`).
 * Run by `.github/actions/theoria-build-check` on the fresh build and again on
 * the downloaded artifact before each deploy.
 *
 *   BUILD_ROOT=/abs/path/to/build bun run --cwd apps/theoria build:check
 *
 * `BUILD_ROOT` defaults to the app directory.
 */

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const appRoot = yield* Effect.flatMap(Url.fromString("../", import.meta.url), path.fromFileUrl)
  const root = yield* Config.string("BUILD_ROOT").pipe(
    Config.withDefault(appRoot),
    Config.map((value) => path.resolve(value))
  )
  const summary = yield* checkBuildOutput(root)
  yield* Effect.log("Build output is deployable").pipe(
    Effect.annotateLogs({
      root: summary.root,
      assets: summary.assets,
      workerKiB: Number.round(Number.unsafeDivide(summary.workerBytes, 1024), 0),
      homepageScriptGzipKiB: Number.round(Number.unsafeDivide(summary.homepageScriptGzipBytes, 1024), 0)
    })
  )
})

BunRuntime.runMain(Effect.provide(program, BunContext.layer))
