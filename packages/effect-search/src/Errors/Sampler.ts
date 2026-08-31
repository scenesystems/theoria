/**
 * Tagged error variants for sampler-related failures such as invalid configuration, exhaustion, and grid incompatibility.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * An error indicating that sampler configuration is invalid.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidSamplerConfig extends Schema.TaggedError<InvalidSamplerConfig>()(
  "effect-search/InvalidSamplerConfig",
  {
    reason: Schema.String,
    sampler: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * An error indicating that a sampler cannot produce another suggestion.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerExhausted extends Schema.TaggedError<SamplerExhausted>()(
  "effect-search/SamplerExhausted",
  {
    sampler: Schema.String,
    nextTrialNumber: Schema.Number,
    available: Schema.Number
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * An error indicating that a search space cannot be represented by the configured grid sampler.
 *
 * @since 0.1.0
 * @category errors
 */
export class GridIncompatible extends Schema.TaggedError<GridIncompatible>()(
  "effect-search/GridIncompatible",
  {
    dimension: Schema.String,
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * An error indicating that a sampler does not support the supplied search space.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerSearchSpaceUnsupported extends Schema.TaggedError<SamplerSearchSpaceUnsupported>()(
  "effect-search/SamplerSearchSpaceUnsupported",
  {
    sampler: Schema.String,
    reason: Schema.String,
    dimension: Schema.optional(Schema.String),
    distribution: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * An error indicating that a sampler does not support the requested objective shape.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerObjectiveUnsupported extends Schema.TaggedError<SamplerObjectiveUnsupported>()(
  "effect-search/SamplerObjectiveUnsupported",
  {
    sampler: Schema.String,
    objective: Schema.String,
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
