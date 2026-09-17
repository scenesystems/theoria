/**
 * Validates every committed SciPy fixture against its schema and reports
 * recursively discovered JSON files that are absent from the manifest.
 *
 * @since 0.1.0
 * @module
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array, Boolean, Chunk, Console, Effect, Either, Inspectable, Match, Option, Schema, String } from "effect"

import { directoryBeside, loadFixtureByEntry, loadManifest } from "../test/helpers/fixtures/io.js"

const fixtureRoot = "../test/fixtures/scipy/"
const manifestFile = "manifest.json"

class FixtureCheckError extends Schema.TaggedError<FixtureCheckError>(
  "@scenesystems/effect-math/scripts/check-fixtures/FixtureCheckError"
)("FixtureCheckError", {
  name: Schema.String,
  file: Schema.String,
  reason: Schema.String,
  cause: Schema.Option(Schema.Unknown)
}) {
  override get message() {
    return Array.join(
      Array.make(
        this.name,
        " (",
        this.file,
        "): ",
        this.reason,
        Option.match(this.cause, {
          onNone: () => "",
          onSome: (cause) => String.concat(": ", Inspectable.toStringUnknown(cause, 0))
        })
      ),
      ""
    )
  }
}

const findJsonFiles = (
  fileSystem: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Chunk.Chunk<Either.Either<string, FixtureCheckError>>> =>
  Effect.gen(function*() {
    const directory = Boolean.match(String.isEmpty(prefix), {
      onFalse: () => pathService.join(root, prefix),
      onTrue: () => root
    })
    const entries = yield* Effect.either(fileSystem.readDirectory(directory))

    return yield* Either.match(entries, {
      onLeft: (cause) =>
        Effect.succeed(
          Chunk.of(
            Either.left(
              new FixtureCheckError({
                name: "scan",
                file: directory,
                reason: "could not read directory",
                cause: Option.some(cause)
              })
            )
          )
        ),
      onRight: (names) =>
        Effect.map(
          Effect.forEach(names, (name) =>
            Effect.gen(function*() {
              const relative = Boolean.match(String.isEmpty(prefix), {
                onFalse: () => pathService.join(prefix, name),
                onTrue: () => name
              })
              const absolute = pathService.join(root, relative)
              const stat = yield* Effect.either(fileSystem.stat(absolute))

              return yield* Either.match(stat, {
                onLeft: (cause) =>
                  Effect.succeed(
                    Chunk.of(
                      Either.left(
                        new FixtureCheckError({
                          name: "scan",
                          file: absolute,
                          reason: "could not stat filesystem entry",
                          cause: Option.some(cause)
                        })
                      )
                    )
                  ),
                onRight: (info) =>
                  Match.value(info.type).pipe(
                    Match.when("Directory", () => findJsonFiles(fileSystem, pathService, root, relative)),
                    Match.when(
                      Match.is("File", "SymbolicLink", "BlockDevice", "CharacterDevice", "FIFO", "Socket", "Unknown"),
                      () =>
                        Effect.succeed(
                          Boolean.match(String.endsWith(".json")(name), {
                            onFalse: () => Chunk.empty<Either.Either<string, FixtureCheckError>>(),
                            onTrue: () => Chunk.of(Either.right(relative))
                          })
                        )
                    ),
                    Match.exhaustive
                  )
              })
            })),
          (entries) => Chunk.flatten(Chunk.fromIterable(entries))
        )
    })
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const root = yield* directoryBeside(import.meta.url, fixtureRoot).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureCheckError({
          name: "manifest",
          file: fixtureRoot,
          reason: "could not resolve fixture directory",
          cause: Option.some(cause)
        })
    )
  )
  const manifest = yield* loadManifest(root, manifestFile).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureCheckError({
          name: "manifest",
          file: pathService.join(root, manifestFile),
          reason: Match.value(cause).pipe(
            Match.tag("FixtureManifestReadError", () => "could not read manifest"),
            Match.tag("FixtureMalformedJsonError", () => "malformed manifest JSON"),
            Match.tag("FixtureManifestDecodeError", () => "manifest schema decode failed"),
            Match.exhaustive
          ),
          cause: Option.some(cause)
        })
    )
  )

  const fixtureResults = yield* Effect.forEach(manifest.fixtures, (entry) =>
    loadFixtureByEntry(root, entry).pipe(
      Effect.as(entry.name),
      Effect.mapError(
        (cause) =>
          new FixtureCheckError({
            name: entry.name,
            file: entry.file,
            reason: Match.value(cause).pipe(
              Match.tag("FixtureFileReadError", () => "read failed"),
              Match.tag("FixtureMalformedJsonError", () => "malformed JSON"),
              Match.tag(
                "FixtureSchemaDecodeError",
                () => "schema decode failed — fixture JSON does not match its declared KnownFixtureSchema variant"
              ),
              Match.exhaustive
            ),
            cause: Option.some(cause)
          })
      ),
      Effect.either
    ))

  const manifestFiles = Array.map(manifest.fixtures, (entry) => entry.file)
  const scanned = yield* findJsonFiles(fileSystem, pathService, root, "")
  const [scanErrors, discoveredFiles] = Array.separate(scanned)
  const orphanErrors = Array.filterMap(discoveredFiles, (file) => {
    const normalized = String.replaceAll(pathService.sep, "/")(file)
    const declared = Array.some(manifestFiles, (manifestFile) => String.Equivalence(manifestFile, normalized))
    return Boolean.match(
      Boolean.and(Boolean.not(String.Equivalence(normalized, manifestFile)), Boolean.not(declared)),
      {
        onFalse: () => Option.none<FixtureCheckError>(),
        onTrue: () =>
          Option.some(
            new FixtureCheckError({
              name: "orphan",
              file: normalized,
              reason: "fixture file exists on disk but is not declared in manifest",
              cause: Option.none()
            })
          )
      }
    )
  })
  const [fixtureErrors, passed] = Array.separate(fixtureResults)
  const allErrors = Array.appendAll(Array.appendAll(fixtureErrors, scanErrors), orphanErrors)

  yield* Console.log("Checking", Array.length(manifest.fixtures), "fixtures from manifest...")
  yield* Console.log()
  yield* Effect.forEach(passed, (name) => Console.log("✓", name), { discard: true })
  yield* Effect.forEach(allErrors, (error) => Console.log("✗", error.message), { discard: true })
  yield* Console.log()
  yield* Console.log("Results:", Array.length(passed), "passed,", Array.length(allErrors), "failed")

  yield* Effect.fail(
    new FixtureCheckError({
      name: "summary",
      file: manifestFile,
      reason: String.concat(Inspectable.toStringUnknown(Array.length(allErrors), 0), " fixture check failure(s)"),
      cause: Option.none()
    })
  ).pipe(Effect.when(() => Array.isNonEmptyArray(allErrors)))
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
