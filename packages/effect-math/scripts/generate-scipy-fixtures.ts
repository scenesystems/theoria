/**
 * Evaluates Python reference families in scoped processes and writes validated
 * fixtures with a manifest recording each fixture's SHA-256.
 *
 * @since 0.1.0
 * @module
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Config, Console, Effect, Path } from "effect"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import { committedFixtureDirectory, defaultGeneratedAt, generateReferenceFixtures } from "./scipy-fixtures.js"

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const outputDirectory = yield* Config.String("SCIPY_FIXTURE_OUTPUT_DIRECTORY").pipe(
    Config.withDefault(path.join(packageRoot, committedFixtureDirectory))
  )
  const generatedAt = yield* Config.String("SCIPY_FIXTURE_GENERATED_AT").pipe(
    Config.withDefault(defaultGeneratedAt)
  )
  const generated = yield* generateReferenceFixtures({ packageRoot, outputDirectory, generatedAt })
  yield* Console.log(
    "Generated",
    generated.fixtures,
    "fixtures with",
    generated.cases,
    "reference cases in",
    outputDirectory
  )
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunServices.layer)))
