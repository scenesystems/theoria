import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import * as Pareto from "../../src/Pareto/index.js"
import { FixtureRegistryLive, loadAllFixtures, MotpeWeightsFixtureSchema } from "../helpers/fixtures.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-9): void => {
  expect(abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe("Pareto MOTPE compatibility", () => {
  it.effect("preserves fixture-backed MOTPE hypervolume weighting parity", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixtureSchema)(fixture)
      )

      expect(fixtures.length).toBeGreaterThanOrEqual(3)

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

        expect(contributions).toHaveLength(fixture.payload.expectedContributions.length)
        expect(weights).toHaveLength(fixture.payload.expectedWeights.length)

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(contributions[index] ?? 0, expected)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(weights[index] ?? 0, expected)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
