import { Array as Arr, Option } from "effect"

import { type ApiConvertedPackage } from "./converted.js"
import { documentationPathForExport } from "./documentation-routes.js"
import { apiExportAnchor } from "./presentation.js"
import { apiPagePath, routeSlug } from "./reflections.js"

export type ApiDocLink = readonly [packageName: string, name: string, href: string]

const canonicalModules = (converted: ApiConvertedPackage) =>
  Arr.filterMap(converted.modules, (module) =>
    Option.map(
      Arr.findFirst(module.routes, (route) => route.entrypoint.subpath === module.source.canonicalSubpath),
      (route) => ({ module: module.source, route })
    ))

export const makeApiDocLinks = (
  convertedPackages: ReadonlyArray<ApiConvertedPackage>
): ReadonlyArray<ApiDocLink> => {
  const moduleLinks = Arr.flatMap(
    convertedPackages,
    (converted) =>
      Arr.map(canonicalModules(converted), ({ route }): ApiDocLink => {
        const { sourcePackage } = converted
        const slug = routeSlug(route.entrypoint.subpath)
        const name = slug.length === 0
          ? sourcePackage.manifest.name
          : slug.split("/").at(-1) ?? slug
        return [
          sourcePackage.manifest.name,
          name,
          apiPagePath(sourcePackage.directoryName, slug)
        ]
      })
  )
  const symbolLinks = Arr.flatMap(
    convertedPackages,
    (converted) =>
      Arr.flatMap(canonicalModules(converted), ({ module, route }) => {
        const { sourcePackage } = converted
        return Arr.map(route.publicExports, (entry): ApiDocLink => [
          sourcePackage.manifest.name,
          entry.exportName,
          `${documentationPathForExport({ sourcePackage, module, publicExport: entry })}#${
            apiExportAnchor(entry.exportName)
          }`
        ])
      })
  )

  return Arr.appendAll(moduleLinks, symbolLinks)
}
