/**
 * Tagged error variants for sampler-related failures such as invalid configuration, exhaustion, and grid incompatibility.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
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
