import { Array as Arr, Data, Match, Number as Num, Option, Order } from "effect"

import {
  buildConstraintDensityModels,
  constraintDensityRatioLogProduct,
  isConstraintVectorFeasible
} from "../../../internal/tpe/constrainedDensity.js"
import { defaultGamma } from "../../../internal/tpe/gammaSplit.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"

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
