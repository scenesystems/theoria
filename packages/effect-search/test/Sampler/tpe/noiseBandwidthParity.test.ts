import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import { buildContinuousParzen } from "../../../src/internal/tpe/continuousParzen.js"
import { FixtureRegistryLive, loadFixture, NoiseBandwidthFixture } from "../../helpers/fixtures/index.js"

describe("base bandwidth parity on noisy observations", () => {
  it.effect("replays FM-15 fixture-backed noise-bandwidth expectations", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("noise-bandwidth.parity").pipe(
        Effect.provide(FixtureRegistryLive)
      )
      const fixture = yield* Schema.decodeUnknownEffect(NoiseBandwidthFixture)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.sync(() => {
            const baseline = buildContinuousParzen(entry.observations, entry.low, entry.high)
            const baselineSigmas = Arr.map(baseline.kernels, (kernel) => kernel.sigma)

            Arr.forEach(entry.expected.baseSigmas, (expected, index) => {
              expect(Arr.get(baselineSigmas, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expected, 9)
            })
          }),
        { discard: true }
      )
    }))
})
