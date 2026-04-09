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

import { FailureEnvelope, Metadata } from "../../envelope.js"

export const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const PackageDocsCatalog = Schema.Array(PackageDocsCatalogEntrySchema)

export const PackageDocsSearchResults = Schema.Array(PackageDocsSearchResultSchema)

export class PackageDocsBundleSuccessEnvelope extends Schema.Class<PackageDocsBundleSuccessEnvelope>(
  "PackageDocsBundleSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: PackageDocsBundleSchema
}) {}

export class PackageDocsCatalogSuccessEnvelope extends Schema.Class<PackageDocsCatalogSuccessEnvelope>(
  "PackageDocsCatalogSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: PackageDocsCatalog
}) {}

export class PackageDocsSearchSuccessEnvelope extends Schema.Class<PackageDocsSearchSuccessEnvelope>(
  "PackageDocsSearchSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: PackageDocsSearchResults
}) {}

export const PackageDocsBundleEnvelope = Schema.Union(PackageDocsBundleSuccessEnvelope, FailureEnvelope)

export const PackageDocsCatalogEnvelope = Schema.Union(PackageDocsCatalogSuccessEnvelope, FailureEnvelope)

export const PackageDocsSearchEnvelope = Schema.Union(PackageDocsSearchSuccessEnvelope, FailureEnvelope)

export type PackageDocsBundle = RootPackageDocsBundle

export type PackageDocsCatalogEntry = RootPackageDocsCatalogEntry

export type PackageDocsQuery = RootPackageDocsQuery

export type PackageDocsSearchResult = RootPackageDocsSearchResult

export type { PackageName }

export {
  nullablePackageName,
  PackageDocsBundleSchema,
  PackageDocsCatalogEntrySchema,
  PackageDocsQuerySchema,
  PackageDocsSearchResultSchema,
  PackageNameSchema
}
