/**
 * Fixture schema-check script — validates digest external/parity fixture JSON
 * against schema contracts and verifies source manifest content hashes.
 *
 * Usage: bun run fixtures:check
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { createHash } from "node:crypto"
import { Array as Arr, Console, Effect, Option, Schema } from "effect"
import {
  decodeUnknownJson,
  EXTERNAL_FIXTURE_ROOT,
  FixtureManifestSchema,
  MANIFEST_FILE,
  PARITY_FIXTURE_ROOT,
  validateFixtureByKind
} from "./fixture-contract.js"

class FixtureCheckError {
  readonly _tag = "FixtureCheckError"

  constructor(
    readonly name: string,
    readonly file: string,
    readonly reason: string
  ) {}
}

const toText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const toSha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")

const normalizeRelativePath = (pathService: Path.Path, value: string): string =>
  value.split(pathService.sep).join("/")

const readJsonContent = (
  absolutePath: string
): Effect.Effect<string, FixtureCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(absolutePath).pipe(
      Effect.mapError(() => new FixtureCheckError("read", absolutePath, "file not found"))
    )

    const content = toText(bytes)

    yield* decodeUnknownJson(content).pipe(
      Effect.mapError(() => new FixtureCheckError("json", absolutePath, "malformed JSON"))
    )

    return content
  })

const findJsonFiles = (
  fileSystem: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Array<string>, FixtureCheckError> =>
  Effect.gen(function*() {
    const directory = prefix === "" ? root : pathService.join(root, prefix)
    const entries = yield* fileSystem.readDirectory(directory).pipe(
      Effect.mapError(() => new FixtureCheckError("scan", directory, "could not read directory"))
    )

    const nested = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const relative = prefix === "" ? entry : `${prefix}/${entry}`
        const absolute = pathService.join(root, relative)
        const stat = yield* fileSystem.stat(absolute).pipe(
          Effect.mapError(() => new FixtureCheckError("scan", absolute, "could not stat"))
        )

        if (stat.type === "Directory") {
          return yield* findJsonFiles(fileSystem, pathService, root, relative)
        }

        return entry.endsWith(".json") ? [relative] : Arr.empty<string>()
      }))

    return Arr.flatten(nested)
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())

  const externalRoot = pathService.join(cwd, EXTERNAL_FIXTURE_ROOT)
  const parityRoot = pathService.join(cwd, PARITY_FIXTURE_ROOT)
  const manifestPath = pathService.join(externalRoot, MANIFEST_FILE)

  const manifestContent = yield* readJsonContent(manifestPath)
  const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(manifestContent).pipe(
    Effect.mapError(() => new FixtureCheckError("manifest", manifestPath, "manifest schema decode failed"))
  )

  const fixtureResults = yield* Effect.forEach(manifest.sources, (source) =>
    Effect.gen(function*() {
      const absolutePath = pathService.normalize(pathService.join(externalRoot, source.fixturePath))
      const bytes = yield* fileSystem.readFile(absolutePath).pipe(
        Effect.mapError(() => new FixtureCheckError(source.id, source.fixturePath, "fixture file not found"))
      )
      const content = toText(bytes)

      yield* validateFixtureByKind(source.kind, content).pipe(
        Effect.mapError(() => new FixtureCheckError(source.id, source.fixturePath, "schema decode failed"))
      )

      const actualSha256 = toSha256Hex(bytes)
      if (actualSha256 !== source.contentSha256) {
        return new FixtureCheckError(
          source.id,
          source.fixturePath,
          `contentSha256 mismatch: expected ${source.contentSha256}, got ${actualSha256}`
        )
      }

      return null
    }).pipe(Effect.catchAll((error) => Effect.succeed(error))))

  const expectedFixturePaths = Arr.map(manifest.sources, (source) =>
    normalizeRelativePath(pathService, pathService.normalize(source.fixturePath))
  )

  const externalJsonFiles = yield* findJsonFiles(fileSystem, pathService, externalRoot, "")
  const parityJsonFiles = yield* findJsonFiles(fileSystem, pathService, parityRoot, "")

  const scannedFixturePaths = [
    ...Arr.filter(
      Arr.map(externalJsonFiles, (file) => normalizeRelativePath(pathService, file)),
      (file) => file !== MANIFEST_FILE
    ),
    ...Arr.map(parityJsonFiles, (file) => normalizeRelativePath(pathService, `../parity/generated/${file}`))
  ]

  const orphanErrors = Arr.filterMap(scannedFixturePaths, (fixturePath) =>
    Arr.some(expectedFixturePaths, (expected) => expected === fixturePath)
      ? Option.none<FixtureCheckError>()
      : Option.some(
        new FixtureCheckError(
          "orphan",
          fixturePath,
          "fixture file exists on disk but is not declared in sources.manifest.json"
        )
      )
  )

  const resultErrors = Arr.filterMap(fixtureResults, (result) =>
    result === null ? Option.none<FixtureCheckError>() : Option.some(result)
  )
  const allErrors = [...resultErrors, ...orphanErrors]

  const passedNames = Arr.filterMap(
    manifest.sources,
    (source, index) => fixtureResults[index] === null ? Option.some(source.id) : Option.none()
  )

  yield* Console.log(`Checking ${manifest.sources.length} fixture sources...`)
  yield* Console.log()
  yield* Effect.forEach(passedNames, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(allErrors, (error) => Console.log(`✗ ${error.name} (${error.file}): ${error.reason}`), {
    discard: true
  })
  yield* Console.log()
  yield* Console.log(`Results: ${passedNames.length} passed, ${allErrors.length} failed`)

  if (Arr.isNonEmptyArray(allErrors)) {
    return yield* Effect.fail(new FixtureCheckError("summary", "", `${allErrors.length} fixture check failure(s)`))
  }
})

const main = program.pipe(
  Effect.catchAll((error) =>
    Console.error(`\nFATAL: ${error.reason}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
