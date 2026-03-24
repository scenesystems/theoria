/**
 * Tagged error variants for study-level failures including invalid configuration, objective reporting, trial errors, and math input violations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import { SearchErrorTypeId } from "./typeId.js"

/**
 * @since 0.1.0
 * @category errors
 */
export class InvalidStudyConfig extends Schema.TaggedError<InvalidStudyConfig>()(
  "effect-search/InvalidStudyConfig",
  {
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
export class InvalidObjectiveValue extends Schema.TaggedError<InvalidObjectiveValue>()(
  "effect-search/InvalidObjectiveValue",
  {
    trialNumber: Schema.Number,
    value: ObjectiveValueSchema
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * @since 0.1.0
 * @category errors
 */
export class InvalidObjectiveReport extends Schema.TaggedError<InvalidObjectiveReport>()(
  "effect-search/InvalidObjectiveReport",
  {
    trialNumber: Schema.Number,
    reason: Schema.String,
    step: Schema.optional(Schema.Number),
    value: Schema.optional(Schema.Number),
    previousStep: Schema.optional(Schema.Number)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * @since 0.1.0
 * @category errors
 */
export class TrialError extends Schema.TaggedError<TrialError>()(
  "effect-search/TrialError",
  {
    trialNumber: Schema.Number,
    message: Schema.String,
    cause: Schema.Unknown
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * @since 0.1.0
 * @category errors
 */
export class NoSuccessfulTrials extends Schema.TaggedError<NoSuccessfulTrials>()(
  "effect-search/NoSuccessfulTrials",
  {
    trialCount: Schema.Number
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * @since 0.1.0
 * @category errors
 */
export class InvalidMathInput extends Schema.TaggedError<InvalidMathInput>()(
  "effect-search/InvalidMathInput",
  {
    operation: Schema.String,
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
export class NotImplemented extends Schema.TaggedError<NotImplemented>()(
  "effect-search/NotImplemented",
  {
    feature: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
