/**
 * Multi-objective trial split — Pareto front decomposition with scalarized constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Number as Num, Option } from "effect"

import type { Direction } from "../../../contracts/Direction.js"
import { normalizeObjectiveVector } from "../../../contracts/ObjectiveValue.js"
import type { SamplerConfig } from "../../../internal/configAccess.js"
import { nonDominatedSort } from "../../../internal/pareto.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { computeMultiObjectiveWeights } from "../../../internal/tpe/multiObjectiveWeights.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { SuggestCompletedTrial } from "../../../Sampler/index.js"
import { ConstraintAwareSplitTrial, splitWithConstraintFeasibility } from "../constraints/split.js"

const WEIGHT_EPSILON = 1e-12

class MultiObjectiveTrial extends Data.Class<{
  readonly trialNumber: number
  readonly config: SamplerConfig
  readonly vector: ReadonlyArray<number>
  readonly observationWeight?: number
  readonly cost?: number
  readonly variance?: number
  readonly constraints?: ReadonlyArray<number>
}> {}

const finiteVector = (
  vector: ReadonlyArray<number>,
  dimensions: number
): boolean => vector.length === dimensions && Arr.every(vector, (entry) => Number.isFinite(entry))

const asMultiObjectiveTrials = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  dimensions: number
): Array<MultiObjectiveTrial> =>
  Arr.filterMap(completed, (trial) => {
    const vector = normalizeObjectiveVector(trial.value)

    return finiteVector(vector, dimensions)
      ? Option.some(
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
      )
      : Option.none()
  })

const trialAt = (
  trials: ReadonlyArray<MultiObjectiveTrial>,
  index: number
): Option.Option<MultiObjectiveTrial> => Arr.get(trials, index)

const weightAt = (
  weights: ReadonlyArray<number>,
  index: number
): number =>
  Arr.get(weights, index).pipe(
    Option.filter((value) => Number.isFinite(value)),
    Option.getOrElse(() => WEIGHT_EPSILON)
  )

const scalarizedValue = (rank: number, weight: number): number =>
  rank +
  (1 -
    Num.clamp(weight, {
      minimum: WEIGHT_EPSILON,
      maximum: 1
    }))

const weightedFrontTrials = (
  trials: ReadonlyArray<MultiObjectiveTrial>,
  front: ReadonlyArray<number>,
  rank: number,
  weights: ReadonlyArray<number>
): Array<ConstraintAwareSplitTrial> =>
  Arr.flatMap(front, (index) =>
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

const splitCount = (size: number, nBelowOverride?: number): number => {
  const requested = Option.fromNullable(nBelowOverride).pipe(Option.getOrElse(() => defaultGamma(size)))

  return Num.clamp(requested, {
    minimum: 0,
    maximum: size
  })
}

/** @since 0.1.0 */
export const splitMultiObjective = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  directions: ReadonlyArray<Direction>,
  nBelowOverride?: number,
  epsilon = 0
): TrialSplit => {
  if (directions.length <= 0) {
    return {
      below: [],
      above: []
    }
  }

  const trials = asMultiObjectiveTrials(completed, directions.length)
  const points = Arr.map(trials, (trial) => trial.vector)
  const weights = computeMultiObjectiveWeights(points, undefined, directions)
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
}
