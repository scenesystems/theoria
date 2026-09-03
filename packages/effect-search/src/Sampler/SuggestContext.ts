/**
 * Immutable trial history and reservation state supplied for one suggestion.
 *
 * @since 0.1.0
 */
import { Data, Option, Schema } from "effect"

import { ObjectiveSpecSchema, singleObjectiveSpec } from "../contracts/ObjectiveSpec.js"
import { type ObjectiveValue, ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import type { SamplerConfig } from "../internal/configAccess.js"

const SuggestionEpsilonSchema = Schema.NonNegative.pipe(
  Schema.filter((value) => Number.isFinite(value))
)

/**
 * Records one completed observation in the sampler's untyped configuration space.
 *
 * @remarks
 * Optional statistical fields are interpreted only by samplers that consume
 * them. TPE uses observation weight, positive cost, non-negative variance, and
 * constraint values; other built-in samplers may ignore those fields.
 * @since 0.1.0
 * @category models
 */
export class SuggestCompletedTrial extends Schema.Class<SuggestCompletedTrial>("effect-search/SuggestCompletedTrial")({
  /** Study-assigned identity used to preserve observation order. */
  trialNumber: Schema.Number,
  /** Evaluated configuration keyed by search-space parameter name. */
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Observed scalar objective or vector matching `objectiveSpec`. */
  value: ObjectiveValueSchema,
  /** Relative contribution used when a sampler performs weighted fitting. */
  observationWeight: Schema.optional(Schema.Number),
  /** Evaluation cost used by cost-aware acquisition when finite and positive. */
  cost: Schema.optional(Schema.Number),
  /** Objective variance used by noise-aware fitting when finite and non-negative. */
  variance: Schema.optional(Schema.Number),
  /** Constraint residuals; values at or below zero are feasible. */
  constraints: Schema.optional(Schema.Array(Schema.Number))
}) {}

/**
 * Identifies a reserved configuration whose objective has not completed.
 *
 * @remarks
 * The sampler's {@link PendingImputationPolicy} determines whether it also
 * appears as a synthetic completed observation.
 * @since 0.1.0
 * @category models
 */
export class SuggestPendingTrial extends Schema.Class<SuggestPendingTrial>("effect-search/SuggestPendingTrial")({
  /** Study-assigned identity for the reservation. */
  trialNumber: Schema.Number,
  /** Reserved configuration keyed by search-space parameter name. */
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

/**
 * Presents the history, objective contract, and next trial identity for a suggestion.
 *
 * @remarks
 * Built-in samplers derive per-trial random state from `nextTrialNumber`.
 * `epsilon` is a finite non-negative multi-objective dominance tolerance rather
 * than an exploration probability. Construction and decoding reject invalid
 * epsilon values; other numeric fields retain their schema values.
 * @since 0.1.0
 * @category models
 */
export class SuggestContext extends Schema.Class<SuggestContext>("effect-search/SuggestContext")({
  /** Real observations followed by any pending-trial imputations. */
  completed: Schema.Array(SuggestCompletedTrial),
  /** Reservations still awaiting an objective result. */
  pending: Schema.Array(SuggestPendingTrial),
  /** Objective directions and arity used to interpret observation values. */
  objectiveSpec: ObjectiveSpecSchema,
  /** Identity assigned to the suggestion being requested. */
  nextTrialNumber: Schema.Number,
  /** Inclusive improvement tolerance used in multi-objective comparisons. */
  epsilon: SuggestionEpsilonSchema
}) {}

/**
 * Carries a suggested configuration with the trial identity reserved for it.
 * @since 0.1.0
 * @category models
 */
export class SuggestionReservation extends Data.Class<{
  /** Identity that the study must use when reporting the result. */
  readonly trialNumber: number
  /** Suggested configuration retained until completion or cancellation. */
  readonly config: SamplerConfig
}> {}

/**
 * Creates a completed sampler observation and omits absent optional fields.
 *
 * @remarks
 * The constraint array is copied. The configuration record and scalar fields
 * are retained as supplied; this constructor performs no range or arity checks.
 * @since 0.1.0
 * @category constructors
 */
export const makeSuggestCompletedTrial = (
  trialNumber: number,
  config: SamplerConfig,
  value: ObjectiveValue,
  observationWeight?: number,
  cost?: number,
  variance?: number,
  constraints?: ReadonlyArray<number>
): SuggestCompletedTrial =>
  new SuggestCompletedTrial({
    trialNumber,
    config,
    value,
    ...Option.fromNullable(observationWeight).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedObservationWeight) => ({
          observationWeight: resolvedObservationWeight
        })
      })
    ),
    ...Option.fromNullable(cost).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedCost) => ({
          cost: resolvedCost
        })
      })
    ),
    ...Option.fromNullable(variance).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedVariance) => ({
          variance: resolvedVariance
        })
      })
    ),
    ...Option.fromNullable(constraints).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedConstraints) => ({
          constraints: [...resolvedConstraints]
        })
      })
    )
  })

/**
 * Creates a pending sampler observation without copying its configuration record.
 * @since 0.1.0
 * @category constructors
 */
export const makeSuggestPendingTrial = (
  trialNumber: number,
  config: SamplerConfig
): SuggestPendingTrial =>
  new SuggestPendingTrial({
    trialNumber,
    config
  })

/**
 * Creates a cold-start context for a minimizing scalar objective.
 *
 * @remarks
 * Completed and pending histories are empty and epsilon is zero.
 *
 * @param nextTrialNumber - Identity used to derive the suggestion; defaults to `0`.
 * @since 0.1.0
 * @category constructors
 */
export const emptySuggestContext = (nextTrialNumber = 0): SuggestContext =>
  new SuggestContext({
    completed: [],
    pending: [],
    objectiveSpec: singleObjectiveSpec(),
    nextTrialNumber,
    epsilon: 0
  })
