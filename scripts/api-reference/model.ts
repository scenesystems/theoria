import { Schema } from "effect"

export const ApiImportKindSchema = Schema.Literal("default", "namespace", "type", "value")

export const ApiReferenceFacetSchema = Schema.Struct({
  reflectionId: Schema.Number,
  reflectionKind: Schema.String,
  sourceUrl: Schema.String
})

export const ApiReferenceImportSchema = Schema.Struct({
  name: Schema.String,
  importKind: ApiImportKindSchema,
  summary: Schema.String,
  since: Schema.String,
  category: Schema.String,
  reflections: Schema.Array(ApiReferenceFacetSchema)
})

export const ApiReferenceRouteSchema = Schema.Struct({
  subpath: Schema.String,
  slug: Schema.String,
  canonical: Schema.Boolean,
  path: Schema.String,
  page: Schema.String,
  imports: Schema.Array(ApiReferenceImportSchema)
})

export const ApiReferenceModuleSchema = Schema.Struct({
  source: Schema.String,
  sourceUrl: Schema.String,
  reflection: Schema.String,
  reflectionSha256: Schema.String,
  reflectionId: Schema.Number,
  routes: Schema.Array(ApiReferenceRouteSchema)
})

export const ApiReferencePackageSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  slug: Schema.String,
  description: Schema.String,
  modules: Schema.Array(ApiReferenceModuleSchema)
})

export const ApiReferenceManifestSchema = Schema.Struct({
  schemaVersion: Schema.Literal(2),
  typedocVersion: Schema.String,
  revision: Schema.String,
  packages: Schema.Array(ApiReferencePackageSchema)
})

export const ApiReferenceManifestJson = Schema.parseJson(ApiReferenceManifestSchema)

export class ApiReferenceGenerationError extends Schema.TaggedError<ApiReferenceGenerationError>()(
  "ApiReferenceGenerationError",
  {
    packageName: Schema.String,
    detail: Schema.String
  }
) {}

export type ApiReferenceFacet = typeof ApiReferenceFacetSchema.Type
export type ApiReferenceImport = typeof ApiReferenceImportSchema.Type
export type ApiReferenceRoute = typeof ApiReferenceRouteSchema.Type
export type ApiReferenceModule = typeof ApiReferenceModuleSchema.Type
export type ApiReferencePackage = typeof ApiReferencePackageSchema.Type
export type ApiReferenceManifest = typeof ApiReferenceManifestSchema.Type
