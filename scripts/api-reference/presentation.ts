import { Array as Arr, Boolean as Bool, Data, Option } from "effect"
import * as Str from "effect/String"

import {
  type ApiCategory,
  type ApiDocumentation,
  type ApiExport,
  type ApiPage,
  type DocsSearchEntry
} from "@theoria/docs-model"
import { type ApiReferenceRoute } from "./model.js"

export const apiExportAnchor = (name: string): string => `api-${encodeURIComponent(name)}`

export const apiExportId = (packageSlug: string, routeSlug: string, name: string): string =>
  `${packageSlug}${Bool.match(Str.isEmpty(routeSlug), { onTrue: () => "", onFalse: () => `/${routeSlug}` })}#${name}`

const apiModuleId = (packageSlug: string, routeSlug: string): string =>
  `${packageSlug}${Bool.match(Str.isEmpty(routeSlug), { onTrue: () => "", onFalse: () => `/${routeSlug}` })}`

const moduleName = (packageName: string, slug: string): string =>
  Bool.match(Str.isEmpty(slug), { onTrue: () => packageName, onFalse: () => Arr.lastNonEmpty(Str.split(slug, "/")) })

const qualifiedModuleName = (packageName: string, slug: string): string =>
  Bool.match(Str.isEmpty(slug), { onTrue: () => packageName, onFalse: () => `${packageName}/${slug}` })

const categoriesFor = (
  packageSlug: string,
  route: ApiReferenceRoute
): ReadonlyArray<ApiCategory> =>
  Arr.map(Arr.dedupe(Arr.map(route.imports, (entry) => entry.category)), (category) => ({
    name: category,
    exportIds: Arr.map(
      Arr.filter(route.imports, (entry) => Str.Equivalence(entry.category, category)),
      (entry) => apiExportId(packageSlug, route.slug, entry.name)
    )
  }))

export const categoriesForExports = (
  exports: ReadonlyArray<ApiExport>
): ReadonlyArray<ApiCategory> =>
  Arr.map(Arr.dedupe(Arr.map(exports, (entry) => entry.category)), (category) => ({
    name: category,
    exportIds: Arr.map(
      Arr.filter(exports, (entry) => Str.Equivalence(entry.category, category)),
      (entry) => entry.id
    )
  }))

class ModuleSearchEntryInput extends Data.Class<{
  readonly packageName: string
  readonly packageSlug: string
  readonly route: ApiReferenceRoute
  readonly moduleSummary: string
}> {}

const moduleSearchEntry = (input: ModuleSearchEntryInput): DocsSearchEntry => ({
  id: apiModuleId(input.packageSlug, input.route.slug),
  kind: "module",
  package: input.packageName,
  packageSlug: input.packageSlug,
  name: moduleName(input.packageName, input.route.slug),
  qualifiedName: qualifiedModuleName(input.packageName, input.route.slug),
  category: Option.none(),
  summary: input.moduleSummary,
  path: input.route.path,
  anchor: Option.none()
})

class SymbolSearchEntriesInput extends Data.Class<{
  readonly packageName: string
  readonly packageSlug: string
  readonly route: ApiReferenceRoute
  readonly exports: ReadonlyArray<ApiExport>
}> {}

const symbolSearchEntries = (input: SymbolSearchEntriesInput): ReadonlyArray<DocsSearchEntry> =>
  Arr.map(input.exports, (apiExport) => ({
    id: apiExport.id,
    kind: "symbol",
    package: input.packageName,
    packageSlug: input.packageSlug,
    name: apiExport.name,
    qualifiedName: `${qualifiedModuleName(input.packageName, input.route.slug)}.${apiExport.name}`,
    category: Option.some(apiExport.category),
    summary: apiExport.summary,
    path: input.route.path,
    anchor: Option.some(apiExport.anchor)
  }))

class BuildApiPresentationInput extends Data.Class<{
  readonly packageName: string
  readonly packageVersion: string
  readonly packageSlug: string
  readonly packageDescription: string
  readonly moduleSource: string
  readonly moduleSourceUrl: string
  readonly moduleDocs: ApiDocumentation
  readonly moduleSummary: string
  readonly moduleSince: string
  readonly canonicalPath: string
  readonly routes: ReadonlyArray<ApiReferenceRoute>
  readonly exportsByRoute: ReadonlyArray<ReadonlyArray<ApiExport>>
}> {}

export const buildApiPresentation = (input: BuildApiPresentationInput) => {
  const aliases = Arr.map(
    Arr.filter(input.routes, (route) => Bool.not(route.canonical)),
    (route) => route.path
  )
  const pages: ReadonlyArray<ApiPage> = Arr.map(Arr.zip(input.routes, input.exportsByRoute), ([route, exports]) => ({
    schemaVersion: 2,
    kind: "api-module",
    path: route.path,
    canonical: route.canonical,
    canonicalPath: input.canonicalPath,
    aliases,
    package: {
      name: input.packageName,
      version: input.packageVersion,
      slug: input.packageSlug,
      description: input.packageDescription
    },
    module: {
      kind: "entrypoint",
      name: moduleName(input.packageName, route.slug),
      subpath: route.subpath,
      slug: route.slug,
      source: input.moduleSource,
      docs: input.moduleDocs,
      since: input.moduleSince,
      sourceUrl: input.moduleSourceUrl
    },
    categories: categoriesFor(input.packageSlug, route),
    exports
  }))
  const searchEntries = Arr.flatMap(
    Arr.zip(input.routes, input.exportsByRoute),
    ([route, exports]): ReadonlyArray<DocsSearchEntry> =>
      Bool.match(route.canonical, {
        onTrue: () =>
          Arr.prepend(
            symbolSearchEntries({
              packageName: input.packageName,
              packageSlug: input.packageSlug,
              route,
              exports
            }),
            moduleSearchEntry({
              packageName: input.packageName,
              packageSlug: input.packageSlug,
              route,
              moduleSummary: input.moduleSummary
            })
          ),
        onFalse: Arr.empty
      })
  )

  return { pages, searchEntries }
}
