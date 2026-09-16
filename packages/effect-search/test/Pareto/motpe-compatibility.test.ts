import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../../src/internal/float64.js"
import * as Pareto from "../../src/Pareto/index.js"
import { FixtureRegistryLive, loadAllFixtures, MotpeWeightsFixtureSchema } from "../helpers/fixtures.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-9): void => {
  expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const numberAt = (values: Pareto.ObjectiveWeights, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => 0))

describe("Pareto MOTPE compatibility", () => {
  it.effect("preserves fixture-backed MOTPE hypervolume weighting parity", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixtureSchema)(fixture)
      )

      Arr.forEach(fixtures, (fixture) => {
        const contributions = Pareto.hypervolumeContribution2d(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )
        const weights = Pareto.computeMultiObjectiveWeights(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )

        expect(contributions).toHaveLength(Arr.length(fixture.payload.expectedContributions))
        expect(weights).toHaveLength(Arr.length(fixture.payload.expectedWeights))

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(numberAt(contributions, index), expected)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(numberAt(weights, index), expected)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
