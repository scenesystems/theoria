import { Array as Arr, Equivalence, Match, Number as Num, Option, Schema, Tuple } from "effect"

import type { Direction } from "../../Direction.js"

export class PrunedIntermediateValue extends Schema.Class<PrunedIntermediateValue>(
  "@scenesystems/effect-search/internal/tpe/prunedScore/PrunedIntermediateValue"
)({
  step: Schema.Finite,
  value: Schema.Number
}) {}

export class PrunedTrialScore extends Schema.Class<PrunedTrialScore>(
  "@scenesystems/effect-search/internal/tpe/prunedScore/PrunedTrialScore"
)({
  step: Schema.Finite,
  value: Schema.Number
}) {}

const latestIntermediateValue = (
  intermediateValuesInput: Iterable<PrunedIntermediateValue>
): Option.Option<PrunedIntermediateValue> => {
  const intermediateValues = Arr.fromIterable(intermediateValuesInput)
  return Arr.reduce(
    intermediateValues,
    Option.none<PrunedIntermediateValue>(),
    (current, value) =>
      Option.match(current, {
        onNone: () => Option.some(value),
        onSome: (latest) =>
          Match.value(Num.isLessThanOrEqualTo(latest.step, value.step)).pipe(
            Match.when(true, () => Option.some(value)),
            Match.orElse(() => Option.some(latest))
          )
      })
  )
}

const directionalScore = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Num.multiply(-1, value)),
    Match.orElse(() => value)
  )

const orderedScore = (value: number): number =>
  Match.value(Equivalence.strictEqual<number>()(value, value)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => Number.POSITIVE_INFINITY)
  )

export const prunedTrialScore = (
  intermediateValuesInput: Iterable<PrunedIntermediateValue>,
  direction: Direction
): PrunedTrialScore => {
  const intermediateValues = Arr.fromIterable(intermediateValuesInput)
  return latestIntermediateValue(intermediateValues).pipe(
    Option.match({
      onNone: () =>
        new PrunedTrialScore({
          step: Num.multiply(-1, 1),
          value: 0
        }),
      onSome: (latest) =>
        new PrunedTrialScore({
          step: latest.step,
          value: orderedScore(directionalScore(direction, latest.value))
        })
    })
  )
}

export const prunedTrialOrderKey = (
  trialNumber: number,
  score: PrunedTrialScore
): readonly [number, number, number] => Tuple.make(Num.multiply(-1, score.step), score.value, trialNumber)
