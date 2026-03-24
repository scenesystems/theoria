import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Order, Schema } from "effect"

import {
  buildConstraintDensityModels,
  constraintDensityRatioProduct
} from "../../../src/internal/tpe/constrainedDensity.js"
import { makeSuggestCompletedTrial } from "../../../src/Sampler/index.js"
import { splitSingleObjective } from "../../../src/samplers/Tpe/split/singleSplit.js"
import { ConstrainedTpeFixtureSchema, FixtureRegistryLive, loadFixture } from "../../helpers/fixtures.js"

const SCORE_TOLERANCE = 1e-9

const valueAt = (values: ReadonlyArray<number>, index: number): number =>
  Arr.get(values, index).pipe(
    Option.getOrElse(() => Number.NaN)
  )

const expectWithinTolerance = (
  actual: number,
  expected: number,
  tolerance: number
): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

const descendingRatioOrder = (ratios: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.map(
    Arr.sortBy(
      Order.mapInput(Order.number, (entry: { readonly index: number; readonly ratio: number }) => -entry.ratio),
      Order.mapInput(Order.number, (entry: { readonly index: number; readonly ratio: number }) => entry.index)
    )(
      Arr.makeBy(ratios.length, (index) => ({
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
          makeSuggestCompletedTrial(
            trial.trialNumber,
            { trialNumber: trial.trialNumber },
            trial.value,
            undefined,
            undefined,
            undefined,
            trial.constraints
          )),
        splitCase.direction
      )

      yield* Effect.sync(() => {
        expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(splitCase.expectedBelow)
        expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(splitCase.expectedAbove)
      })
    }))
})
