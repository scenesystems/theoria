/**
 * Requested model-identity authority independent of execution route.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Schema describing the model the caller wants, independent of where it is
 * executed.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ModelArtifactSchema = Schema.Struct({
  modelRef: Schema.String,
  revision: Schema.optional(Schema.String),
  alias: Schema.optional(Schema.String),
  adapter: Schema.optional(Schema.String),
  family: Schema.optional(Schema.String)
})

/**
 * Extracted requested model-identity record.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ModelArtifact = Schema.Schema.Type<typeof ModelArtifactSchema>
