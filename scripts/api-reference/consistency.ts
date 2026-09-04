/**
 * Verifies that the browser docs data written by `docs:api` agrees with
 * itself: module indexes match their focused export pages and the manifest's
 * canonical routes, source projections match their owning entrypoint, every
 * authored `{@link}` resolves to an emitted route, and the search index
 * mirrors the presented symbols.
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
  DocsSearchIndexJson
} from "@theoria/docs-model"
import { Array as Arr, Effect, HashSet, Option, Schema, String as Str } from "effect"

import { documentationLinkDiagnostics, documentationRecords, searchIndexDiagnostics } from "./consistency-rules.js"
import type { ApiReferenceManifest, ApiReferenceModule, ApiReferenceRoute } from "./model.js"

export class ApiReferenceConsistencyError extends Schema.TaggedError<ApiReferenceConsistencyError>()(
  "ApiReferenceConsistencyError",
  { diagnostics: Schema.Array(Schema.String) }
) {}

const decodeFile = <A, I>(schema: Schema.Schema<A, I>, file: string) =>
  Effect.flatMap(
    FileSystem.FileSystem,
    (fs) => fs.readFileString(file).pipe(Effect.flatMap(Schema.decodeUnknown(schema)), Effect.orDie)
  )

type LoadedPage = {
  readonly pkg: DocsManifest["packages"][number]
  readonly summary: DocsApiModuleSummary
  readonly index: DocsApiModuleIndex
  readonly exports: ReadonlyArray<ApiExport>
}

const loadPages = (browserOutputRoot: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const docsManifest = yield* decodeFile(DocsManifestJson, path.join(browserOutputRoot, "manifest.json"))
    const assetFile = (asset: string) => path.join(browserOutputRoot, asset.replace(/^\/docs-data\//u, ""))
    const searchIndex = yield* decodeFile(DocsSearchIndexJson, assetFile(docsManifest.searchIndexAsset))
    const pages: ReadonlyArray<LoadedPage> = yield* Effect.forEach(docsManifest.packages, (pkg) =>
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

const modulesOf = (manifest: ApiReferenceManifest, packageName: string): ReadonlyArray<ApiReferenceModule> =>
  Option.match(Arr.findFirst(manifest.packages, (_) => _.name === packageName), {
    onNone: () => [],
    onSome: (pkg) => pkg.modules
  })

const routesOf = (manifest: ApiReferenceManifest, packageName: string): ReadonlyArray<ApiReferenceRoute> =>
  Arr.flatMap(modulesOf(manifest, packageName), (module) => module.routes)

const entrypointDiagnostics = (
  manifest: ApiReferenceManifest,
  targets: HashSet.HashSet<string>,
  { pkg, summary, index, exports }: LoadedPage
): ReadonlyArray<string> => {
  const owner = `${pkg.name}/${summary.subpath}`
  const routes = routesOf(manifest, pkg.name)
  const canonical = Arr.findFirst(routes, (_) => _.canonical && _.path === index.path)
  const module = Arr.findFirst(
    modulesOf(manifest, pkg.name),
    (_) => Arr.some(_.routes, (route) => route.canonical && route.path === index.path)
  )
  const aliases = Option.match(module, {
    onNone: () => [],
    onSome: (_) => Arr.map(Arr.filter(_.routes, (route) => !route.canonical), (route) => route.path)
  })
  const exportDiagnostics = Arr.flatMap(index.exports, (entry, position) => {
    const focused = exports[position]
    const reflected = Option.flatMap(
      canonical,
      (_) =>
        Arr.findFirst(
          _.imports,
          (candidate) => candidate.name === entry.name && candidate.importKind === entry.importKind
        )
    )
    return [
      ...(focused === undefined || entry.id !== focused.id || entry.name !== focused.name ||
          entry.importKind !== focused.importKind || entry.category !== focused.category ||
          entry.since !== focused.since || entry.summary !== focused.summary
        ? [`${owner}#${entry.name}: focused page mismatch`]
        : []),
      ...(Option.isNone(reflected) || reflected.value.category !== entry.category ||
          reflected.value.since !== entry.since || reflected.value.reflections.length !== focused?.facets.length
        ? [`${owner}#${entry.name}: canonical reflection mismatch`]
        : [])
    ]
  })
  const records = [{ owner, docs: index.module.docs }, ...Arr.flatMap(exports, documentationRecords)]
  return Arr.dedupe([
    ...(Option.isNone(canonical) ? [`${owner}: canonical route is absent`] : []),
    ...(Option.isSome(canonical) && canonical.value.imports.length !== index.exports.length
      ? [`${owner}: canonical import count mismatch`]
      : []),
    ...(Arr.sort(aliases, Str.Order).join("\u0000") !== Arr.sort(index.aliases, Str.Order).join("\u0000")
      ? [`${owner}: alias route mismatch`]
      : []),
    ...exportDiagnostics,
    ...documentationLinkDiagnostics(records, targets)
  ])
}

const sourceDiagnostics = (
  manifest: ApiReferenceManifest,
  targets: HashSet.HashSet<string>,
  { pkg, summary, index }: LoadedPage
): ReadonlyArray<string> => {
  const owner = `${pkg.name}/${summary.source}`
  const canonical = Arr.findFirst(routesOf(manifest, pkg.name), (_) => _.canonical && _.subpath === summary.subpath)
  const expected = Option.match(canonical, {
    onNone: () => [],
    onSome: (route) => Arr.filter(route.imports, (entry) => entry.source === summary.source)
  })
  return Arr.dedupe([
    ...(Option.isNone(canonical) ? [`${owner}: owning entrypoint is absent`] : []),
    ...(expected.length !== index.exports.length ? [`${owner}: source projection count mismatch`] : []),
    ...Arr.flatMap(index.exports, (entry) => {
      const match = Arr.findFirst(expected, (_) => _.name === entry.name && _.importKind === entry.importKind)
      return Option.isSome(match) && match.value.category === entry.category && match.value.since === entry.since
        ? []
        : [`${owner}#${entry.name}: source projection mismatch`]
    }),
    ...documentationLinkDiagnostics([{ owner, docs: index.module.docs }], targets)
  ])
}

export const checkApiReferenceConsistency = (input: {
  readonly manifest: ApiReferenceManifest
  readonly browserOutputRoot: string
}): Effect.Effect<number, ApiReferenceConsistencyError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const { pages, searchIndex } = yield* loadPages(input.browserOutputRoot)
    const entrypoints = Arr.filter(pages, ({ summary }) => summary.kind === "entrypoint")
    const sources = Arr.filter(pages, ({ summary }) => summary.kind === "source")
    const targets = HashSet.fromIterable(Arr.flatMap(pages, ({ index }) =>
      Arr.flatMap([index.path, ...index.aliases], (route) => [
        route,
        ...Arr.map(index.exports, (entry) => `${route}#${entry.anchor}`)
      ])))
    const expectedSearch = Arr.flatMap(entrypoints, ({ index, pkg, summary }) =>
      Arr.map(index.exports, (entry) => {
        const projected = Arr.findFirst(sources, (candidate) =>
          candidate.pkg.name === pkg.name && Arr.some(candidate.index.exports, (_) =>
            _.id === entry.id))
        return {
          id: entry.id,
          package: pkg.name,
          packageSlug: pkg.slug,
          name: entry.name,
          qualifiedName: `${
            summary.subpath === "." ? pkg.name : `${pkg.name}/${summary.subpath.slice(2)}`
          }.${entry.name}`,
          category: entry.category,
          summary: entry.summary,
          path: Option.match(projected, { onNone: () => index.path, onSome: (_) => _.index.path }),
          anchor: entry.anchor
        }
      }))
    const diagnostics = [
      ...Arr.flatMap(entrypoints, (page) => entrypointDiagnostics(input.manifest, targets, page)),
      ...Arr.flatMap(sources, (page) => sourceDiagnostics(input.manifest, targets, page)),
      ...searchIndexDiagnostics(expectedSearch, searchIndex.entries)
    ]
    if (Arr.isNonEmptyReadonlyArray(diagnostics)) {
      return yield* new ApiReferenceConsistencyError({ diagnostics })
    }
    return expectedSearch.length
  })
