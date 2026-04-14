/**
 * Five-variant tagged union modeling a trial's lifecycle state machine.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import { TrialError } from "../Errors/index.js"

/**
 * Schema for the five-variant tagged union that models a trial's lifecycle.
 *
 * - **Running** — the trial is actively evaluating an objective function.
 * - **Completed** — evaluation finished and produced an {@link ObjectiveValueSchema} result.
 * - **Failed** — evaluation threw a {@link TrialError} before producing a value.
 * - **Pruned** — an early-stopping policy terminated the trial mid-evaluation.
 * - **Cancelled** — external interruption (user abort, timeout) stopped the trial.
 *
 * @see {@link TrialState} for the inferred type
 * @see {@link Trial} for the immutable record that carries this state
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialStateSchema = Schema.Union(
  Schema.TaggedStruct("Running", {
    startedAt: Schema.Number
  }),
  Schema.TaggedStruct("Completed", {
    value: ObjectiveValueSchema,
    duration: Schema.Number,
    retryCount: Schema.Number,
    evaluationCount: Schema.optional(Schema.Number),
    variance: Schema.optional(Schema.Number)
  }),
  Schema.TaggedStruct("Failed", {
    error: TrialError,
    duration: Schema.Number
  }),
  Schema.TaggedStruct("Pruned", {
    step: Schema.Number,
    reason: Schema.String,
    policy: Schema.String,
    duration: Schema.Number
  }),
  Schema.TaggedStruct("Cancelled", {
    cancelled: Schema.optional(Schema.Literal(true))
  })
)

/**
 * Discriminated union representing the lifecycle state machine of a trial.
 * A trial begins as `Running` and transitions exactly once to a terminal
 * state — `Completed`, `Failed`, `Pruned`, or `Cancelled`. Transitions are
 * performed by noun-owned combinators on {@link Trial}.
 *
 * @see {@link TrialStateSchema} for the underlying schema definition
 * @see {@link matchState} for exhaustive pattern matching over all variants
 *
 * @since 0.1.0
 * @category models
 */
export type TrialState = Schema.Schema.Type<typeof TrialStateSchema>

const TrialStateConstructors = Data.taggedEnum<TrialState>()

/**
 * Destructured constructors, guards, and pattern matchers for the {@link TrialState} tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * Constructs the initial lifecycle state, indicating the trial's objective
   * function is currently being evaluated. Records `startedAt` to compute
   * elapsed duration on transition to a terminal state.
   *
   * @see {@link Trial.run} for the primary trial creation entry point
   *
   * @since 0.1.0
   * @category constructors
   */
  Running,
  /**
   * Constructs the terminal state reached when the objective function returns
   * a value successfully. Carries the objective value, elapsed duration,
   * retry count, and optional evaluation/variance metadata.
   *
   * @see {@link CompletedState} for the narrowed type
   * @see {@link Trial.complete} for the lifecycle transition
   *
   * @since 0.1.0
   * @category constructors
   */
  Completed,
  /**
   * Constructs the terminal state reached when the objective function throws
   * or returns an unrecoverable error. Captures the {@link TrialError} and
   * elapsed duration for post-hoc diagnostics.
   *
   * @see {@link Trial.fail} for the lifecycle transition
   *
   * @since 0.1.0
   * @category constructors
   */
  Failed,
  /**
   * Constructs the terminal state reached when an early-stopping policy
   * (e.g. median pruner) decides the trial is unlikely to improve. Records
   * the step at which pruning occurred, a human-readable reason, and the
   * policy name for auditability.
   *
   * @see {@link Trial.prune} for the lifecycle transition
   *
   * @since 0.1.0
   * @category constructors
   */
  Pruned,
  /**
   * Constructs the terminal state reached when a trial is stopped by
   * external interruption — user abort, timeout, or study-level cancellation.
   * Unlike Failed, no error is recorded because the interruption is intentional.
   *
   * @see {@link cancel} for the lifecycle transition function
   *
   * @since 0.1.0
   * @category constructors
   */
  Cancelled,
  /**
   * Reports whether a trial state matches a specific variant tag. Accepts the
   * tag string and returns a type-narrowing predicate. Supports data-first
   * usage: `isState("Completed")(trial.state)`.
   *
   * @see {@link TrialState} for the full set of variant tags
   * @see {@link matchState} for exhaustive branching instead of single-variant checks
   *
   * @since 0.1.0
   * @category guards
   */
  $is: isState,
  /**
   * Exhaustive pattern match over all five {@link TrialState} variants.
   * The compiler enforces that every branch is handled, preventing silent
   * omissions when new states are added.
   *
   * @see {@link TrialState} for the variant definitions
   * @see {@link isState} for single-variant narrowing
   *
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchState
} = TrialStateConstructors

/**
 * Narrowed intersection of {@link TrialState} where `_tag` is `"Completed"`.
 * Use this type to accept only trials that have finished successfully,
 * giving access to `value`, `duration`, and `retryCount` without requiring
 * a runtime check at the call site.
 *
 * @see {@link Completed} for the constructor
 * @see {@link CompletedTrial} for the full trial record narrowed to this state
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletedState = Data.TaggedEnum.Value<TrialState, "Completed">
