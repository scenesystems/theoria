import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Order, Schema } from "effect"

import * as Float64 from "../../../src/internal/float64.js"
import {
  buildConstraintDensityModels,
  constraintDensityRatioProduct
} from "../../../src/internal/tpe/constrainedDensity.js"
import type { ContinuousValues } from "../../../src/internal/tpe/continuousParzen.js"
import { SuggestCompletedTrial } from "../../../src/Sampler/index.js"
import { splitSingleObjective } from "../../../src/samplers/Tpe/split/singleSplit.js"
import { ConstrainedTpeFixtureSchema, FixtureRegistryLive, loadFixture } from "../../helpers/fixtures.js"

const SCORE_TOLERANCE = 1e-9

const valueAt = (values: ContinuousValues, index: number): number =>
  Arr.get(values, index).pipe(
    Option.getOrElse(() => Number.NaN)
  )

const expectWithinTolerance = (
  actual: number,
  expected: number,
  tolerance: number
): void => {
  expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

class RatioEntry extends Schema.Class<RatioEntry>("effect-search/test/RatioEntry")({
  index: Schema.Number,
  ratio: Schema.Number
}) {}

const descendingRatioOrder = (ratios: ContinuousValues): ContinuousValues =>
  Arr.map(
    Arr.sortBy(
      Order.mapInput(Order.number, (entry: RatioEntry) => Num.negate(entry.ratio)),
      Order.mapInput(Order.number, (entry: RatioEntry) => entry.index)
    )(
      Arr.makeBy(Arr.length(ratios), (index) =>
        new RatioEntry({
          index,
          ratio: valueAt(ratios, index)
        }))
    ),
    (entry) => entry.index
  )

describe("constrained fixture parity", () => {
  it.effect("matches Optuna-derived constrained density ratios and feasibility ordering", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("constrained-tpe.parity").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(ConstrainedTpeFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.densityCases,
        (densityCase) =>
          Effect.gen(function*() {
            const models = buildConstraintDensityModels(densityCase.observations)
            const ratios = Arr.map(
              densityCase.probes,
              (probe) => constraintDensityRatioProduct(models, probe)
            )

            yield* Effect.forEach(
              densityCase.expectedRatioProducts,
              (expectedRatio, index) =>
                Effect.sync(() => {
                  expectWithinTolerance(valueAt(ratios, index), expectedRatio, SCORE_TOLERANCE)
                }),
              { discard: true }
            )

            yield* Effect.sync(() => {
              expect(descendingRatioOrder(ratios)).toEqual(densityCase.expectedOrder)
            })
          }),
        { discard: true }
      )

      const splitCase = fixture.payload.splitCase
      const split = splitSingleObjective(
        Arr.map(splitCase.trials, (trial) =>
          new SuggestCompletedTrial({
            trialNumber: trial.trialNumber,
            config: { trialNumber: trial.trialNumber },
            value: trial.value,
            constraints: trial.constraints
          })),
        splitCase.direction
      )

      yield* Effect.sync(() => {
        expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(splitCase.expectedBelow)
        expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(splitCase.expectedAbove)
      })
    }))
})
