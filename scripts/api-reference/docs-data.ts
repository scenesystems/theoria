/**
 * Reads the browser docs data written by `docs:api` back into memory so the
 * post-generation checks can verify what was actually emitted.
 */

import { FileSystem, Path } from "@effect/platform"
import {
  type ApiExport,
  DocsApiExportPageJson,
  type DocsApiModuleIndex,
  DocsApiModuleIndexJson,
  type DocsApiModuleSummary,
  type DocsManifest,
  DocsManifestJson,
  type DocsSearchIndex,
  DocsSearchIndexJson
} from "@theoria/docs-model"
import { Array as Arr, Effect, Schema } from "effect"

export type DocsPage = {
  readonly pkg: DocsManifest["packages"][number]
  readonly summary: DocsApiModuleSummary
  readonly index: DocsApiModuleIndex
  readonly exports: ReadonlyArray<ApiExport>
}

export type DocsData = {
  readonly searchIndex: DocsSearchIndex
  readonly pages: ReadonlyArray<DocsPage>
}

const decodeFile = <A, I>(schema: Schema.Schema<A, I>, file: string) =>
  Effect.flatMap(
    FileSystem.FileSystem,
    (fs) => fs.readFileString(file).pipe(Effect.flatMap(Schema.decodeUnknown(schema)), Effect.orDie)
  )

export const loadDocsData = (
  browserOutputRoot: string
): Effect.Effect<DocsData, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const docsManifest = yield* decodeFile(DocsManifestJson, path.join(browserOutputRoot, "manifest.json"))
    const assetFile = (asset: string) => path.join(browserOutputRoot, asset.replace(/^\/docs-data\//u, ""))
    const searchIndex = yield* decodeFile(DocsSearchIndexJson, assetFile(docsManifest.searchIndexAsset))
    const pages: ReadonlyArray<DocsPage> = yield* Effect.forEach(docsManifest.packages, (pkg) =>
      Effect.forEach(pkg.apiModules, (summary) =>
        Effect.gen(function*() {
          const index = yield* decodeFile(DocsApiModuleIndexJson, assetFile(summary.asset))
          const exports = yield* Effect.forEach(
            index.exports,
            (entry) =>
              decodeFile(DocsApiExportPageJson, assetFile(entry.asset)).pipe(Effect.map((_) => _.export))
          )
          return { pkg, summary, index, exports }
        }), { concurrency: 8 }), { concurrency: 8 }).pipe(Effect.map(Arr.flatten))
    return { searchIndex, pages }
  })
