import { type PackagePublicExport } from "./public-exports.js"
import { apiPagePath, routeSlug } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage, sourceModuleSubpath } from "./source.js"

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
