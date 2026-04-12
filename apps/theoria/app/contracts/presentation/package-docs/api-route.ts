import { Match, Option, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "../../error.js"
import { ErrorCode } from "../../error.js"
import type { PageLocation } from "../page-location.js"

import { PackageDocsApiRequestInput } from "./api-request-input.js"

import {
  NonEmptyString,
  type PackageDocsQuery,
  PackageDocsQuerySchema,
  type PackageName,
  PackageNameSchema
} from "./shared.js"

export class PackageDocsRequestError extends Schema.TaggedError<PackageDocsRequestError>()(
  "PackageDocsRequestError",
  {
    message: Schema.String
  }
) {
  static fromMessage(message: string): PackageDocsRequestError {
    return new PackageDocsRequestError({ message })
  }
}

export class PackageDocsDecodeError extends Schema.TaggedError<PackageDocsDecodeError>()(
  "PackageDocsDecodeError",
  {
    message: Schema.String
  }
) {
  static fromParseError(error: ParseResult.ParseError): PackageDocsDecodeError {
    return new PackageDocsDecodeError({
      message: ParseResult.TreeFormatter.formatErrorSync(error)
    })
  }
}

export class PackageDocsExecutionError extends Schema.TaggedError<PackageDocsExecutionError>()(
  "PackageDocsExecutionError",
  {
    code: ErrorCode,
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {
  static fromErrorModel(error: ErrorModel): PackageDocsExecutionError {
    return new PackageDocsExecutionError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    })
  }
}

export const PackageDocsError = Schema.Union(
  PackageDocsRequestError,
  PackageDocsDecodeError,
  PackageDocsExecutionError
)
export type PackageDocsError = typeof PackageDocsError.Type

export class MissingPackageDocsBundlePackage extends Schema.TaggedClass<MissingPackageDocsBundlePackage>()(
  "MissingPackageDocsBundlePackage",
  {}
) {
  static missing(): MissingPackageDocsBundlePackage {
    return missingPackageDocsBundlePackage
  }
}

export class PackageDocsBundlePackage extends Schema.TaggedClass<PackageDocsBundlePackage>()(
  "PackageDocsBundlePackage",
  {
    packageId: PackageNameSchema
  }
) {
  static fromPackageId(packageId: PackageName): PackageDocsBundlePackage {
    return PackageDocsBundlePackage.make({ packageId })
  }
}

export const PackageDocsBundleSelection = Schema.Union(MissingPackageDocsBundlePackage, PackageDocsBundlePackage)
export type PackageDocsBundleSelection = typeof PackageDocsBundleSelection.Type

export class MissingPackageDocsSearchQuery extends Schema.TaggedClass<MissingPackageDocsSearchQuery>()(
  "MissingPackageDocsSearchQuery",
  {}
) {
  static missing(): MissingPackageDocsSearchQuery {
    return missingPackageDocsSearchQuery
  }
}

export class InvalidPackageDocsSearchPackage extends Schema.TaggedClass<InvalidPackageDocsSearchPackage>()(
  "InvalidPackageDocsSearchPackage",
  {
    rawPackageId: NonEmptyString
  }
) {
  static fromRawPackageId(rawPackageId: string): InvalidPackageDocsSearchPackage {
    return InvalidPackageDocsSearchPackage.make({ rawPackageId })
  }
}

export class PackageDocsSearchQuery extends Schema.TaggedClass<PackageDocsSearchQuery>()(
  "PackageDocsSearchQuery",
  {
    query: PackageDocsQuerySchema
  }
) {
  static fromQuery(query: PackageDocsQuery): PackageDocsSearchQuery {
    return PackageDocsSearchQuery.make({
      query: Schema.decodeUnknownSync(PackageDocsQuerySchema)(query)
    })
  }
}

export const PackageDocsSearchSelection = Schema.Union(
  MissingPackageDocsSearchQuery,
  InvalidPackageDocsSearchPackage,
  PackageDocsSearchQuery
)
export type PackageDocsSearchSelection = typeof PackageDocsSearchSelection.Type

const withOptionalPackageParam = (params: URLSearchParams, packageId: PackageName | null): URLSearchParams => {
  if (packageId !== null) {
    params.set("package", packageId)
  }

  return params
}

export class PackageDocsCatalogRoute extends Schema.TaggedClass<PackageDocsCatalogRoute>()("catalog", {}) {
  static catalog(): PackageDocsCatalogRoute {
    return packageDocsCatalogRoute
  }

  static fromLocation(location: PageLocation): Option.Option<PackageDocsCatalogRoute> {
    return PackageDocsCatalogRoute.fromInput(PackageDocsApiRequestInput.fromLocation(location))
  }

  static fromInput(input: PackageDocsApiRequestInput): Option.Option<PackageDocsCatalogRoute> {
    return PackageDocsCatalogRoute.matches(input)
      ? Option.some(PackageDocsCatalogRoute.catalog())
      : Option.none()
  }

  static matches(input: PackageDocsApiRequestInput): boolean {
    return input.hasPathname(PackageDocsCatalogRoute.pathname())
  }

  static pathname(): string {
    return "/api/package-docs/catalog"
  }

  path(): string {
    return PackageDocsCatalogRoute.pathname()
  }
}

export class PackageDocsBundleRoute extends Schema.TaggedClass<PackageDocsBundleRoute>()("bundle", {
  selection: PackageDocsBundleSelection
}) {
  static missing(): PackageDocsBundleRoute {
    return PackageDocsBundleRoute.make({
      selection: MissingPackageDocsBundlePackage.missing()
    })
  }

  static fromPackageId(packageId: PackageName): PackageDocsBundleRoute {
    return PackageDocsBundleRoute.make({
      selection: PackageDocsBundlePackage.fromPackageId(packageId)
    })
  }

  static fromLocation(location: PageLocation): Option.Option<PackageDocsBundleRoute> {
    return PackageDocsBundleRoute.fromInput(PackageDocsApiRequestInput.fromLocation(location))
  }

  static fromInput(input: PackageDocsApiRequestInput): Option.Option<PackageDocsBundleRoute> {
    return PackageDocsBundleRoute.matches(input)
      ? Option.some(PackageDocsBundleRoute.fromRequestInput(input))
      : Option.none()
  }

  static fromRequestInput(input: PackageDocsApiRequestInput): PackageDocsBundleRoute {
    const packageId = input.packageId()

    return packageId === null ? PackageDocsBundleRoute.missing() : PackageDocsBundleRoute.fromPackageId(packageId)
  }

  static matches(input: PackageDocsApiRequestInput): boolean {
    return input.hasPathname(PackageDocsBundleRoute.pathname())
  }

  static pathname(): string {
    return "/api/package-docs/bundle"
  }

  path(): string {
    return Match.value(this.selection).pipe(
      Match.tag(
        "PackageDocsBundlePackage",
        ({ packageId }) =>
          `${PackageDocsBundleRoute.pathname()}?${
            withOptionalPackageParam(new URLSearchParams(), packageId).toString()
          }`
      ),
      Match.tag("MissingPackageDocsBundlePackage", () => PackageDocsBundleRoute.pathname()),
      Match.exhaustive
    )
  }
}

export class PackageDocsSearchRoute extends Schema.TaggedClass<PackageDocsSearchRoute>()("search", {
  selection: PackageDocsSearchSelection
}) {
  static fromLocation(location: PageLocation): Option.Option<PackageDocsSearchRoute> {
    return PackageDocsSearchRoute.fromInput(PackageDocsApiRequestInput.fromLocation(location))
  }

  static fromInput(input: PackageDocsApiRequestInput): Option.Option<PackageDocsSearchRoute> {
    return PackageDocsSearchRoute.matches(input)
      ? Option.some(PackageDocsSearchRoute.fromRequestInput(input))
      : Option.none()
  }

  static fromQuery(query: PackageDocsQuery): PackageDocsSearchRoute {
    return PackageDocsSearchRoute.make({
      selection: PackageDocsSearchQuery.fromQuery(query)
    })
  }

  static invalidPackage(rawPackageId: string): PackageDocsSearchRoute {
    return PackageDocsSearchRoute.make({
      selection: InvalidPackageDocsSearchPackage.fromRawPackageId(rawPackageId)
    })
  }

  static missing(): PackageDocsSearchRoute {
    return PackageDocsSearchRoute.make({
      selection: MissingPackageDocsSearchQuery.missing()
    })
  }

  static fromRequestInput(input: PackageDocsApiRequestInput): PackageDocsSearchRoute {
    const query = input.query()
    const rawPackageId = input.rawPackageId()
    const packageId = input.packageId()

    return query.length === 0
      ? PackageDocsSearchRoute.missing()
      : rawPackageId !== null && packageId === null
      ? PackageDocsSearchRoute.invalidPackage(rawPackageId)
      : PackageDocsSearchRoute.fromQuery({
        query,
        packageId,
        limit: input.limit()
      })
  }

  static matches(input: PackageDocsApiRequestInput): boolean {
    return input.hasPathname(PackageDocsSearchRoute.pathname())
  }

  static pathname(): string {
    return "/api/package-docs/search"
  }

  path(): string {
    return Match.value(this.selection).pipe(
      Match.tag("MissingPackageDocsSearchQuery", () => PackageDocsSearchRoute.pathname()),
      Match.tag(
        "InvalidPackageDocsSearchPackage",
        ({ rawPackageId }) =>
          `${PackageDocsSearchRoute.pathname()}?${new URLSearchParams({ package: rawPackageId }).toString()}`
      ),
      Match.tag("PackageDocsSearchQuery", ({ query }) => {
        const params = withOptionalPackageParam(new URLSearchParams(), query.packageId)

        params.set("query", query.query)
        params.set("limit", String(query.limit))

        return `${PackageDocsSearchRoute.pathname()}?${params.toString()}`
      }),
      Match.exhaustive
    )
  }
}

export class PackageDocsRouteNotFound extends Schema.TaggedClass<PackageDocsRouteNotFound>()("route-not-found", {}) {}

export const PackageDocsApiRequestRoute = Schema.Union(
  PackageDocsCatalogRoute,
  PackageDocsBundleRoute,
  PackageDocsSearchRoute
)
export const PackageDocsApiRoute = Schema.Union(PackageDocsApiRequestRoute, PackageDocsRouteNotFound)
export type PackageDocsApiRequestRoute = typeof PackageDocsApiRequestRoute.Type
export type PackageDocsApiRoute = typeof PackageDocsApiRoute.Type

export const packageDocsApiRouteFromLocation = (
  location: PageLocation
): Option.Option<PackageDocsApiRequestRoute> =>
  PackageDocsCatalogRoute.fromLocation(location).pipe(
    Option.orElse(() => PackageDocsBundleRoute.fromLocation(location)),
    Option.orElse(() => PackageDocsSearchRoute.fromLocation(location))
  )

export const isPackageDocsPackageId = Schema.is(PackageNameSchema)

const missingPackageDocsBundlePackage = MissingPackageDocsBundlePackage.make({})
const missingPackageDocsSearchQuery = MissingPackageDocsSearchQuery.make({})
const packageDocsCatalogRoute = PackageDocsCatalogRoute.make({})
