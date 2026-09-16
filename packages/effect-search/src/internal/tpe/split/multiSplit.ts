/**
 * Multi-objective trial split — Pareto front decomposition with scalarized constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Data, Equal, Match, Number as Num, Option } from "effect"

import type { Vector } from "../../../Objective.js"

import type { Direction } from "../../../Direction.js"
import type { SamplerConfig } from "../../../internal/configAccess.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import { toVector } from "../../../Objective.js"
import { nonDominatedSort } from "../../../Pareto.js"
import { multiObjectiveWeights } from "../../../Pareto.js"
import type { Observation } from "../../../Sampler.js"
import { ConstraintAwareSplitTrial, splitWithConstraintFeasibility } from "../constraints/split.js"

const WEIGHT_EPSILON = 1e-12

class MultiObjectiveTrial extends Data.Class<{
  readonly trialNumber: number
  readonly config: SamplerConfig
  readonly vector: Vector
  readonly observationWeight?: number
  readonly cost?: number
  readonly variance?: number
  readonly constraints?: Vector
}> {}

const finiteVector = (
  vectorInput: Iterable<number>,
  dimensions: number
): boolean => {
  const vector = Arr.fromIterable(vectorInput)
  return Bool.and(
    Equal.equals(vector.length, dimensions),
    Arr.every(vector, (entry) => Number.isFinite(entry))
  )
}

const asMultiObjectiveTrials = (
  completedInput: Iterable<Observation>,
  dimensions: number
) => {
  const completed = Arr.fromIterable(completedInput)
  return Arr.filterMap(completed, (trial) => {
    const vector = toVector(trial.value)

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
}

const trialAt = (
  trialsInput: Iterable<MultiObjectiveTrial>,
  index: number
): Option.Option<MultiObjectiveTrial> => {
  const trials = Arr.fromIterable(trialsInput)
  return Arr.get(trials, index)
}

const weightAt = (
  weightsInput: Iterable<number>,
  index: number
): number => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.get(weights, index).pipe(
    Option.filter((value) => Number.isFinite(value)),
    Option.getOrElse(() => WEIGHT_EPSILON)
  )
}

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
  trialsInput: Iterable<MultiObjectiveTrial>,
  frontInput: Iterable<number>,
  rank: number,
  weightsInput: Iterable<number>
) => {
  const trials = Arr.fromIterable(trialsInput)
  const front = Arr.fromIterable(frontInput)
  const weights = Arr.fromIterable(weightsInput)
  return Arr.flatMap(front, (index) =>
    trialAt(trials, index).pipe(
      Option.match({
        onNone: () => [],
        onSome: (trial) => [
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
              Option.getOrElse(() => [])
            )
          })
        ]
      })
    ))
}

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
  completedInput: Iterable<Observation>,
  directionsInput: Iterable<Direction>,
  nBelowOverride?: number,
  epsilon = 0
): TrialSplit => {
  const completed = Arr.fromIterable(completedInput)
  const directions = Arr.fromIterable(directionsInput)

  return Match.value(Num.lessThanOrEqualTo(directions.length, 0)).pipe(
    Match.when(true, () => ({
      below: Arr.empty<CompletedTrialForSplit>(),
      above: Arr.empty<CompletedTrialForSplit>()
    })),
    Match.orElse(() => {
      const trials = asMultiObjectiveTrials(completed, directions.length)
      const points = Arr.map(trials, (trial) => trial.vector)
      const weights = multiObjectiveWeights(points, undefined, directions)
      const fronts = nonDominatedSort(points, directions, epsilon)
      const scalarized = Arr.flatMap(fronts, (front, rank) => weightedFrontTrials(trials, front, rank, weights))

      return splitWithConstraintFeasibility(scalarized, nBelowOverride).pipe(
        Option.getOrElse(() =>
          splitTrials(
            Arr.map(scalarized, (trial) => trial.trial),
            () => splitCount(scalarized.length, nBelowOverride)
          )
        )
      )
    })
  )
}
