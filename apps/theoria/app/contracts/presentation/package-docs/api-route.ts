import { Match, Option, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "../../error.js"
import { ErrorCode } from "../../error.js"

import {
  NonEmptyString,
  nullablePackageName,
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
) {}

export class PackageDocsBundlePackage extends Schema.TaggedClass<PackageDocsBundlePackage>()(
  "PackageDocsBundlePackage",
  {
    packageId: PackageNameSchema
  }
) {}

export const PackageDocsBundleSelection = Schema.Union(MissingPackageDocsBundlePackage, PackageDocsBundlePackage)
export type PackageDocsBundleSelection = typeof PackageDocsBundleSelection.Type

export class MissingPackageDocsSearchQuery extends Schema.TaggedClass<MissingPackageDocsSearchQuery>()(
  "MissingPackageDocsSearchQuery",
  {}
) {}

export class InvalidPackageDocsSearchPackage extends Schema.TaggedClass<InvalidPackageDocsSearchPackage>()(
  "InvalidPackageDocsSearchPackage",
  {
    rawPackageId: NonEmptyString
  }
) {}

export class PackageDocsSearchQuery extends Schema.TaggedClass<PackageDocsSearchQuery>()(
  "PackageDocsSearchQuery",
  {
    query: PackageDocsQuerySchema
  }
) {}

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

const positiveSearchLimit = (rawValue: string | null): number => {
  const parsed = rawValue === null ? Number.NaN : Number(rawValue)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10
}

export class PackageDocsCatalogRoute extends Schema.TaggedClass<PackageDocsCatalogRoute>()("catalog", {}) {
  static fromPathname(pathname: string): Option.Option<PackageDocsCatalogRoute> {
    return PackageDocsCatalogRoute.matches(pathname)
      ? Option.some(PackageDocsCatalogRoute.make({}))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return pathname === PackageDocsCatalogRoute.pathname()
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
  static fromPackageId(packageId: PackageName): PackageDocsBundleRoute {
    return PackageDocsBundleRoute.make({
      selection: PackageDocsBundlePackage.make({ packageId })
    })
  }

  static fromPathname(pathname: string, search: string): Option.Option<PackageDocsBundleRoute> {
    return PackageDocsBundleRoute.matches(pathname)
      ? Option.some(PackageDocsBundleRoute.fromSearch(search))
      : Option.none()
  }

  static fromSearch(search: string): PackageDocsBundleRoute {
    const packageId = nullablePackageName(new URLSearchParams(search).get("package"))

    return PackageDocsBundleRoute.make({
      selection: packageId === null
        ? MissingPackageDocsBundlePackage.make({})
        : PackageDocsBundlePackage.make({ packageId })
    })
  }

  static matches(pathname: string): boolean {
    return pathname === PackageDocsBundleRoute.pathname()
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
  static fromPathname(pathname: string, search: string): Option.Option<PackageDocsSearchRoute> {
    return PackageDocsSearchRoute.matches(pathname)
      ? Option.some(PackageDocsSearchRoute.fromSearch(search))
      : Option.none()
  }

  static fromQuery(query: PackageDocsQuery): PackageDocsSearchRoute {
    return PackageDocsSearchRoute.make({
      selection: PackageDocsSearchQuery.make({
        query: Schema.decodeUnknownSync(PackageDocsQuerySchema)(query)
      })
    })
  }

  static fromSearch(search: string): PackageDocsSearchRoute {
    const params = new URLSearchParams(search)
    const query = (params.get("query") ?? "").trim()
    const rawPackageId = params.get("package")
    const packageId = nullablePackageName(rawPackageId)

    return PackageDocsSearchRoute.make({
      selection: query.length === 0
        ? MissingPackageDocsSearchQuery.make({})
        : rawPackageId !== null && packageId === null
        ? InvalidPackageDocsSearchPackage.make({ rawPackageId })
        : PackageDocsSearchQuery.make({
          query: Schema.decodeUnknownSync(PackageDocsQuerySchema)({
            query,
            packageId,
            limit: positiveSearchLimit(params.get("limit"))
          })
        })
    })
  }

  static matches(pathname: string): boolean {
    return pathname === PackageDocsSearchRoute.pathname()
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

export const isPackageDocsPackageId = Schema.is(PackageNameSchema)
