/**
 * Verifies committed SciPy evidence.
 *
 * Decodes every fixture and manifest, verifies their pinned SHA-256 hashes,
 * then regenerates every family and the manifest with the root uv lock at the
 * committed timestamp. All 17 files must match byte for byte, locally and in CI.
 * The generator pins PYTHONHASHSEED=0 and
 * NPY_DISABLE_CPU_FEATURES=AVX2,FMA3,AVX512F before importing NumPy.
 *
 * @since 0.1.0
 * @module
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array, Console, Effect, FileSystem, Option, Path } from "effect"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import {
  checkFixtureTree,
  checkManifestSha256,
  committedFixtureDirectory,
  compareFixtureTrees,
  failOnErrors,
  FixtureCheckError,
  generateReferenceFixtures,
  manifestFile,
  reportComparison,
  reportFixtureTree
} from "./scipy-fixtures.js"

/**
 * SHA-256 of the committed `manifest.json` bytes. Update only this value when
 * the manifest metadata changes intentionally.
 */
const expectedManifestSha256 = "b0c9ef71c0ef72e05ca68c56c4aa92bc00e855da2d62db777612d12f8840858d"

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const committedRoot = path.join(packageRoot, committedFixtureDirectory)

  yield* Console.log("SciPy fixture verification: full portable byte regeneration")
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

  yield* Console.log("Regenerating all references at", generatedAt, "into", regeneratedRoot)
  const generated = yield* generateReferenceFixtures({ packageRoot, outputDirectory: regeneratedRoot, generatedAt })
  yield* Console.log("Regenerated", generated.fixtures, "fixtures with", generated.cases, "reference cases")
  yield* Console.log()
  const regenerated = yield* checkFixtureTree(regeneratedRoot)
  yield* reportFixtureTree("regenerated", regenerated).pipe(Effect.ignore)
  const comparison = yield* compareFixtureTrees(committedRoot, regeneratedRoot)
  yield* reportComparison("full", comparison)
  yield* failOnErrors("regenerated", regenerated.errors)
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunServices.layer)))
