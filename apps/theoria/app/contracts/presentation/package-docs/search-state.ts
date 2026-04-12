import { Schema } from "effect"

import { type PackageDocsPageRoute, PackageDocsPageRouteSchema } from "./page-route.js"
import {
  type PackageDocsQuery,
  PackageDocsQuerySchema,
  type PackageDocsSearchResult,
  PackageDocsSearchResults,
  type PackageName,
  PackageNameSchema
} from "./shared.js"

export class PackageDocsSearchIdle extends Schema.TaggedClass<PackageDocsSearchIdle>()("IdlePackageDocsSearch", {
  query: Schema.String,
  route: PackageDocsPageRouteSchema,
  selectedPackageId: Schema.NullOr(PackageNameSchema)
}) {}

export class PackageDocsSearchLoading extends Schema.TaggedClass<PackageDocsSearchLoading>()(
  "LoadingPackageDocsSearch",
  {
    query: Schema.String,
    route: PackageDocsPageRouteSchema,
    selectedPackageId: Schema.NullOr(PackageNameSchema)
  }
) {}

export class PackageDocsSearchFailure extends Schema.TaggedClass<PackageDocsSearchFailure>()(
  "FailedPackageDocsSearch",
  {
    description: Schema.String,
    query: Schema.String,
    route: PackageDocsPageRouteSchema,
    selectedPackageId: Schema.NullOr(PackageNameSchema)
  }
) {}

export class PackageDocsSearchReady extends Schema.TaggedClass<PackageDocsSearchReady>()("ReadyPackageDocsSearch", {
  query: Schema.String,
  results: PackageDocsSearchResults,
  route: PackageDocsPageRouteSchema,
  selectedPackageId: Schema.NullOr(PackageNameSchema)
}) {}

export const PackageDocsSearchState = Schema.Union(
  PackageDocsSearchIdle,
  PackageDocsSearchLoading,
  PackageDocsSearchFailure,
  PackageDocsSearchReady
)

export type PackageDocsSearchState = typeof PackageDocsSearchState.Type

const packageDocsSearchBase = (route: PackageDocsPageRoute, query: string): {
  readonly query: string
  readonly route: PackageDocsPageRoute
  readonly selectedPackageId: PackageName | null
} => ({
  query,
  route,
  selectedPackageId: route.selectedPackageId()
})

export const packageDocsSearchIdle = (
  route: PackageDocsPageRoute,
  query: string
): PackageDocsSearchIdle => PackageDocsSearchIdle.make(packageDocsSearchBase(route, query))

export const packageDocsSearchQuery = ({
  query,
  route
}: {
  readonly query: string
  readonly route: PackageDocsPageRoute
}): PackageDocsQuery | null => {
  const trimmedQuery = query.trim()

  return trimmedQuery.length === 0
    ? null
    : Schema.decodeUnknownSync(PackageDocsQuerySchema)({
      limit: 8,
      packageId: route.selectedPackageId(),
      query: trimmedQuery
    })
}

export const packageDocsSearchState = ({
  description,
  query,
  results,
  route
}: {
  readonly description: string | null
  readonly query: string
  readonly results: ReadonlyArray<PackageDocsSearchResult> | null
  readonly route: PackageDocsPageRoute
}): PackageDocsSearchLoading | PackageDocsSearchFailure | PackageDocsSearchReady => {
  const base = packageDocsSearchBase(route, query)

  if (results === null) {
    return description === null
      ? PackageDocsSearchLoading.make(base)
      : PackageDocsSearchFailure.make({ ...base, description })
  }

  return PackageDocsSearchReady.make({ ...base, results })
}
