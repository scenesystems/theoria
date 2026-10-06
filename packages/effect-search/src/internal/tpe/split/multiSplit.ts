/**
 * Multi-objective trial split — Pareto front decomposition with scalarized constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Equal, Match, Number as Num, Option, Result } from "effect"

import type { Vector } from "../../../Objective.js"

import type { Direction } from "../../../Direction.js"
import type { SamplerConfig } from "../../../internal/configAccess.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import { toVector } from "../../../Objective.js"
import { nonDominatedSort } from "../../../Pareto.js"
import { referencePoint } from "../../../Pareto.js"
import type { Observation } from "../../../Sampler.js"
import { normalizePoint } from "../../paretoDominance.js"
import { ConstraintAwareSplitTrial, splitWithConstraintFeasibility } from "../constraints/split.js"
import { hypervolumeSubset } from "./hypervolumeSubset.js"

const minimumWeight = 1e-12

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
    Equal.equals(Arr.length(vector), dimensions),
    Arr.every(vector, isFinite)
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
            ...Option.fromNullishOr(trial.observationWeight).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (observationWeight) => ({ observationWeight })
              })
            ),
            ...Option.fromNullishOr(trial.cost).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (cost) => ({ cost })
              })
            ),
            ...Option.fromNullishOr(trial.variance).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (variance) => ({ variance })
              })
            ),
            ...Option.fromNullishOr(trial.constraints).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (constraints) => ({ constraints })
              })
            )
          })
        )),
      Match.orElse(() => Option.none()),
      Result.fromOption(() => undefined)
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
    Option.filter(isFinite),
    Option.getOrElse(() => minimumWeight)
  )
}

const scalarizedValue = (rank: number, weight: number): number =>
  Num.sum(
    rank,
    Num.subtract(
      1,
      Num.clamp(weight, {
        minimum: minimumWeight,
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
        onNone: () => Arr.empty(),
        onSome: (trial) =>
          Arr.of(
            new ConstraintAwareSplitTrial({
              trial: new CompletedTrialForSplit({
                trialNumber: trial.trialNumber,
                config: trial.config,
                value: scalarizedValue(rank, weightAt(weights, index)),
                ...Option.fromNullishOr(trial.observationWeight).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (observationWeight) => ({ observationWeight })
                  })
                ),
                ...Option.fromNullishOr(trial.cost).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (cost) => ({ cost })
                  })
                ),
                ...Option.fromNullishOr(trial.variance).pipe(
                  Option.match({
                    onNone: () => ({}),
                    onSome: (variance) => ({ variance })
                  })
                )
              }),
              constraints: Option.fromNullishOr(trial.constraints).pipe(
                Option.getOrElse(() => Arr.empty())
              )
            })
          )
      })
    ))
}

const splitCount = (size: number, nBelowOverride?: number): number => {
  const requested = Option.fromNullishOr(nBelowOverride).pipe(Option.getOrElse(() => defaultGamma(size)))

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

  return Match.value(Num.isLessThanOrEqualTo(Arr.length(directions), 0)).pipe(
    Match.when(true, () => ({
      below: Arr.empty<CompletedTrialForSplit>(),
      above: Arr.empty<CompletedTrialForSplit>()
    })),
    Match.orElse(() => {
      const trials = asMultiObjectiveTrials(completed, Arr.length(directions))
      const points = Arr.map(trials, (trial) => trial.vector)
      const fronts = nonDominatedSort(points, directions, epsilon)
      const count = splitCount(Arr.length(trials), nBelowOverride)
      const selected = Arr.reduce(fronts, Arr.empty<number>(), (indices, front) => {
        const needed = Num.max(0, Num.subtract(count, Arr.length(indices)))
        if (Num.isGreaterThanOrEqualTo(needed, Arr.length(front))) return Arr.appendAll(indices, front)
        if (Equal.equals(needed, 0)) return indices
        const losses = Arr.map(
          front,
          (index) => normalizePoint(Arr.get(points, index).pipe(Option.getOrThrow), directions)
        )
        const chosen = hypervolumeSubset(losses, referencePoint(losses), needed)
        return Arr.appendAll(indices, Arr.map(chosen, (index) => Arr.get(front, index).pipe(Option.getOrThrow)))
      })
      const weights = Arr.map(points, (_point, index) =>
        Bool.match(Arr.contains(selected, index), {
          onTrue: () => 1,
          onFalse: () => minimumWeight
        }))
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
