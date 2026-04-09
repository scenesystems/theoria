import { Schema } from "effect"

import {
  type PackageDocsBundle,
  PackageDocsBundleSchema,
  PackageDocsCatalog,
  type PackageDocsCatalogEntry,
  type PackageDocsPageRoute,
  PackageDocsPageRouteSchema,
  PackageNameSchema
} from "../../contracts/presentation/package-docs.js"

export class EmptyPackageDocsCatalogSelection extends Schema.TaggedClass<EmptyPackageDocsCatalogSelection>()(
  "EmptyPackageDocsCatalogSelection",
  {
    route: PackageDocsPageRouteSchema
  }
) {}

export class ResolvedPackageDocsCatalogSelection extends Schema.TaggedClass<ResolvedPackageDocsCatalogSelection>()(
  "ResolvedPackageDocsCatalogSelection",
  {
    route: PackageDocsPageRouteSchema,
    selectedPackageId: PackageNameSchema
  }
) {}

export const PackageDocsCatalogSelection = Schema.Union(
  EmptyPackageDocsCatalogSelection,
  ResolvedPackageDocsCatalogSelection
)

export type PackageDocsCatalogSelection = typeof PackageDocsCatalogSelection.Type

export const packageDocsCatalogSelection = ({
  catalog,
  route
}: {
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly route: PackageDocsPageRoute
}): PackageDocsCatalogSelection => {
  const selectedPackageId = route.selectedPackageId() ?? catalog[0]?.packageId ?? null

  return selectedPackageId === null
    ? EmptyPackageDocsCatalogSelection.make({ route })
    : ResolvedPackageDocsCatalogSelection.make({ route, selectedPackageId })
}

export class PackageDocsCatalogLoading extends Schema.TaggedClass<PackageDocsCatalogLoading>()("CatalogLoading", {
  route: PackageDocsPageRouteSchema
}) {}

export class PackageDocsCatalogFailure extends Schema.TaggedClass<PackageDocsCatalogFailure>()("CatalogFailure", {
  route: PackageDocsPageRouteSchema,
  description: Schema.String
}) {}

export class PackageDocsEmptyCatalog extends Schema.TaggedClass<PackageDocsEmptyCatalog>()("EmptyCatalog", {
  route: PackageDocsPageRouteSchema
}) {}

export class PackageDocsBundleLoading extends Schema.TaggedClass<PackageDocsBundleLoading>()("BundleLoading", {
  route: PackageDocsPageRouteSchema,
  catalog: PackageDocsCatalog,
  selectedPackageId: PackageNameSchema
}) {}

export class PackageDocsBundleFailure extends Schema.TaggedClass<PackageDocsBundleFailure>()("BundleFailure", {
  route: PackageDocsPageRouteSchema,
  catalog: PackageDocsCatalog,
  description: Schema.String,
  selectedPackageId: PackageNameSchema
}) {}

export class PackageDocsReady extends Schema.TaggedClass<PackageDocsReady>()("Ready", {
  route: PackageDocsPageRouteSchema,
  bundle: PackageDocsBundleSchema,
  catalog: PackageDocsCatalog,
  selectedPackageId: PackageNameSchema
}) {}

export const PackageDocsRouteState = Schema.Union(
  PackageDocsCatalogLoading,
  PackageDocsCatalogFailure,
  PackageDocsEmptyCatalog,
  PackageDocsBundleLoading,
  PackageDocsBundleFailure,
  PackageDocsReady
)

export type PackageDocsRouteState = typeof PackageDocsRouteState.Type

export const packageDocsCatalogState = ({
  description,
  route
}: {
  readonly description: string | null
  readonly route: PackageDocsPageRoute
}): PackageDocsCatalogLoading | PackageDocsCatalogFailure =>
  description === null
    ? PackageDocsCatalogLoading.make({ route })
    : PackageDocsCatalogFailure.make({ route, description })

export const packageDocsBundleState = ({
  bundle,
  catalog,
  description,
  selection
}: {
  readonly bundle: PackageDocsBundle | null
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly description: string | null
  readonly selection: ResolvedPackageDocsCatalogSelection
}): PackageDocsBundleLoading | PackageDocsBundleFailure | PackageDocsReady => {
  if (bundle === null) {
    return description === null
      ? PackageDocsBundleLoading.make({
        route: selection.route,
        catalog,
        selectedPackageId: selection.selectedPackageId
      })
      : PackageDocsBundleFailure.make({
        route: selection.route,
        catalog,
        description,
        selectedPackageId: selection.selectedPackageId
      })
  }

  return PackageDocsReady.make({
    route: selection.route,
    bundle,
    catalog,
    selectedPackageId: selection.selectedPackageId
  })
}
