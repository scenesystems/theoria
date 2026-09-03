import { Array as Arr } from "effect"

import { type ApiReferenceRoute } from "./model.js"
import {
  type ApiCategory,
  type ApiDocumentation,
  type ApiExport,
  type ApiPage,
  type DocsSearchEntry
} from "@theoria/docs-model"

export const apiExportAnchor = (name: string): string => `api-${encodeURIComponent(name)}`

export const apiExportId = (packageSlug: string, routeSlug: string, name: string): string =>
  `${packageSlug}${routeSlug.length === 0 ? "" : `/${routeSlug}`}#${name}`

const apiModuleId = (packageSlug: string, routeSlug: string): string =>
  `${packageSlug}${routeSlug.length === 0 ? "" : `/${routeSlug}`}`

const moduleName = (packageName: string, slug: string): string =>
  slug.length === 0 ? packageName : slug.split("/").at(-1) ?? slug

const qualifiedModuleName = (packageName: string, slug: string): string =>
  slug.length === 0 ? packageName : `${packageName}/${slug}`

const categoriesFor = (
  packageSlug: string,
  route: ApiReferenceRoute
): ReadonlyArray<ApiCategory> =>
  Arr.map(Arr.dedupe(Arr.map(route.imports, (entry) => entry.category)), (category) => ({
    name: category,
    exportIds: Arr.map(
      Arr.filter(route.imports, (entry) => entry.category === category),
      (entry) => apiExportId(packageSlug, route.slug, entry.name)
    )
  }))

export const categoriesForExports = (
  exports: ReadonlyArray<ApiExport>
): ReadonlyArray<ApiCategory> =>
  Arr.map(Arr.dedupe(Arr.map(exports, (entry) => entry.category)), (category) => ({
    name: category,
    exportIds: Arr.map(
      Arr.filter(exports, (entry) => entry.category === category),
      (entry) => entry.id
    )
  }))

const moduleSearchEntry = (input: {
  readonly packageName: string
  readonly packageSlug: string
  readonly route: ApiReferenceRoute
  readonly moduleSummary: string
}): DocsSearchEntry => ({
  id: apiModuleId(input.packageSlug, input.route.slug),
  kind: "module",
  package: input.packageName,
  packageSlug: input.packageSlug,
  name: moduleName(input.packageName, input.route.slug),
  qualifiedName: qualifiedModuleName(input.packageName, input.route.slug),
  category: null,
  summary: input.moduleSummary,
  path: input.route.path,
  anchor: null
})

const symbolSearchEntries = (input: {
  readonly packageName: string
  readonly packageSlug: string
  readonly route: ApiReferenceRoute
  readonly exports: ReadonlyArray<ApiExport>
}): ReadonlyArray<DocsSearchEntry> =>
  Arr.map(input.exports, (apiExport) => ({
    id: apiExport.id,
    kind: "symbol",
    package: input.packageName,
    packageSlug: input.packageSlug,
    name: apiExport.name,
    qualifiedName: `${qualifiedModuleName(input.packageName, input.route.slug)}.${apiExport.name}`,
    category: apiExport.category,
    summary: apiExport.summary,
    path: input.route.path,
    anchor: apiExport.anchor
  }))

export const buildApiPresentation = (input: {
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
}) => {
  const aliases = Arr.map(
    Arr.filter(input.routes, (route) => !route.canonical),
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
    ([route, exports]): ReadonlyArray<DocsSearchEntry> => route.canonical ? [
      moduleSearchEntry({
        packageName: input.packageName,
        packageSlug: input.packageSlug,
        route,
        moduleSummary: input.moduleSummary
      }),
      ...symbolSearchEntries({
        packageName: input.packageName,
        packageSlug: input.packageSlug,
        route,
        exports
      })
    ] : []
  )

  return { pages, searchEntries }
}
