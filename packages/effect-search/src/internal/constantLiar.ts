import { Array as Arr, Match, Number as Num, Option } from "effect"

import { defaultDirection, type Direction } from "../contracts/Direction.js"
import { matchObjectiveSpec, objectiveDirectionAt, objectiveSpecDimensions } from "../contracts/ObjectiveSpec.js"
import { normalizeObjectiveVector } from "../contracts/ObjectiveValue.js"
import { ImputedObservation, PendingImputationPolicy } from "../Sampler/PendingImputationPolicy.js"
import type { SuggestContext } from "../Sampler/SuggestContext.js"

const valueAt = (values: ReadonlyArray<number>, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => 0))

const objectiveValuesByDimension = (context: SuggestContext, index: number): Array<number> =>
  Arr.map(context.completed, (trial) => valueAt(normalizeObjectiveVector(trial.value), index))

const worstByDirection = (direction: Direction, values: ReadonlyArray<number>): number =>
  Arr.head(values).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (first) =>
        Arr.tail(values).pipe(
          Option.match({
            onNone: () => first,
            onSome: (rest) =>
              Arr.reduce(
                rest,
                first,
                (acc, value) =>
                  Match.value(direction).pipe(
                    Match.when("minimize", () => Num.max(acc, value)),
                    Match.orElse(() => Num.min(acc, value))
                  )
              )
          })
        )
    })
  )

const objectiveDirection = (context: SuggestContext, index: number): Direction =>
  objectiveDirectionAt(context.objectiveSpec, index).pipe(Option.getOrElse(defaultDirection))

const liarVector = (context: SuggestContext): ReadonlyArray<number> =>
  Arr.makeBy(
    objectiveSpecDimensions(context.objectiveSpec),
    (index) => worstByDirection(objectiveDirection(context, index), objectiveValuesByDimension(context, index))
  )

const liarValue = (context: SuggestContext): number | ReadonlyArray<number> => {
  const vector = liarVector(context)

  return matchObjectiveSpec({
    Single: () => valueAt(vector, 0),
    Multi: () => vector
  })(context.objectiveSpec)
}

export const constantLiar = (context: SuggestContext): ReadonlyArray<ImputedObservation> =>
  Arr.map(
    context.pending,
    (pending) =>
      new ImputedObservation({
        trialNumber: pending.trialNumber,
        config: pending.config,
        value: liarValue(context)
      })
  )

export const constantLiarPendingImputationPolicy = new PendingImputationPolicy({
  name: "constant-liar",
  impute: constantLiar
})
