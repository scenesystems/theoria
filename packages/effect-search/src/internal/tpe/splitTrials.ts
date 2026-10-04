import { Array as Arr, Number as Num, Option, Order, Schema, Tuple } from "effect"

import { defaultGamma } from "./gammaSplit.js"

export class CompletedTrialForSplit extends Schema.Class<CompletedTrialForSplit>(
  "@scenesystems/effect-search/internal/tpe/splitTrials/CompletedTrialForSplit"
)({
  trialNumber: Schema.Finite,
  config: Schema.Record(Schema.String, Schema.Unknown),
  value: Schema.Number,
  observationWeight: Schema.optional(Schema.Finite),
  cost: Schema.optional(Schema.Finite),
  variance: Schema.optional(Schema.Finite),
  sortStep: Schema.optional(Schema.Finite)
}) {}

export const TrialSplitSchema = Schema.Struct({
  below: Schema.Array(CompletedTrialForSplit),
  above: Schema.Array(CompletedTrialForSplit)
})

export type TrialSplit = Schema.Schema.Type<typeof TrialSplitSchema>

const splitOrder = Order.mapInput(
  Order.Tuple([Order.Number, Order.Number, Order.Number]),
  (trial: CompletedTrialForSplit) =>
    Tuple.make(
      trial.value,
      Option.fromNullishOr(trial.sortStep).pipe(Option.getOrElse(() => Num.multiply(-1, 1))),
      trial.trialNumber
    )
)

const trialNumberOrder = Order.mapInput(Order.Number, (trial: CompletedTrialForSplit) => trial.trialNumber)

const splitCount = (size: number, gamma: (nCompletedTrials: number) => number): number =>
  Num.clamp(gamma(size), {
    minimum: 0,
    maximum: size
  })

export const splitTrials = (
  trialsInput: Iterable<CompletedTrialForSplit>,
  gamma = defaultGamma
): TrialSplit => {
  const trials = Arr.fromIterable(trialsInput)

  const sortedByScore = Arr.sort(trials, splitOrder)
  const split = splitCount(Arr.length(sortedByScore), gamma)
  const below = Arr.take(sortedByScore, split)
  const above = Arr.drop(sortedByScore, split)

  return {
    below: Arr.sort(below, trialNumberOrder),
    above: Arr.sort(above, trialNumberOrder)
  }
}
