import { Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect"

import { PackageNameSchema, ReleaseVersionSchema } from "./identifiers.js"
import { PackagePublicEntrypoint, SourceFilePath } from "./model.js"

/**
 * Minimal package manifest shape needed for public-surface governance.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageReleaseManifestSchema = Schema.Struct({
  name: PackageNameSchema,
  version: ReleaseVersionSchema,
  exports: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })
})

/**
 * Package manifest JSON decoder for release-governance package tests.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageReleaseManifestJson = Schema.parseJson(PackageReleaseManifestSchema)

/**
 * Package manifest type needed for source-proof inventory building.
 *
 * @since 0.0.0
 * @category models
 */
export type PackageReleaseManifest = typeof PackageReleaseManifestSchema.Type

const toForwardSlashes = (path: Path.Path, value: string): string => value.split(path.sep).join("/")

const isTypeScriptSourceTarget = (value: string): boolean =>
  value.startsWith("./src/") && (value.endsWith(".ts") || value.endsWith(".mts"))

const firstTypeScriptSourceTarget = (target: unknown): Option.Option<string> => {
  if (typeof target === "string") {
    return isTypeScriptSourceTarget(target)
      ? Option.some(target)
      : Option.none()
  }

  if (target === null || Arr.isArray(target) || typeof target !== "object") {
    return Option.none()
  }

  return Arr.reduce(Rec.values(target), Option.none<string>(), (accumulator, value) =>
    Option.match(accumulator, {
      onNone: () => firstTypeScriptSourceTarget(value),
      onSome: () => accumulator
    }))
}

/**
 * Collects public TypeScript entrypoints declared in a package manifest.
 *
 * The manifest is the surface authority: only `package.json` export subpaths
 * that point at concrete source entrypoints participate in docstring
 * governance. Blocked internals, `./package.json`, and non-source targets are
 * intentionally ignored.
 *
 * @since 0.0.0
 * @category queries
 */
export const packagePublicEntrypoints = (
  packageRoot: string,
  manifest: PackageReleaseManifest
): Effect.Effect<ReadonlyArray<PackagePublicEntrypoint>, never, Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const sortedEntries = Arr.fromIterable(Rec.toEntries(manifest.exports)).sort(([leftSubpath], [rightSubpath]) =>
      leftSubpath.localeCompare(rightSubpath)
    )

    return Arr.filterMap(sortedEntries, ([subpath, target]) =>
      Option.map(firstTypeScriptSourceTarget(target), (sourceTarget) => {
        const absolute = path.join(packageRoot, sourceTarget)
        const relative = toForwardSlashes(path, path.relative(packageRoot, absolute))

        return new PackagePublicEntrypoint({
          packageName: manifest.name,
          releasedVersion: manifest.version,
          subpath,
          sourceFile: new SourceFilePath({
            absolute,
            relative
          })
        })
      }))
  })
