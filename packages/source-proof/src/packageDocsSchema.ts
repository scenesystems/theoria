import { Schema } from "effect"

import { PackageNameSchema, ReleaseVersionSchema } from "./identifiers.js"

const NullableString = Schema.Union(Schema.String, Schema.Null)

/**
 * Package identifier used by the root-owned package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsPackageIdSchema = PackageNameSchema

/**
 * Source-surface kinds that participate in package-doc normalization.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsSourceKindSchema = Schema.Literal(
  "package-manifest",
  "readme",
  "module-doc",
  "example",
  "release-snapshot",
  "proof-command"
)

/**
 * Excerpt kinds emitted by the normalized package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsExcerptKindSchema = Schema.Literal(
  "readme-section",
  "module-doc-section",
  "example-code",
  "release-snapshot-summary",
  "proof-command"
)

/**
 * Source-linked reference for one normalized package-doc surface.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsSourceRefSchema = Schema.Struct({
  packageId: PackageDocsPackageIdSchema,
  kind: PackageDocsSourceKindSchema,
  path: Schema.String,
  anchor: NullableString,
  title: Schema.String
})

/**
 * Normalized excerpt block used by package-doc query and search surfaces.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsSectionBlockSchema = Schema.Struct({
  id: Schema.String,
  kind: PackageDocsExcerptKindSchema,
  title: Schema.String,
  content: Schema.String,
  source: PackageDocsSourceRefSchema
})

/**
 * One normalized markdown-backed package-doc document.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsDocumentSchema = Schema.Struct({
  title: Schema.String,
  source: PackageDocsSourceRefSchema,
  blocks: Schema.Array(PackageDocsSectionBlockSchema)
})

/**
 * One normalized example surface in the package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsExampleSchema = Schema.Struct({
  title: Schema.String,
  source: PackageDocsSourceRefSchema,
  block: PackageDocsSectionBlockSchema
})

/**
 * One normalized release-snapshot surface in the package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsReleaseSnapshotSchema = Schema.Struct({
  releasedVersion: ReleaseVersionSchema,
  source: PackageDocsSourceRefSchema,
  block: PackageDocsSectionBlockSchema
})

/**
 * One normalized proof-command surface in the package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsProofCommandSchema = Schema.Struct({
  name: Schema.String,
  command: Schema.String,
  source: PackageDocsSourceRefSchema,
  block: PackageDocsSectionBlockSchema
})

/**
 * Normalized package-doc bundle returned by the root-owned corpus loader.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsBundleSchema = Schema.Struct({
  packageId: PackageDocsPackageIdSchema,
  packageDirectory: Schema.String,
  version: ReleaseVersionSchema,
  description: NullableString,
  manifestSource: PackageDocsSourceRefSchema,
  readme: PackageDocsDocumentSchema,
  moduleDocs: Schema.Array(PackageDocsDocumentSchema),
  examples: Schema.Array(PackageDocsExampleSchema),
  releaseSnapshots: Schema.Array(PackageDocsReleaseSnapshotSchema),
  proofCommands: Schema.Array(PackageDocsProofCommandSchema)
})

/**
 * Catalog entry surfaced by the root-owned package-doc query engine.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsCatalogEntrySchema = Schema.Struct({
  packageId: PackageDocsPackageIdSchema,
  packageDirectory: Schema.String,
  version: ReleaseVersionSchema,
  description: NullableString,
  readmePath: Schema.String,
  moduleDocCount: Schema.Number,
  exampleCount: Schema.Number,
  releaseSnapshotCount: Schema.Number,
  proofCommandCount: Schema.Number
})

/**
 * Query contract for root-owned package-doc search.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsQuerySchema = Schema.Struct({
  query: Schema.String,
  packageId: Schema.Union(PackageNameSchema, Schema.Null),
  limit: Schema.Number
})

/**
 * Search result emitted by the root-owned package-doc query engine.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsSearchResultSchema = Schema.Struct({
  packageId: PackageDocsPackageIdSchema,
  title: Schema.String,
  excerpt: Schema.String,
  source: PackageDocsSourceRefSchema,
  score: Schema.Number
})

/**
 * Complete root-owned package-doc corpus.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsCorpusSchema = Schema.Struct({
  catalog: Schema.Array(PackageDocsCatalogEntrySchema),
  bundles: Schema.Array(PackageDocsBundleSchema)
})

/**
 * Root authority metadata for package-doc normalization and retrieval.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageDocsAuthoritySchema = Schema.Struct({
  name: Schema.String,
  corpusSources: Schema.Array(Schema.String),
  querySurfaces: Schema.Array(Schema.String),
  cliEntrypoints: Schema.Array(Schema.String),
  appProjectionConsumer: Schema.String
})

export type PackageDocsBundle = typeof PackageDocsBundleSchema.Type
export type PackageDocsCatalogEntry = typeof PackageDocsCatalogEntrySchema.Type
export type PackageDocsCorpus = typeof PackageDocsCorpusSchema.Type
export type PackageDocsDocument = typeof PackageDocsDocumentSchema.Type
export type PackageDocsExample = typeof PackageDocsExampleSchema.Type
export type PackageDocsExcerptKind = typeof PackageDocsExcerptKindSchema.Type
export type PackageDocsProofCommand = typeof PackageDocsProofCommandSchema.Type
export type PackageDocsQuery = typeof PackageDocsQuerySchema.Type
export type PackageDocsReleaseSnapshot = typeof PackageDocsReleaseSnapshotSchema.Type
export type PackageDocsSearchResult = typeof PackageDocsSearchResultSchema.Type
export type PackageDocsSectionBlock = typeof PackageDocsSectionBlockSchema.Type
export type PackageDocsSourceKind = typeof PackageDocsSourceKindSchema.Type
export type PackageDocsSourceRef = typeof PackageDocsSourceRefSchema.Type
export type PackageDocsAuthority = typeof PackageDocsAuthoritySchema.Type

/**
 * Canonical root-owned package-doc authority for the current convergence wave.
 *
 * @since 0.0.0
 * @category constants
 */
export const TheoriaPackageDocsAuthority: PackageDocsAuthority = {
  name: "root-package-docs-authority",
  corpusSources: [
    "packages/*/package.json",
    "packages/*/README.md",
    "packages/*/docs/modules/**/*.md",
    "packages/*/examples/**/*.ts",
    "packages/*/test/package/release-snapshots/*.json"
  ],
  querySurfaces: ["catalog", "bundle", "bounded-search"],
  cliEntrypoints: ["scripts/docs-packages.ts"],
  appProjectionConsumer: "apps/theoria"
}
