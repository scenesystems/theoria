/**
 * Caller-owned model identity, independent of execution route.
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
  /** Model identifier passed to the provider adapter. */
  modelRef: Schema.String,
  /** Requested immutable or named model revision. */
  revision: Schema.optional(Schema.String),
  /** Caller-facing name retained with the request. */
  alias: Schema.optional(Schema.String),
  /** Requested adapter or fine-tune identity. */
  adapter: Schema.optional(Schema.String),
  /** Caller-supplied model-family classification. */
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
