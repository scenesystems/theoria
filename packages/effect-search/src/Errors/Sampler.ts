/**
 * Tagged error variants for sampler-related failures such as invalid configuration, exhaustion, and grid incompatibility.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * Rejects sampler construction or suggestion when an option cannot satisfy
 * the sampler's numeric or distribution invariants. `reason` is the actionable
 * validation message; `sampler`, when present, identifies the rejecting implementation.
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
 * Signals that a finite sampler has no configuration at `nextTrialNumber`.
 * Callers can stop asking, or resume with a larger/different search space;
 * `available` is the total number of configurations that could be emitted.
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
 * Rejects grid construction when `dimension` cannot be enumerated into a
 * finite value set. `reason` explains the incompatible distribution detail,
 * such as a floating-point dimension without a step.
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
 * Rejects suggestion before sampling when the selected sampler cannot model
 * the supplied space. `reason` states the violated requirement, while optional
 * `dimension` and `distribution` localize the unsupported parameter.
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
 * Rejects suggestion when a sampler cannot optimize the study's objective
 * shape. `objective` records the rejected shape and `reason` describes the
 * supported alternative, allowing callers to select another sampler or objective spec.
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
