/**
 * Validates every committed SciPy fixture against its schema and manifest
 * SHA-256, and reports recursively discovered JSON files that are absent from
 * the manifest.
 *
 * @since 0.1.0
 * @module
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Effect, Path } from "effect"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import { checkFixtureTree, committedFixtureDirectory, reportFixtureTree } from "./scipy-fixtures.js"

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const report = yield* checkFixtureTree(path.join(packageRoot, committedFixtureDirectory))
  yield* reportFixtureTree("committed", report)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
