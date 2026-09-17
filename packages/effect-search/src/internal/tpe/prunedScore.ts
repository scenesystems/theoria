import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Match, Number as Num, Option, Schema, Tuple } from "effect"

import type { Direction } from "../../Direction.js"

export class PrunedIntermediateValue
  extends Schema.Class<PrunedIntermediateValue>("effect-search/PrunedIntermediateValue")({
    step: Schema.Number,
    value: Schema.Number
  })
{}

export class PrunedTrialScore extends Schema.Class<PrunedTrialScore>("effect-search/PrunedTrialScore")({
  step: Schema.Number,
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
          Match.value(Num.lessThanOrEqualTo(latest.step, value.step)).pipe(
            Match.when(true, () => Option.some(value)),
            Match.orElse(() => Option.some(latest))
          )
      })
  )
}

const directionalScore = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Num.negate(value)),
    Match.orElse(() => value)
  )

const finiteScore = (value: number): number =>
  Match.value(isFinite(value)).pipe(
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
          step: Num.negate(1),
          value: Number.POSITIVE_INFINITY
        }),
      onSome: (latest) =>
        new PrunedTrialScore({
          step: latest.step,
          value: finiteScore(directionalScore(direction, latest.value))
        })
    })
  )
}

export const prunedTrialOrderKey = (
  trialNumber: number,
  score: PrunedTrialScore
): readonly [number, number, number] => Tuple.make(score.value, score.step, trialNumber)
