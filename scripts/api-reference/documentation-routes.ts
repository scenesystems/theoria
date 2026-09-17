import { Array as Arr, Boolean as Bool, Number as Num, Option, Order, String as Str } from "effect"

import { type PackagePublicExport } from "./public-exports.js"
import { apiPagePath, routeSlug } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage, type SourceFilePath, sourceModuleSubpath } from "./source.js"

export const hasSourceDocumentationPages = (
  sourcePackage: ApiSourcePackage,
  module: ApiSourceModule
): boolean =>
  Bool.every(Arr.make(
    Num.Equivalence(Arr.length(sourcePackage.modules), 1),
    Str.Equivalence(module.canonicalSubpath, "."),
    Num.Equivalence(Arr.length(module.routes), 1),
    Option.exists(Arr.head(module.routes), (route) => Str.Equivalence(route.entrypoint.subpath, "."))
  ))

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
    (entry) =>
      Bool.match(Str.Equivalence(entry.sourceFile.relative, module.relative), {
        onTrue: Option.none,
        onFalse: () => Option.some(entry.sourceFile)
      })
  )
  const distinct = Arr.dedupeWith(contributing, (left, right) => Str.Equivalence(left.relative, right.relative))

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

  return Bool.match(
    Bool.and(
      hasSourceDocumentationPages(input.sourcePackage, input.module),
      Bool.not(Str.Equivalence(input.publicExport.sourceFile.relative, input.module.relative))
    ),
    {
      onTrue: () =>
        apiPagePath(
          input.sourcePackage.directoryName,
          sourceDocumentationSlug(input.publicExport.sourceFile.relative)
        ),
      onFalse: () => routePath
    }
  )
}
