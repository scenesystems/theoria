import { Array as Arr, Option, Order } from "effect"

import { type PackagePublicExport } from "./public-exports.js"
import { apiPagePath, routeSlug } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage, type SourceFilePath, sourceModuleSubpath } from "./source.js"

export const hasSourceDocumentationPages = (
  sourcePackage: ApiSourcePackage,
  module: ApiSourceModule
): boolean =>
  sourcePackage.modules.length === 1
  && module.canonicalSubpath === "."
  && module.routes.length === 1
  && module.routes[0]?.entrypoint.subpath === "."

export const sourceDocumentationSlug = (relativeSource: string): string =>
  routeSlug(sourceModuleSubpath(relativeSource))

// Every source file other than the entrypoint that contributes a public export
// gets its own page, in path order.
export const sourceDocumentationFiles = (
  module: ApiSourceModule,
  publicExports: ReadonlyArray<PackagePublicExport>
): ReadonlyArray<SourceFilePath> => {
  const contributing: ReadonlyArray<SourceFilePath> = Arr.filterMap(
    publicExports,
    (entry) => entry.sourceFile.relative === module.relative ? Option.none() : Option.some(entry.sourceFile)
  )
  const distinct = Arr.dedupeWith(contributing, (left, right) => left.relative === right.relative)

  return Arr.sort(distinct, Order.mapInput(Order.string, (file: SourceFilePath) => file.relative))
}

export const documentationPathForExport = (input: {
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiSourceModule
  readonly publicExport: PackagePublicExport
}): string => {
  const routePath = apiPagePath(
    input.sourcePackage.directoryName,
    routeSlug(input.publicExport.subpath)
  )

  return hasSourceDocumentationPages(input.sourcePackage, input.module)
      && input.publicExport.sourceFile.relative !== input.module.relative
    ? apiPagePath(
      input.sourcePackage.directoryName,
      sourceDocumentationSlug(input.publicExport.sourceFile.relative)
    )
    : routePath
}
