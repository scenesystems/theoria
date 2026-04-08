import {
  nullablePackageName,
  type PackageDocsBundle as RootPackageDocsBundle,
  PackageDocsBundleSchema,
  type PackageDocsCatalogEntry as RootPackageDocsCatalogEntry,
  PackageDocsCatalogEntrySchema,
  type PackageDocsQuery as RootPackageDocsQuery,
  PackageDocsQuerySchema,
  type PackageDocsSearchResult as RootPackageDocsSearchResult,
  PackageDocsSearchResultSchema,
  type PackageName,
  PackageNameSchema
} from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { Envelope } from "../envelope.js"
import { ErrorCode } from "../error.js"

export const PackageDocsCatalog = Schema.Array(PackageDocsCatalogEntrySchema)

export const PackageDocsSearchResults = Schema.Array(PackageDocsSearchResultSchema)

export const PackageDocsBundleEnvelope = Envelope(PackageDocsBundleSchema)

export const PackageDocsCatalogEnvelope = Envelope(PackageDocsCatalog)

export const PackageDocsSearchEnvelope = Envelope(PackageDocsSearchResults)

export const PackageDocsPagePathname = "/packages"

export const PackageDocsApiCatalogPathname = "/api/package-docs/catalog"

export const PackageDocsApiBundlePathname = "/api/package-docs/bundle"

export const PackageDocsApiSearchPathname = "/api/package-docs/search"

export class PackageDocsRequestError extends Schema.TaggedError<PackageDocsRequestError>()(
  "PackageDocsRequestError",
  {
    message: Schema.String
  }
) {}

export class PackageDocsDecodeError extends Schema.TaggedError<PackageDocsDecodeError>()(
  "PackageDocsDecodeError",
  {
    message: Schema.String
  }
) {}

export class PackageDocsExecutionError extends Schema.TaggedError<PackageDocsExecutionError>()(
  "PackageDocsExecutionError",
  {
    code: ErrorCode,
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {}

export const PackageDocsError = Schema.Union(
  PackageDocsRequestError,
  PackageDocsDecodeError,
  PackageDocsExecutionError
)

export type PackageDocsBundle = RootPackageDocsBundle
export type PackageDocsCatalogEntry = RootPackageDocsCatalogEntry
export type PackageDocsError = typeof PackageDocsError.Type
export type PackageDocsQuery = RootPackageDocsQuery
export type PackageDocsSearchResult = RootPackageDocsSearchResult

const withOptionalPackageParam = (params: URLSearchParams, packageId: PackageName | null): URLSearchParams => {
  if (packageId !== null) {
    params.set("package", packageId)
  }

  return params
}

export const packageDocsPagePath = (packageId: PackageName | null): string =>
  packageId === null
    ? PackageDocsPagePathname
    : `${PackageDocsPagePathname}?${withOptionalPackageParam(new URLSearchParams(), packageId).toString()}`

export const packageDocsQueryPackage = (search: string): PackageName | null =>
  nullablePackageName(new URLSearchParams(search).get("package"))

export const packageDocsCatalogApiPath = (): string => PackageDocsApiCatalogPathname

export const packageDocsBundleApiPath = (packageId: PackageName): string =>
  `${PackageDocsApiBundlePathname}?${withOptionalPackageParam(new URLSearchParams(), packageId).toString()}`

export const packageDocsSearchApiPath = (query: PackageDocsQuery): string => {
  const decoded = Schema.decodeUnknownSync(PackageDocsQuerySchema)(query)
  const params = withOptionalPackageParam(new URLSearchParams(), decoded.packageId)

  params.set("query", decoded.query)
  params.set("limit", String(decoded.limit))

  return `${PackageDocsApiSearchPathname}?${params.toString()}`
}

export const isPackageDocsPackageId = Schema.is(PackageNameSchema)
