/**
 * Fixture schema-check script — validates digest external fixture JSON
 * against schema contracts and verifies source manifest content hashes.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type * as PlatformError from "@effect/platform/Error"
import { Array as Arr, Console, Data, Effect, Either, Option, ParseResult, Schema } from "effect"

import { digestBytesHex } from "../src/convenience.js"
import {
  decodeUnknownJson,
  EXTERNAL_FIXTURE_ROOT,
  FixtureManifestSchema,
  MANIFEST_FILE,
  validateFixtureByKind
} from "./fixture-contract.js"

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

const toText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const toSha256Hex = (bytes: Uint8Array): Effect.Effect<string> => digestBytesHex("sha256", bytes)

const normalizeRelativePath = (pathService: Path.Path, value: string): string => value.split(pathService.sep).join("/")

const readJsonContent = (
  absolutePath: string
): Effect.Effect<string, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(absolutePath).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({
          name: "read",
          file: absolutePath,
          reason: "could not read manifest",
          cause: Option.some(error)
        })
      )
    )

    const content = toText(bytes)

    yield* decodeUnknownJson(content).pipe(
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
    const directory = prefix === "" ? root : pathService.join(root, prefix)
    const entries = yield* Effect.either(fileSystem.readDirectory(directory))
    if (Either.isLeft(entries)) {
      return [Either.left(
        new FixtureCheckError({
          name: "scan",
          file: directory,
          reason: "could not read directory",
          cause: Option.some(entries.left)
        })
      )]
    }

    const nested = yield* Effect.forEach(entries.right, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* Effect.either(fileSystem.stat(absolute))
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
          return yield* findJsonFiles(fileSystem, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [Either.right(relative)] : Arr.empty()
      }))

    return Arr.flatten(nested)
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const packageRoot = yield* Url.fromString("../", import.meta.url).pipe(
    Effect.flatMap((url) => pathService.fromFileUrl(url)),
    Effect.orDie
  )

  const externalRoot = pathService.join(packageRoot, EXTERNAL_FIXTURE_ROOT)
  const manifestPath = pathService.join(externalRoot, MANIFEST_FILE)

  const manifestContent = yield* readJsonContent(manifestPath)
  const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(manifestContent, {
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
      const content = toText(bytes)

      yield* validateFixtureByKind(source.kind, content).pipe(
        Effect.mapError((error) =>
          new FixtureCheckError({
            name: source.id,
            file: source.fixturePath,
            reason: "schema decode failed",
            cause: Option.filter(Option.some(error), ParseResult.isParseError)
          })
        )
      )

      const actualSha256 = yield* toSha256Hex(bytes)
      if (actualSha256 !== source.contentSha256) {
        return yield* Effect.fail(
          new FixtureCheckError({
            name: source.id,
            file: source.fixturePath,
            reason: `contentSha256 mismatch: expected ${source.contentSha256}, got ${actualSha256}`,
            cause: Option.none()
          })
        )
      }

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
    (file) => file !== MANIFEST_FILE
  )

  const orphanErrors = Arr.filterMap(
    scannedFixturePaths,
    (fixturePath) =>
      Arr.some(expectedFixturePaths, (expected) => expected === fixturePath)
        ? Option.none<FixtureCheckError>()
        : Option.some(
          new FixtureCheckError({
            name: "orphan",
            file: fixturePath,
            reason: "fixture file exists on disk but is not declared in sources.manifest.json",
            cause: Option.none()
          })
        )
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

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
