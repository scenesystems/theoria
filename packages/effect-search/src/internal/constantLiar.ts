import { Array as Arr, Chunk, Match, Number as Num, Option } from "effect"

import { type Direction, minimize } from "../Direction.js"
import { dimensions, directionAt, match } from "../Objective.js"
import { toVector } from "../Objective.js"
import { type Context, Observation } from "../Sampler.js"

const valueAt = (valuesInput: Iterable<number>, index: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => 0))
}

const objectiveValuesByDimension = (context: Context, index: number) =>
  Arr.map(context.completed, (trial) => valueAt(toVector(trial.value), index))

const worstByDirection = (direction: Direction, valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.head(values).pipe(
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
}

const objectiveDirection = (context: Context, index: number): Direction =>
  directionAt(context.objectiveSpec, index).pipe(Option.getOrElse(() => minimize))

const liarVector = (context: Context) =>
  Arr.makeBy(
    dimensions(context.objectiveSpec),
    (index) => worstByDirection(objectiveDirection(context, index), objectiveValuesByDimension(context, index))
  )

const liarValue = (context: Context) => {
  const vector = liarVector(context)

  return match({
    Single: () => valueAt(vector, 0),
    Multi: () => vector
  })(context.objectiveSpec)
}

export const constantLiar = (context: Context): Chunk.Chunk<Observation> =>
  Chunk.fromIterable(Arr.map(
    context.pending,
    (pending) =>
      new Observation({
        trialNumber: pending.trialNumber,
        config: pending.config,
        value: liarValue(context)
      })
  ))
