/**
 * Runtime schema and tagged values for trial lifecycle state.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import { TrialError } from "../Errors/index.js"

/**
 * Decodes running, completed, failed, pruned, and cancelled states used in
 * snapshots and trial records.
 *
 * Running timestamps and terminal durations use milliseconds under the default
 * study clock. Completed states carry the objective result and retry metadata.
 * Failed states retain a typed {@link TrialError}; pruned states retain the
 * policy decision. Cancellation carries no timing or error information. The
 * schema checks field types but does not constrain numeric ranges or finiteness.
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
 * Tracks a pending evaluation or one of its terminal outcomes. Lifecycle
 * functions create new values without enforcing valid source-state transitions.
 *
 * @since 0.1.0
 * @category models
 */
export type TrialState = Schema.Schema.Type<typeof TrialStateSchema>

const TrialStateConstructors = Data.taggedEnum<TrialState>()

/**
 * Constructors and matching functions derived from the trial-state tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * Creates a pending state whose millisecond timestamp is used for elapsed
   * duration calculations. The value is not validated against the clock.
   *
   * @since 0.1.0
   * @category constructors
   */
  Running,
  /**
   * Creates a successful terminal state with objective, elapsed-time, retry,
   * and optional repeated-evaluation metadata. It does not validate those
   * values against an objective specification.
   *
   * @since 0.1.0
   * @category constructors
   */
  Completed,
  /**
   * Creates a terminal failure with the diagnostic error and elapsed duration.
   *
   * @since 0.1.0
   * @category constructors
   */
  Failed,
  /**
   * Creates a terminal pruning result from a policy's step and explanation.
   *
   * @since 0.1.0
   * @category constructors
   */
  Pruned,
  /**
   * Creates a terminal cancellation state with no error or elapsed duration.
   *
   * @since 0.1.0
   * @category constructors
   */
  Cancelled,
  /**
   * Builds a predicate that narrows a state to the selected tag.
   *
   * @typeParam Tag - State discriminator selected for narrowing.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { isState, makeRunning } from "@scenesystems/effect-search/Trial"
   *
   * const trial = makeRunning(0, { rate: 0.1 }, 1_000)
   * export const program = Effect.succeed(trial.state).pipe(
   *   Effect.filterOrFail(isState("Running"), () => "ExpectedRunningState"),
   *   Effect.map(({ startedAt }) => startedAt),
   *   Effect.filterOrFail((startedAt) => startedAt === 1_000, () => "UnexpectedStartTime")
   * )
   * ```
   *
   * @since 0.1.0
   * @category guards
   */
  $is: isState,
  /**
   * Builds a function that requires one branch per trial-state variant and
   * returns a common result type.
   *
   * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
   *
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchState
} = TrialStateConstructors

/**
 * Selects the successful terminal variant, including objective, duration, and
 * evaluation metadata.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletedState = Data.TaggedEnum.Value<TrialState, "Completed">
