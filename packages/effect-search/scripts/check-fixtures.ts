/**
 * Fixture schema-check script — validates every committed fixture JSON
 * against the TypeScript KnownFixtureSchema union.
 *
 * Catches generator ↔ schema drift that the Python verifier cannot detect.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, Schema } from "effect"

import { FixtureManifestSchema, KnownFixtureSchema } from "../test/helpers/fixtures/schemas.js"

const FIXTURE_ROOT = "test/fixtures/optuna"
const MANIFEST_FILE = "manifest.json"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly name: string
  readonly file: string
  readonly reason: string
}> {
  override get message() {
    return `${this.name} (${this.file}): ${this.reason}`
  }
}

const readJsonFile = (
  absolutePath: string
): Effect.Effect<unknown, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const raw = yield* fs.readFileString(absolutePath).pipe(
      Effect.mapError(() => new FixtureCheckError({ name: "manifest", file: absolutePath, reason: "file not found" }))
    )
    return yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
      Effect.mapError(() => new FixtureCheckError({ name: "manifest", file: absolutePath, reason: "malformed JSON" }))
    )
  })

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packageRoot = yield* Url.fromString("../", import.meta.url).pipe(
    Effect.flatMap((url) => path.fromFileUrl(url)),
    Effect.orDie
  )
  const root = path.join(packageRoot, FIXTURE_ROOT)

  // 1. Load and decode manifest
  const manifestPath = path.join(root, MANIFEST_FILE)
  const manifestJson = yield* readJsonFile(manifestPath)
  const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(manifestJson).pipe(
    Effect.mapError(() =>
      new FixtureCheckError({ name: "manifest", file: manifestPath, reason: "manifest schema decode failed" })
    )
  )

  yield* Console.log(`Checking ${manifest.fixtures.length} fixtures from manifest...`)
  yield* Console.log()

  // 2. Validate each fixture file against KnownFixtureSchema
  const results = yield* Effect.forEach(
    manifest.fixtures,
    (entry) =>
      Effect.gen(function*() {
        const filePath = path.join(root, entry.file)
        const exists = yield* fs.exists(filePath).pipe(
          Effect.mapError(
            (error) =>
              new FixtureCheckError({ name: entry.name, file: entry.file, reason: `probe failed: ${error.message}` })
          )
        )
        if (!exists) {
          return yield* Effect.fail(
            new FixtureCheckError({ name: entry.name, file: entry.file, reason: "file does not exist" })
          )
        }

        const raw = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(
            (error) =>
              new FixtureCheckError({ name: entry.name, file: entry.file, reason: `read failed: ${error.message}` })
          )
        )
        const json = yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
          Effect.mapError(
            (error) =>
              new FixtureCheckError({ name: entry.name, file: entry.file, reason: `read failed: ${error.message}` })
          )
        )
        const fixture = yield* Schema.decodeUnknown(KnownFixtureSchema)(json).pipe(
          Effect.mapError(() =>
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: "schema decode failed — fixture JSON does not match any KnownFixtureSchema variant"
            })
          )
        )
        if (fixture.fixture !== entry.name) {
          return yield* Effect.fail(
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: `name mismatch: manifest says "${entry.name}" but fixture contains "${fixture.fixture}"`
            })
          )
        }
        return entry.name
      }).pipe(Effect.either)
  )

  // 3. Check for orphan JSON files not in manifest
  const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
  const allJsonFiles = yield* findJsonFiles(fs, path, root, "")
  const orphans = Arr.filter(allJsonFiles, (file) => file !== MANIFEST_FILE && !Arr.contains(manifestFiles, file))
  const orphanErrors = Arr.map(
    orphans,
    (file) =>
      new FixtureCheckError({
        name: "orphan",
        file,
        reason: "fixture file exists on disk but is not declared in manifest"
      })
  )

  // 4. Report results
  const [errors, passed] = Arr.separate(results)

  const allErrors = [...errors, ...orphanErrors]

  // Print results
  yield* Effect.forEach(passed, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (err) => Console.log(`✗ ${err.name} (${err.file}): ${err.reason}`), {
    discard: true
  })

  yield* Console.log()
  yield* Console.log(`Results: ${passed.length} passed, ${allErrors.length} failed`)

  if (Arr.isNonEmptyArray(allErrors)) {
    return yield* Effect.fail(
      new FixtureCheckError({ name: "summary", file: "", reason: `${allErrors.length} fixture check failure(s)` })
    )
  }
})

const findJsonFiles = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Array<string>, FixtureCheckError> =>
  Effect.gen(function*() {
    const dir = prefix === "" ? root : pathService.join(root, prefix)
    const entries = yield* fs.readDirectory(dir).pipe(
      Effect.mapError(() => new FixtureCheckError({ name: "scan", file: dir, reason: "could not read directory" }))
    )

    const results = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* fs.stat(absolute).pipe(
          Effect.mapError(() => new FixtureCheckError({ name: "scan", file: absolute, reason: "could not stat" }))
        )

        if (stat.type === "Directory") {
          if (entry === "invalid") return Arr.empty<string>()
          return yield* findJsonFiles(fs, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [relative] : Arr.empty<string>()
      }))

    return Arr.flatten(results)
  })

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
