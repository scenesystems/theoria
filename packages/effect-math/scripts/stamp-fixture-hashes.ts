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
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { digest } from "@scenesystems/digest"
import { Console, Effect, Schema } from "effect"

const FIXTURES_DIR = "test/fixtures"

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

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packageRoot = yield* Url.fromString("../", import.meta.url).pipe(
    Effect.flatMap((url) => path.fromFileUrl(url)),
    Effect.orDie
  )
  const fixturesDir = path.join(packageRoot, FIXTURES_DIR)

  const entries = yield* fs.readDirectory(fixturesDir)
  const manifestFiles = entries.filter((e) => e.endsWith(".fixture-manifest.json"))

  yield* Console.log(`Found ${manifestFiles.length} manifest files\n`)

  yield* Effect.forEach(manifestFiles, (manifestFile) =>
    Effect.gen(function*() {
      const manifestPath = path.join(fixturesDir, manifestFile)
      const manifestRaw = yield* fs.readFileString(manifestPath)
      const manifest = yield* decodeJsonManifest(manifestRaw)

      const stamped = yield* Effect.forEach(manifest.fixtures, (fixture) =>
        Effect.gen(function*() {
          const fixturePath = path.join(packageRoot, fixture.path)
          const fixtureRaw = yield* fs.readFileString(fixturePath)
          const fixtureValue = yield* decodeJsonUnknown(fixtureRaw)
          const hash = yield* digest("blake3-256", fixtureValue)

          if (fixture.hash === hash) {
            yield* Console.log(`  ${fixture.name}: ${hash} (unchanged)`)
            return fixture
          }
          yield* Console.log(`  ${fixture.name}: ${fixture.hash} → ${hash}`)
          return { ...fixture, hash }
        }))
      const updated = stamped.some((fixture, index) => fixture !== manifest.fixtures[index])

      if (updated) {
        const encoded = yield* encodeManifestJson({ ...manifest, fixtures: stamped })
        yield* fs.writeFileString(manifestPath, encoded + "\n")
        yield* Console.log(`  ✓ ${manifestFile} updated\n`)
      } else {
        yield* Console.log(`  ✓ ${manifestFile} already canonical\n`)
      }
    }).pipe(Effect.orDie), { discard: true })

  yield* Console.log("Done — all manifests stamped with canonical BLAKE3-256 hashes.")
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
