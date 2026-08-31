import { Array as Arr } from "effect"

import { apiExportAnchor } from "./presentation.js"
import { apiPagePath, routeSlug } from "./reflections.js"
import { type ApiSourcePackage } from "./source.js"

export type ApiDocLink = readonly [packageName: string, name: string, href: string]

const canonicalRoutes = (sourcePackage: ApiSourcePackage) =>
  Arr.filterMap(sourcePackage.modules, (module) =>
    Arr.findFirst(module.routes, (route) => route.entrypoint.subpath === module.canonicalSubpath))

export const makeApiDocLinks = (
  sourcePackages: ReadonlyArray<ApiSourcePackage>
): ReadonlyArray<ApiDocLink> => {
  const moduleLinks = Arr.flatMap(sourcePackages, (sourcePackage) =>
    Arr.map(canonicalRoutes(sourcePackage), (route): ApiDocLink => {
      const slug = routeSlug(route.entrypoint.subpath)
      const name = slug.length === 0
        ? sourcePackage.manifest.name
        : slug.split("/").at(-1) ?? slug
      return [
        sourcePackage.manifest.name,
        name,
        apiPagePath(sourcePackage.directoryName, slug)
      ]
    }))
  const symbolLinks = Arr.flatMap(sourcePackages, (sourcePackage) =>
    Arr.flatMap(canonicalRoutes(sourcePackage), (route) => {
      const slug = routeSlug(route.entrypoint.subpath)
      const path = apiPagePath(sourcePackage.directoryName, slug)
      return Arr.map(route.publicExports, (entry): ApiDocLink => [
        sourcePackage.manifest.name,
        entry.exportName,
        `${path}#${apiExportAnchor(entry.exportName)}`
      ])
    }))

  return Arr.appendAll(moduleLinks, symbolLinks)
}
