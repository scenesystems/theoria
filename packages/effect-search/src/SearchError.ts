/**
 * Closed vocabulary of expected search failures.
 *
 * @since 0.1.0
 * @module
 */
import * as Journal from "@scenesystems/effect-study/Journal"
import { Schema } from "effect"

import { Value } from "./Objective.js"

/** Invalid search-space declaration or compilation. @since 0.1.0 @category errors */
export class InvalidSearchSpace extends Schema.TaggedError<InvalidSearchSpace>()(
  "effect-search/InvalidSearchSpace",
  {
    reason: Schema.String,
    dimension: Schema.optional(Schema.String)
  }
) {}

/** Invalid sampler configuration. @since 0.1.0 @category errors */
export class InvalidSamplerConfig extends Schema.TaggedError<InvalidSamplerConfig>()(
  "effect-search/InvalidSamplerConfig",
  {
    reason: Schema.String,
    sampler: Schema.optional(Schema.String)
  }
) {}

/** Exhausted finite sampler. @since 0.1.0 @category errors */
export class SamplerExhausted extends Schema.TaggedError<SamplerExhausted>()(
  "effect-search/SamplerExhausted",
  {
    sampler: Schema.String,
    nextTrialNumber: Schema.Number,
    available: Schema.Number
  }
) {}

/** Grid-incompatible search-space dimension. @since 0.1.0 @category errors */
export class GridIncompatible extends Schema.TaggedError<GridIncompatible>()(
  "effect-search/GridIncompatible",
  {
    dimension: Schema.String,
    reason: Schema.String
  }
) {}

/** Unsupported sampler search-space shape. @since 0.1.0 @category errors */
export class SamplerSearchSpaceUnsupported extends Schema.TaggedError<SamplerSearchSpaceUnsupported>()(
  "effect-search/SamplerSearchSpaceUnsupported",
  {
    sampler: Schema.String,
    reason: Schema.String,
    dimension: Schema.optional(Schema.String),
    distribution: Schema.optional(Schema.String)
  }
) {}

/** Unsupported sampler objective shape. @since 0.1.0 @category errors */
export class SamplerObjectiveUnsupported extends Schema.TaggedError<SamplerObjectiveUnsupported>()(
  "effect-search/SamplerObjectiveUnsupported",
  {
    sampler: Schema.String,
    objective: Schema.String,
    reason: Schema.String
  }
) {}

/** Invalid optimization configuration or persisted state. @since 0.1.0 @category errors */
export class InvalidOptimizationConfig extends Schema.TaggedError<InvalidOptimizationConfig>()(
  "effect-search/InvalidOptimizationConfig",
  { reason: Schema.String }
) {}

/** Invalid completed objective value. @since 0.1.0 @category errors */
export class InvalidObjectiveValue extends Schema.TaggedError<InvalidObjectiveValue>()(
  "effect-search/InvalidObjectiveValue",
  {
    trialNumber: Schema.Number,
    value: Value
  }
) {}

/** Invalid intermediate objective report. @since 0.1.0 @category errors */
export class InvalidObjectiveReport extends Schema.TaggedError<InvalidObjectiveReport>()(
  "effect-search/InvalidObjectiveReport",
  {
    trialNumber: Schema.Number,
    reason: Schema.String,
    step: Schema.optional(Schema.Number),
    value: Schema.optional(Schema.Number),
    previousStep: Schema.optional(Schema.Number)
  }
) {}

/** Objective execution failure associated with a trial. @since 0.1.0 @category errors */
export class TrialError extends Schema.TaggedError<TrialError>()(
  "effect-search/TrialError",
  {
    trialNumber: Schema.Number,
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

/** Absence of a successful trial. @since 0.1.0 @category errors */
export class NoSuccessfulTrials extends Schema.TaggedError<NoSuccessfulTrials>()(
  "effect-search/NoSuccessfulTrials",
  { trialCount: Schema.Number }
) {}

/** Input outside a numerical helper's domain. @since 0.1.0 @category errors */
export class InvalidMathInput extends Schema.TaggedError<InvalidMathInput>()(
  "effect-search/InvalidMathInput",
  {
    operation: Schema.String,
    reason: Schema.String
  }
) {}

/** Recognized but unavailable execution path. @since 0.1.0 @category errors */
export class NotImplemented extends Schema.TaggedError<NotImplemented>()(
  "effect-search/NotImplemented",
  { feature: Schema.String }
) {}

/**
 * Every expected search failure, including shared persistence failures.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SearchError = Schema.Union(
  InvalidSearchSpace,
  InvalidSamplerConfig,
  SamplerExhausted,
  GridIncompatible,
  SamplerSearchSpaceUnsupported,
  SamplerObjectiveUnsupported,
  InvalidOptimizationConfig,
  InvalidObjectiveValue,
  InvalidObjectiveReport,
  TrialError,
  NoSuccessfulTrials,
  InvalidMathInput,
  NotImplemented,
  Journal.Failure
)

/** Expected search failure decoded by {@link SearchError}. @since 0.1.0 @category models */
export type SearchError = typeof SearchError.Type

/**
 * Validates and narrows a recognizable search failure, including decoded wire values.
 *
 * @since 0.1.0
 * @category guards
 */
export const isSearchError = Schema.is(SearchError)
