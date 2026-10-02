/**
 * Fixture schema-check script — validates digest external fixture JSON
 * against schema contracts and verifies source manifest content hashes.
 *
 * Usage: bun run fixtures:check
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, FileSystem, Option, Path, Result, Schema, Stream } from "effect"
import type { PlatformError } from "effect"
import { Hex } from "effect/encoding"

import * as Digest from "@scenesystems/digest/Digest"
import * as Fixtures from "./fixtures.js"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly name: string
  readonly file: string
  readonly reason: string
  readonly cause: Option.Option<PlatformError.PlatformError | Schema.SchemaError>
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
  Effect.succeed(Hex.encode(Digest.hash("sha256", bytes)))

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

    yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(content).pipe(
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
): Effect.Effect<Array<Result.Result<string, FixtureCheckError>>, never> =>
  Effect.gen(function*() {
    const directory = prefix === "" ? root : pathService.join(root, prefix)
    const entries = yield* Effect.result(fileSystem.readDirectory(directory))
    if (Result.isFailure(entries)) {
      return [Result.fail(
        new FixtureCheckError({
          name: "scan",
          file: directory,
          reason: "could not read directory",
          cause: Option.some(entries.failure)
        })
      )]
    }

    const nested = yield* Effect.forEach(entries.success, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* Effect.result(fileSystem.stat(absolute))
        if (Result.isFailure(stat)) {
          return [Result.fail(
            new FixtureCheckError({
              name: "scan",
              file: absolute,
              reason: "could not stat",
              cause: Option.some(stat.failure)
            })
          )]
        }

        if (stat.success.type === "Directory") {
          return yield* findJsonFiles(fileSystem, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [Result.succeed(relative)] : Arr.empty()
      }))

    return Arr.flatten(nested)
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const scriptUrl = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url).pipe(Effect.orDie)
  const scriptPath = yield* pathService.fromFileUrl(scriptUrl).pipe(Effect.orDie)
  const packageRoot = pathService.resolve(pathService.dirname(scriptPath), "..")

  const externalRoot = pathService.join(packageRoot, Fixtures.root)
  const manifestPath = pathService.join(externalRoot, Fixtures.manifestFile)

  const manifestContent = yield* readJsonContent(manifestPath)
  const manifest = yield* Schema.decodeEffect(Fixtures.Manifest)(manifestContent, {
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
      if (actualSha256 !== source.contentSha256) {
        return yield* new FixtureCheckError({
          name: source.id,
          file: source.fixturePath,
          reason: `contentSha256 mismatch: expected ${source.contentSha256}, got ${actualSha256}`,
          cause: Option.none()
        })
      }

      return source.id
    }).pipe(Effect.result))

  const expectedFixturePaths = Arr.map(
    manifest.sources,
    (source) => normalizeRelativePath(pathService, pathService.normalize(source.fixturePath))
  )

  const externalJsonFiles = yield* findJsonFiles(fileSystem, pathService, externalRoot, "")
  const [discoveredJsonFiles, scanErrors] = Arr.separate(externalJsonFiles)
  const scannedFixturePaths = Arr.filter(
    Arr.map(discoveredJsonFiles, (file) => normalizeRelativePath(pathService, file)),
    (file) => file !== Fixtures.manifestFile
  )

  const orphanErrors = Arr.filterMap(
    scannedFixturePaths,
    (fixturePath) =>
      Arr.some(expectedFixturePaths, (expected) => expected === fixturePath)
        ? Result.failVoid
        : Result.succeed(
          new FixtureCheckError({
            name: "orphan",
            file: fixturePath,
            reason: "fixture file exists on disk but is not declared in sources.manifest.json",
            cause: Option.none()
          })
        )
  )

  const [passedNames, resultErrors] = Arr.separate(fixtureResults)
  const allErrors = [...resultErrors, ...scanErrors, ...orphanErrors]

  yield* Console.log(`Checking ${manifest.sources.length} fixture sources...`)
  yield* Console.log()
  yield* Effect.forEach(passedNames, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (error) => Console.log(`✗ ${error.message}`), {
    discard: true
  })
  yield* Console.log()
  yield* Console.log(`Results: ${passedNames.length} passed, ${allErrors.length} failed`)

  if (allErrors.length > 0) {
    return yield* new FixtureCheckError({
      name: "summary",
      file: "",
      reason: `${allErrors.length} fixture check failure(s)`,
      cause: Option.none()
    })
  }
})

const main = program.pipe(Effect.provide(BunServices.layer))

BunRuntime.runMain(main)
