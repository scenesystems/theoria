import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

import {
  diagonalGaussianLogDensity,
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussian,
  sampleDiagonalGaussianMixture,
  scottsBandwidth,
  scottsFactor
} from "../../../src/internal/tpe/multivariateGaussian.js"
import { FixtureRegistryLive, loadFixture, MultivariateGaussianFixture } from "../../helpers/fixtures/index.js"

const densityFixtures = Arr.make(
  {
    fixture: "multivariate-gaussian.standard-origin",
    point: Arr.make(0, 0),
    mean: Arr.make(0, 0),
    sigmas: Arr.make(1, 1),
    expected: Num.negate(1.8378770664093453)
  },
  {
    fixture: "multivariate-gaussian.unit-offset",
    point: Arr.make(1, Num.negate(1)),
    mean: Arr.make(0, 0),
    sigmas: Arr.make(1, 1),
    expected: Num.negate(2.8378770664093453)
  },
  {
    fixture: "multivariate-gaussian.asymmetric-sigma",
    point: Arr.make(0.25, Num.negate(0.5)),
    mean: Arr.make(0.5, Num.negate(0.75)),
    sigmas: Arr.make(0.2, 0.4),
    expected: Num.negate(0.28871092210109006)
  }
)

const samplingFixtures = Arr.make(
  {
    fixture: "multivariate-gaussian.sample.kernel-a",
    mean: Arr.make(0.5, Num.negate(1)),
    sigmas: Arr.make(0.2, 0.4),
    rolls: Arr.make(0.1, 0.9),
    expected: Arr.make(0.2436896868910798, Num.negate(0.4873793737821596))
  },
  {
    fixture: "multivariate-gaussian.sample.kernel-b",
    mean: Arr.make(1.25, 0.75),
    sigmas: Arr.make(0.35, 0.15),
    rolls: Arr.make(0.6, 0.3),
    expected: Arr.make(1.33867148609753, 0.6713399230937939)
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

          expect(actual).toHaveLength(Arr.length(fixture.expected))
          Arr.forEach(fixture.expected, (expectedValue, index) => {
            expect(Arr.get(actual, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expectedValue, 12)
          })
        }),
      { discard: true }
    ))

  it.effect("replays deterministic mixture-sampling fixture", () =>
    Effect.sync(() => {
      const actual = sampleDiagonalGaussianMixture(
        Arr.make(Arr.make(0.2, Num.negate(0.3)), Arr.make(1.1, 0.6)),
        Arr.make(Arr.make(0.1, 0.2), Arr.make(0.3, 0.4)),
        Arr.make(0.75, 0.25),
        0.2,
        Arr.make(0.35, 0.7)
      )

      expect(Arr.get(actual, 0).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(0.16146795335924322, 12)
      expect(Arr.get(actual, 1).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(
        Num.negate(0.1951198974583919),
        12
      )
    }))

  it.effect("replays fixture-backed FM-14 multivariate gaussian parity", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("multivariate-gaussian.parity").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(MultivariateGaussianFixture)(loaded)

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

            expect(sample).toHaveLength(Arr.length(entry.expectedSample))
            Arr.forEach(entry.expectedSample, (expectedValue, index) => {
              expect(Arr.get(sample, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expectedValue, 12)
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
        Arr.forEach(mixture.expectedSample, (expectedValue, index) => {
          expect(Arr.get(sample, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expectedValue, 12)
        })
        expect(diagonalGaussianMixtureLogDensity(sample, mixture.means, mixture.sigmas, mixture.weights)).toBeCloseTo(
          mixture.expectedLogDensity,
          12
        )
      })
    }))
})
