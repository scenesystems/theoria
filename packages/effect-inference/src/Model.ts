/**
 * Caller-owned model identity, independent of provider routing.
 *
 * @since 0.5.0
 * @module
 */
import * as Schema from "effect/Schema"

/**
 * Model identity requested by a caller.
 *
 * @since 0.5.0
 * @category models
 */
export const Model = Schema.Struct({
  modelRef: Schema.String,
  revision: Schema.optional(Schema.String),
  alias: Schema.optional(Schema.String),
  adapter: Schema.optional(Schema.String),
  family: Schema.optional(Schema.String)
}).annotations({ identifier: "@scenesystems/effect-inference/Model/Model" })

/**
 * Model identity requested by a caller.
 *
 * @since 0.5.0
 * @category models
 */
export type Model = typeof Model.Type
