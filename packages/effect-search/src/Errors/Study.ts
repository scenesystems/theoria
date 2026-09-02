/**
 * Expected failures owned by study setup, objective evaluation, and result selection.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import { SearchErrorTypeId } from "./typeId.js"

/**
 * Reports an invalid study option, resume seed, scheduler configuration, or persisted state.
 * `reason` contains the rejected condition; callers decide whether to correct input or
 * discard incompatible recovery data.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidStudyConfig extends Schema.TaggedError<InvalidStudyConfig>()(
  "effect-search/InvalidStudyConfig",
  {
    /** Failed option, compatibility check, or persistence invariant. */
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Rejects a completed objective with non-finite coordinates or the wrong arity.
 * `trialNumber` identifies the evaluation and `value` preserves the rejected result.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidObjectiveValue extends Schema.TaggedError<InvalidObjectiveValue>()(
  "effect-search/InvalidObjectiveValue",
  {
    /** Trial whose completed objective value was rejected. */
    trialNumber: Schema.Number,
    /** Non-finite scalar or incompatible vector result returned by the objective. */
    value: ObjectiveValueSchema
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Rejects an intermediate report or aggregated objective observation.
 * `reason` identifies the failed condition. Optional fields retain the current step,
 * numeric value, and preceding step when those values contributed to the failure.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidObjectiveReport extends Schema.TaggedError<InvalidObjectiveReport>()(
  "effect-search/InvalidObjectiveReport",
  {
    /** Trial whose intermediate or aggregated report was rejected. */
    trialNumber: Schema.Number,
    /** Failed ordering, finiteness, arity, or cost condition. */
    reason: Schema.String,
    /** Current intermediate step when step ordering was checked. */
    step: Schema.optional(Schema.Number),
    /** Numeric observation or cost that contributed to the rejection. */
    value: Schema.optional(Schema.Number),
    /** Last accepted step when monotonic step ordering failed. */
    previousStep: Schema.optional(Schema.Number)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Associates an objective failure with its trial.
 * `message` is caller-facing diagnostic text and `cause` preserves the original unknown
 * value for retry policy and inspection. Neither field is redacted for untrusted output.
 *
 * @since 0.1.0
 * @category errors
 */
export class TrialError extends Schema.TaggedError<TrialError>()(
  "effect-search/TrialError",
  {
    /** Trial whose objective, timeout, or cache operation failed. */
    trialNumber: Schema.Number,
    /** Caller-facing diagnostic derived from the failure cause. */
    message: Schema.String,
    /** Original failure value retained without redaction. */
    cause: Schema.Unknown
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports that result selection found no completed trial with an objective value.
 * `trialCount` includes every observed lifecycle state, allowing callers to distinguish
 * an empty study from one containing only failed or pruned trials.
 *
 * @since 0.1.0
 * @category errors
 */
export class NoSuccessfulTrials extends Schema.TaggedError<NoSuccessfulTrials>()(
  "effect-search/NoSuccessfulTrials",
  {
    /** Total observed trials across completed, failed, pruned, cancelled, and running states. */
    trialCount: Schema.Number
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Rejects input outside a numerical helper's implemented domain.
 * `operation` identifies the calculation and `reason` records its failed precondition.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidMathInput extends Schema.TaggedError<InvalidMathInput>()(
  "effect-search/InvalidMathInput",
  {
    /** Numerical helper that rejected its arguments. */
    operation: Schema.String,
    /** Failed finiteness, range, or dimensionality condition. */
    reason: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}

/**
 * Reports an execution path that the current implementation does not implement.
 * `feature` names the unavailable path so callers can select another operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class NotImplemented extends Schema.TaggedError<NotImplemented>()(
  "effect-search/NotImplemented",
  {
    /** Recognized execution path without a current implementation. */
    feature: Schema.String
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
