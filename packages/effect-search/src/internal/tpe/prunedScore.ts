import { Array as Arr, Match, Option, Schema, Tuple } from "effect"

import type { Direction } from "../../contracts/Direction.js"

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
  intermediateValues: ReadonlyArray<PrunedIntermediateValue>
): Option.Option<PrunedIntermediateValue> =>
  Arr.reduce(intermediateValues, Option.none<PrunedIntermediateValue>(), (current, value) =>
    Option.match(current, {
      onNone: () => Option.some(value),
      onSome: (latest) =>
        Match.value(latest.step <= value.step).pipe(
          Match.when(true, () => Option.some(value)),
          Match.orElse(() => Option.some(latest))
        )
    }))

const directionalScore = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => -value),
    Match.orElse(() => value)
  )

const finiteScore = (value: number): number =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => Number.POSITIVE_INFINITY)
  )

export const prunedTrialScore = (
  intermediateValues: ReadonlyArray<PrunedIntermediateValue>,
  direction: Direction
): PrunedTrialScore =>
  latestIntermediateValue(intermediateValues).pipe(
    Option.match({
      onNone: () =>
        new PrunedTrialScore({
          step: -1,
          value: Number.POSITIVE_INFINITY
        }),
      onSome: (latest) =>
        new PrunedTrialScore({
          step: latest.step,
          value: finiteScore(directionalScore(direction, latest.value))
        })
    })
  )

export const prunedTrialOrderKey = (
  trialNumber: number,
  score: PrunedTrialScore
): readonly [number, number, number] => Tuple.make(score.value, score.step, trialNumber)
