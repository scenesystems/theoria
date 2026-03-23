/**
 * Fixture schema-check script — validates every committed fixture JSON
 * against the TypeScript KnownFixtureSchema union.
 *
 * Catches generator ↔ schema drift that the Python verifier cannot detect.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Either, Option, Schema } from "effect"

import { FixtureManifestSchema, KnownFixtureSchema } from "../test/helpers/fixtures/schemas.js"

const FIXTURE_ROOT = "test/fixtures/scipy"
const MANIFEST_FILE = "manifest.json"

class FixtureCheckError {
  readonly _tag = "FixtureCheckError"
  constructor(
    readonly name: string,
    readonly file: string,
    readonly reason: string
  ) {}
}

const readJsonFile = (
  absolutePath: string
): Effect.Effect<unknown, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const raw = yield* fs.readFileString(absolutePath).pipe(
      Effect.mapError(() => new FixtureCheckError("manifest", absolutePath, "file not found"))
    )
    return yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
      Effect.mapError(() => new FixtureCheckError("manifest", absolutePath, "malformed JSON"))
    )
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
      Effect.mapError(() => new FixtureCheckError("scan", dir, "could not read directory"))
    )

    const results = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* fs.stat(absolute).pipe(
          Effect.mapError(() => new FixtureCheckError("scan", absolute, "could not stat"))
        )

        if (stat.type === "Directory") {
          return yield* findJsonFiles(fs, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [relative] : Arr.empty<string>()
      }))

    return Arr.flatten(results)
  })

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())
  const root = path.join(cwd, FIXTURE_ROOT)

  const manifestPath = path.join(root, MANIFEST_FILE)
  const manifestJson = yield* readJsonFile(manifestPath)
  const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(manifestJson).pipe(
    Effect.mapError(() => new FixtureCheckError("manifest", manifestPath, "manifest schema decode failed"))
  )

  yield* Console.log(`Checking ${manifest.fixtures.length} fixtures from manifest...`)
  yield* Console.log()

  const results = yield* Effect.forEach(
    manifest.fixtures,
    (entry) =>
      Effect.gen(function*() {
        const filePath = path.join(root, entry.file)
        const exists = yield* fs.exists(filePath)
        if (!exists) {
          return new FixtureCheckError(entry.name, entry.file, "file does not exist")
        }

        const json = yield* readJsonFile(filePath)
        const decoded = yield* Schema.decodeUnknown(KnownFixtureSchema)(json).pipe(Effect.either)
        return Either.match(decoded, {
          onLeft: () =>
            new FixtureCheckError(
              entry.name,
              entry.file,
              "schema decode failed — fixture JSON does not match any KnownFixtureSchema variant"
            ),
          onRight: (fixture) =>
            fixture.fixture === entry.name
              ? null
              : new FixtureCheckError(
                entry.name,
                entry.file,
                `name mismatch: manifest says "${entry.name}" but fixture contains "${fixture.fixture}"`
              )
        })
      }).pipe(Effect.catchAll((err) => Effect.succeed(err)))
  )

  const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
  const allJsonFiles = yield* findJsonFiles(fs, path, root, "")
  const orphans = Arr.filter(allJsonFiles, (file) => file !== MANIFEST_FILE && !Arr.contains(manifestFiles, file))
  const orphanErrors = Arr.map(
    orphans,
    (file) =>
      new FixtureCheckError(
        "orphan",
        file,
        "fixture file exists on disk but is not declared in manifest"
      )
  )

  const errors = Arr.filter(results, (result): result is FixtureCheckError => result instanceof FixtureCheckError)

  const passed = Arr.filterMap(
    manifest.fixtures,
    (entry, index) => results[index] === null ? Option.some(entry.name) : Option.none()
  )

  const allErrors = [...errors, ...orphanErrors]

  yield* Effect.forEach(passed, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (err) => Console.log(`✗ ${err.name} (${err.file}): ${err.reason}`), {
    discard: true
  })

  yield* Console.log()
  yield* Console.log(`Results: ${passed.length} passed, ${allErrors.length} failed`)

  if (Arr.isNonEmptyArray(allErrors)) {
    return yield* Effect.fail(new FixtureCheckError("summary", "", `${allErrors.length} fixture check failure(s)`))
  }
})

const main = program.pipe(
  Effect.catchAll((err) =>
    Console.error(`\nFATAL: ${err.reason}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
