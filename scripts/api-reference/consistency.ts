/**
 * Verifies that the browser docs data written by `docs:api` agrees with
 * itself: module indexes match their focused export pages and the manifest's
 * canonical routes, source projections match their owning entrypoint, every
 * authored `{@link}` resolves to an emitted route, and the search index
 * mirrors the presented symbols.
 */

import { Array as Arr, Boolean as Bool, Effect, HashSet, Number as Num, Option, Schema, String as Str } from "effect"

import {
  documentationLinkDiagnostics,
  DocumentationRecord,
  documentationRecords,
  searchIndexDiagnostics
} from "./consistency-rules.js"
import type { DocsData, DocsPage } from "./docs-data.js"
import type { ApiReferenceManifest, ApiReferenceModule, ApiReferenceRoute } from "./model.js"

export class ApiReferenceConsistencyError extends Schema.TaggedError<ApiReferenceConsistencyError>(
  "@theoria/scripts/api-reference/ApiReferenceConsistencyError"
)(
  "ApiReferenceConsistencyError",
  { diagnostics: Schema.Array(Schema.String) }
) {}

const modulesOf = (manifest: ApiReferenceManifest, packageName: string): ReadonlyArray<ApiReferenceModule> =>
  Option.match(Arr.findFirst(manifest.packages, (_) => Str.Equivalence(_.name, packageName)), {
    onNone: Arr.empty,
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
  const canonical = Arr.findFirst(routes, (_) => Bool.and(_.canonical, Str.Equivalence(_.path, index.path)))
  const module = Arr.findFirst(
    modulesOf(manifest, pkg.name),
    (_) => Arr.some(_.routes, (route) => Bool.and(route.canonical, Str.Equivalence(route.path, index.path)))
  )
  const aliases = Option.match(module, {
    onNone: Arr.empty,
    onSome: (_) => Arr.map(Arr.filter(_.routes, (route) => Bool.not(route.canonical)), (route) => route.path)
  })
  const exportDiagnostics = Arr.flatMap(index.exports, (entry, position) => {
    const focused = Arr.get(exports, position)
    const reflected = Option.flatMap(
      canonical,
      (_) =>
        Arr.findFirst(
          _.imports,
          (candidate) =>
            Bool.and(
              Str.Equivalence(candidate.name, entry.name),
              Str.Equivalence(candidate.importKind, entry.importKind)
            )
        )
    )
    return Arr.appendAll(
      Bool.match(
        Option.exists(
          focused,
          (page) =>
            Bool.every(Arr.make(
              Str.Equivalence(entry.id, page.id),
              Str.Equivalence(entry.name, page.name),
              Str.Equivalence(entry.importKind, page.importKind),
              Str.Equivalence(entry.category, page.category),
              Str.Equivalence(entry.since, page.since),
              Str.Equivalence(entry.summary, page.summary)
            ))
        ),
        {
          onTrue: Arr.empty,
          onFalse: () => Arr.make(`${owner}#${entry.name}: focused page mismatch`)
        }
      ),
      Bool.match(
        Option.exists(
          reflected,
          (candidate) =>
            Bool.every(Arr.make(
              Str.Equivalence(candidate.category, entry.category),
              Str.Equivalence(candidate.since, entry.since),
              Option.exists(focused, (page) =>
                Num.Equivalence(Arr.length(candidate.reflections), Arr.length(page.facets)))
            ))
        ),
        {
          onTrue: Arr.empty,
          onFalse: () => Arr.make(`${owner}#${entry.name}: canonical reflection mismatch`)
        }
      )
    )
  })
  const records = Arr.prepend(
    Arr.flatMap(exports, documentationRecords),
    new DocumentationRecord({ owner, docs: index.module.docs })
  )
  return Arr.dedupe(Arr.flatten(Arr.make(
    Bool.match(Option.isNone(canonical), {
      onTrue: () => Arr.make(`${owner}: canonical route is absent`),
      onFalse: Arr.empty
    }),
    Bool.match(
      Option.exists(
        canonical,
        (route) => Bool.not(Num.Equivalence(Arr.length(route.imports), Arr.length(index.exports)))
      ),
      {
        onTrue: () => Arr.make(`${owner}: canonical import count mismatch`),
        onFalse: Arr.empty
      }
    ),
    Bool.match(
      Bool.not(
        Str.Equivalence(
          Arr.join(Arr.sort(aliases, Str.Order), "\u0000"),
          Arr.join(Arr.sort(index.aliases, Str.Order), "\u0000")
        )
      ),
      {
        onTrue: () => Arr.make(`${owner}: alias route mismatch`),
        onFalse: Arr.empty
      }
    ),
    exportDiagnostics,
    documentationLinkDiagnostics(records, targets)
  )))
}

const sourceDiagnostics = (
  manifest: ApiReferenceManifest,
  targets: HashSet.HashSet<string>,
  { pkg, summary, index }: DocsPage
): ReadonlyArray<string> => {
  const owner = `${pkg.name}/${summary.source}`
  const canonical = Arr.findFirst(
    routesOf(manifest, pkg.name),
    (_) => Bool.and(_.canonical, Str.Equivalence(_.subpath, summary.subpath))
  )
  const expected = Option.match(canonical, {
    onNone: Arr.empty,
    onSome: (route) => Arr.filter(route.imports, (entry) => Str.Equivalence(entry.source, summary.source))
  })
  return Arr.dedupe(Arr.flatten(Arr.make(
    Bool.match(Option.isNone(canonical), {
      onTrue: () => Arr.make(`${owner}: owning entrypoint is absent`),
      onFalse: Arr.empty
    }),
    Bool.match(Num.Equivalence(Arr.length(expected), Arr.length(index.exports)), {
      onTrue: Arr.empty,
      onFalse: () => Arr.make(`${owner}: source projection count mismatch`)
    }),
    Arr.flatMap(index.exports, (entry) => {
      const match = Arr.findFirst(
        expected,
        (_) => Bool.and(Str.Equivalence(_.name, entry.name), Str.Equivalence(_.importKind, entry.importKind))
      )
      return Bool.match(
        Option.exists(match, (value) =>
          Bool.and(
            Str.Equivalence(value.category, entry.category),
            Str.Equivalence(value.since, entry.since)
          )),
        {
          onTrue: Arr.empty,
          onFalse: () => Arr.make(`${owner}#${entry.name}: source projection mismatch`)
        }
      )
    }),
    documentationLinkDiagnostics(
      Arr.make(new DocumentationRecord({ owner, docs: index.module.docs })),
      targets
    )
  )))
}

export const checkApiReferenceConsistency = (
  manifest: ApiReferenceManifest,
  { pages, searchIndex }: DocsData
): Effect.Effect<number, ApiReferenceConsistencyError> => {
  const entrypoints = Arr.filter(pages, ({ summary }) => Str.Equivalence(summary.kind, "entrypoint"))
  const sources = Arr.filter(pages, ({ summary }) => Str.Equivalence(summary.kind, "source"))
  const targets = HashSet.fromIterable(
    Arr.flatMap(pages, ({ index }) =>
      Arr.flatMap(Arr.prepend(index.aliases, index.path), (route) =>
        Arr.prepend(
          Arr.map(index.exports, (entry) => `${route}#${entry.anchor}`),
          route
        )))
  )
  const expectedSearch = Arr.flatMap(entrypoints, ({ index, pkg, summary }) =>
    Arr.map(index.exports, (entry) => {
      const projected = Arr.findFirst(sources, (candidate) =>
        Bool.and(
          Str.Equivalence(candidate.pkg.name, pkg.name),
          Arr.some(candidate.index.exports, (_) => Str.Equivalence(_.id, entry.id))
        ))
      return {
        id: entry.id,
        package: pkg.name,
        packageSlug: pkg.slug,
        name: entry.name,
        qualifiedName: `${
          Bool.match(Str.Equivalence(summary.subpath, "."), {
            onTrue: () => pkg.name,
            onFalse: () => `${pkg.name}/${Str.slice(2)(summary.subpath)}`
          })
        }.${entry.name}`,
        category: Option.some(entry.category),
        summary: entry.summary,
        path: Option.match(projected, { onNone: () => index.path, onSome: (_) => _.index.path }),
        anchor: Option.some(entry.anchor)
      }
    }))
  const diagnostics = Arr.flatten(Arr.make(
    Arr.flatMap(entrypoints, (page) => entrypointDiagnostics(manifest, targets, page)),
    Arr.flatMap(sources, (page) => sourceDiagnostics(manifest, targets, page)),
    searchIndexDiagnostics(expectedSearch, searchIndex.entries)
  ))
  return Effect.if(Arr.isNonEmptyReadonlyArray(diagnostics), {
    onTrue: () => Effect.fail(new ApiReferenceConsistencyError({ diagnostics })),
    onFalse: () => Effect.succeed(Arr.length(expectedSearch))
  })
}
