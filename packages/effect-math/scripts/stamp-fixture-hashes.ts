/**
 * Computes canonical BLAKE3-256 hashes for all boundary fixture JSON files
 * using `@scenesystems/digest` and stamps the corresponding manifest files.
 *
 * The hash is computed via `digest("blake3-256", value)`:
 * JCS canonicalize → UTF-8 encode → BLAKE3-256 → base64url → tagged string.
 *
 * No `JSON.parse` or `JSON.stringify` — all serialization uses Effect Schema.
 *
 * Usage: bun run scripts/stamp-fixture-hashes.ts
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { digest } from "@scenesystems/digest"
import { Console, Effect, Schema } from "effect"

const FIXTURES_DIR = "test/fixtures"
const SCIPY_FIXTURE_ROOT = "test/fixtures/scipy"
const SCIPY_MANIFEST_FILE = "manifest.json"

const ManifestSchema = Schema.Struct({
  version: Schema.Number,
  algorithm: Schema.Literal("blake3-256"),
  fixtures: Schema.NonEmptyArray(
    Schema.Struct({
      name: Schema.String,
      path: Schema.String,
      hash: Schema.String
    })
  )
})

const decodeJsonManifest = Schema.decodeUnknown(Schema.parseJson(ManifestSchema))
const decodeJsonUnknown = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))
const encodeManifestJson = Schema.encode(Schema.parseJson(ManifestSchema))
const ScipyBootstrapManifestSchema = Schema.Struct({
  schemaVersion: Schema.String,
  generator: Schema.Struct({
    script: Schema.String,
    generatorVersion: Schema.String,
    upstream: Schema.String,
    upstreamVersion: Schema.String,
    numpyVersion: Schema.String,
    pythonVersion: Schema.String,
    generatedAt: Schema.String
  }),
  fixtures: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      file: Schema.String,
      hash: Schema.optional(Schema.String)
    })
  )
})
const decodeScipyManifestJson = Schema.decodeUnknown(Schema.parseJson(ScipyBootstrapManifestSchema))
const encodeScipyManifestJson = Schema.encode(Schema.parseJson(ScipyBootstrapManifestSchema))

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())
  const fixturesDir = path.join(cwd, FIXTURES_DIR)

  const entries = yield* fs.readDirectory(fixturesDir)
  const manifestFiles = entries.filter((e) => e.endsWith(".fixture-manifest.json"))

  yield* Console.log(`Found ${manifestFiles.length} manifest files\n`)

  yield* Effect.forEach(manifestFiles, (manifestFile) =>
    Effect.gen(function*() {
      const manifestPath = path.join(fixturesDir, manifestFile)
      const manifestRaw = yield* fs.readFileString(manifestPath)
      const manifest = yield* decodeJsonManifest(manifestRaw)

      let updated = false

      for (const fixture of manifest.fixtures) {
        const fixturePath = path.join(cwd, fixture.path)
        const fixtureRaw = yield* fs.readFileString(fixturePath)
        const fixtureValue = yield* decodeJsonUnknown(fixtureRaw)
        const hash = yield* digest("blake3-256", fixtureValue)

        if (fixture.hash !== hash) {
          yield* Console.log(`  ${fixture.name}: ${fixture.hash} → ${hash}`)
          fixture.hash = hash
          updated = true
        } else {
          yield* Console.log(`  ${fixture.name}: ${hash} (unchanged)`)
        }
      }

      if (updated) {
        const encoded = yield* encodeManifestJson(manifest)
        yield* fs.writeFileString(manifestPath, encoded + "\n")
        yield* Console.log(`  ✓ ${manifestFile} updated\n`)
      } else {
        yield* Console.log(`  ✓ ${manifestFile} already canonical\n`)
      }
    }).pipe(Effect.orDie), { discard: true })

  yield* Console.log("Stamping SciPy parity manifest...\n")

  const scipyRoot = path.join(cwd, SCIPY_FIXTURE_ROOT)
  const scipyManifestPath = path.join(scipyRoot, SCIPY_MANIFEST_FILE)
  const scipyManifestRaw = yield* fs.readFileString(scipyManifestPath)
  const scipyManifest = yield* decodeScipyManifestJson(scipyManifestRaw)

  let scipyUpdated = false

  for (const fixture of scipyManifest.fixtures) {
    const fixturePath = path.join(scipyRoot, fixture.file)
    const fixtureRaw = yield* fs.readFileString(fixturePath)
    const fixtureValue = yield* decodeJsonUnknown(fixtureRaw)
    const hash = yield* digest("blake3-256", fixtureValue)

    if (fixture.hash !== hash) {
      yield* Console.log(`  ${fixture.name}: ${fixture.hash} → ${hash}`)
      fixture.hash = hash
      scipyUpdated = true
    } else {
      yield* Console.log(`  ${fixture.name}: ${hash} (unchanged)`)
    }
  }

  if (scipyUpdated) {
    const encoded = yield* encodeScipyManifestJson(scipyManifest)
    yield* fs.writeFileString(scipyManifestPath, encoded + "\n")
    yield* Console.log(`  ✓ ${SCIPY_MANIFEST_FILE} updated\n`)
  } else {
    yield* Console.log(`  ✓ ${SCIPY_MANIFEST_FILE} already canonical\n`)
  }

  yield* Console.log("Done — all manifests stamped with canonical BLAKE3-256 hashes.")
})

BunRuntime.runMain(
  program.pipe(
    Effect.catchAll((err) =>
      Console.error(`FATAL: ${String(err)}`).pipe(
        Effect.andThen(Effect.sync(() => process.exit(1)))
      )
    ),
    Effect.provide(BunContext.layer)
  )
)
