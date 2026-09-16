/**
 * Multi-objective trial split — Pareto front decomposition with scalarized constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Match, Number as Num, Option, Schema } from "effect"

import type { DirectionVector } from "../../../contracts/Direction.js"
import { normalizeObjectiveVector, type ObjectiveVector } from "../../../contracts/ObjectiveValue.js"
import { SamplerConfigSchema } from "../../../internal/configAccess.js"
import { nonDominatedSort } from "../../../internal/pareto.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { computeMultiObjectiveWeights } from "../../../internal/tpe/multiObjectiveWeights.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { SuggestCompletedTrial, SuggestContext } from "../../../Sampler/index.js"
import {
  ConstraintAwareSplitTrial,
  type ConstraintAwareSplitTrials,
  splitWithConstraintFeasibility
} from "../constraints/split.js"

const WEIGHT_EPSILON = 1e-12

class MultiObjectiveTrial extends Schema.Class<MultiObjectiveTrial>("effect-search/MultiObjectiveTrial")({
  trialNumber: Schema.Number,
  config: SamplerConfigSchema,
  vector: Schema.Array(Schema.Number),
  observationWeight: Schema.optional(Schema.Number),
  cost: Schema.optional(Schema.Number),
  variance: Schema.optional(Schema.Number),
  constraints: Schema.optional(Schema.Array(Schema.Number))
}) {}

type MultiObjectiveTrials = Schema.Array$<typeof MultiObjectiveTrial>["Type"]

const isFinite = Schema.is(Schema.Finite)

const finiteVector = (
  vector: ObjectiveVector,
  dimensions: number
): boolean => Boolean.and(Num.Equivalence(Arr.length(vector), dimensions), Arr.every(vector, isFinite))

const asMultiObjectiveTrials = (
  completed: SuggestContext["completed"],
  dimensions: number
): MultiObjectiveTrials =>
  Arr.filterMap(completed, (trial) => {
    const vector = normalizeObjectiveVector(trial.value)

    return Match.value(finiteVector(vector, dimensions)).pipe(
      Match.when(true, () =>
        Option.some(
          new MultiObjectiveTrial({
            trialNumber: trial.trialNumber,
            config: trial.config,
            vector,
            ...Option.fromNullable(trial.observationWeight).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (observationWeight) => ({ observationWeight })
              })
            ),
            ...Option.fromNullable(trial.cost).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (cost) => ({ cost })
              })
            ),
            ...Option.fromNullable(trial.variance).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (variance) => ({ variance })
              })
            ),
            ...Option.fromNullable(trial.constraints).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (constraints) => ({ constraints })
              })
            )
          })
        )),
      Match.orElse(() => Option.none())
    )
  })

const trialAt = (
  trials: MultiObjectiveTrials,
  index: number
): Option.Option<MultiObjectiveTrial> => Arr.get(trials, index)

const weightAt = (
  weights: ObjectiveVector,
  index: number
): number =>
  Arr.get(weights, index).pipe(
    Option.filter(isFinite),
    Option.getOrElse(() => WEIGHT_EPSILON)
  )

const scalarizedValue = (rank: number, weight: number): number =>
  Num.sum(
    rank,
    Num.subtract(
      1,
      Num.clamp(weight, {
        minimum: WEIGHT_EPSILON,
        maximum: 1
      })
    )
  )

const weightedFrontTrials = (
  trials: MultiObjectiveTrials,
  front: ObjectiveVector,
  rank: number,
  weights: ObjectiveVector
): ConstraintAwareSplitTrials =>
  Arr.flatMap(front, (index) =>
    trialAt(trials, index).pipe(
      Option.match({
        onNone: () => Arr.empty<ConstraintAwareSplitTrial>(),
        onSome: (trial) =>
          Arr.of(
            new ConstraintAwareSplitTrial({
              trial: new CompletedTrialForSplit({
                trialNumber: trial.trialNumber,
                config: trial.config,
                value: scalarizedValue(rank, weightAt(weights, index)),
                ...Option.fromNullable(trial.observationWeight).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (observationWeight) => ({ observationWeight })
                  })
                ),
                ...Option.fromNullable(trial.cost).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (cost) => ({ cost })
                  })
                ),
                ...Option.fromNullable(trial.variance).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (variance) => ({ variance })
                  })
                )
              }),
              constraints: Option.fromNullable(trial.constraints).pipe(
                Option.getOrElse(() => Arr.empty<number>())
              )
            })
          )
      })
    ))

const splitCount = (size: number, nBelowOverride?: number): number => {
  const requested = Option.fromNullable(nBelowOverride).pipe(Option.getOrElse(() => defaultGamma(size)))

  return Num.clamp(requested, {
    minimum: 0,
    maximum: size
  })
}

/**
 * Splits completed trials for multi-objective TPE by computing Pareto fronts,
 * scalarizing with hypervolume-based weights, and partitioning into below/above
 * groups with constraint-aware feasibility.
 *
 * Uses non-dominated sorting and hypervolume contribution to rank trials,
 * ensuring the below group covers the Pareto-optimal region.
 *
 * @see {@link splitSingleObjective} for single-objective splitting
 * @since 0.1.0
 * @category sampling
 */
export const splitMultiObjective = (
  completed: Schema.Array$<typeof SuggestCompletedTrial>["Type"],
  directions: DirectionVector,
  nBelowOverride?: number,
  epsilon = 0
): TrialSplit => {
  return Match.value(Arr.isEmptyReadonlyArray(directions)).pipe(
    Match.when(true, () => ({
      below: Arr.empty<CompletedTrialForSplit>(),
      above: Arr.empty<CompletedTrialForSplit>()
    })),
    Match.orElse(() => {
      const trials = asMultiObjectiveTrials(completed, Arr.length(directions))
      const points = Arr.map(trials, (trial) => trial.vector)
      const weights = computeMultiObjectiveWeights(points, undefined, directions)
      const fronts = nonDominatedSort(points, directions, epsilon)
      const scalarized = Arr.flatMap(fronts, (front, rank) => weightedFrontTrials(trials, front, rank, weights))

      return splitWithConstraintFeasibility(scalarized, nBelowOverride).pipe(
        Option.getOrElse(() =>
          splitTrials(
            Arr.map(scalarized, (trial) => trial.trial),
            () => splitCount(Arr.length(scalarized), nBelowOverride)
          )
        )
      )
    })
  )
}
