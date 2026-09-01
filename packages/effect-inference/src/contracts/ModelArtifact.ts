/**
 * Requested model-identity authority independent of execution route.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Decodes caller-owned model identity without accepting provider, endpoint, or
 * other execution-route claims.
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
 * Captures caller-owned model identity independently from provider routing.
 * Optional revision, alias, adapter, and family fields refine intent; their
 * absence makes no claim about values selected by the runtime.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ModelArtifact = Schema.Schema.Type<typeof ModelArtifactSchema>
