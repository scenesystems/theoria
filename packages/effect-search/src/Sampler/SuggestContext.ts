/**
 * Suggestion context — trial history and reservation state for sampler invocation.
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
 * The sampler's view of a completed trial — config stored as an untyped record
 * so samplers remain search-space-agnostic. Carries the objective value, optional
 * observation weight, cost, variance, and constraint violations observed during
 * evaluation.
 *
 * @see {@link makeSuggestCompletedTrial} factory that handles optional field elision
 * @see {@link SuggestContext} where completed trials are consumed
 * @since 0.1.0
 * @category models
 */
export class SuggestCompletedTrial extends Schema.Class<SuggestCompletedTrial>("effect-search/SuggestCompletedTrial")({
  trialNumber: Schema.Number,
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  value: ObjectiveValueSchema,
  observationWeight: Schema.optional(Schema.Number),
  cost: Schema.optional(Schema.Number),
  variance: Schema.optional(Schema.Number),
  constraints: Schema.optional(Schema.Array(Schema.Number))
}) {}

/**
 * An in-flight trial that has been suggested but not yet evaluated. Samplers
 * should account for pending trials to avoid re-suggesting duplicate or
 * nearby configurations while evaluations are still running.
 *
 * @see {@link makeSuggestPendingTrial} factory constructor
 * @see {@link SuggestContext} where pending trials are surfaced to samplers
 * @since 0.1.0
 * @category models
 */
export class SuggestPendingTrial extends Schema.Class<SuggestPendingTrial>("effect-search/SuggestPendingTrial")({
  trialNumber: Schema.Number,
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

/**
 * Full observation context provided to a sampler when requesting the next
 * configuration to evaluate. Contains the history of completed trials, any
 * pending (in-flight) trials the sampler should be aware of, the objective
 * specification defining optimization direction(s), the next trial number to
 * assign, and the exploration epsilon controlling random-vs-model balance.
 *
 * @see {@link SuggestCompletedTrial} shape of each completed observation
 * @see {@link SuggestPendingTrial} shape of each pending observation
 * @since 0.1.0
 * @category models
 */
export class SuggestContext extends Schema.Class<SuggestContext>("effect-search/SuggestContext")({
  completed: Schema.Array(SuggestCompletedTrial),
  pending: Schema.Array(SuggestPendingTrial),
  objectiveSpec: ObjectiveSpecSchema,
  nextTrialNumber: Schema.Number,
  epsilon: SuggestionEpsilonSchema
}) {}

/**
 * Pairs a newly assigned trial number with the configuration a sampler has
 * suggested. Returned from a sampler's `suggest` call so the caller can
 * register the trial and begin evaluation.
 *
 * @see {@link SuggestContext} the input context that produced this reservation
 * @since 0.1.0
 * @category models
 */
export class SuggestionReservation extends Data.Class<{
  readonly trialNumber: number
  readonly config: SamplerConfig
}> {}

/**
 * Constructs a {@link SuggestCompletedTrial} from positional arguments,
 * eliding optional fields (`observationWeight`, `cost`, `variance`,
 * `constraints`) when they are `undefined` rather than including them as
 * explicit `undefined` values.
 *
 * @see {@link SuggestCompletedTrial} the resulting model
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
 * Constructs a {@link SuggestPendingTrial} from a trial number and its
 * sampler-config record.
 *
 * @see {@link SuggestPendingTrial} the resulting model
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
 * Creates an empty {@link SuggestContext} with no completed or pending trials,
 * a single-objective spec, and zero epsilon. Useful for cold-start scenarios
 * where no prior observations exist, or as a baseline in tests.
 *
 * @see {@link SuggestContext} the resulting model
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
