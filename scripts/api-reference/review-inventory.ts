import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, HashMap, HashSet, Option, Schema, String as Str } from "effect"
import type { DocsApiModuleIndex, DocsManifest, DocsSearchIndex } from "@theoria/docs-model"
import {
  DocsApiExportPageJson,
  DocsApiModuleIndexJson,
  DocsManifestJson,
  DocsSearchIndexJson
} from "@theoria/docs-model"

import { ApiReferenceManifestJson } from "./model.js"
import {
  addCounts,
  docsCounts,
  documentationDiagnostics,
  documentationRecords,
  exampleRecords,
  exportCounts,
  searchIndexDiagnostics,
  semanticExport,
  semanticHash,
  zeroCounts
} from "./review-content.js"
import { type Inventory, ReviewInventoryJson } from "./review-model.js"
import { exportDiagnostics, proseDiagnostic, unprojectedDuplicateGroups } from "./review-rules.js"

const assetPath = (dataRoot: string, asset: string): string =>
  `${dataRoot}/${asset.replace(/^\/docs-data\/[^/]+\//u, "")}`

export const buildInventory = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const source = yield* fs.readFileString("api-reference/manifest.json")
  const manifest = yield* Schema.decodeUnknown(ApiReferenceManifestJson)(source)
  const dataRoot = path.join("apps/theoria/public/docs-data", manifest.revision)
  const docsManifest: DocsManifest = yield* fs.readFileString("apps/theoria/public/docs-data/manifest.json").pipe(
    Effect.flatMap(Schema.decodeUnknown(DocsManifestJson)))
  const searchIndex: DocsSearchIndex = yield* fs.readFileString(
    assetPath(dataRoot, docsManifest.searchIndexAsset)
  ).pipe(Effect.flatMap(Schema.decodeUnknown(DocsSearchIndexJson)))
  const loaded = yield* Effect.forEach(docsManifest.packages, (pkg) => Effect.forEach(
    pkg.apiModules,
    (summary) => Effect.gen(function*() {
      const index: DocsApiModuleIndex = yield* fs.readFileString(assetPath(dataRoot, summary.asset)).pipe(
        Effect.flatMap(Schema.decodeUnknown(DocsApiModuleIndexJson)))
      const pages = yield* Effect.forEach(index.exports, (entry) =>
        fs.readFileString(assetPath(dataRoot, entry.asset)).pipe(
          Effect.flatMap(Schema.decodeUnknown(DocsApiExportPageJson))))
      return { pkg, summary, index, exports: Arr.map(pages, (_) => _.export) }
    }),
    { concurrency: 8 }
  ), { concurrency: 8 }).pipe(Effect.map(Arr.flatten))
  const targets = HashSet.fromIterable(Arr.flatMap(loaded, ({ index }) => {
    const routes = [index.path, ...index.aliases]
    return Arr.flatMap(routes, (route) => [
      route,
      ...Arr.map(index.exports, (entry) => `${route}#${entry.anchor}`)
    ])
  }))
  const units = yield* Effect.forEach(loaded, ({ pkg, summary, index, exports }) => Effect.gen(function*() {
    const sourcePackage = Arr.findFirst(manifest.packages, (_) => _.name === pkg.name)
    const sourceModule = Option.flatMap(sourcePackage, (_) => Arr.findFirst(_.modules, (module) =>
      Arr.some(module.routes, (route) => route.canonical && route.path === index.path)))
    const sourceRoutes = Option.match(sourceModule, { onNone: () => [], onSome: (_) => _.routes })
    const canonicalRoute = Arr.findFirst(sourceRoutes, (_) => _.canonical && _.path === index.path)
    const sourceAliases = Arr.map(Arr.filter(sourceRoutes, (_) => !_.canonical), (_) => _.path)
    const metadata = Arr.flatMap(index.exports, (entry, position) => {
      const focused = exports[position]
      const reflected = Option.flatMap(canonicalRoute, (_) => Arr.findFirst(_.imports, (candidate) =>
        candidate.name === entry.name && candidate.importKind === entry.importKind))
      return [
        ...(focused === undefined || entry.id !== focused.id || entry.name !== focused.name ||
          entry.importKind !== focused.importKind || entry.category !== focused.category ||
          entry.since !== focused.since || entry.summary !== focused.summary
          ? [`${pkg.name}/${summary.subpath}#${entry.name}: focused page mismatch`] : []),
        ...(Option.isNone(reflected) || reflected.value.category !== entry.category ||
          reflected.value.since !== entry.since || reflected.value.reflections.length !== focused?.facets.length
          ? [`${pkg.name}/${summary.subpath}#${entry.name}: canonical reflection mismatch`] : [])
      ]
    })
    const routeDiagnostics = [
      ...(Option.isNone(canonicalRoute) ? [`${pkg.name}/${summary.subpath}: canonical route is absent`] : []),
      ...(Option.isSome(canonicalRoute) && canonicalRoute.value.imports.length !== index.exports.length
        ? [`${pkg.name}/${summary.subpath}: canonical import count mismatch`] : []),
      ...(Arr.sort(sourceAliases, Str.Order).join("\u0000") !== Arr.sort(index.aliases, Str.Order).join("\u0000")
        ? [`${pkg.name}/${summary.subpath}: alias route mismatch`] : [])
    ]
    const records = [
      { owner: `${pkg.name}/${summary.subpath}`, docs: index.module.docs },
      ...Arr.flatMap(exports, documentationRecords)
    ]
    const authored = [
      ...documentationDiagnostics(records, targets),
      ...Arr.flatMap(exports, (entry) => [
        ...exportDiagnostics(entry.id, entry),
        ...Arr.filterMap([entry.summary], (text) => Option.fromNullable(proseDiagnostic(entry.id, text)))
      ])
    ]
    const counts = addCounts(Arr.reduce(Arr.map(exports, exportCounts), {
      ...zeroCounts(),
      modules: 1,
      routes: 1 + index.aliases.length,
      projections: Arr.reduce(sourceRoutes, 0, (count, route) => count + route.imports.length),
      categories: index.categories.length
    }, addCounts), docsCounts([index.module.docs]))
    const encoded = yield* Schema.encode(Schema.parseJson(Schema.Unknown))({
      module: { subpath: summary.subpath, docs: index.module.docs, since: index.module.since },
      exports: Arr.map(exports, semanticExport)
    })
    return {
      package: pkg.name,
      module: summary.subpath,
      counts,
      semanticHash: semanticHash(encoded),
      diagnostics: Arr.dedupe([...metadata, ...routeDiagnostics, ...authored]),
      summaries: Arr.map(exports, (_) => ({
        owner: _.id,
        summary: _.summary,
        sources: Arr.map(_.facets, (facet) => facet.sourceUrl)
      })),
      examples: exampleRecords(pkg.name, records)
    }
  }), { concurrency: 8 })
  const expectedSearch = Arr.flatMap(loaded, ({ index, pkg, summary }) => Arr.map(index.exports, (entry) => ({
    id: entry.id,
    package: pkg.name,
    packageSlug: pkg.slug,
    name: entry.name,
    qualifiedName: `${summary.subpath === "." ? pkg.name : `${pkg.name}/${summary.subpath.slice(2)}`}.${entry.name}`,
    category: entry.category,
    summary: entry.summary,
    path: index.path,
    anchor: entry.anchor
  })))
  const searchDiagnostics = searchIndexDiagnostics(expectedSearch, searchIndex.entries)
  const publicUnits = Arr.map(units, ({ diagnostics: _, summaries: __, examples: ___, ...unit }) => unit)
  const totals = Arr.reduce(publicUnits, { ...zeroCounts(), packages: docsManifest.packages.length },
    (sum, unit) => addCounts(sum, unit.counts))
  const inventory: Inventory = {
    format: "theoria-api-review-inventory-v1",
    revision: manifest.revision,
    totals,
    units: publicUnits,
    diagnostics: [...Arr.flatMap(units, (_) => _.diagnostics), ...searchDiagnostics]
  }
  yield* fs.makeDirectory("api-reference", { recursive: true })
  const output = yield* Schema.encode(ReviewInventoryJson)(inventory)
  yield* fs.writeFileString("api-reference/review-inventory.json", `${output}\n`)
  const importPaths = HashMap.fromIterable(Arr.flatMap(manifest.packages, (pkg) =>
    Arr.flatMap(pkg.modules, (module) => Arr.map(module.routes, (route) => [
      route.subpath === "." ? pkg.name : `${pkg.name}${route.subpath.slice(1)}`,
      path.resolve("packages", pkg.slug, module.source)
    ]))))
  return {
    inventory,
    duplicates: unprojectedDuplicateGroups(Arr.flatMap(units, (_) => _.summaries)),
    examples: Arr.flatMap(units, (_) => _.examples),
    importPaths
  }
})
