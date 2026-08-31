import { Schema } from "effect"

export const ApiDocPartSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("code"), text: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("link"),
    text: Schema.String,
    href: Schema.NullOr(Schema.String)
  })
)

export const ApiDocumentationSchema = Schema.Struct({
  summary: Schema.Array(ApiDocPartSchema),
  remarks: Schema.Array(ApiDocPartSchema),
  examples: Schema.Array(Schema.Array(ApiDocPartSchema)),
  deprecated: Schema.NullOr(Schema.Array(ApiDocPartSchema)),
  see: Schema.Array(Schema.Array(ApiDocPartSchema))
})

export const ApiTypeParameterSchema = Schema.Struct({
  name: Schema.String,
  constraint: Schema.NullOr(Schema.String),
  default: Schema.NullOr(Schema.String),
  description: Schema.Array(ApiDocPartSchema)
})

export const ApiParameterSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  optional: Schema.Boolean,
  rest: Schema.Boolean,
  defaultValue: Schema.NullOr(Schema.String),
  description: Schema.Array(ApiDocPartSchema)
})

export const ApiReturnSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.Array(ApiDocPartSchema)
})

export const ApiSignatureSchema = Schema.Struct({
  kind: Schema.Literal("call", "constructor", "get", "set", "index"),
  code: Schema.String,
  typeParameters: Schema.Array(ApiTypeParameterSchema),
  parameters: Schema.Array(ApiParameterSchema),
  returns: ApiReturnSchema,
  docs: ApiDocumentationSchema,
  sourceUrl: Schema.String
})

export const ApiMemberSchema = Schema.Struct({
  name: Schema.String,
  anchor: Schema.String,
  kind: Schema.String,
  declaration: Schema.String,
  type: Schema.NullOr(Schema.String),
  optional: Schema.Boolean,
  readonly: Schema.Boolean,
  static: Schema.Boolean,
  inherited: Schema.Boolean,
  docs: ApiDocumentationSchema,
  signatures: Schema.Array(ApiSignatureSchema),
  sourceUrl: Schema.String
})

export const ApiFacetSchema = Schema.Struct({
  kind: Schema.String,
  declaration: Schema.String,
  type: Schema.NullOr(Schema.String),
  typeParameters: Schema.Array(ApiTypeParameterSchema),
  extends: Schema.Array(Schema.String),
  implements: Schema.Array(Schema.String),
  docs: ApiDocumentationSchema,
  signatures: Schema.Array(ApiSignatureSchema),
  members: Schema.Array(ApiMemberSchema),
  sourceUrl: Schema.String
})

export const ApiExportSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  anchor: Schema.String,
  importKind: Schema.Literal("default", "namespace", "type", "value"),
  category: Schema.String,
  since: Schema.String,
  summary: Schema.String,
  facets: Schema.Array(ApiFacetSchema)
})

export const ApiCategorySchema = Schema.Struct({
  name: Schema.String,
  exportIds: Schema.Array(Schema.String)
})

export const ApiPagePackageSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  slug: Schema.String,
  description: Schema.String
})

export const ApiPageModuleSchema = Schema.Struct({
  name: Schema.String,
  subpath: Schema.String,
  slug: Schema.String,
  docs: ApiDocumentationSchema,
  since: Schema.String,
  sourceUrl: Schema.String
})

export const ApiPageSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: Schema.Literal("api-module"),
  path: Schema.String,
  canonical: Schema.Boolean,
  canonicalPath: Schema.String,
  aliases: Schema.Array(Schema.String),
  package: ApiPagePackageSchema,
  module: ApiPageModuleSchema,
  categories: Schema.Array(ApiCategorySchema),
  exports: Schema.Array(ApiExportSchema)
})

export const ApiSearchEntrySchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("module", "symbol"),
  package: Schema.String,
  packageSlug: Schema.String,
  name: Schema.String,
  qualifiedName: Schema.String,
  category: Schema.NullOr(Schema.String),
  summary: Schema.String,
  path: Schema.String,
  anchor: Schema.NullOr(Schema.String)
})

export const ApiSearchIndexSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  entries: Schema.Array(ApiSearchEntrySchema)
})

export const ApiPageJson = Schema.parseJson(ApiPageSchema)
export const ApiSearchIndexJson = Schema.parseJson(ApiSearchIndexSchema)

export type ApiDocPart = typeof ApiDocPartSchema.Type
export type ApiDocumentation = typeof ApiDocumentationSchema.Type
export type ApiTypeParameter = typeof ApiTypeParameterSchema.Type
export type ApiParameter = typeof ApiParameterSchema.Type
export type ApiReturn = typeof ApiReturnSchema.Type
export type ApiSignature = typeof ApiSignatureSchema.Type
export type ApiMember = typeof ApiMemberSchema.Type
export type ApiFacet = typeof ApiFacetSchema.Type
export type ApiExport = typeof ApiExportSchema.Type
export type ApiCategory = typeof ApiCategorySchema.Type
export type ApiPage = typeof ApiPageSchema.Type
export type ApiSearchEntry = typeof ApiSearchEntrySchema.Type
export type ApiSearchIndex = typeof ApiSearchIndexSchema.Type
