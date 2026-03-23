import { Array as Arr, Number as Num, Option, Order, Schema, Tuple } from "effect"

import { defaultGamma } from "./gammaSplit.js"

export class CompletedTrialForSplit
  extends Schema.Class<CompletedTrialForSplit>("effect-search/CompletedTrialForSplit")({
    trialNumber: Schema.Number,
    config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    value: Schema.Number,
    observationWeight: Schema.optional(Schema.Number),
    cost: Schema.optional(Schema.Number),
    variance: Schema.optional(Schema.Number),
    sortStep: Schema.optional(Schema.Number)
  })
{}

export const TrialSplitSchema = Schema.Struct({
  below: Schema.Array(CompletedTrialForSplit),
  above: Schema.Array(CompletedTrialForSplit)
})

export type TrialSplit = Schema.Schema.Type<typeof TrialSplitSchema>

const splitOrder = Order.mapInput(
  Order.tuple(Order.number, Order.number, Order.number),
  (trial: CompletedTrialForSplit) =>
    Tuple.make(
      trial.value,
      Option.fromNullable(trial.sortStep).pipe(Option.getOrElse(() => -1)),
      trial.trialNumber
    )
)

const trialNumberOrder = Order.mapInput(Order.number, (trial: CompletedTrialForSplit) => trial.trialNumber)

const splitCount = (size: number, gamma: (nCompletedTrials: number) => number): number =>
  Num.clamp(gamma(size), {
    minimum: 0,
    maximum: size
  })

export const splitTrials = (
  trials: ReadonlyArray<CompletedTrialForSplit>,
  gamma = defaultGamma
): TrialSplit => {
  const sortedByScore = Arr.sort(trials, splitOrder)
  const split = splitCount(sortedByScore.length, gamma)
  const below = Arr.take(sortedByScore, split)
  const above = Arr.drop(sortedByScore, split)

  return {
    below: Arr.sort(below, trialNumberOrder),
    above: Arr.sort(above, trialNumberOrder)
  }
}
