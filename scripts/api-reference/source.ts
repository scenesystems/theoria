import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Schema } from "effect"

import {
  type PackageReleaseManifest,
  PackageReleaseManifestJson,
  type PackagePublicEntrypoint,
  type PackagePublicExport,
  packagePublicEntrypoints,
  packagePublicExports,
  typeScriptProgramFromConfig
} from "@theoria/source-proof"

import {
  ApiReferenceGenerationError
} from "./model.js"

export type ApiSourceRoute = {
  readonly entrypoint: PackagePublicEntrypoint
  readonly publicExports: ReadonlyArray<PackagePublicExport>
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
  readonly manifest: PackageReleaseManifest
  readonly modules: ReadonlyArray<ApiSourceModule>
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

const groupModules = (
  entrypoints: ReadonlyArray<PackagePublicEntrypoint>,
  publicExports: ReadonlyArray<PackagePublicExport>
): ReadonlyArray<ApiSourceModule> => {
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
      routes: Arr.map(matchingEntrypoints, (entrypoint) => ({
        entrypoint,
        publicExports: Arr.filter(publicExports, (entry) => entry.subpath === entrypoint.subpath)
      }))
    }))
  })
}

const hasInternalSegment = (subpath: string): boolean =>
  subpath.replace(/^\.\//u, "").split("/").some((segment) => segment.toLocaleLowerCase("en-US") === "internal")

const sourceHasInternalSegment = (sourceFile: string): boolean =>
  sourceFile.replaceAll("\\", "/").split("/").some((segment) =>
    segment.toLocaleLowerCase("en-US") === "internal"
  )

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
    const manifest = yield* Schema.decodeUnknown(PackageReleaseManifestJson)(manifestJson).pipe(Effect.orDie)

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

    const entrypoints = yield* packagePublicEntrypoints(root, manifest)
    const internalEntrypoints = Arr.filter(
      entrypoints,
      (entrypoint) =>
        hasInternalSegment(entrypoint.subpath) || sourceHasInternalSegment(entrypoint.sourceFile.relative)
    )

    if (internalEntrypoints.length > 0) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: `internal API modules are public: ${internalEntrypoints.map((entry) => entry.subpath).join(", ")}`
      })
    }

    const program = yield* typeScriptProgramFromConfig(path.join(root, "tsconfig.src.json")).pipe(Effect.orDie)
    const publicExports = packagePublicExports(program, entrypoints)
    const incompleteExports = Arr.filterMap(publicExports, (entry) => {
      const missing = [
        ...(entry.summary === null ? ["summary"] : []),
        ...(entry.since === null ? ["@since"] : []),
        ...(entry.category === null ? ["@category"] : [])
      ]

      return missing.length === 0
        ? Option.none()
        : Option.some(`${entry.subpath}#${entry.exportName} (${missing.join(", ")})`)
    })

    if (incompleteExports.length > 0) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: `public API documentation is incomplete: ${incompleteExports.join(", ")}`
      })
    }

    const modules = groupModules(entrypoints, publicExports)
    const collision = conflictingRoute(modules)

    if (Option.isSome(collision)) {
      return yield* new ApiReferenceGenerationError({
        packageName: manifest.name,
        detail: `route ${collision.value.subpath} collides case-insensitively with a different source module`
      })
    }

    return Option.some({
      directoryName,
      root,
      description,
      manifest,
      modules
    })
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
