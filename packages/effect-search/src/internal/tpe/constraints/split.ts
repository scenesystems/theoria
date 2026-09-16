/**
 * Constraint-aware trial splitting — feasibility-based partitioning with density-ranked infeasible promotion.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Data, Equal, Match, Number as Num, Option, Order } from "effect"

import type { Vector } from "../../../Objective.js"

import {
  buildConstraintDensityModels,
  constraintDensityRatioLogProduct,
  isConstraintVectorFeasible
} from "../../../internal/tpe/constrainedDensity.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"

/**
 * A completed trial paired with its constraint violation vector for
 * feasibility-aware splitting. Each constraint value represents a
 * violation magnitude — values ≤ 0 are feasible, positive values
 * indicate the degree of constraint violation.
 *
 * @see {@link splitWithConstraintFeasibility} which partitions these trials
 * @see {@link CompletedTrialForSplit} for the underlying trial structure
 * @since 0.1.0
 * @category models
 */
export class ConstraintAwareSplitTrial extends Data.Class<{
  readonly trial: CompletedTrialForSplit
  readonly constraints: Vector
}> {}

class InfeasibleRankingEntry extends Data.Class<{
  readonly original: CompletedTrialForSplit
  readonly ranked: CompletedTrialForSplit
}> {}

const trialNumberOrder = Order.mapInput(
  Order.number,
  (trial: CompletedTrialForSplit) => trial.trialNumber
)

const sortByTrialNumber = (
  trialsInput: Iterable<CompletedTrialForSplit>
) => {
  const trials = Arr.fromIterable(trialsInput)
  return Arr.sortBy(trialNumberOrder)(trials)
}

const constraintCount = (trialsInput: Iterable<ConstraintAwareSplitTrial>): number => {
  const trials = Arr.fromIterable(trialsInput)
  return Arr.reduce(trials, 0, (count, trial) => Num.max(count, Arr.length(trial.constraints)))
}

const normalizeConstraints = (
  constraintsInput: Iterable<number>,
  count: number
) => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.makeBy(count, (index) =>
    Arr.get(constraints, index).pipe(
      Option.getOrElse(() => Number.POSITIVE_INFINITY)
    ))
}

const normalizeTrials = (
  trialsInput: Iterable<ConstraintAwareSplitTrial>
) => {
  const trials = Arr.fromIterable(trialsInput)

  const count = constraintCount(trials)

  return Arr.map(trials, (trial) =>
    new ConstraintAwareSplitTrial({
      trial: trial.trial,
      constraints: normalizeConstraints(trial.constraints, count)
    }))
}

const splitCount = (
  size: number,
  nBelowOverride?: number
): number => {
  const requested = Option.fromNullable(nBelowOverride).pipe(
    Option.getOrElse(() => defaultGamma(size))
  )

  return Num.clamp(requested, {
    minimum: 0,
    maximum: size
  })
}

const rankedTrial = (
  trial: CompletedTrialForSplit,
  logDensityProduct: number
): CompletedTrialForSplit =>
  new CompletedTrialForSplit({
    trialNumber: trial.trialNumber,
    config: trial.config,
    value: Num.negate(logDensityProduct),
    sortStep: trial.value,
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
  })

const originalTrialsFromRankedSelection = (
  selectedInput: Iterable<CompletedTrialForSplit>,
  rankedEntriesInput: Iterable<InfeasibleRankingEntry>
) => {
  const selected = Arr.fromIterable(selectedInput)
  const rankedEntries = Arr.fromIterable(rankedEntriesInput)
  return Arr.flatMap(
    selected,
    (trial) =>
      Arr.findFirst(rankedEntries, (entry) => Equal.equals(entry.original.trialNumber, trial.trialNumber)).pipe(
        Option.match({
          onNone: () => Arr.empty(),
          onSome: (entry) => Arr.of(entry.original)
        })
      )
  )
}

/**
 * Partitions trials into below/above sets using constraint feasibility.
 * Feasible trials are split first; when the target below-set size exceeds
 * the feasible count, the best infeasible trials are promoted by their
 * constraint density ratio rank. This balances objective optimization
 * with constraint satisfaction in constrained Bayesian optimization.
 *
 * @see {@link ConstraintAwareSplitTrial} for the input trial format
 * @see {@link TrialSplit} for the output below/above partition
 * @since 0.1.0
 * @category sampling
 */
export const splitWithConstraintFeasibility = (
  trialsInput: Iterable<ConstraintAwareSplitTrial>,
  nBelowOverride?: number
): Option.Option<TrialSplit> => {
  const trials = Arr.fromIterable(trialsInput)

  const normalizedTrials = normalizeTrials(trials)
  const count = constraintCount(normalizedTrials)
  return Option.liftPredicate(normalizedTrials, () => Num.greaterThan(count, 0)).pipe(
    Option.flatMap((nonEmptyConstraints) => {
      const feasible = Arr.filter(nonEmptyConstraints, (trial) => isConstraintVectorFeasible(trial.constraints))
      const infeasible = Arr.filter(
        nonEmptyConstraints,
        (trial) => Bool.not(isConstraintVectorFeasible(trial.constraints))
      )

      return Option.liftPredicate(feasible, (entries) => Num.greaterThan(Arr.length(entries), 0)).pipe(
        Option.map((feasibleEntries) => {
          const targetBelow = splitCount(Arr.length(nonEmptyConstraints), nBelowOverride)
          const feasibleTrials = Arr.map(feasibleEntries, (trial) => trial.trial)
          const models = buildConstraintDensityModels(
            Arr.map(nonEmptyConstraints, (trial) => trial.constraints)
          )
          const rankedInfeasible = Arr.map(infeasible, (trial) => {
            const logDensityProduct = constraintDensityRatioLogProduct(models, trial.constraints)

            return new InfeasibleRankingEntry({
              original: trial.trial,
              ranked: rankedTrial(trial.trial, logDensityProduct)
            })
          })
          const infeasibleTrials = Arr.map(rankedInfeasible, (trial) => trial.original)

          return Match.value(Num.lessThanOrEqualTo(targetBelow, Arr.length(feasibleTrials))).pipe(
            Match.when(true, () => {
              const feasibleSplit = splitTrials(feasibleTrials, () => targetBelow)

              return {
                below: sortByTrialNumber(feasibleSplit.below),
                above: sortByTrialNumber(Arr.appendAll(feasibleSplit.above, infeasibleTrials))
              }
            }),
            Match.orElse(() => {
              const neededInfeasible = Num.max(Num.subtract(targetBelow, Arr.length(feasibleTrials)), 0)
              const infeasibleSplit = splitTrials(
                Arr.map(rankedInfeasible, (trial) => trial.ranked),
                () => neededInfeasible
              )
              const selectedInfeasible = originalTrialsFromRankedSelection(infeasibleSplit.below, rankedInfeasible)
              const remainingInfeasible = originalTrialsFromRankedSelection(infeasibleSplit.above, rankedInfeasible)

              return {
                below: sortByTrialNumber(Arr.appendAll(feasibleTrials, selectedInfeasible)),
                above: sortByTrialNumber(remainingInfeasible)
              }
            })
          )
        })
      )
    })
  )
}
