/**
 * Constraint-aware trial splitting — feasibility-based partitioning with density-ranked infeasible promotion.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Number as Num, Option, Order } from "effect"

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
  readonly constraints: ReadonlyArray<number>
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
  trials: ReadonlyArray<CompletedTrialForSplit>
): ReadonlyArray<CompletedTrialForSplit> => Arr.sortBy(trialNumberOrder)(trials)

const constraintCount = (trials: ReadonlyArray<ConstraintAwareSplitTrial>): number =>
  Arr.reduce(trials, 0, (count, trial) => Num.max(count, trial.constraints.length))

const normalizeConstraints = (
  constraints: ReadonlyArray<number>,
  count: number
): ReadonlyArray<number> =>
  Arr.makeBy(count, (index) =>
    Arr.get(constraints, index).pipe(
      Option.getOrElse(() => Number.POSITIVE_INFINITY)
    ))

const normalizeTrials = (
  trials: ReadonlyArray<ConstraintAwareSplitTrial>
): ReadonlyArray<ConstraintAwareSplitTrial> => {
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
    value: -logDensityProduct,
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
  selected: ReadonlyArray<CompletedTrialForSplit>,
  rankedEntries: ReadonlyArray<InfeasibleRankingEntry>
): ReadonlyArray<CompletedTrialForSplit> =>
  Arr.flatMap(
    selected,
    (trial) =>
      Arr.findFirst(rankedEntries, (entry) => entry.original.trialNumber === trial.trialNumber).pipe(
        Option.match({
          onNone: () => [],
          onSome: (entry) => [entry.original]
        })
      )
  )

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
  trials: ReadonlyArray<ConstraintAwareSplitTrial>,
  nBelowOverride?: number
): Option.Option<TrialSplit> => {
  const normalizedTrials = normalizeTrials(trials)
  const count = constraintCount(normalizedTrials)

  if (count <= 0) {
    return Option.none()
  }

  const feasible = Arr.filter(normalizedTrials, (trial) => isConstraintVectorFeasible(trial.constraints))
  const infeasible = Arr.filter(normalizedTrials, (trial) => !isConstraintVectorFeasible(trial.constraints))

  if (feasible.length <= 0) {
    return Option.none()
  }

  const targetBelow = splitCount(normalizedTrials.length, nBelowOverride)
  const feasibleTrials = Arr.map(feasible, (trial) => trial.trial)
  const models = buildConstraintDensityModels(
    Arr.map(normalizedTrials, (trial) => trial.constraints)
  )
  const rankedInfeasible = Arr.map(infeasible, (trial) => {
    const logDensityProduct = constraintDensityRatioLogProduct(
      models,
      trial.constraints
    )

    return new InfeasibleRankingEntry({
      original: trial.trial,
      ranked: rankedTrial(trial.trial, logDensityProduct)
    })
  })
  const infeasibleTrials = Arr.map(rankedInfeasible, (trial) => trial.original)

  return Match.value(targetBelow <= feasibleTrials.length).pipe(
    Match.when(true, () => {
      const feasibleSplit = splitTrials(feasibleTrials, () => targetBelow)

      return Option.some({
        below: sortByTrialNumber(feasibleSplit.below),
        above: sortByTrialNumber(Arr.appendAll(feasibleSplit.above, infeasibleTrials))
      })
    }),
    Match.orElse(() => {
      const neededInfeasible = Num.max(targetBelow - feasibleTrials.length, 0)
      const infeasibleSplit = splitTrials(
        Arr.map(rankedInfeasible, (trial) => trial.ranked),
        () => neededInfeasible
      )
      const selectedInfeasible = originalTrialsFromRankedSelection(
        infeasibleSplit.below,
        rankedInfeasible
      )
      const remainingInfeasible = originalTrialsFromRankedSelection(
        infeasibleSplit.above,
        rankedInfeasible
      )

      return Option.some({
        below: sortByTrialNumber(Arr.appendAll(feasibleTrials, selectedInfeasible)),
        above: sortByTrialNumber(remainingInfeasible)
      })
    })
  )
}
