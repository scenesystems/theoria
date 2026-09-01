import * as Schema from "effect/Schema"

import { ApiCategorySchema, ApiExportSchema, ApiPageModuleSchema, ApiPagePackageSchema } from "./api-reference.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const DocsAssetPath = Schema.String.pipe(
  Schema.pattern(/^\/docs-data\/[A-Za-z0-9._/-]+$/u)
)

export const GuideInlineSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("code"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("link"), text: Schema.String, href: NonEmptyString })
)

const GuideInlinePartsSchema = Schema.Array(GuideInlineSchema)

export const GuideBlockSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("paragraph"), parts: GuideInlinePartsSchema }),
  Schema.Struct({
    kind: Schema.Literal("heading"),
    depth: Schema.Literal(2, 3, 4, 5, 6),
    id: NonEmptyString,
    text: NonEmptyString
  }),
  Schema.Struct({ kind: Schema.Literal("code"), language: Schema.String, source: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("list"), ordered: Schema.Boolean, items: Schema.Array(GuideInlinePartsSchema) }),
  Schema.Struct({ kind: Schema.Literal("quote"), parts: GuideInlinePartsSchema }),
  Schema.Struct({
    kind: Schema.Literal("table"),
    headers: Schema.Array(GuideInlinePartsSchema),
    rows: Schema.Array(Schema.Array(GuideInlinePartsSchema))
  })
)

export const GuideAnchorSchema = Schema.Struct({
  id: NonEmptyString,
  label: NonEmptyString,
  depth: Schema.Literal(2, 3, 4, 5, 6)
})

export const GuidePageSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: Schema.Literal("guide"),
  path: NonEmptyString,
  package: ApiPagePackageSchema,
  title: NonEmptyString,
  summary: NonEmptyString,
  sourceUrl: NonEmptyString,
  blocks: Schema.Array(GuideBlockSchema),
  anchors: Schema.Array(GuideAnchorSchema)
})

export const DocsGuideSummarySchema = Schema.Struct({
  slug: Schema.String,
  title: NonEmptyString,
  summary: NonEmptyString,
  path: NonEmptyString,
  asset: DocsAssetPath
})

export const DocsApiModuleSummarySchema = Schema.Struct({
  name: NonEmptyString,
  subpath: NonEmptyString,
  slug: Schema.String,
  path: NonEmptyString,
  asset: DocsAssetPath,
  aliases: Schema.Array(NonEmptyString),
  summary: NonEmptyString,
  since: NonEmptyString,
  exportCount: Schema.Number,
  categories: Schema.Array(NonEmptyString)
})

export const DocsApiExportSummarySchema = Schema.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  anchor: NonEmptyString,
  importKind: Schema.Literal("default", "namespace", "type", "value"),
  category: Schema.String,
  since: Schema.String,
  summary: Schema.String,
  asset: DocsAssetPath
})

export const DocsApiModuleIndexSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: Schema.Literal("api-module-index"),
  path: NonEmptyString,
  canonical: Schema.Boolean,
  canonicalPath: NonEmptyString,
  aliases: Schema.Array(NonEmptyString),
  package: ApiPagePackageSchema,
  module: ApiPageModuleSchema,
  categories: Schema.Array(ApiCategorySchema),
  exports: Schema.Array(DocsApiExportSummarySchema)
})

export const DocsApiExportPageSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: Schema.Literal("api-export"),
  export: ApiExportSchema
})

export const DocsPackageSummarySchema = Schema.Struct({
  name: NonEmptyString,
  version: NonEmptyString,
  slug: NonEmptyString,
  description: NonEmptyString,
  npmUrl: NonEmptyString,
  repositoryUrl: NonEmptyString,
  overview: DocsGuideSummarySchema,
  guides: Schema.Array(DocsGuideSummarySchema),
  apiModules: Schema.Array(DocsApiModuleSummarySchema)
})

export const DocsManifestSchema = Schema.Struct({
  schemaVersion: Schema.Literal(2),
  revision: NonEmptyString,
  searchIndexAsset: DocsAssetPath,
  packages: Schema.Array(DocsPackageSummarySchema)
})

export const DocsSearchEntrySchema = Schema.Struct({
  id: NonEmptyString,
  kind: Schema.Literal("package", "guide", "module", "symbol"),
  package: NonEmptyString,
  packageSlug: NonEmptyString,
  name: NonEmptyString,
  qualifiedName: NonEmptyString,
  category: Schema.NullOr(Schema.String),
  summary: Schema.String,
  path: NonEmptyString,
  anchor: Schema.NullOr(Schema.String)
})

export const DocsSearchIndexSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  entries: Schema.Array(DocsSearchEntrySchema)
})

export const GuidePageJson = Schema.parseJson(GuidePageSchema)
export const DocsApiModuleIndexJson = Schema.parseJson(DocsApiModuleIndexSchema)
export const DocsApiExportPageJson = Schema.parseJson(DocsApiExportPageSchema)
export const DocsManifestJson = Schema.parseJson(DocsManifestSchema)
export const DocsSearchIndexJson = Schema.parseJson(DocsSearchIndexSchema)

export class DocsDataError extends Schema.TaggedError<DocsDataError>()("DocsDataError", {
  path: Schema.String,
  message: Schema.String
}) {}

export type GuideInline = typeof GuideInlineSchema.Type
export type GuideBlock = typeof GuideBlockSchema.Type
export type GuideAnchor = typeof GuideAnchorSchema.Type
export type GuidePage = typeof GuidePageSchema.Type
export type DocsGuideSummary = typeof DocsGuideSummarySchema.Type
export type DocsApiModuleSummary = typeof DocsApiModuleSummarySchema.Type
export type DocsApiExportSummary = typeof DocsApiExportSummarySchema.Type
export type DocsApiModuleIndex = typeof DocsApiModuleIndexSchema.Type
export type DocsApiExportPage = typeof DocsApiExportPageSchema.Type
export type DocsPackageSummary = typeof DocsPackageSummarySchema.Type
export type DocsManifest = typeof DocsManifestSchema.Type
export type DocsSearchEntry = typeof DocsSearchEntrySchema.Type
export type DocsSearchIndex = typeof DocsSearchIndexSchema.Type
