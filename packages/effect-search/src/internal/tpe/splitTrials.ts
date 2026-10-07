import { Array as Arr, Boolean as Bool, Equal, Match, Number as Num, Option, Order, Schema, Tuple } from "effect"

import { defaultGamma } from "./gammaSplit.js"

export class CompletedTrialForSplit extends Schema.Class<CompletedTrialForSplit>(
  "@scenesystems/effect-search/internal/tpe/splitTrials/CompletedTrialForSplit"
)({
  trialNumber: Schema.Finite,
  config: Schema.Record(Schema.String, Schema.Unknown),
  value: Schema.Number,
  state: Schema.optional(Schema.Literals(["complete", "pruned", "running"])),
  observationWeight: Schema.optional(Schema.Finite),
  /** MOTPE hypervolume-contribution weight replacing the default l(x) kernel weight. */
  belowWeight: Schema.optional(Schema.Finite),
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
  Order.Tuple([Order.Number, Order.Number, Order.Number, Order.Number]),
  (trial: CompletedTrialForSplit) => {
    const step = Option.fromNullishOr(trial.sortStep).pipe(Option.getOrElse(() => -1))
    return Match.value(trial.state).pipe(
      Match.when("pruned", () => Tuple.make(1, Num.multiply(-1, step), trial.value, trial.trialNumber)),
      Match.when("running", () => Tuple.make(2, 0, 0, trial.trialNumber)),
      Match.orElse(() => Tuple.make(0, trial.value, step, trial.trialNumber))
    )
  }
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
  const split = splitCount(
    Arr.length(Arr.filter(trials, (trial) => Bool.not(Equal.equals(trial.state, "running")))),
    gamma
  )
  const below = Arr.take(sortedByScore, split)
  const above = Arr.drop(sortedByScore, split)

  return {
    below: Arr.sort(below, trialNumberOrder),
    above: Arr.sort(above, trialNumberOrder)
  }
}
