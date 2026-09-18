/**
 * Computes canonical SHA-256 hashes for every fixture declared in
 * test/fixtures/external/sources.manifest.json and rewrites contentSha256.
 *
 * Usage: bun run fixtures:stamp
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Console, Data, Effect, Encoding, Option, Schema, String as Str } from "effect"

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

const toSha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.succeed(Encoding.encodeHex(Digest.hash("sha256", bytes)))

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const packageRoot = yield* Url.fromString("../", import.meta.url).pipe(
    Effect.flatMap((url) => pathService.fromFileUrl(url)),
    Effect.orDie
  )
  const externalRoot = pathService.join(packageRoot, Fixtures.root)
  const manifestPath = pathService.join(externalRoot, Fixtures.manifestFile)

  const manifestRaw = yield* fileSystem.readFileString(manifestPath).pipe(
    Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "manifest file not found" }))
  )
  const manifest = yield* Schema.decodeUnknown(Fixtures.Manifest)(manifestRaw, {
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

      yield* Console.log(Bool.match(Str.Equivalence(source.contentSha256, actualSha256), {
        onTrue: () => `✓ ${source.id}: ${actualSha256} (unchanged)`,
        onFalse: () => `↺ ${source.id}: ${source.contentSha256} → ${actualSha256}`
      }))

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
      Option.match(Arr.findFirst(manifest.sources, (previous) => Str.Equivalence(previous.id, source.id)), {
        onNone: () => true,
        onSome: (previous) => Bool.not(Str.Equivalence(previous.contentSha256, source.contentSha256))
      })
  )

  yield* Effect.if(changed, {
    onFalse: () => Console.log("\nNo fixture hash updates required."),
    onTrue: () =>
      Effect.gen(function*() {
        const encoded = yield* Schema.encode(Fixtures.Manifest)(updatedManifest).pipe(
          Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "manifest encode failed" }))
        )

        yield* fileSystem.writeFileString(manifestPath, `${encoded}\n`).pipe(
          Effect.mapError(() => new FixtureStampError({ file: manifestPath, reason: "failed to write manifest" }))
        )

        yield* Console.log(`\nUpdated fixture hash manifest: ${manifestPath}`)
      })
  })
})

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
