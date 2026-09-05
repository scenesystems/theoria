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
import type * as PlatformError from "@effect/platform/Error"
import { Array as Arr, Console, Data, Effect, Either, Option, Schema } from "effect"
import type { ParseResult } from "effect"

import { FixtureManifestSchema, KnownFixtureSchema } from "../test/helpers/fixtures/schemas.js"

const FIXTURE_ROOT = "test/fixtures/optuna"
const MANIFEST_FILE = "manifest.json"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly name: string
  readonly file: string
  readonly reason: string
  readonly cause: Option.Option<PlatformError.PlatformError | ParseResult.ParseError>
}> {
  override get message() {
    return `${this.name} (${this.file}): ${this.reason}${
      Option.match(this.cause, {
        onNone: () => "",
        onSome: (cause) => `: ${cause.message}`
      })
    }`
  }
}

const readJsonFile = (
  absolutePath: string
): Effect.Effect<unknown, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const raw = yield* fs.readFileString(absolutePath).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({
          name: "manifest",
          file: absolutePath,
          reason: "could not read manifest",
          cause: Option.some(error)
        })
      )
    )
    return yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({
          name: "manifest",
          file: absolutePath,
          reason: "malformed JSON",
          cause: Option.some(error)
        })
      )
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
    Effect.mapError((error) =>
      new FixtureCheckError({
        name: "manifest",
        file: manifestPath,
        reason: "manifest schema decode failed",
        cause: Option.some(error)
      })
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
              new FixtureCheckError({
                name: entry.name,
                file: entry.file,
                reason: "probe failed",
                cause: Option.some(error)
              })
          )
        )
        if (!exists) {
          return yield* Effect.fail(
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: "file does not exist",
              cause: Option.none()
            })
          )
        }

        const raw = yield* fs.readFileString(filePath).pipe(
          Effect.mapError(
            (error) =>
              new FixtureCheckError({
                name: entry.name,
                file: entry.file,
                reason: "read failed",
                cause: Option.some(error)
              })
          )
        )
        const json = yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
          Effect.mapError(
            (error) =>
              new FixtureCheckError({
                name: entry.name,
                file: entry.file,
                reason: "malformed JSON",
                cause: Option.some(error)
              })
          )
        )
        const fixture = yield* Schema.decodeUnknown(KnownFixtureSchema)(json).pipe(
          Effect.mapError((error) =>
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: "schema decode failed — fixture JSON does not match any KnownFixtureSchema variant",
              cause: Option.some(error)
            })
          )
        )
        if (fixture.fixture !== entry.name) {
          return yield* Effect.fail(
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: `name mismatch: manifest says "${entry.name}" but fixture contains "${fixture.fixture}"`,
              cause: Option.none()
            })
          )
        }
        return entry.name
      }).pipe(Effect.either)
  )

  // 3. Check for orphan JSON files not in manifest
  const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
  const allJsonFiles = yield* findJsonFiles(fs, path, root, "")
  const [scanErrors, discoveredJsonFiles] = Arr.separate(allJsonFiles)
  const orphans = Arr.filter(
    discoveredJsonFiles,
    (file) => file !== MANIFEST_FILE && !Arr.contains(manifestFiles, file)
  )
  const orphanErrors = Arr.map(
    orphans,
    (file) =>
      new FixtureCheckError({
        name: "orphan",
        file,
        reason: "fixture file exists on disk but is not declared in manifest",
        cause: Option.none()
      })
  )

  // 4. Report results
  const [errors, passed] = Arr.separate(results)

  const allErrors = [...errors, ...scanErrors, ...orphanErrors]

  // Print results
  yield* Effect.forEach(passed, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (err) => Console.log(`✗ ${err.message}`), {
    discard: true
  })

  yield* Console.log()
  yield* Console.log(`Results: ${passed.length} passed, ${allErrors.length} failed`)

  if (Arr.isNonEmptyArray(allErrors)) {
    return yield* Effect.fail(
      new FixtureCheckError({
        name: "summary",
        file: "",
        reason: `${allErrors.length} fixture check failure(s)`,
        cause: Option.none()
      })
    )
  }
})

const findJsonFiles = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Array<Either.Either<string, FixtureCheckError>>, never> =>
  Effect.gen(function*() {
    const dir = prefix === "" ? root : pathService.join(root, prefix)
    const entries = yield* Effect.either(fs.readDirectory(dir))
    if (Either.isLeft(entries)) {
      return [Either.left(
        new FixtureCheckError({
          name: "scan",
          file: dir,
          reason: "could not read directory",
          cause: Option.some(entries.left)
        })
      )]
    }

    const results = yield* Effect.forEach(entries.right, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* Effect.either(fs.stat(absolute))
        if (Either.isLeft(stat)) {
          return [Either.left(
            new FixtureCheckError({
              name: "scan",
              file: absolute,
              reason: "could not stat",
              cause: Option.some(stat.left)
            })
          )]
        }

        if (stat.right.type === "Directory") {
          if (entry === "invalid") return Arr.empty()
          return yield* findJsonFiles(fs, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [Either.right(relative)] : Arr.empty()
      }))

    return Arr.flatten(results)
  })

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
