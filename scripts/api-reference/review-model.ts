import { Schema } from "effect"

export const ReviewCounts = Schema.Struct({
  packages: Schema.Number,
  modules: Schema.Number,
  routes: Schema.Number,
  imports: Schema.Number,
  projections: Schema.Number,
  facets: Schema.Number,
  members: Schema.Number,
  signatures: Schema.Number,
  typeParameters: Schema.Number,
  parameters: Schema.Number,
  returns: Schema.Number,
  examples: Schema.Number,
  deprecations: Schema.Number,
  links: Schema.Number,
  categories: Schema.Number
})

export const ReviewExample = Schema.Struct({
  owner: Schema.String,
  package: Schema.String,
  language: Schema.NullOr(Schema.String),
  code: Schema.NullOr(Schema.String)
})

export const ReviewUnit = Schema.Struct({
  package: Schema.String,
  module: Schema.String,
  counts: ReviewCounts,
  semanticHash: Schema.String
})

export const ReviewInventory = Schema.Struct({
  format: Schema.Literal("theoria-api-review-inventory-v1"),
  revision: Schema.String,
  totals: ReviewCounts,
  units: Schema.Array(ReviewUnit),
  diagnostics: Schema.Array(Schema.String)
})

export const ReviewRecord = Schema.Struct({
  format: Schema.Literal("theoria-api-review-record-v1"),
  units: Schema.Array(Schema.Struct({ package: Schema.String, module: Schema.String, semanticHash: Schema.String })),
  duplicateAllowlist: Schema.Array(Schema.Struct({ owners: Schema.Array(Schema.String), summary: Schema.String }))
})

export const ReviewInventoryJson = Schema.parseJson(ReviewInventory)
export const ReviewRecordJson = Schema.parseJson(ReviewRecord, { space: 2 })
export type Counts = typeof ReviewCounts.Type
export type Example = typeof ReviewExample.Type
export type Inventory = typeof ReviewInventory.Type
export type Record = typeof ReviewRecord.Type

export class ReviewError extends Schema.TaggedError<ReviewError>()("ReviewError", {
  diagnostics: Schema.Array(Schema.String)
}) {}
