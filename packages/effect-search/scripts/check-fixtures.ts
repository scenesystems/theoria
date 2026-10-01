/**
 * Fixture schema-check script — validates every committed fixture JSON
 * against the TypeScript KnownFixture union.
 *
 * Catches generator ↔ schema drift that the Python verifier cannot detect.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type * as PlatformError from "@effect/platform/Error"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Console,
  Data,
  Effect,
  Either,
  Match,
  Option,
  Schema,
  String as Str
} from "effect"
import type { ParseResult } from "effect"

import { FixtureManifest, KnownFixture } from "../test/helpers/fixtures/index.js"

const fixtureRoot = "test/fixtures/optuna"
const manifestFile = "manifest.json"

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
  const root = path.join(packageRoot, fixtureRoot)

  // 1. Load and decode manifest
  const manifestPath = path.join(root, manifestFile)
  const manifestJson = yield* readJsonFile(manifestPath)
  const manifest = yield* Schema.decodeUnknown(FixtureManifest)(manifestJson).pipe(
    Effect.mapError((error) =>
      new FixtureCheckError({
        name: "manifest",
        file: manifestPath,
        reason: "manifest schema decode failed",
        cause: Option.some(error)
      })
    )
  )

  yield* Console.log(`Checking ${Arr.length(manifest.fixtures)} fixtures from manifest...`)
  yield* Console.log()

  // 2. Validate each fixture file against KnownFixture
  const results = yield* Effect.forEach(
    manifest.fixtures,
    (entry) => {
      const filePath = path.join(root, entry.file)
      const missing = new FixtureCheckError({
        name: entry.name,
        file: entry.file,
        reason: "file does not exist",
        cause: Option.none()
      })

      return fs.exists(filePath).pipe(
        Effect.mapError(
          (error) =>
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: "probe failed",
              cause: Option.some(error)
            })
        ),
        Effect.flatMap((exists) =>
          Effect.if(exists, {
            onFalse: () => Effect.fail(missing),
            onTrue: () =>
              fs.readFileString(filePath).pipe(
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
          })
        ),
        Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))),
        Effect.mapError((error) =>
          Match.value(error).pipe(
            Match.tag("FixtureCheckError", (fixtureError) => fixtureError),
            Match.orElse((parseError) =>
              new FixtureCheckError({
                name: entry.name,
                file: entry.file,
                reason: "malformed JSON",
                cause: Option.some(parseError)
              })
            )
          )
        ),
        Effect.flatMap(Schema.decodeUnknown(KnownFixture)),
        Effect.mapError((error) =>
          Match.value(error).pipe(
            Match.tag("FixtureCheckError", (fixtureError) => fixtureError),
            Match.orElse((parseError) =>
              new FixtureCheckError({
                name: entry.name,
                file: entry.file,
                reason: "schema decode failed — fixture JSON does not match any KnownFixture variant",
                cause: Option.some(parseError)
              })
            )
          )
        ),
        Effect.filterOrFail(
          (fixture) => Str.Equivalence(fixture.fixture, entry.name),
          (fixture) =>
            new FixtureCheckError({
              name: entry.name,
              file: entry.file,
              reason: `name mismatch: manifest says "${entry.name}" but fixture contains "${fixture.fixture}"`,
              cause: Option.none()
            })
        ),
        Effect.as(entry.name),
        Effect.either
      )
    }
  )

  // 3. Check for orphan JSON files not in manifest
  const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
  const allJsonFiles = yield* findJsonFiles(fs, path, root, "")
  const [scanErrors, discoveredJsonFiles] = Chunk.separate(allJsonFiles)
  const orphans = Arr.filter(
    discoveredJsonFiles,
    (file) => Bool.and(Bool.not(Str.Equivalence(file, manifestFile)), Bool.not(Arr.contains(manifestFiles, file)))
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

  const allErrors = Arr.appendAll(Arr.appendAll(errors, scanErrors), orphanErrors)

  // Print results
  yield* Effect.forEach(passed, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (err) => Console.log(`✗ ${err.message}`), {
    discard: true
  })

  yield* Console.log()
  yield* Console.log(`Results: ${Arr.length(passed)} passed, ${Arr.length(allErrors)} failed`)

  yield* Effect.fail(
    new FixtureCheckError({
      name: "summary",
      file: "",
      reason: `${Arr.length(allErrors)} fixture check failure(s)`,
      cause: Option.none()
    })
  ).pipe(Effect.when(() => Arr.isNonEmptyReadonlyArray(allErrors)))
})

const findJsonFiles = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Chunk.Chunk<Either.Either<string, FixtureCheckError>>, never> => {
  const dir = Bool.match(Str.isEmpty(prefix), {
    onFalse: () => pathService.join(root, prefix),
    onTrue: () => root
  })

  return fs.readDirectory(dir).pipe(
    Effect.either,
    Effect.flatMap(Either.match({
      onLeft: (error) =>
        Effect.succeed(Chunk.of(Either.left(
          new FixtureCheckError({
            name: "scan",
            file: dir,
            reason: "could not read directory",
            cause: Option.some(error)
          })
        ))),
      onRight: (entries) =>
        Effect.forEach(entries, (entry) => {
          const relative = Bool.match(Str.isEmpty(prefix), {
            onFalse: () => `${prefix}/${entry}`,
            onTrue: () => entry
          })
          const absolute = pathService.join(root, relative)

          return fs.stat(absolute).pipe(
            Effect.either,
            Effect.flatMap(Either.match({
              onLeft: (error) =>
                Effect.succeed(Chunk.of(Either.left(
                  new FixtureCheckError({
                    name: "scan",
                    file: absolute,
                    reason: "could not stat",
                    cause: Option.some(error)
                  })
                ))),
              onRight: (stat) =>
                Match.value(stat.type).pipe(
                  Match.when("Directory", () =>
                    Bool.match(Str.Equivalence(entry, "invalid"), {
                      onFalse: () => findJsonFiles(fs, pathService, root, relative),
                      onTrue: () => Effect.succeed(Chunk.empty())
                    })),
                  Match.orElse(() =>
                    Effect.succeed(Bool.match(Str.endsWith(".json")(entry), {
                      onFalse: () => Chunk.empty(),
                      onTrue: () => Chunk.of(Either.right(relative))
                    }))
                  )
                )
            }))
          )
        }).pipe(
          Effect.map(Chunk.fromIterable),
          Effect.map(Chunk.flatten)
        )
    }))
  )
}

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
