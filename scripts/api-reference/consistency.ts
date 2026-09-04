/**
 * Verifies that the browser docs data written by `docs:api` agrees with
 * itself: module indexes match their focused export pages and the manifest's
 * canonical routes, source projections match their owning entrypoint, every
 * authored `{@link}` resolves to an emitted route, and the search index
 * mirrors the presented symbols.
 */

import { Array as Arr, Effect, HashSet, Option, Schema, String as Str } from "effect"

import { documentationLinkDiagnostics, documentationRecords, searchIndexDiagnostics } from "./consistency-rules.js"
import type { DocsData, DocsPage } from "./docs-data.js"
import type { ApiReferenceManifest, ApiReferenceModule, ApiReferenceRoute } from "./model.js"

export class ApiReferenceConsistencyError extends Schema.TaggedError<ApiReferenceConsistencyError>()(
  "ApiReferenceConsistencyError",
  { diagnostics: Schema.Array(Schema.String) }
) {}

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
  { pkg, summary, index, exports }: DocsPage
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
  { pkg, summary, index }: DocsPage
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

export const checkApiReferenceConsistency = (
  manifest: ApiReferenceManifest,
  { pages, searchIndex }: DocsData
): Effect.Effect<number, ApiReferenceConsistencyError> => {
  const entrypoints = Arr.filter(pages, ({ summary }) => summary.kind === "entrypoint")
  const sources = Arr.filter(pages, ({ summary }) => summary.kind === "source")
  const targets = HashSet.fromIterable(
    Arr.flatMap(pages, ({ index }) =>
      Arr.flatMap([index.path, ...index.aliases], (route) => [
        route,
        ...Arr.map(index.exports, (entry) => `${route}#${entry.anchor}`)
      ]))
  )
  const expectedSearch = Arr.flatMap(entrypoints, ({ index, pkg, summary }) =>
    Arr.map(index.exports, (entry) => {
      const projected = Arr.findFirst(sources, (candidate) =>
        candidate.pkg.name === pkg.name && Arr.some(candidate.index.exports, (_) => _.id === entry.id))
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
    ...Arr.flatMap(entrypoints, (page) => entrypointDiagnostics(manifest, targets, page)),
    ...Arr.flatMap(sources, (page) => sourceDiagnostics(manifest, targets, page)),
    ...searchIndexDiagnostics(expectedSearch, searchIndex.entries)
  ]
  return Arr.isNonEmptyReadonlyArray(diagnostics)
    ? Effect.fail(new ApiReferenceConsistencyError({ diagnostics }))
    : Effect.succeed(expectedSearch.length)
}
