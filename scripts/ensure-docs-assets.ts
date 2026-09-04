import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type { PlatformError } from "@effect/platform/Error"
import { Array as Arr, Console, Effect, Schema } from "effect"

import { DocsManifestJson } from "@theoria/docs-model"

const docsAssetPrefix = "/docs-data/"

const isNotFound = (error: PlatformError): boolean => error._tag === "SystemError" && error.reason === "NotFound"

/**
 * Whether every asset the manifest names is on disk. A manifest that is absent
 * or no longer decodes as the current schema means the assets need regenerating;
 * a filesystem that cannot be read is a failure of this script.
 */
const docsAssetsAreCurrent = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const repositoryRoot = yield* Effect.flatMap(
    Url.fromString("../", import.meta.url).pipe(Effect.orDie),
    path.fromFileUrl
  )
  const outputRoot = path.join(repositoryRoot, "apps", "theoria", "public", "docs-data")
  const manifestText = yield* fileSystem.readFileString(path.join(outputRoot, "manifest.json"))
  const manifest = yield* Schema.decode(DocsManifestJson)(manifestText)
  const assets = [
    manifest.searchIndexAsset,
    ...Arr.flatMap(manifest.packages, (docsPackage) => [
      docsPackage.overview.asset,
      ...Arr.map(docsPackage.guides, (guide) => guide.asset),
      ...Arr.map(docsPackage.apiModules, (apiModule) => apiModule.asset)
    ])
  ]
  const existing = yield* Effect.forEach(
    assets,
    (asset) => fileSystem.exists(path.join(outputRoot, asset.slice(docsAssetPrefix.length))),
    { concurrency: 32 }
  )

  return Arr.every(existing, (exists) => exists)
}).pipe(
  Effect.catchTag("ParseError", () => Effect.succeed(false)),
  Effect.catchIf(isNotFound, () => Effect.succeed(false))
)

const program = Effect.flatMap(docsAssetsAreCurrent, (current) =>
  current
    ? Console.log("Documentation assets are current.")
    : Effect.promise(() => import("./api-reference-program.js")).pipe(
      Effect.flatMap(({ apiReferenceProgram }) => apiReferenceProgram)
    ))

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
