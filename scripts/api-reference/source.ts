import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Predicate, Record as Rec, Schema, String as Str } from "effect"

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

export const SourceFilePath = Schema.Struct({ absolute: Schema.String, relative: Schema.String })
export type SourceFilePath = typeof SourceFilePath.Type

export const PackagePublicEntrypoint = Schema.Struct({ subpath: Schema.String, sourceFile: SourceFilePath })
export type PackagePublicEntrypoint = typeof PackagePublicEntrypoint.Type

export const ApiSourceRoute = Schema.Struct({ entrypoint: PackagePublicEntrypoint })
export type ApiSourceRoute = typeof ApiSourceRoute.Type

export const ApiSourceModule = Schema.Struct({
  absolute: Schema.String,
  relative: Schema.String,
  canonicalSubpath: Schema.String,
  routes: Schema.Array(ApiSourceRoute)
})
export type ApiSourceModule = typeof ApiSourceModule.Type

export const ApiSourcePackage = Schema.Struct({
  directoryName: Schema.String,
  root: Schema.String,
  description: Schema.String,
  manifest: PackageManifestSchema,
  modules: Schema.Array(ApiSourceModule)
})
export type ApiSourcePackage = typeof ApiSourcePackage.Type

export const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const isTypeScriptSourceTarget = (value: string): boolean =>
  value.startsWith("./src/") && (value.endsWith(".ts") || value.endsWith(".mts"))

const firstTypeScriptSourceTarget = (target: unknown): Option.Option<string> => {
  if (typeof target === "string") {
    return isTypeScriptSourceTarget(target) ? Option.some(target) : Option.none()
  }

  if (!Predicate.isRecord(target)) {
    return Option.none()
  }

  const candidates = Arr.isArray(target) ? target : Rec.values(target)

  return Arr.reduce(
    candidates,
    Option.none<string>(),
    (accumulator, value) => Option.orElse(accumulator, () => firstTypeScriptSourceTarget(value))
  )
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

  return Arr.filterMap(
    sortedEntries,
    ([subpath, target]) =>
      Option.map(firstTypeScriptSourceTarget(target), (sourceTarget) => {
        const absolute = path.join(packageRoot, sourceTarget)

        return {
          subpath,
          sourceFile: { absolute, relative: toForwardSlashes(path, path.relative(packageRoot, absolute)) }
        }
      })
  )
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
  const routes = Arr.flatMap(modules, (module) =>
    Arr.map(module.routes, ({ entrypoint }) => ({
      key: entrypoint.subpath.toLocaleLowerCase("en-US"),
      source: module.relative,
      subpath: entrypoint.subpath
    })))

  return Arr.findFirst(routes, (route) =>
    Arr.some(
      routes,
      (candidate) => candidate.key === route.key && candidate.source !== route.source
    ))
}

/** The public package in `packagesRoot/directoryName`; none for private packages and non-package directories. */
export const loadApiSourcePackage = (packagesRoot: string, directoryName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = path.join(packagesRoot, directoryName)
    const manifestPath = path.join(root, "package.json")
    const rootStat = yield* fileSystem.stat(root)

    if (rootStat.type !== "Directory" || !(yield* fileSystem.exists(manifestPath))) {
      return Option.none<ApiSourcePackage>()
    }

    const manifestJson = yield* fileSystem.readFileString(manifestPath)
    const manifest = yield* Schema.decodeUnknown(PackageManifestJson)(manifestJson)

    if (manifest.private === true) {
      return Option.none<ApiSourcePackage>()
    }

    const description = yield* Option.fromNullable(manifest.description).pipe(
      Option.map(Str.trim),
      Option.filter(Str.isNonEmpty),
      Effect.mapError(() =>
        new ApiReferenceGenerationError({
          packageName: manifest.name,
          detail: "public package is missing a description"
        })
      )
    )

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
    const directoryNames = yield* fileSystem.readDirectory(packagesRoot)
    const packages = yield* Effect.forEach(
      directoryNames.sort((left, right) => left.localeCompare(right)),
      (directoryName) => loadApiSourcePackage(packagesRoot, directoryName),
      { concurrency: "unbounded" }
    )

    return Arr.getSomes(packages).sort((left, right) => left.manifest.name.localeCompare(right.manifest.name))
  })
