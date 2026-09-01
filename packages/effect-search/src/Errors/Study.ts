/**
 * Tagged error variants for study-level failures including invalid configuration, objective reporting, trial errors, and math input violations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import { SearchErrorTypeId } from "./typeId.js"

/**
 * Rejects study setup, resume, scheduling, or snapshot recovery before useful
 * execution can continue. `reason` distinguishes option validation failures
 * from incompatible or corrupt persisted state so callers can correct or discard it.
 *
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
 * Fails completion of `trialNumber` when its scalar or vector objective contains
 * a non-finite value or has the wrong objective arity. `value` preserves the
 * rejected result for diagnostics; the trial is not counted as successful.
 *
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
 * Rejects an objective result or intermediate report before it affects pruning
 * or aggregation. `reason` identifies schema, cost, step, or value validation;
 * optional `step`, `value`, and `previousStep` retain the relevant report context.
 *
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
 * Records an objective failure against `trialNumber`; `message` is stable
 * diagnostic text while `cause` preserves the original unknown failure for
 * recovery policy, retry events, and post-run inspection.
 *
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
 * Returned by result selection when no completed trial can supply a best or
 * Pareto result. `trialCount` includes all observed lifecycle outcomes, so
 * callers can distinguish an empty study from one whose trials failed or were pruned.
 *
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
 * Stops a numerical helper when its domain preconditions are violated rather
 * than returning a misleading NaN or infinity. `operation` identifies the
 * failing computation and `reason` states the input constraint to repair.
 *
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
 * Fails an explicitly unsupported execution path without treating it as bad
 * user data or a trial failure. `feature` names the unavailable capability so
 * callers can choose a supported strategy or handle the gap deliberately.
 *
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
