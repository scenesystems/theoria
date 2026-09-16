import { FileSystem, Path } from "@effect/platform"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Option,
  Order,
  Predicate,
  Record as Rec,
  Schema,
  String as Str
} from "effect"

import { ApiReferenceGenerationError } from "./model.js"

const PackageManifestSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.optional(Schema.String),
  private: Schema.optional(Schema.Boolean),
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const PackageManifestJson = Schema.parseJson(PackageManifestSchema)
const ExportTargetCandidates = Schema.Array(Schema.Unknown)
type ExportTargetCandidates = typeof ExportTargetCandidates.Type
const LocaleStringOrder = Order.make<string>((self, that) => Str.localeCompare(that)(self))

export type PackageManifest = typeof PackageManifestSchema.Type

export const SourceFilePath = Schema.Struct({ absolute: Schema.String, relative: Schema.String })
export type SourceFilePath = typeof SourceFilePath.Type

export const PackagePublicEntrypoint = Schema.Struct({ subpath: Schema.String, sourceFile: SourceFilePath })
export type PackagePublicEntrypoint = typeof PackagePublicEntrypoint.Type
const PackagePublicEntrypoints = Schema.Array(PackagePublicEntrypoint)
type PackagePublicEntrypoints = typeof PackagePublicEntrypoints.Type

export const ApiSourceRoute = Schema.Struct({ entrypoint: PackagePublicEntrypoint })
export type ApiSourceRoute = typeof ApiSourceRoute.Type

export const ApiSourceModule = Schema.Struct({
  absolute: Schema.String,
  relative: Schema.String,
  canonicalSubpath: Schema.String,
  routes: Schema.Array(ApiSourceRoute)
})
export type ApiSourceModule = typeof ApiSourceModule.Type
const ApiSourceModules = Schema.Array(ApiSourceModule)
type ApiSourceModules = typeof ApiSourceModules.Type

export const ApiSourcePackage = Schema.Struct({
  directoryName: Schema.String,
  root: Schema.String,
  description: Schema.String,
  manifest: PackageManifestSchema,
  modules: ApiSourceModules
})
export type ApiSourcePackage = typeof ApiSourcePackage.Type

export const toForwardSlashes = (path: Path.Path, value: string): string => Arr.join(Str.split(value, path.sep), "/")

const isTypeScriptSourceTarget = (value: string): boolean =>
  Bool.and(Str.startsWith("./src/")(value), Bool.or(Str.endsWith(".ts")(value), Str.endsWith(".mts")(value)))

const isExportTargetCandidates = Schema.is(ExportTargetCandidates)

const firstTypeScriptSourceTarget = (target: unknown): Option.Option<string> =>
  Option.match(Option.liftPredicate(target, Predicate.isString), {
    onSome: (sourceTarget) => Option.liftPredicate(sourceTarget, isTypeScriptSourceTarget),
    onNone: () => {
      const visitCandidates = (candidates: ExportTargetCandidates) =>
        Arr.reduce(
          candidates,
          Option.none<string>(),
          (accumulator, value) => Option.orElse(accumulator, () => firstTypeScriptSourceTarget(value))
        )

      return Option.match(Option.liftPredicate(target, isExportTargetCandidates), {
        onSome: visitCandidates,
        onNone: () =>
          Option.match(Option.liftPredicate(target, Predicate.isRecord), {
            onSome: (record) => visitCandidates(Rec.values(record)),
            onNone: Option.none
          })
      })
    }
  })

// The manifest is the surface authority: only `exports` subpaths that point at
// a TypeScript source file are public API modules. `./package.json` and
// build-artifact-only targets are ignored.
const packagePublicEntrypoints = (
  path: Path.Path,
  packageRoot: string,
  manifest: PackageManifest
): PackagePublicEntrypoints => {
  const sortedEntries = Arr.sort(
    Rec.toEntries(manifest.exports),
    Order.struct({ 0: LocaleStringOrder })
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
  const withoutSourceRoot = Str.replace(/\.m?ts$/u, "")(Str.replace(/^src\//u, "")(relativeSource))
  const modulePath = Bool.match(Str.Equivalence(withoutSourceRoot, "index"), {
    onTrue: () => "",
    onFalse: () => Str.replace(/\/index$/u, "")(withoutSourceRoot)
  })

  return Bool.match(Str.isEmpty(modulePath), { onTrue: () => ".", onFalse: () => Str.concat("./", modulePath) })
}

const canonicalEntrypoint = (
  relativeSource: string,
  entrypoints: PackagePublicEntrypoints
): Option.Option<PackagePublicEntrypoint> => {
  const sourceSubpath = sourceModuleSubpath(relativeSource)

  return Option.orElse(
    Arr.findFirst(entrypoints, (entrypoint) => Str.Equivalence(entrypoint.subpath, sourceSubpath)),
    () => Arr.head(entrypoints)
  )
}

const groupModules = (entrypoints: PackagePublicEntrypoints): ApiSourceModules => {
  const sourceFiles = Arr.dedupe(Arr.map(entrypoints, (entrypoint) => entrypoint.sourceFile.absolute))

  return Arr.filterMap(sourceFiles, (sourceFile) => {
    const matchingEntrypoints = Arr.filter(
      entrypoints,
      (entrypoint) => Str.Equivalence(entrypoint.sourceFile.absolute, sourceFile)
    )

    return Option.flatMap(
      Arr.head(matchingEntrypoints),
      (firstEntrypoint) =>
        Option.map(canonicalEntrypoint(firstEntrypoint.sourceFile.relative, matchingEntrypoints), (canonical) => ({
          absolute: canonical.sourceFile.absolute,
          relative: canonical.sourceFile.relative,
          canonicalSubpath: canonical.subpath,
          routes: Arr.map(matchingEntrypoints, (entrypoint) => ({ entrypoint }))
        }))
    )
  })
}

const hasInternalSegment = (value: string): boolean =>
  Arr.some(
    Str.split(Str.replace(/^\.\//u, "")(value), "/"),
    (segment) => Str.Equivalence(Str.toLocaleLowerCase("en-US")(segment), "internal")
  )

const conflictingRoute = (modules: ApiSourceModules) => {
  const routes = Arr.flatMap(modules, (module) =>
    Arr.map(module.routes, ({ entrypoint }) => ({
      key: Str.toLocaleLowerCase("en-US")(entrypoint.subpath),
      source: module.relative,
      subpath: entrypoint.subpath
    })))

  return Arr.findFirst(routes, (route) =>
    Arr.some(
      routes,
      (candidate) =>
        Bool.and(Str.Equivalence(candidate.key, route.key), Bool.not(Str.Equivalence(candidate.source, route.source)))
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
    const manifestExists = yield* Effect.if(Str.Equivalence(rootStat.type, "Directory"), {
      onTrue: () => fileSystem.exists(manifestPath),
      onFalse: () => Effect.succeed(false)
    })

    return yield* Effect.if(manifestExists, {
      onFalse: () => Effect.succeed(Option.none<ApiSourcePackage>()),
      onTrue: () =>
        Effect.gen(function*() {
          const manifestJson = yield* fileSystem.readFileString(manifestPath)
          const manifest = yield* Schema.decodeUnknown(PackageManifestJson)(manifestJson)
          const isPrivate = Option.match(Option.fromNullable(manifest.private), {
            onNone: () => false,
            onSome: (value) => Bool.Equivalence(value, true)
          })

          return yield* Effect.if(isPrivate, {
            onTrue: () => Effect.succeed(Option.none<ApiSourcePackage>()),
            onFalse: () =>
              Effect.gen(function*() {
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
                  (entrypoint) =>
                    Bool.or(hasInternalSegment(entrypoint.subpath), hasInternalSegment(entrypoint.sourceFile.relative))
                )

                yield* Effect.if(Arr.isNonEmptyArray(internalEntrypoints), {
                  onTrue: () =>
                    Effect.fail(
                      new ApiReferenceGenerationError({
                        packageName: manifest.name,
                        detail: Str.concat(
                          "internal API modules are public: ",
                          Arr.join(Arr.map(internalEntrypoints, (entrypoint) => entrypoint.subpath), ", ")
                        )
                      })
                    ),
                  onFalse: () => Effect.void
                })

                const modules = groupModules(entrypoints)
                const collision = conflictingRoute(modules)

                yield* Option.match(collision, {
                  onNone: () => Effect.void,
                  onSome: (conflict) =>
                    Effect.fail(
                      new ApiReferenceGenerationError({
                        packageName: manifest.name,
                        detail: Str.concat(
                          Str.concat("route ", conflict.subpath),
                          " collides case-insensitively with a different source module"
                        )
                      })
                    )
                })

                return Option.some<ApiSourcePackage>({ directoryName, root, description, manifest, modules })
              })
          })
        })
    })
  })

export const discoverApiSourcePackages = (packagesRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directoryNames = yield* fileSystem.readDirectory(packagesRoot)
    const packages = yield* Effect.forEach(
      Arr.sort(directoryNames, LocaleStringOrder),
      (directoryName) => loadApiSourcePackage(packagesRoot, directoryName),
      { concurrency: "unbounded" }
    )

    return Arr.sort(
      Arr.getSomes(packages),
      Order.mapInput(LocaleStringOrder, (sourcePackage: ApiSourcePackage) => sourcePackage.manifest.name)
    )
  })
