/**
 * Verifies committed SciPy evidence.
 *
 * Both modes decode the manifest and every fixture with their schemas, verify
 * every fixture's SHA-256, and require the manifest bytes to match the pinned
 * `expectedManifestSha256`, so a tampered manifest fails even when every payload
 * entry is intact.
 *
 * - `portable` (default, CI): additionally regenerates only the CPU-independent
 *   `cpython-sum-001` family, whose module pins its own dispatch environment,
 *   and requires its bytes to match the committed file exactly.
 * - `full` (`SCIPY_FIXTURE_VERIFY_MODE=full`, explicit local command): regenerates
 *   every family and the manifest with the root uv lock at the committed
 *   timestamp and requires the whole tree to match the committed bytes. Several
 *   legacy files depend on NumPy CPU dispatch (see the manifest `provenance`),
 *   so this passes only on a CPU that reproduces them and otherwise reports the
 *   exact drifting files.
 *
 * @since 0.1.0
 * @module
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array, Config, Console, Effect, FileSystem, Match, Option, Path, Schema } from "effect"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import {
  checkFixtureTree,
  checkManifestSha256,
  committedFixtureDirectory,
  compareFixtureFiles,
  compareFixtureTrees,
  failOnErrors,
  FixtureCheckError,
  generatePortableFixtures,
  generateReferenceFixtures,
  manifestFile,
  reportComparison,
  reportFixtureTree
} from "./scipy-fixtures.js"

/**
 * SHA-256 of the committed `manifest.json` bytes. Update only this value when
 * the manifest metadata changes intentionally.
 */
const expectedManifestSha256 = "809ec1033cefa1ab56babce676bf3d69eedc3d53348d5770f2c9c8f2b1929c7b"

const VerifyMode = Schema.Literals(["portable", "full"])

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const mode = yield* Config.schema(VerifyMode, "SCIPY_FIXTURE_VERIFY_MODE").pipe(Config.withDefault("portable"))
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const committedRoot = path.join(packageRoot, committedFixtureDirectory)

  yield* Console.log("SciPy fixture verification mode:", mode)
  yield* Console.log()
  const committed = yield* checkFixtureTree(committedRoot)
  const manifestErrors = yield* checkManifestSha256(committedRoot, expectedManifestSha256)
  yield* reportFixtureTree("committed", { ...committed, errors: Array.appendAll(committed.errors, manifestErrors) })
  yield* Console.log("✓", manifestFile, "sha256", expectedManifestSha256)
  const manifest = yield* Effect.fromOption(committed.manifest).pipe(
    Effect.mapError(() =>
      new FixtureCheckError({
        name: "manifest",
        file: committedRoot,
        reason: "committed manifest unavailable",
        cause: Option.none()
      })
    )
  )
  const generatedAt = manifest.generator.generatedAt
  const regeneratedRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-math-scipy-" })
  yield* Console.log()

  yield* Match.value(mode).pipe(
    Match.when("portable", () =>
      Effect.gen(function*() {
        yield* Console.log("Regenerating CPU-independent references at", generatedAt, "into", regeneratedRoot)
        const generated = yield* generatePortableFixtures({
          packageRoot,
          outputDirectory: regeneratedRoot,
          generatedAt
        })
        yield* Console.log("Regenerated", Array.length(generated.entries), "fixtures with", generated.cases, "cases")
        const comparison = yield* compareFixtureFiles(
          committedRoot,
          regeneratedRoot,
          Array.map(generated.entries, (entry) => entry.file)
        )
        yield* reportComparison("portable", comparison)
      })),
    Match.when("full", () =>
      Effect.gen(function*() {
        yield* Console.log("Regenerating all references at", generatedAt, "into", regeneratedRoot)
        const generated = yield* generateReferenceFixtures({
          packageRoot,
          outputDirectory: regeneratedRoot,
          generatedAt
        })
        yield* Console.log("Regenerated", generated.fixtures, "fixtures with", generated.cases, "reference cases")
        yield* Console.log()
        const regenerated = yield* checkFixtureTree(regeneratedRoot)
        yield* reportFixtureTree("regenerated", regenerated).pipe(Effect.ignore)
        const comparison = yield* compareFixtureTrees(committedRoot, regeneratedRoot)
        yield* reportComparison("full", comparison)
        yield* failOnErrors("regenerated", regenerated.errors)
      })),
    Match.exhaustive
  )
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunServices.layer)))
