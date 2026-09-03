/**
 * Expected sampler configuration, compatibility, and exhaustion failures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * Rejects sampler construction or suggestion when an option violates its invariants.
 * `reason` contains the failed condition; `sampler` identifies the implementation when known.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidSamplerConfig extends Schema.TaggedError<InvalidSamplerConfig>()(
  "effect-search/InvalidSamplerConfig",
  {
    /** Failed construction or suggestion invariant. */
    reason: Schema.String,
    /** Sampler implementation associated with the failure when known. */
    sampler: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports that a finite sampler has no configuration for `nextTrialNumber`.
 * `available` records the total configurations in that sampler's current finite sequence.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerExhausted extends Schema.TaggedError<SamplerExhausted>()(
  "effect-search/SamplerExhausted",
  {
    /** Finite sampler whose configuration sequence was exhausted. */
    sampler: Schema.String,
    /** Trial number that has no corresponding configuration. */
    nextTrialNumber: Schema.Number,
    /** Total configurations in the sampler's current finite sequence. */
    available: Schema.Number
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports a dimension that grid sampling cannot enumerate to a finite value set.
 * `reason` records the incompatible distribution condition.
 *
 * @since 0.1.0
 * @category errors
 */
export class GridIncompatible extends Schema.TaggedError<GridIncompatible>()(
  "effect-search/GridIncompatible",
  {
    /** Search-space dimension that cannot be enumerated. */
    dimension: Schema.String,
    /** Distribution condition preventing a finite grid. */
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports that a sampler cannot represent the supplied search space.
 * `dimension` and `distribution`, when present, locate the unsupported parameter;
 * `reason` records the sampler requirement it violates.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerSearchSpaceUnsupported extends Schema.TaggedError<SamplerSearchSpaceUnsupported>()(
  "effect-search/SamplerSearchSpaceUnsupported",
  {
    /** Sampler implementation that rejected the space. */
    sampler: Schema.String,
    /** Sampler requirement violated by the space. */
    reason: Schema.String,
    /** Rejected parameter name when one dimension caused the failure. */
    dimension: Schema.optional(Schema.String),
    /** Rejected distribution kind when one distribution caused the failure. */
    distribution: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports that a sampler cannot optimize the selected objective shape.
 * `objective` names the rejected shape and `reason` records the supported constraint.
 *
 * @since 0.1.0
 * @category errors
 */
export class SamplerObjectiveUnsupported extends Schema.TaggedError<SamplerObjectiveUnsupported>()(
  "effect-search/SamplerObjectiveUnsupported",
  {
    /** Sampler implementation that rejected the objective. */
    sampler: Schema.String,
    /** Scalar or vector objective shape that was rejected. */
    objective: Schema.String,
    /** Objective constraint imposed by the sampler. */
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
