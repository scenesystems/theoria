/**
 * Stamps canonical BLAKE3-256 hashes into boundary fixture manifests.
 *
 * The hash is computed via `ContentDigest.fromUnknown("blake3-256", value)`:
 * JCS canonicalize → UTF-8 encode → BLAKE3-256 → base64url → tagged string.
 *
 * @since 0.1.0
 * @module
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Array, Boolean, Console, Effect, Schema, String } from "effect"

const fixturesDirectoryName = "test/fixtures"

const FixtureHashManifestSchema = Schema.Struct({
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

const decodeManifest = Schema.decodeUnknown(Schema.parseJson(FixtureHashManifestSchema))
const decodeJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))
const encodeManifest = Schema.encode(Schema.parseJson(FixtureHashManifestSchema))

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const packageUrl = yield* Url.fromString("../", import.meta.url)
  const packageRoot = yield* pathService.fromFileUrl(packageUrl)
  const fixturesDirectory = pathService.join(packageRoot, fixturesDirectoryName)
  const entries = yield* fileSystem.readDirectory(fixturesDirectory)
  const manifestFiles = Array.filter(
    entries,
    String.endsWith(".fixture-manifest.json")
  )

  yield* Console.log("Found", Array.length(manifestFiles), "fixture hash manifest files")
  yield* Console.log()

  yield* Effect.forEach(manifestFiles, (manifestFile) =>
    Effect.gen(function*() {
      const manifestPath = pathService.join(fixturesDirectory, manifestFile)
      const manifestRaw = yield* fileSystem.readFileString(manifestPath)
      const manifest = yield* decodeManifest(manifestRaw, { onExcessProperty: "error" })
      const stamped = yield* Effect.forEach(manifest.fixtures, (fixture) =>
        Effect.gen(function*() {
          const fixturePath = pathService.join(packageRoot, fixture.path)
          const fixtureRaw = yield* fileSystem.readFileString(fixturePath)
          const fixtureValue = yield* decodeJson(fixtureRaw, { onExcessProperty: "error" })
          const hash = ContentDigest.toString(yield* ContentDigest.fromUnknown("blake3-256", fixtureValue))

          yield* Console.log(
            Boolean.match(String.Equivalence(fixture.hash, hash), {
              onFalse: () => Array.join(Array.make("  ↺ ", fixture.name, ": ", fixture.hash, " → ", hash), ""),
              onTrue: () => Array.join(Array.make("  ✓ ", fixture.name, ": ", hash, " (unchanged)"), "")
            })
          )

          return Boolean.match(String.Equivalence(fixture.hash, hash), {
            onFalse: () => ({ name: fixture.name, path: fixture.path, hash }),
            onTrue: () => fixture
          })
        }))
      const changed = Array.some(
        Array.zip(stamped, manifest.fixtures),
        ([current, previous]) => Boolean.not(String.Equivalence(current.hash, previous.hash))
      )

      yield* Boolean.match(changed, {
        onFalse: () => Console.log("  Manifest already canonical"),
        onTrue: () =>
          Effect.gen(function*() {
            const encoded = yield* encodeManifest(
              {
                version: manifest.version,
                algorithm: manifest.algorithm,
                fixtures: stamped
              },
              { onExcessProperty: "error" }
            )
            yield* fileSystem.writeFileString(manifestPath, String.concat(encoded, "\n"))
            yield* Console.log("  Manifest updated")
          })
      })
      yield* Console.log()
    }), { discard: true })

  yield* Console.log("Done — all fixture hash manifests are canonical.")
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
