import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect"

import { ApiReferenceGenerationError } from "./model.js"

const PackageManifestSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.optional(Schema.String),
  private: Schema.optional(Schema.Boolean),
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const PackageManifestJson = Schema.parseJson(PackageManifestSchema)

export type PackageManifest = typeof PackageManifestSchema.Type

export type SourceFilePath = {
  readonly absolute: string
  readonly relative: string
}

export type PackagePublicEntrypoint = {
  readonly subpath: string
  readonly sourceFile: SourceFilePath
}

export type ApiSourceRoute = {
  readonly entrypoint: PackagePublicEntrypoint
}

export type ApiSourceModule = {
  readonly absolute: string
  readonly relative: string
  readonly canonicalSubpath: string
  readonly routes: ReadonlyArray<ApiSourceRoute>
}

export type ApiSourcePackage = {
  readonly directoryName: string
  readonly root: string
  readonly description: string
  readonly manifest: PackageManifest
  readonly modules: ReadonlyArray<ApiSourceModule>
}

export const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const isTypeScriptSourceTarget = (value: string): boolean =>
  value.startsWith("./src/") && (value.endsWith(".ts") || value.endsWith(".mts"))

const firstTypeScriptSourceTarget = (target: unknown): Option.Option<string> => {
  if (typeof target === "string") {
    return isTypeScriptSourceTarget(target) ? Option.some(target) : Option.none()
  }

  if (target === null || typeof target !== "object") {
    return Option.none()
  }

  const candidates = Arr.isArray(target) ? target : Rec.values(target)

  return Arr.reduce(candidates, Option.none<string>(), (accumulator, value) =>
    Option.orElse(accumulator, () => firstTypeScriptSourceTarget(value)))
}

// The manifest is the surface authority: only `exports` subpaths that point at
// a TypeScript source file are public API modules. `./package.json` and
// build-artifact-only targets are ignored.
const packagePublicEntrypoints = (
  path: Path.Path,
  packageRoot: string,
  manifest: PackageManifest
): ReadonlyArray<PackagePublicEntrypoint> => {
  const sortedEntries = Arr.fromIterable(Rec.toEntries(manifest.exports)).sort(([left], [right]) =>
    left.localeCompare(right)
  )

  return Arr.filterMap(sortedEntries, ([subpath, target]) =>
    Option.map(firstTypeScriptSourceTarget(target), (sourceTarget) => {
      const absolute = path.join(packageRoot, sourceTarget)

      return {
        subpath,
        sourceFile: { absolute, relative: toForwardSlashes(path, path.relative(packageRoot, absolute)) }
      }
    }))
}

export const sourceModuleSubpath = (relativeSource: string): string => {
  const withoutSourceRoot = relativeSource.replace(/^src\//u, "").replace(/\.m?ts$/u, "")
  const modulePath = withoutSourceRoot === "index"
    ? ""
    : withoutSourceRoot.replace(/\/index$/u, "")

  return modulePath.length === 0 ? "." : `./${modulePath}`
}

const canonicalEntrypoint = (
  relativeSource: string,
  entrypoints: ReadonlyArray<PackagePublicEntrypoint>
): Option.Option<PackagePublicEntrypoint> => {
  const sourceSubpath = sourceModuleSubpath(relativeSource)

  return Option.orElse(
    Arr.findFirst(entrypoints, (entrypoint) => entrypoint.subpath === sourceSubpath),
    () => Arr.head(entrypoints)
  )
}

const groupModules = (entrypoints: ReadonlyArray<PackagePublicEntrypoint>): ReadonlyArray<ApiSourceModule> => {
  const sourceFiles = Arr.dedupe(Arr.map(entrypoints, (entrypoint) => entrypoint.sourceFile.absolute))

  return Arr.filterMap(sourceFiles, (sourceFile) => {
    const matchingEntrypoints = Arr.filter(entrypoints, (entrypoint) => entrypoint.sourceFile.absolute === sourceFile)
    const relativeSource = Option.match(Arr.head(matchingEntrypoints), {
      onNone: () => "",
      onSome: (entrypoint) => entrypoint.sourceFile.relative
    })

    return Option.map(canonicalEntrypoint(relativeSource, matchingEntrypoints), (canonical) => ({
      absolute: canonical.sourceFile.absolute,
      relative: canonical.sourceFile.relative,
      canonicalSubpath: canonical.subpath,
      routes: Arr.map(matchingEntrypoints, (entrypoint) => ({ entrypoint }))
    }))
  })
}

const hasInternalSegment = (value: string): boolean =>
  value.replace(/^\.\//u, "").split("/").some((segment) => segment.toLocaleLowerCase("en-US") === "internal")

const conflictingRoute = (modules: ReadonlyArray<ApiSourceModule>) => {
  const routes = Arr.flatMap(modules, (module) => Arr.map(module.routes, ({ entrypoint }) => ({
    key: entrypoint.subpath.toLocaleLowerCase("en-US"),
    source: module.relative,
    subpath: entrypoint.subpath
  })))

  return Arr.findFirst(routes, (route) => Arr.some(
    routes,
    (candidate) => candidate.key === route.key && candidate.source !== route.source
  ))
}

const loadSourcePackage = (packagesRoot: string, directoryName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = path.join(packagesRoot, directoryName)
    const manifestPath = path.join(root, "package.json")
    const rootStat = yield* fileSystem.stat(root).pipe(Effect.orDie)

    if (rootStat.type !== "Directory" || !(yield* fileSystem.exists(manifestPath).pipe(Effect.orDie))) {
      return Option.none<ApiSourcePackage>()
    }

    const manifestJson = yield* fileSystem.readFileString(manifestPath).pipe(Effect.orDie)
    const manifest = yield* Schema.decodeUnknown(PackageManifestJson)(manifestJson).pipe(Effect.orDie)

    if (manifest.private === true) {
      return Option.none<ApiSourcePackage>()
    }

    const description = manifest.description?.trim()

    if (description === undefined || description.length === 0) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: "public package is missing a description"
      })
    }

    const entrypoints = packagePublicEntrypoints(path, root, manifest)
    const internalEntrypoints = Arr.filter(
      entrypoints,
      (entrypoint) => hasInternalSegment(entrypoint.subpath) || hasInternalSegment(entrypoint.sourceFile.relative)
    )

    if (internalEntrypoints.length > 0) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: `internal API modules are public: ${internalEntrypoints.map((entry) => entry.subpath).join(", ")}`
      })
    }

    const modules = groupModules(entrypoints)
    const collision = conflictingRoute(modules)

    if (Option.isSome(collision)) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: `route ${collision.value.subpath} collides case-insensitively with a different source module`
      })
    }

    return Option.some<ApiSourcePackage>({ directoryName, root, description, manifest, modules })
  })

export const discoverApiSourcePackages = (packagesRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directoryNames = yield* fileSystem.readDirectory(packagesRoot).pipe(Effect.orDie)
    const packages = yield* Effect.forEach(
      directoryNames.sort((left, right) => left.localeCompare(right)),
      (directoryName) => loadSourcePackage(packagesRoot, directoryName),
      { concurrency: "unbounded" }
    )

    return Arr.getSomes(packages).sort((left, right) => left.manifest.name.localeCompare(right.manifest.name))
  })
