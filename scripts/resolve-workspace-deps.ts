/**
 * resolve-workspace-deps.ts
 *
 * Resolves `workspace:` protocol references in packed package manifests to real
 * semver ranges after `build-utils pack-v3`.
 */

import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array, Boolean, Effect, HashMap, Match, Number, Option, Record, Schema, String, Tuple } from "effect"

class WorkspaceDependencyResolutionError extends Schema.TaggedError<WorkspaceDependencyResolutionError>()(
  "WorkspaceDependencyResolutionError",
  { message: Schema.String }
) {}

const DependencyMap = Schema.transform(
  Schema.Record({ key: Schema.String, value: Schema.String }),
  Schema.HashMapFromSelf({ key: Schema.String, value: Schema.String }),
  {
    strict: true,
    decode: (dependencies) => HashMap.fromIterable(Array.fromRecord(dependencies)),
    encode: (dependencies) => Record.fromEntries(HashMap.toEntries(dependencies))
  }
)
type DependencyMap = typeof DependencyMap.Type
const optionalDependencyMap = Schema.optionalWith(DependencyMap, { as: "Option" })
const optionalString = Schema.optionalWith(Schema.String, { as: "Option" })
const Manifest = Schema.Struct(
  {
    name: optionalString,
    version: optionalString,
    dependencies: optionalDependencyMap,
    devDependencies: optionalDependencyMap,
    peerDependencies: optionalDependencyMap,
    optionalDependencies: optionalDependencyMap
  },
  Schema.Record({ key: Schema.String, value: Schema.Unknown })
)
const ManifestJson = Schema.parseJson(Manifest, { space: 2 })

const WORKSPACE_PROTOCOL = "workspace:"

const readManifest = (manifestPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.readFileString(manifestPath).pipe(Effect.flatMap(Schema.decode(ManifestJson)))
  })

const readOptionalManifest = (manifestPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(manifestPath)
    return yield* Boolean.match(exists, {
      onFalse: () => Effect.succeedNone,
      onTrue: () => Effect.asSome(readManifest(manifestPath))
    })
  })

const packageDirectories = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* Effect.flatMap(Url.fromString("../", import.meta.url), path.fromFileUrl)
  const packagesDir = path.join(root, "packages")
  const entries = yield* fs.readDirectory(packagesDir)
  const directories = yield* Effect.filter(
    entries,
    (entry) =>
      fs.stat(path.join(packagesDir, entry)).pipe(Effect.map((stat) => String.Equivalence(stat.type, "Directory")))
  )
  return Array.map(directories, (entry) => path.join(packagesDir, entry))
})

const workspaceVersions = (directories: Iterable<string>) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const manifests = yield* Effect.forEach(
      directories,
      (directory) => readOptionalManifest(path.join(directory, "package.json")),
      { concurrency: "unbounded" }
    )
    return HashMap.fromIterable(
      Array.filterMap(
        manifests,
        (manifest) => Option.flatMap(manifest, (value) => Option.all(Tuple.make(value.name, value.version)))
      )
    )
  })

const resolveSpec = (
  dependency: string,
  spec: string,
  versions: DependencyMap
): Effect.Effect<string, WorkspaceDependencyResolutionError> =>
  Boolean.match(String.startsWith(WORKSPACE_PROTOCOL)(spec), {
    onFalse: () => Effect.succeed(spec),
    onTrue: () =>
      Option.match(HashMap.get(versions, dependency), {
        onNone: () =>
          Effect.fail(
            new WorkspaceDependencyResolutionError({
              message: Array.join(
                Array.make("Cannot resolve workspace dependency \"", dependency, "\": not found in packages/."),
                ""
              )
            })
          ),
        onSome: (version) =>
          Match.value(String.slice(String.length(WORKSPACE_PROTOCOL))(spec)).pipe(
            Match.when("^", () => Effect.succeed(String.concat("^", version))),
            Match.when("~", () => Effect.succeed(String.concat("~", version))),
            Match.when("*", () => Effect.succeed(String.concat("^", version))),
            Match.orElse(() =>
              Effect.fail(
                new WorkspaceDependencyResolutionError({
                  message: Array.join(
                    Array.make("Unsupported workspace protocol \"", spec, "\" for \"", dependency, "\"."),
                    ""
                  )
                })
              )
            )
          )
      })
  })

const resolveDependencyField = (
  dependencies: DependencyMap,
  versions: DependencyMap
): Effect.Effect<DependencyMap, WorkspaceDependencyResolutionError> =>
  Effect.forEach(
    HashMap.toEntries(dependencies),
    ([dependency, spec]) =>
      Effect.map(resolveSpec(dependency, spec, versions), (resolved) => Tuple.make(dependency, resolved)),
    { concurrency: "unbounded" }
  ).pipe(Effect.map(HashMap.fromIterable))

const resolveOptionalDependencyField = (
  dependencies: Option.Option<DependencyMap>,
  versions: DependencyMap
) =>
  Option.match(dependencies, {
    onNone: () => Effect.succeedNone,
    onSome: (value) => Effect.asSome(resolveDependencyField(value, versions))
  })

const dependencyMaps = (manifest: typeof Manifest.Type) =>
  Array.make(
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies
  )

const countWorkspaceSpecs = (manifest: typeof Manifest.Type): number =>
  Array.reduce(dependencyMaps(manifest), 0, (total, dependencies) =>
    Number.sum(
      total,
      Option.match(dependencies, {
        onNone: () => 0,
        onSome: (value) =>
          Array.length(
            Array.filter(Array.fromIterable(HashMap.values(value)), String.startsWith(WORKSPACE_PROTOCOL))
          )
      })
    ))

const resolveManifest = (manifest: typeof Manifest.Type, versions: DependencyMap) =>
  Effect.all({
    dependencies: resolveOptionalDependencyField(manifest.dependencies, versions),
    devDependencies: resolveOptionalDependencyField(manifest.devDependencies, versions),
    peerDependencies: resolveOptionalDependencyField(manifest.peerDependencies, versions),
    optionalDependencies: resolveOptionalDependencyField(manifest.optionalDependencies, versions)
  }, { concurrency: "unbounded" }).pipe(
    Effect.map((resolved) => ({ ...manifest, ...resolved }))
  )

const processPackage = (directory: string, versions: DependencyMap) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const distManifestPath = path.join(directory, "dist", "package.json")
    const manifest = yield* readOptionalManifest(distManifestPath)
    return yield* Option.match(manifest, {
      onNone: () => Effect.succeed(0),
      onSome: (current) => {
        const resolved = countWorkspaceSpecs(current)
        return Boolean.match(Number.Equivalence(resolved, 0), {
          onTrue: () => Effect.succeed(0),
          onFalse: () =>
            Effect.gen(function*() {
              const packageName = Option.getOrElse(current.name, () => directory)
              const next = yield* resolveManifest(current, versions)
              const encoded = yield* Schema.encode(ManifestJson)(next)
              yield* fs.writeFileString(distManifestPath, String.concat(encoded, "\n"))
              yield* Effect.log("Workspace dependencies resolved").pipe(
                Effect.annotateLogs({ packageName, dependenciesResolved: resolved })
              )
              return resolved
            })
        })
      }
    })
  })

const program = Effect.gen(function*() {
  const directories = yield* packageDirectories
  const versions = yield* workspaceVersions(directories)
  const counts = yield* Effect.forEach(directories, (directory) => processPackage(directory, versions), {
    concurrency: "unbounded"
  })
  yield* Effect.log("Workspace dependency resolution complete").pipe(
    Effect.annotateLogs({ dependenciesResolved: Number.sumAll(counts) })
  )
})

BunRuntime.runMain(
  program.pipe(
    Effect.tapError((error) =>
      Effect.logError("Workspace dependency resolution failed").pipe(Effect.annotateLogs({ error }))
    ),
    Effect.provide(BunContext.layer)
  )
)
