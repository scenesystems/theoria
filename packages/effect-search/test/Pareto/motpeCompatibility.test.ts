import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Pareto from "../../src/Pareto.js"
import { FixtureRegistryLive, loadAllFixtures, MotpeWeightsFixture } from "../helpers/fixtures/index.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-9): void => {
  expect(Numeric.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Pareto MOTPE compatibility", () => {
  it.effect("preserves fixture-backed MOTPE hypervolume weighting parity", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixture)(fixture)
      )

      Arr.forEach(fixtures, (fixture) => {
        const contributions = Pareto.hypervolumeContribution2d(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )
        const weights = Pareto.multiObjectiveWeights(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )

        expect(contributions).toHaveLength(Arr.length(fixture.payload.expectedContributions))
        expect(weights).toHaveLength(Arr.length(fixture.payload.expectedWeights))

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(Arr.get(contributions, index).pipe(Option.getOrElse(() => 0)), expected)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(Arr.get(weights, index).pipe(Option.getOrElse(() => 0)), expected)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
