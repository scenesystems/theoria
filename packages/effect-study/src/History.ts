/**
 * Immutable trial history in trial-number order, with evaluation-cost accounting.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Data, HashMap, Number as Num, Option, Schema, Tuple } from "effect"
import { dual } from "effect/Function"

import type * as Trial from "./Trial.js"

/**
 * Keeps one current record per trial number and the sum of its valid reported costs.
 * The HashMap supports native lookup and filtering; {@link values} sorts by trial number.
 *
 * @since 0.1.0
 * @category models
 */
export class History<Config, State> extends Data.Class<{
  readonly trials: HashMap.HashMap<number, Trial.Trial<Config, State>>
  readonly cumulativeCost: number
}> {}

const validCost = Schema.is(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)))

const cost = <Config, State>(trial: Trial.Trial<Config, State>): number =>
  Option.fromNullishOr(trial.cost).pipe(Option.filter(validCost), Option.getOrElse(() => 0))

/**
 * Cost evidence across current trial records. A known zero is reported; absent
 * costs are missing, and negative or non-finite costs are invalid. Reported totals
 * are not provider billing or attempt accounting. reportedTotal is "Overflow"
 * when summing valid costs exceeds finite number range; counts remain intact.
 *
 * @since 0.1.0
 * @category models
 */
export const Cost = Schema.Struct({
  reportedTotal: Schema.Union([Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)), Schema.Literal("Overflow")]),
  reportedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  missingCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  invalidCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
})

/**
 * Cost evidence derived from its encoding schema.
 *
 * @since 0.1.0
 * @category models
 */
export type Cost = typeof Cost.Type

/**
 * Summarizes the latest cost for each trial, independently of completion state.
 * Replaced trials contribute only their current evidence. No cost is imputed.
 * Recomputing from current records permits recovery from aggregate overflow when
 * a trial is replaced. Finite totals use ordinary floating-point summation.
 *
 * @since 0.1.0
 * @category accessors
 */
export const costs = <Config, State>(self: History<Config, State>): Cost =>
  Arr.reduce(
    HashMap.values(self.trials),
    Cost.make({ reportedTotal: 0, reportedCount: 0, missingCount: 0, invalidCount: 0 }),
    (summary, trial) =>
      Option.match(Option.fromNullishOr(trial.cost), {
        onNone: () => Cost.make({ ...summary, missingCount: Num.increment(summary.missingCount) }),
        onSome: (value) => {
          if (!validCost(value)) return Cost.make({ ...summary, invalidCount: Num.increment(summary.invalidCount) })
          const total = summary.reportedTotal === "Overflow" ? Infinity : Num.sum(summary.reportedTotal, value)
          return Cost.make({
            ...summary,
            reportedTotal: validCost(total) ? total : "Overflow",
            reportedCount: Num.increment(summary.reportedCount)
          })
        }
      })
  )

/**
 * Creates empty history without imposing an observation or error vocabulary.
 *
 * @since 0.1.0
 * @category constructors
 */
export const empty = <Config, State>(): History<Config, State> =>
  new History({ trials: HashMap.empty<number, Trial.Trial<Config, State>>(), cumulativeCost: 0 })

/**
 * Inserts or replaces a trial. Replacing a record replaces its cost contribution,
 * so replaying the same finalization does not charge it twice. Absent, negative,
 * and non-finite costs contribute zero without rejecting the record.
 *
 * @since 0.1.0
 * @category operations
 */
export const set: {
  <Config, State>(trial: Trial.Trial<Config, State>): (self: History<Config, State>) => History<Config, State>
  <Config, State>(
    self: History<Config, State>,
    trial: Trial.Trial<Config, State>
  ): History<Config, State>
} = dual(2, <Config, State>(self: History<Config, State>, trial: Trial.Trial<Config, State>) => {
  const previousCost = HashMap.get(self.trials, trial.trialNumber).pipe(
    Option.map(cost),
    Option.getOrElse(() => 0)
  )
  return new History({
    trials: HashMap.set(self.trials, trial.trialNumber, trial),
    cumulativeCost: Num.sum(Num.subtract(self.cumulativeCost, previousCost), cost(trial))
  })
})

/**
 * Restores trial history in source order; the last record for a number wins.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromIterable = <Config, State>(records: Iterable<Trial.Trial<Config, State>>): History<Config, State> =>
  Arr.reduce(
    records,
    empty<Config, State>(),
    (self: History<Config, State>, trial: Trial.Trial<Config, State>) => set(self, trial)
  )

/**
 * Returns all records in ascending trial-number order, independent of finish order.
 *
 * @since 0.1.0
 * @category accessors
 */
export const values = <Config, State>(self: History<Config, State>) =>
  Arr.map(Arr.sortWith(HashMap.entries(self.trials), Tuple.get(0), Num.Order), Tuple.get(1))
