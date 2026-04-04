/**
 * Computes canonical SHA-256 hashes for every fixture declared in
 * test/fixtures/external/sources.manifest.json and rewrites contentSha256.
 *
 * Usage: bun run fixtures:stamp
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Option } from "effect"
import { sha256 } from "../src/algorithms/sha256.js"
import { toHex } from "../src/encoding.js"
import { EXTERNAL_FIXTURE_ROOT, FixtureManifestSchema, MANIFEST_FILE } from "./fixture-contract.js"

class FixtureStampError {
  readonly _tag = "FixtureStampError"

  constructor(
    readonly file: string,
    readonly reason: string
  ) {}
}

const toSha256Hex = (bytes: Uint8Array): Effect.Effect<string> => sha256(bytes).pipe(Effect.map(toHex))

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())
  const externalRoot = pathService.join(cwd, EXTERNAL_FIXTURE_ROOT)
  const manifestPath = pathService.join(externalRoot, MANIFEST_FILE)

  const manifestRaw = yield* fileSystem.readFileString(manifestPath).pipe(
    Effect.mapError(() => new FixtureStampError(manifestPath, "manifest file not found"))
  )
  const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(manifestRaw).pipe(
    Effect.mapError(() => new FixtureStampError(manifestPath, "manifest schema decode failed"))
  )

  const updatedSources = yield* Effect.forEach(manifest.sources, (source) =>
    Effect.gen(function*() {
      const absolutePath = pathService.normalize(pathService.join(externalRoot, source.fixturePath))
      const bytes = yield* fileSystem.readFile(absolutePath).pipe(
        Effect.mapError(() => new FixtureStampError(source.fixturePath, "fixture file not found"))
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
    })
  )

  const updatedManifest = {
    sources: updatedSources
  }

  const changed = Arr.some(updatedManifest.sources, (source) =>
    Option.match(Arr.findFirst(manifest.sources, (previous) => previous.id === source.id), {
      onNone: () => true,
      onSome: (previous) => previous.contentSha256 !== source.contentSha256
    })
  )

  if (!changed) {
    yield* Console.log("\nNo fixture hash updates required.")
    return
  }

  const encoded = yield* Effect.try({
    try: () => JSON.stringify(updatedManifest, null, 2),
    catch: () => new FixtureStampError(manifestPath, "manifest encode failed")
  })

  yield* fileSystem.writeFileString(manifestPath, `${encoded}\n`).pipe(
    Effect.mapError(() => new FixtureStampError(manifestPath, "failed to write manifest"))
  )

  yield* Console.log(`\nUpdated fixture hash manifest: ${manifestPath}`)
})

const main = program.pipe(
  Effect.catchAll((error) =>
    Console.error(`\nFATAL (${error.file}): ${error.reason}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
