/** Validates committed Optuna fixtures against their TypeScript schemas. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as Bool,
  Console,
  Data,
  Effect,
  FileSystem,
  Match,
  Option,
  Path,
  Result,
  String as Str
} from "effect"

import { directoryBeside, loadFixtureByEntry, loadManifest } from "../test/helpers/fixtures/io.js"

const fixtureRoot = "../test/fixtures/optuna/"
const manifestFile = "manifest.json"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly name: string
  readonly file: string
  readonly reason: string
  readonly cause: Option.Option<unknown>
}> {
  override get message() {
    return `${this.name} (${this.file}): ${this.reason}${
      Option.match(this.cause, {
        onNone: () => "",
        onSome: (cause) => `: ${String(cause)}`
      })
    }`
  }
}

const findJsonFiles = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<ReadonlyArray<Result.Result<string, FixtureCheckError>>> =>
  Effect.gen(function*() {
    const directory = Bool.match(Str.isEmpty(prefix), {
      onFalse: () => path.join(root, prefix),
      onTrue: () => root
    })
    const entries = yield* Effect.result(fileSystem.readDirectory(directory))
    return yield* Result.match(entries, {
      onFailure: (cause) =>
        Effect.succeed([Result.fail(
          new FixtureCheckError({
            name: "scan",
            file: directory,
            reason: "could not read directory",
            cause: Option.some(cause)
          })
        )]),
      onSuccess: (names) =>
        Effect.map(
          Effect.forEach(names, (name) =>
            Effect.gen(function*() {
              const relative = Str.isEmpty(prefix) ? name : path.join(prefix, name)
              const absolute = path.join(root, relative)
              const stat = yield* Effect.result(fileSystem.stat(absolute))
              return yield* Result.match(stat, {
                onFailure: (cause) =>
                  Effect.succeed([Result.fail(
                    new FixtureCheckError({
                      name: "scan",
                      file: absolute,
                      reason: "could not stat",
                      cause: Option.some(cause)
                    })
                  )]),
                onSuccess: (info) =>
                  Match.value(info.type).pipe(
                    Match.when("Directory", () =>
                      Str.Equivalence(name, "invalid")
                        ? Effect.succeed([])
                        : findJsonFiles(fileSystem, path, root, relative)),
                    Match.orElse(() => Effect.succeed(Str.endsWith(".json")(name) ? [Result.succeed(relative)] : []))
                  )
              })
            })),
          Arr.flatten
        )
    })
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* directoryBeside(import.meta.url, fixtureRoot)
  const manifest = yield* loadManifest(root, manifestFile)
  yield* Console.log(`Checking ${Arr.length(manifest.fixtures)} fixtures from manifest...`)

  const fixtureResults = yield* Effect.forEach(
    manifest.fixtures,
    (entry) => loadFixtureByEntry(root, entry).pipe(Effect.as(entry.name), Effect.result)
  )
  const [passed, fixtureErrors] = Arr.separate(fixtureResults)
  const scanned = yield* findJsonFiles(fileSystem, path, root, "")
  const [discovered, scanErrors] = Arr.separate(scanned)
  const declared = Arr.map(manifest.fixtures, (entry) => entry.file)
  const orphanErrors = Arr.map(
    Arr.filter(
      discovered,
      (file) => Bool.and(Bool.not(Str.Equivalence(file, manifestFile)), Bool.not(Arr.contains(declared, file)))
    ),
    (file) =>
      new FixtureCheckError({
        name: "orphan",
        file,
        reason: "fixture file exists on disk but is not declared in manifest",
        cause: Option.none()
      })
  )
  const errors = Arr.appendAll(
    Arr.map(fixtureErrors, (cause) =>
      new FixtureCheckError({
        name: cause._tag,
        file: "",
        reason: "fixture validation failed",
        cause: Option.some(cause)
      })),
    Arr.appendAll(scanErrors, orphanErrors)
  )

  yield* Effect.forEach(passed, (name) => Console.log(`✓ ${name}`), { discard: true })
  yield* Effect.forEach(errors, (error) => Console.log(`✗ ${error.message}`), { discard: true })
  yield* Console.log(`Results: ${Arr.length(passed)} passed, ${Arr.length(errors)} failed`)
  if (Arr.isArrayNonEmpty(errors)) {
    return yield* new FixtureCheckError({
      name: "summary",
      file: "",
      reason: `${Arr.length(errors)} fixture check failure(s)`,
      cause: Option.none()
    })
  }
})

BunRuntime.runMain(program.pipe(Effect.asVoid, Effect.provide(BunServices.layer)))
