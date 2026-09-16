/**
 * Constraint-aware trial splitting — feasibility-based partitioning with density-ranked infeasible promotion.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Equal, Match, Number as Num, Option, Order, Schema } from "effect"

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
export class ConstraintAwareSplitTrial extends Schema.Class<ConstraintAwareSplitTrial>(
  "effect-search/ConstraintAwareSplitTrial"
)({
  trial: CompletedTrialForSplit,
  constraints: Schema.Array(Schema.Number)
}) {}

export type ConstraintAwareSplitTrials = Schema.Array$<typeof ConstraintAwareSplitTrial>["Type"]

class InfeasibleRankingEntry extends Schema.Class<InfeasibleRankingEntry>("effect-search/InfeasibleRankingEntry")({
  original: CompletedTrialForSplit,
  ranked: CompletedTrialForSplit
}) {}

type InfeasibleRankingEntries = Schema.Array$<typeof InfeasibleRankingEntry>["Type"]

const trialNumberOrder = Order.mapInput(
  Order.number,
  (trial: CompletedTrialForSplit) => trial.trialNumber
)

const sortByTrialNumber = (
  trials: TrialSplit["below"]
): TrialSplit["below"] => Arr.sortBy(trialNumberOrder)(trials)

const constraintCount = (trials: ConstraintAwareSplitTrials): number =>
  Arr.reduce(trials, 0, (count, trial) => Num.max(count, Arr.length(trial.constraints)))

const normalizeConstraints = (
  constraints: ConstraintAwareSplitTrial["constraints"],
  count: number
): ConstraintAwareSplitTrial["constraints"] =>
  Arr.makeBy(count, (index) =>
    Arr.get(constraints, index).pipe(
      Option.getOrElse(() => Number.POSITIVE_INFINITY)
    ))

const normalizeTrials = (
  trials: ConstraintAwareSplitTrials
): ConstraintAwareSplitTrials => {
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
  selected: TrialSplit["below"],
  rankedEntries: InfeasibleRankingEntries
): TrialSplit["below"] =>
  Arr.flatMap(
    selected,
    (trial) =>
      Arr.findFirst(rankedEntries, (entry) => Equal.equals(entry.original.trialNumber, trial.trialNumber)).pipe(
        Option.match({
          onNone: () => Arr.empty<CompletedTrialForSplit>(),
          onSome: (entry) => Arr.of(entry.original)
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
  trials: ConstraintAwareSplitTrials,
  nBelowOverride?: number
): Option.Option<TrialSplit> => {
  const normalizedTrials = normalizeTrials(trials)
  const count = constraintCount(normalizedTrials)

  return Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() => {
      const feasible = Arr.filter(normalizedTrials, (trial) => isConstraintVectorFeasible(trial.constraints))
      const infeasible = Arr.filter(
        normalizedTrials,
        (trial) => Boolean.not(isConstraintVectorFeasible(trial.constraints))
      )

      return Match.value(Arr.isEmptyReadonlyArray(feasible)).pipe(
        Match.when(true, () => Option.none()),
        Match.orElse(() => {
          const targetBelow = splitCount(Arr.length(normalizedTrials), nBelowOverride)
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

          return Match.value(Num.lessThanOrEqualTo(targetBelow, Arr.length(feasibleTrials))).pipe(
            Match.when(true, () => {
              const feasibleSplit = splitTrials(feasibleTrials, () => targetBelow)

              return Option.some({
                below: sortByTrialNumber(feasibleSplit.below),
                above: sortByTrialNumber(Arr.appendAll(feasibleSplit.above, infeasibleTrials))
              })
            }),
            Match.orElse(() => {
              const neededInfeasible = Num.max(Num.subtract(targetBelow, Arr.length(feasibleTrials)), 0)
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
        })
      )
    })
  )
}
