/**
 * Immutable trial history in trial-number order, with evaluation-cost accounting.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Data, Number as Num, Option, Schema, SortedMap } from "effect"
import { dual } from "effect/Function"

import type * as Trial from "./Trial.js"

/**
 * Keeps one current record per trial number and the sum of its valid reported costs.
 * The SortedMap is available for native lookup, filtering, and range operations.
 *
 * @since 0.1.0
 * @category models
 */
export class History<Config, State> extends Data.Class<{
  readonly trials: SortedMap.SortedMap<number, Trial.Trial<Config, State>>
  readonly cumulativeCost: number
}> {}

const validCost = Schema.is(Schema.JsonNumber.pipe(Schema.nonNegative()))

const cost = <Config, State>(trial: Trial.Trial<Config, State>): number =>
  Option.fromNullable(trial.cost).pipe(Option.filter(validCost), Option.getOrElse(() => 0))

/**
 * Creates empty history without imposing an observation or error vocabulary.
 *
 * @since 0.1.0
 * @category constructors
 */
export const empty = <Config, State>(): History<Config, State> =>
  new History({ trials: SortedMap.empty<number, Trial.Trial<Config, State>>(Num.Order), cumulativeCost: 0 })

/**
 * Inserts or replaces a trial. Replacing a record replaces its cost contribution,
 * so replaying the same finalization does not charge it twice. Absent, negative,
 * and non-finite costs contribute zero without rejecting the record.
 *
 * @since 0.1.0
 * @category combinators
 */
export const set: {
  <Config, State>(trial: Trial.Trial<Config, State>): (self: History<Config, State>) => History<Config, State>
  <Config, State>(
    self: History<Config, State>,
    trial: Trial.Trial<Config, State>
  ): History<Config, State>
} = dual(2, <Config, State>(self: History<Config, State>, trial: Trial.Trial<Config, State>) => {
  const previousCost = SortedMap.get(self.trials, trial.trialNumber).pipe(
    Option.map(cost),
    Option.getOrElse(() => 0)
  )
  return new History({
    trials: SortedMap.set(self.trials, trial.trialNumber, trial),
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
 * @category getters
 */
export const values = <Config, State>(self: History<Config, State>) => Arr.fromIterable(SortedMap.values(self.trials))
