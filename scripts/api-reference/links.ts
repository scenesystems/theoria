import { Array as Arr, Option } from "effect"

import { documentationPathForExport } from "./documentation-routes.js"
import { apiExportAnchor } from "./presentation.js"
import { apiPagePath, routeSlug } from "./reflections.js"
import { type ApiSourcePackage } from "./source.js"

export type ApiDocLink = readonly [packageName: string, name: string, href: string]

const canonicalModules = (sourcePackage: ApiSourcePackage) =>
  Arr.filterMap(sourcePackage.modules, (module) =>
    Option.map(
      Arr.findFirst(module.routes, (route) => route.entrypoint.subpath === module.canonicalSubpath),
      (route) => ({ module, route })
    ))

export const makeApiDocLinks = (
  sourcePackages: ReadonlyArray<ApiSourcePackage>
): ReadonlyArray<ApiDocLink> => {
  const moduleLinks = Arr.flatMap(sourcePackages, (sourcePackage) =>
    Arr.map(canonicalModules(sourcePackage), ({ route }): ApiDocLink => {
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
    Arr.flatMap(canonicalModules(sourcePackage), ({ module, route }) => {
      return Arr.map(route.publicExports, (entry): ApiDocLink => [
        sourcePackage.manifest.name,
        entry.exportName,
        `${documentationPathForExport({ sourcePackage, module, publicExport: entry })}#${
          apiExportAnchor(entry.exportName)
        }`
      ])
    }))

  return Arr.appendAll(moduleLinks, symbolLinks)
}
