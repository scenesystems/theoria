import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import {
  diagonalGaussianLogDensity,
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussian,
  sampleDiagonalGaussianMixture,
  scottsBandwidth,
  scottsFactor
} from "../../../src/internal/tpe/multivariateGaussian.js"
import { FixtureRegistryLive, loadFixture, MultivariateGaussianFixtureSchema } from "../../helpers/fixtures/index.js"

const densityFixtures = Arr.make(
  {
    fixture: "multivariate-gaussian.standard-origin",
    point: [0, 0],
    mean: [0, 0],
    sigmas: [1, 1],
    expected: -1.8378770664093453
  },
  {
    fixture: "multivariate-gaussian.unit-offset",
    point: [1, -1],
    mean: [0, 0],
    sigmas: [1, 1],
    expected: -2.8378770664093453
  },
  {
    fixture: "multivariate-gaussian.asymmetric-sigma",
    point: [0.25, -0.5],
    mean: [0.5, -0.75],
    sigmas: [0.2, 0.4],
    expected: -0.28871092210109006
  }
)

const samplingFixtures = Arr.make(
  {
    fixture: "multivariate-gaussian.sample.kernel-a",
    mean: [0.5, -1],
    sigmas: [0.2, 0.4],
    rolls: [0.1, 0.9],
    expected: [0.2436896868910798, -0.4873793737821596]
  },
  {
    fixture: "multivariate-gaussian.sample.kernel-b",
    mean: [1.25, 0.75],
    sigmas: [0.35, 0.15],
    rolls: [0.6, 0.3],
    expected: [1.33867148609753, 0.6713399230937939]
  }
)

describe("multivariate gaussian parity", () => {
  it.effect("replays deterministic diagonal-gaussian log-density fixtures", () =>
    Effect.forEach(
      densityFixtures,
      (fixture) =>
        Effect.sync(() => {
          const actual = diagonalGaussianLogDensity(fixture.point, fixture.mean, fixture.sigmas)
          expect(actual).toBeCloseTo(fixture.expected, 12)
        }),
      { discard: true }
    ))

  it.effect("replays Scott's factor and bandwidth parity fixtures", () =>
    Effect.sync(() => {
      expect(scottsFactor(10, 2)).toBeCloseTo(0.6812920690579612, 12)
      expect(scottsFactor(100, 2)).toBeCloseTo(0.4641588833612779, 12)
      expect(scottsBandwidth(10, 2, 2)).toBeCloseTo(1.3625841381159225, 12)
      expect(scottsBandwidth(100, 2, 2)).toBeCloseTo(0.9283177667225558, 12)
    }))

  it.effect("replays deterministic diagonal-gaussian sampling fixtures", () =>
    Effect.forEach(
      samplingFixtures,
      (fixture) =>
        Effect.sync(() => {
          const actual = sampleDiagonalGaussian(fixture.mean, fixture.sigmas, fixture.rolls)

          expect(actual).toHaveLength(fixture.expected.length)
          fixture.expected.forEach((expectedValue, index) => {
            expect(actual[index]).toBeCloseTo(expectedValue, 12)
          })
        }),
      { discard: true }
    ))

  it.effect("replays deterministic mixture-sampling fixture", () =>
    Effect.sync(() => {
      const actual = sampleDiagonalGaussianMixture(
        [
          [0.2, -0.3],
          [1.1, 0.6]
        ],
        [
          [0.1, 0.2],
          [0.3, 0.4]
        ],
        [0.75, 0.25],
        0.2,
        [0.35, 0.7]
      )

      expect(actual[0]).toBeCloseTo(0.16146795335924322, 12)
      expect(actual[1]).toBeCloseTo(-0.1951198974583919, 12)
    }))

  it.effect("replays fixture-backed FM-14 multivariate gaussian parity", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("multivariate-gaussian.parity").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(MultivariateGaussianFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.densityCases,
        (entry) =>
          Effect.sync(() => {
            expect(diagonalGaussianLogDensity(entry.point, entry.mean, entry.sigmas)).toBeCloseTo(
              entry.expectedLogDensity,
              12
            )
          }),
        { discard: true }
      )

      yield* Effect.forEach(
        fixture.payload.bandwidthCases,
        (entry) =>
          Effect.sync(() => {
            expect(scottsFactor(entry.sampleCount, entry.dimensions)).toBeCloseTo(entry.expectedFactor, 12)
            expect(scottsBandwidth(entry.sampleCount, entry.dimensions, entry.stddev)).toBeCloseTo(
              entry.expectedBandwidth,
              12
            )
          }),
        { discard: true }
      )

      yield* Effect.forEach(
        fixture.payload.samplingCases,
        (entry) =>
          Effect.sync(() => {
            const sample = sampleDiagonalGaussian(entry.mean, entry.sigmas, entry.rolls)

            expect(sample).toHaveLength(entry.expectedSample.length)
            entry.expectedSample.forEach((expectedValue, index) => {
              expect(sample[index]).toBeCloseTo(expectedValue, 12)
            })
          }),
        { discard: true }
      )

      const mixture = fixture.payload.mixtureCase
      const sample = sampleDiagonalGaussianMixture(
        mixture.means,
        mixture.sigmas,
        mixture.weights,
        mixture.componentRoll,
        mixture.valueRolls
      )

      yield* Effect.sync(() => {
        mixture.expectedSample.forEach((expectedValue, index) => {
          expect(sample[index]).toBeCloseTo(expectedValue, 12)
        })
        expect(diagonalGaussianMixtureLogDensity(sample, mixture.means, mixture.sigmas, mixture.weights)).toBeCloseTo(
          mixture.expectedLogDensity,
          12
        )
      })
    }))
})
