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
    previous: Schema.NullOr(Schema.suspend(() => PackageDocsPreviousSearch)),
    query: Schema.String,
    route: PackageDocsPageRouteSchema,
    selectedPackageId: Schema.NullOr(PackageNameSchema)
  }
) {}

export class PackageDocsSearchFailure extends Schema.TaggedClass<PackageDocsSearchFailure>()(
  "FailedPackageDocsSearch",
  {
    description: Schema.String,
    previous: Schema.NullOr(Schema.suspend(() => PackageDocsPreviousSearch)),
    query: Schema.String,
    route: PackageDocsPageRouteSchema,
    selectedPackageId: Schema.NullOr(PackageNameSchema)
  }
) {}

export class PackageDocsPreviousSearch extends Schema.Class<PackageDocsPreviousSearch>("PackageDocsPreviousSearch")({
  query: Schema.String,
  results: PackageDocsSearchResults,
  selectedPackageId: Schema.NullOr(PackageNameSchema)
}) {}

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

export const packageDocsPreviousSearch = (ready: PackageDocsSearchReady): PackageDocsPreviousSearch =>
  PackageDocsPreviousSearch.make({
    query: ready.query,
    results: ready.results,
    selectedPackageId: ready.selectedPackageId
  })

export const packageDocsSearchReady = (input: {
  readonly query: string
  readonly results: ReadonlyArray<PackageDocsSearchResult>
  readonly route: PackageDocsPageRoute
}): PackageDocsSearchReady =>
  PackageDocsSearchReady.make({
    ...packageDocsSearchBase(input.route, input.query),
    results: input.results
  })

export const packageDocsSearchQuery = ({
  query,
  route: _route
}: {
  readonly query: string
  readonly route: PackageDocsPageRoute
}): PackageDocsQuery | null => {
  const trimmedQuery = query.trim()

  return trimmedQuery.length === 0
    ? null
    : Schema.decodeUnknownSync(PackageDocsQuerySchema)({
      limit: 8,
      packageId: null,
      query: trimmedQuery
    })
}

export const packageDocsSearchState = ({
  description,
  previous,
  query,
  results,
  route
}: {
  readonly description: string | null
  readonly previous: PackageDocsPreviousSearch | null
  readonly query: string
  readonly results: ReadonlyArray<PackageDocsSearchResult> | null
  readonly route: PackageDocsPageRoute
}): PackageDocsSearchLoading | PackageDocsSearchFailure | PackageDocsSearchReady => {
  const base = packageDocsSearchBase(route, query)

  if (description !== null) {
    return PackageDocsSearchFailure.make({
      ...base,
      description,
      previous
    })
  }

  if (results === null) {
    return PackageDocsSearchLoading.make({
      ...base,
      previous
    })
  }

  return packageDocsSearchReady({ query, results, route })
}
