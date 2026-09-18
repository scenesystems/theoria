import { Array as Arr, Boolean as Bool, Option, String as Str } from "effect"

import { type ConvertedPackage } from "./conversion.js"
import { documentationPathForExport } from "./documentation-routes.js"
import { apiExportAnchor } from "./presentation.js"
import { apiPagePath, routeSlug } from "./reflections.js"

export type ApiDocLink = readonly [packageName: string, name: string, href: string]

const canonicalModules = (converted: ConvertedPackage) =>
  Arr.filterMap(converted.modules, (module) =>
    Option.map(
      Arr.findFirst(
        module.routes,
        (route) => Str.Equivalence(route.entrypoint.subpath, module.source.canonicalSubpath)
      ),
      (route) => ({ module: module.source, route })
    ))

/** Cross-package link targets, built from the conversion summaries alone so no reflection has to be alive yet. */
export const makeApiDocLinks = (
  convertedPackages: ReadonlyArray<ConvertedPackage>
): ReadonlyArray<ApiDocLink> => {
  const moduleLinks = Arr.flatMap(
    convertedPackages,
    (converted) =>
      Arr.map(canonicalModules(converted), ({ route }): ApiDocLink => {
        const { sourcePackage } = converted
        const slug = routeSlug(route.entrypoint.subpath)
        const name = Bool.match(Str.isEmpty(slug), {
          onTrue: () => sourcePackage.manifest.name,
          onFalse: () => Arr.lastNonEmpty(Str.split(slug, "/"))
        })
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
