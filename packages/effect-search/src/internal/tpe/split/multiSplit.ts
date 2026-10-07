/**
 * Multi-objective trial split — Optuna's `_split_trials` for MOTPE: feasible trials fill the below
 * group by non-domination rank with a hypervolume-subset tie-break, infeasible trials follow by
 * positive violation sum, and below trials carry hypervolume-contribution kernel weights.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Equal, HashSet, Number as Num, Option, Order, Tuple } from "effect"

import type { Vector } from "../../../Objective.js"

import type { Direction } from "../../../Direction.js"
import type { SamplerConfig } from "../../../internal/configAccess.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { CompletedTrialForSplit, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import { toVector } from "../../../Objective.js"
import { nonDominatedSort } from "../../../Pareto.js"
import type { Observation } from "../../../Sampler.js"
import { normalizePoint } from "../../paretoDominance.js"
import { hypervolumeSubset } from "./hssp.js"
import { generate, lossReferencePoint, rowAt } from "./hypervolume.js"
import { motpeBelowWeights } from "./motpeWeights.js"

class MultiObjectiveTrial extends Data.Class<{
  readonly trialNumber: number
  readonly config: SamplerConfig
  readonly loss: Vector
  readonly violation: number
  readonly observationWeight?: number
  readonly cost?: number
  readonly variance?: number
}> {}

const finiteVector = (vector: ReadonlyArray<number>, dimensions: number): boolean =>
  Bool.and(Equal.equals(Arr.length(vector), dimensions), Arr.every(vector, isFinite))

const constraintCount = (completed: ReadonlyArray<Observation>): number =>
  Arr.reduce(
    completed,
    0,
    (count, trial) =>
      Num.max(count, Option.match(Option.fromNullishOr(trial.constraints), { onNone: () => 0, onSome: Arr.length }))
  )

/** Optuna's `_get_infeasible_trial_score`; missing constraint values count as infinitely violated. */
const violationSum = (constraints: ReadonlyArray<number>, count: number): number =>
  Num.sumAll(
    generate(count, (index) =>
      Arr.get(constraints, index).pipe(
        Option.map((value) => Num.max(0, value)),
        Option.getOrElse(() => Number.POSITIVE_INFINITY)
      ))
  )

const asMultiObjectiveTrials = (
  completed: ReadonlyArray<Observation>,
  directions: ReadonlyArray<Direction>
): Array<MultiObjectiveTrial> => {
  const count = constraintCount(completed)
  return Arr.sort(
    Arr.getSomes(Arr.map(completed, (trial) => {
      const vector = toVector(trial.value)
      return Option.liftPredicate(vector, (values) => finiteVector(values, Arr.length(directions))).pipe(
        Option.map((values) =>
          new MultiObjectiveTrial({
            trialNumber: trial.trialNumber,
            config: trial.config,
            loss: normalizePoint(values, directions),
            violation: violationSum(Option.getOrElse(Option.fromNullishOr(trial.constraints), () => []), count),
            ...Option.match(Option.fromNullishOr(trial.observationWeight), {
              onNone: () => ({}),
              onSome: (observationWeight) => ({ observationWeight })
            }),
            ...Option.match(Option.fromNullishOr(trial.cost), {
              onNone: () => ({}),
              onSome: (cost) => ({ cost })
            }),
            ...Option.match(Option.fromNullishOr(trial.variance), {
              onNone: () => ({}),
              onSome: (variance) => ({ variance })
            })
          })
        )
      )
    })),
    Order.mapInput(Num.Order, (trial: MultiObjectiveTrial) => trial.trialNumber)
  )
}

const splitCount = (size: number, nBelowOverride?: number): number =>
  Num.clamp(Option.getOrElse(Option.fromNullishOr(nBelowOverride), () => defaultGamma(size)), {
    minimum: 0,
    maximum: size
  })

class FrontSelection extends Data.Class<{
  readonly selected: ReadonlyArray<number>
  readonly ranks: ReadonlyArray<[number, number]>
}> {}

/**
 * `_split_complete_trials_multi_objective`: whole non-domination fronts while they fit, then
 * hypervolume subset selection on the first front that does not, with that front's reference point.
 */
const selectByFronts = (
  trials: ReadonlyArray<MultiObjectiveTrial>,
  nBelow: number,
  epsilon: number
): FrontSelection => {
  const losses = Arr.map(trials, (trial) => trial.loss)
  const minimizeAll = Arr.map(Arr.head(losses).pipe(Option.getOrElse(() => [])), (): Direction => "minimize")
  const fronts = Arr.map(nonDominatedSort(losses, minimizeAll, epsilon), (front) => Arr.sort(front, Num.Order))
  const ranks = Arr.flatMap(fronts, (front, rank) => Arr.map(front, (index) => Tuple.make(index, rank)))
  return new FrontSelection({
    ranks,
    selected: Arr.reduce(fronts, Arr.empty<number>(), (selected, front) => {
      const needed = Num.max(0, Num.subtract(nBelow, Arr.length(selected)))
      return Bool.match(Num.isGreaterThanOrEqualTo(needed, Arr.length(front)), {
        onFalse: () =>
          Bool.match(Equal.equals(needed, 0), {
            onFalse: () => {
              const frontLosses = Arr.map(front, (index) => rowAt(losses, index))
              const chosen = hypervolumeSubset(frontLosses, lossReferencePoint(frontLosses), needed)
              return Arr.appendAll(selected, Arr.map(chosen, (position) => rowAt(front, position)))
            },
            onTrue: () => selected
          }),
        onTrue: () => Arr.appendAll(selected, front)
      })
    })
  })
}

const splitTrial = (trial: MultiObjectiveTrial, value: number, belowWeight: Option.Option<number>) =>
  new CompletedTrialForSplit({
    trialNumber: trial.trialNumber,
    config: trial.config,
    value,
    ...Option.match(Option.fromNullishOr(trial.observationWeight), {
      onNone: () => ({}),
      onSome: (observationWeight) => ({ observationWeight })
    }),
    ...Option.match(Option.fromNullishOr(trial.cost), {
      onNone: () => ({}),
      onSome: (cost) => ({ cost })
    }),
    ...Option.match(Option.fromNullishOr(trial.variance), {
      onNone: () => ({}),
      onSome: (variance) => ({ variance })
    }),
    ...Option.match(belowWeight, {
      onNone: () => ({}),
      onSome: (weight) => ({ belowWeight: weight })
    })
  })

/**
 * Splits completed trials for multi-objective TPE as Optuna's `_split_trials` does.
 *
 * The below-group size is `gamma(n)` over all finite trials (or `nBelowOverride`). Feasible trials
 * fill it by non-domination rank, breaking the last partial front by greedy hypervolume subset
 * selection; infeasible trials, ranked by their positive violation sum, fill any remainder. Each
 * below trial carries its MOTPE `belowWeight` for the l(x) kernels. The split `value` is the
 * front rank, or the front count plus the violation sum for infeasible trials.
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
  const directions = Arr.fromIterable(directionsInput)
  const trials = asMultiObjectiveTrials(Arr.fromIterable(completedInput), directions)
  const nBelow = splitCount(Arr.length(trials), nBelowOverride)
  const feasible = Arr.filter(trials, (trial) => Equal.equals(trial.violation, 0))
  const infeasible = Arr.sort(
    Arr.filter(trials, (trial) => Num.isGreaterThan(trial.violation, 0)),
    Order.mapInput(Num.Order, (trial: MultiObjectiveTrial) => trial.violation)
  )
  const selection = selectByFronts(feasible, Num.min(nBelow, Arr.length(feasible)), epsilon)
  const frontCount = Num.increment(Arr.reduce(selection.ranks, -1, (maximum, [, rank]) => Num.max(maximum, rank)))
  const values = Arr.appendAll(
    Arr.map(selection.ranks, ([index, rank]) => Tuple.make(rowAt(feasible, index), rank)),
    Arr.map(infeasible, (trial) => Tuple.make(trial, Num.sum(frontCount, trial.violation)))
  )
  const belowNumbers = HashSet.fromIterable(
    Arr.appendAll(
      Arr.map(selection.selected, (index) => rowAt(feasible, index).trialNumber),
      Arr.map(
        Arr.take(infeasible, Num.max(0, Num.subtract(nBelow, Arr.length(selection.selected)))),
        (trial) => trial.trialNumber
      )
    )
  )
  const ordered = Arr.sort(
    values,
    Order.mapInput(Num.Order, ([trial]: [MultiObjectiveTrial, number]) => trial.trialNumber)
  )
  const below = Arr.filter(ordered, ([trial]) => HashSet.has(belowNumbers, trial.trialNumber))
  const above = Arr.filter(ordered, ([trial]) => Bool.not(HashSet.has(belowNumbers, trial.trialNumber)))
  const weights = motpeBelowWeights(
    Arr.map(below, ([trial]) => trial.loss),
    Arr.map(below, ([trial]) => Equal.equals(trial.violation, 0))
  )
  return {
    below: Arr.map(below, ([trial, value], index) => splitTrial(trial, value, Option.some(rowAt(weights, index)))),
    above: Arr.map(above, ([trial, value]) => splitTrial(trial, value, Option.none()))
  }
}
