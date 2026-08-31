import { Array as Arr } from "effect"

import { type ApiReferenceRoute } from "./model.js"
import {
  type ApiCategory,
  type ApiDocumentation,
  type ApiExport,
  type ApiPage,
  type ApiSearchEntry
} from "./presentation-model.js"

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

const moduleSearchEntry = (input: {
  readonly packageName: string
  readonly packageSlug: string
  readonly route: ApiReferenceRoute
  readonly moduleSummary: string
}): ApiSearchEntry => ({
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
}): ReadonlyArray<ApiSearchEntry> =>
  Arr.map(input.route.imports, (entry) => ({
    id: apiExportId(input.packageSlug, input.route.slug, entry.name),
    kind: "symbol",
    package: input.packageName,
    packageSlug: input.packageSlug,
    name: entry.name,
    qualifiedName: `${qualifiedModuleName(input.packageName, input.route.slug)}.${entry.name}`,
    category: entry.category,
    summary: entry.summary,
    path: input.route.path,
    anchor: apiExportAnchor(entry.name)
  }))

export const buildApiPresentation = (input: {
  readonly packageName: string
  readonly packageVersion: string
  readonly packageSlug: string
  readonly packageDescription: string
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
  const pages: ReadonlyArray<ApiPage> = Arr.map(input.routes, (route, index) => ({
    schemaVersion: 1,
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
      name: moduleName(input.packageName, route.slug),
      subpath: route.subpath,
      slug: route.slug,
      docs: input.moduleDocs,
      since: input.moduleSince,
      sourceUrl: input.moduleSourceUrl
    },
    categories: categoriesFor(input.packageSlug, route),
    exports: input.exportsByRoute[index] ?? []
  }))
  const searchEntries = Arr.flatMap(
    input.routes,
    (route): ReadonlyArray<ApiSearchEntry> => route.canonical ? [
      moduleSearchEntry({
        packageName: input.packageName,
        packageSlug: input.packageSlug,
        route,
        moduleSummary: input.moduleSummary
      }),
      ...symbolSearchEntries({
        packageName: input.packageName,
        packageSlug: input.packageSlug,
        route
      })
    ] : []
  )

  return { pages, searchEntries }
}
