/**
 * Fixture schema-check script — validates digest external fixture JSON
 * against schema contracts and verifies source manifest content hashes.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type * as PlatformError from "@effect/platform/Error"
import type { ParseResult } from "effect"
import {
  Array as Arr,
  Boolean as Bool,
  Console,
  Data,
  Effect,
  Either,
  Encoding,
  Match,
  Option,
  Schema,
  Stream,
  String as Str
} from "effect"

import * as Digest from "@scenesystems/digest/Digest"
import * as Fixtures from "./fixtures.js"

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

/** The fixture bytes as text; the same bytes are hashed, so the file is read once. */
const toText = (bytes: Uint8Array): Effect.Effect<string> => Stream.decodeText(Stream.make(bytes)).pipe(Stream.mkString)

const toSha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.succeed(Encoding.encodeHex(Digest.hash("sha256", bytes)))

const normalizeRelativePath = (pathService: Path.Path, value: string): string => value.split(pathService.sep).join("/")

const readJsonContent = (
  absolutePath: string
): Effect.Effect<string, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const content = yield* fileSystem.readFileString(absolutePath).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({
          name: "read",
          file: absolutePath,
          reason: "could not read manifest",
          cause: Option.some(error)
        })
      )
    )

    yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(content).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({ name: "json", file: absolutePath, reason: "malformed JSON", cause: Option.some(error) })
      )
    )

    return content
  })

const findJsonFiles = (
  fileSystem: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Array<Either.Either<string, FixtureCheckError>>, never> =>
  Effect.gen(function*() {
    const directory = Bool.match(Str.isEmpty(prefix), {
      onTrue: () => root,
      onFalse: () => pathService.join(root, prefix)
    })
    const entries = yield* Effect.either(fileSystem.readDirectory(directory))
    return yield* Either.match(entries, {
      onLeft: (error) =>
        Effect.succeed([Either.left(
          new FixtureCheckError({
            name: "scan",
            file: directory,
            reason: "could not read directory",
            cause: Option.some(error)
          })
        )]),
      onRight: (entries) =>
        Effect.map(
          Effect.forEach(entries, (entry) => {
            const relative = Bool.match(Str.isEmpty(prefix), {
              onTrue: () => entry,
              onFalse: () => `${prefix}/${entry}`
            })
            const absolute = pathService.join(root, relative)
            return Effect.flatMap(Effect.either(fileSystem.stat(absolute)), (stat) =>
              Either.match(stat, {
                onLeft: (error) =>
                  Effect.succeed([Either.left(
                    new FixtureCheckError({
                      name: "scan",
                      file: absolute,
                      reason: "could not stat",
                      cause: Option.some(error)
                    })
                  )]),
                onRight: (stat) =>
                  Match.value(stat.type).pipe(
                    Match.when("Directory", () => findJsonFiles(fileSystem, pathService, root, relative)),
                    Match.orElse(() =>
                      Effect.succeed(Bool.match(Str.endsWith(".json")(entry), {
                        onTrue: () => [Either.right(relative)],
                        onFalse: Arr.empty
                      }))
                    )
                  )
              }))
          }),
          Arr.flatten
        )
    })
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const packageRoot = yield* Url.fromString("../", import.meta.url).pipe(
    Effect.flatMap((url) => pathService.fromFileUrl(url)),
    Effect.orDie
  )

  const externalRoot = pathService.join(packageRoot, Fixtures.root)
  const manifestPath = pathService.join(externalRoot, Fixtures.manifestFile)

  const manifestContent = yield* readJsonContent(manifestPath)
  const manifest = yield* Schema.decodeUnknown(Fixtures.Manifest)(manifestContent, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError((error) =>
      new FixtureCheckError({
        name: "manifest",
        file: manifestPath,
        reason: "manifest schema decode failed",
        cause: Option.some(error)
      })
    )
  )

  const fixtureResults = yield* Effect.forEach(manifest.sources, (source) =>
    Effect.gen(function*() {
      const absolutePath = pathService.normalize(pathService.join(externalRoot, source.fixturePath))
      const bytes = yield* fileSystem.readFile(absolutePath).pipe(
        Effect.mapError((error) =>
          new FixtureCheckError({
            name: source.id,
            file: source.fixturePath,
            reason: "read failed",
            cause: Option.some(error)
          })
        )
      )
      const content = yield* toText(bytes)

      yield* Fixtures.validate(source.kind, content).pipe(
        Effect.mapError((error) =>
          new FixtureCheckError({
            name: source.id,
            file: source.fixturePath,
            reason: "schema decode failed",
            cause: Option.some(error)
          })
        )
      )

      const actualSha256 = yield* toSha256Hex(bytes)
      yield* Effect.when(
        Effect.fail(
          new FixtureCheckError({
            name: source.id,
            file: source.fixturePath,
            reason: `contentSha256 mismatch: expected ${source.contentSha256}, got ${actualSha256}`,
            cause: Option.none()
          })
        ),
        () => Bool.not(Str.Equivalence(actualSha256, source.contentSha256))
      )

      return source.id
    }).pipe(Effect.either))

  const expectedFixturePaths = Arr.map(
    manifest.sources,
    (source) => normalizeRelativePath(pathService, pathService.normalize(source.fixturePath))
  )

  const externalJsonFiles = yield* findJsonFiles(fileSystem, pathService, externalRoot, "")
  const [scanErrors, discoveredJsonFiles] = Arr.separate(externalJsonFiles)
  const scannedFixturePaths = Arr.filter(
    Arr.map(discoveredJsonFiles, (file) => normalizeRelativePath(pathService, file)),
    (file) => Bool.not(Str.Equivalence(file, Fixtures.manifestFile))
  )

  const orphanErrors = Arr.filterMap(
    scannedFixturePaths,
    (fixturePath) =>
      Bool.match(Arr.contains(expectedFixturePaths, fixturePath), {
        onTrue: Option.none,
        onFalse: () =>
          Option.some(
            new FixtureCheckError({
              name: "orphan",
              file: fixturePath,
              reason: "fixture file exists on disk but is not declared in sources.manifest.json",
              cause: Option.none()
            })
          )
      })
  )

  const [resultErrors, passedNames] = Arr.separate(fixtureResults)
  const allErrors = [...resultErrors, ...scanErrors, ...orphanErrors]

  yield* Console.log(`Checking ${manifest.sources.length} fixture sources...`)
  yield* Console.log()
  yield* Effect.forEach(passedNames, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (error) => Console.log(`✗ ${error.message}`), {
    discard: true
  })
  yield* Console.log()
  yield* Console.log(`Results: ${passedNames.length} passed, ${allErrors.length} failed`)

  yield* Effect.when(
    Effect.fail(
      new FixtureCheckError({
        name: "summary",
        file: "",
        reason: `${allErrors.length} fixture check failure(s)`,
        cause: Option.none()
      })
    ),
    () => Arr.isNonEmptyArray(allErrors)
  )
})

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
