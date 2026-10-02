/**
 * Computes canonical SHA-256 hashes for every fixture declared in
 * test/fixtures/external/sources.manifest.json and rewrites contentSha256.
 *
 * Usage: bun run fixtures:stamp
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, FileSystem, Option, Path, Schema } from "effect"
import { Hex } from "effect/encoding"

import * as Digest from "@scenesystems/digest/Digest"
import * as Fixtures from "./fixtures.js"

class FixtureStampError extends Data.TaggedError("FixtureStampError")<{
  readonly file: string
  readonly reason: string
}> {
  override get message() {
    return `${this.file}: ${this.reason}`
  }
}

const toSha256Hex = (bytes: Uint8Array): Effect.Effect<string> => Effect.map(Digest.hash("sha256", bytes), Hex.encode)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const scriptUrl = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url).pipe(Effect.orDie)
  const scriptPath = yield* pathService.fromFileUrl(scriptUrl).pipe(Effect.orDie)
  const packageRoot = pathService.resolve(pathService.dirname(scriptPath), "..")
  const externalRoot = pathService.join(packageRoot, Fixtures.root)
  const manifestPath = pathService.join(externalRoot, Fixtures.manifestFile)

  const manifestRaw = yield* fileSystem.readFileString(manifestPath).pipe(
    Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "manifest file not found" }))
  )
  const manifest = yield* Schema.decodeEffect(Fixtures.Manifest)(manifestRaw, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "manifest schema decode failed" }))
  )

  const updatedSources = yield* Effect.forEach(manifest.sources, (source) =>
    Effect.gen(function*() {
      const absolutePath = pathService.normalize(pathService.join(externalRoot, source.fixturePath))
      const bytes = yield* fileSystem.readFile(absolutePath).pipe(
        Effect.mapError(() => new FixtureStampError({ file: source.fixturePath, reason: "fixture file not found" }))
      )
      const actualSha256 = yield* toSha256Hex(bytes)

      yield* Console.log(
        source.contentSha256 === actualSha256
          ? `✓ ${source.id}: ${actualSha256} (unchanged)`
          : `↺ ${source.id}: ${source.contentSha256} → ${actualSha256}`
      )

      return {
        ...source,
        contentSha256: actualSha256
      }
    }))

  const updatedManifest = {
    sources: updatedSources
  }

  const changed = Arr.some(
    updatedManifest.sources,
    (source) =>
      Option.match(Arr.findFirst(manifest.sources, (previous) => previous.id === source.id), {
        onNone: () => true,
        onSome: (previous) => previous.contentSha256 !== source.contentSha256
      })
  )

  if (!changed) {
    yield* Console.log("\nNo fixture hash updates required.")
    return
  }

  const encoded = yield* Schema.encodeEffect(Fixtures.Manifest)(updatedManifest).pipe(
    Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "manifest encode failed" }))
  )

  yield* fileSystem.writeFileString(manifestPath, `${encoded}\n`).pipe(
    Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "failed to write manifest" }))
  )

  yield* Console.log(`\nUpdated fixture hash manifest: ${manifestPath}`)
})

const main = program.pipe(Effect.provide(BunServices.layer))

BunRuntime.runMain(main)
