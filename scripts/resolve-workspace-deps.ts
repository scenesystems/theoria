/**
 * resolve-workspace-deps.ts
 *
 * Resolves `workspace:` protocol references in packed package manifests to real
 * semver ranges after `build-utils pack-v3`.
 */

import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, HashMap, Match, Option, Record, Schema, Tuple } from "effect"

class WorkspaceDependencyResolutionError
  extends Schema.TaggedError<WorkspaceDependencyResolutionError>()("WorkspaceDependencyResolutionError", {
    message: Schema.String
  })
{}

const ManifestJson = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { space: 2 })
const DependencyMap = Schema.Record({ key: Schema.String, value: Schema.String })
const decodeDependencyMap = Schema.decodeUnknownOption(DependencyMap)
const decodeString = Schema.decodeUnknownOption(Schema.String)

const WORKSPACE_PROTOCOL = "workspace:"
const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
const rootUrl = new URL("../", import.meta.url)

type Versions = HashMap.HashMap<string, string>

const readManifest = (manifestPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.readFileString(manifestPath).pipe(Effect.flatMap(Schema.decode(ManifestJson)))
  }).pipe(Effect.orDie)

const readOptionalManifest = (manifestPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(manifestPath).pipe(Effect.orDie)
    return yield* exists ? Effect.map(readManifest(manifestPath), Option.some) : Effect.succeedNone
  })

const packageDirectories = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(rootUrl)
  const packagesDir = path.join(root, "packages")
  const entries = yield* fs.readDirectory(packagesDir)
  const directories = yield* Effect.filter(
    entries,
    (entry) => fs.stat(path.join(packagesDir, entry)).pipe(Effect.map((stat) => stat.type === "Directory"))
  )
  return Arr.map(directories, (entry) => path.join(packagesDir, entry))
}).pipe(Effect.orDie)

const workspaceVersions = (
  directories: ReadonlyArray<string>
): Effect.Effect<Versions, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const manifests = yield* Effect.forEach(
      directories,
      (directory) => readOptionalManifest(path.join(directory, "package.json")),
      { concurrency: "unbounded" }
    )
    return HashMap.fromIterable(
      Arr.filterMap(
        manifests,
        Option.flatMap((manifest) => Option.all([decodeString(manifest.name), decodeString(manifest.version)]))
      )
    )
  })

const resolveSpec = (
  dependency: string,
  spec: string,
  versions: Versions
): Effect.Effect<string, WorkspaceDependencyResolutionError> =>
  spec.startsWith(WORKSPACE_PROTOCOL)
    ? Option.match(HashMap.get(versions, dependency), {
      onNone: () =>
        new WorkspaceDependencyResolutionError({
          message: `Cannot resolve workspace dependency "${dependency}": not found in packages/.`
        }),
      onSome: (version) =>
        Match.value(spec.slice(WORKSPACE_PROTOCOL.length)).pipe(
          Match.when("^", () => Effect.succeed(`^${version}`)),
          Match.when("~", () => Effect.succeed(`~${version}`)),
          Match.when("*", () => Effect.succeed(`^${version}`)),
          Match.orElse(() =>
            new WorkspaceDependencyResolutionError({
              message: `Unsupported workspace protocol "${spec}" for "${dependency}".`
            })
          )
        )
    })
    : Effect.succeed(spec)

const resolveDependencyField = (
  dependencies: Record.ReadonlyRecord<string, string>,
  versions: Versions
): Effect.Effect<Record.ReadonlyRecord<string, string>, WorkspaceDependencyResolutionError> =>
  Effect.forEach(
    Record.toEntries(dependencies),
    ([dependency, spec]) =>
      Effect.map(resolveSpec(dependency, spec, versions), (resolved) => Tuple.make(dependency, resolved)),
    { concurrency: "unbounded" }
  ).pipe(Effect.map(Record.fromEntries))

const countWorkspaceSpecs = (manifest: Record.ReadonlyRecord<string, unknown>): number =>
  Arr.reduce(dependencyFields, 0, (total, field) =>
    total + Option.match(decodeDependencyMap(manifest[field]), {
      onNone: () => 0,
      onSome: (dependencies) =>
        Arr.length(Arr.filter(Record.values(dependencies), (spec) => spec.startsWith(WORKSPACE_PROTOCOL)))
    }))

const resolveManifest = (manifest: Record.ReadonlyRecord<string, unknown>, versions: Versions) =>
  Effect.reduce(dependencyFields, manifest, (current, field) =>
    Option.match(decodeDependencyMap(current[field]), {
      onNone: () => Effect.succeed(current),
      onSome: (dependencies) =>
        Effect.map(resolveDependencyField(dependencies, versions), (resolved) => ({ ...current, [field]: resolved }))
    }))

const processPackage = (directory: string, versions: Versions) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const distManifestPath = path.join(directory, "dist", "package.json")
    const manifest = yield* readOptionalManifest(distManifestPath)
    return yield* Option.match(manifest, {
      onNone: () => Effect.succeed(0),
      onSome: (current) =>
        Effect.gen(function*() {
          const resolved = countWorkspaceSpecs(current)
          if (resolved === 0) return 0
          const packageName = Option.getOrElse(decodeString(current.name), () => directory)
          const next = yield* resolveManifest(current, versions)
          const encoded = yield* Schema.encode(ManifestJson)(next).pipe(Effect.orDie)
          yield* fs.writeFileString(distManifestPath, `${encoded}\n`).pipe(Effect.orDie)
          yield* Console.log(`  ✓ ${packageName}: resolved ${resolved} workspace dep(s)`)
          return resolved
        })
    })
  })

const program = Effect.gen(function*() {
  const directories = yield* packageDirectories
  const versions = yield* workspaceVersions(directories)
  const counts = yield* Effect.forEach(directories, (directory) => processPackage(directory, versions), {
    concurrency: "unbounded"
  })
  yield* Console.log(
    `\n✓ Resolved ${Arr.reduce(counts, 0, (total, count) => total + count)} workspace dep(s) across all packages`
  )
})

BunRuntime.runMain(
  program.pipe(
    Effect.tapError((error) => Console.error(`\n✗ ${error.message}`)),
    Effect.provide(BunContext.layer)
  )
)
