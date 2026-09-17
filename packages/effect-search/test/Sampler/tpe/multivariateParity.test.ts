import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FastCheck, Number as Num, Option, Schema } from "effect"

import {
  diagonalGaussianLogDensity,
  diagonalGaussianMixtureLogDensity,
  prepareDiagonalGaussianMixtureLogDensity,
  prepareSampleDiagonalGaussianMixture,
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
  it.effect.prop("prepared mixture densities retain coordinate and component accumulation order", {
    means: FastCheck.array(
      FastCheck.tuple(
        FastCheck.double({ min: -3, max: 5, noNaN: true }),
        FastCheck.double({ min: -8, max: 2, noNaN: true }),
        FastCheck.double({ min: 4, max: 11, noNaN: true })
      ),
      { minLength: 1, maxLength: 12 }
    ),
    points: FastCheck.array(
      FastCheck.tuple(
        FastCheck.double({ min: -4, max: 7, noNaN: true }),
        FastCheck.double({ min: -9, max: 3, noNaN: true }),
        FastCheck.double({ min: 1, max: 12, noNaN: true })
      ),
      { minLength: 2, maxLength: 6 }
    )
  }, ({ means, points }) =>
    Effect.sync(() => {
      const sigmas = Arr.map(means, (_mean, index) => Arr.make(Num.sum(0.3, index), 0.7, 2.1))
      const weights = Arr.map(means, (_mean, index) => index)
      const density = prepareDiagonalGaussianMixtureLogDensity(means, sigmas, weights)
      const changed = prepareDiagonalGaussianMixtureLogDensity(Arr.reverse(means), sigmas, Arr.reverse(weights))
      Arr.forEach(points, (point) => {
        expect(density(point)).toBe(diagonalGaussianMixtureLogDensity(point, means, sigmas, weights))
        expect(changed(point)).toBe(
          diagonalGaussianMixtureLogDensity(point, Arr.reverse(means), sigmas, Arr.reverse(weights))
        )
        expect(density(point)).toBe(diagonalGaussianMixtureLogDensity(point, means, sigmas, weights))
      })
    }))

  it.effect("prepared mixtures preserve invalid scales, missing components, and zero-weight behavior", () =>
    Effect.sync(() => {
      const means = Arr.make(Arr.make(-1, 3), Arr.make(4, -2))
      const sigmas = Arr.make(Arr.make(0, Number.NaN), Arr.make(Number.POSITIVE_INFINITY, -1))
      Arr.forEach(Arr.make(Arr.make(0, 0), Arr.make(3, 1), Arr.make(Number.NaN, -1), Arr.make(1, 0)), (weights) => {
        const density = prepareDiagonalGaussianMixtureLogDensity(means, sigmas, weights)
        const sample = prepareSampleDiagonalGaussianMixture(means, sigmas, weights)
        Arr.forEach(
          Arr.make(Arr.make(-1, 3), Arr.make(2, 1), Arr.empty<number>(), Arr.make(1), Arr.make(Number.NaN, 0)),
          (point) => {
            expect(density(point)).toBe(diagonalGaussianMixtureLogDensity(point, means, sigmas, weights))
          }
        )
        Arr.forEach(Arr.make(0, 0.5, 1, Number.NaN), (roll) => {
          expect(sample(roll, Arr.make(0.1, 0.9))).toEqual(
            sampleDiagonalGaussianMixture(means, sigmas, weights, roll, Arr.make(0.1, 0.9))
          )
        })
      })
      const missing = prepareDiagonalGaussianMixtureLogDensity(means, Arr.take(sigmas, 1), Arr.make(0, 1))
      expect(missing(Arr.make(4, -2))).toBe(Number.NEGATIVE_INFINITY)
      expect(prepareDiagonalGaussianMixtureLogDensity(Arr.empty(), Arr.empty(), Arr.empty())(Arr.empty())).toBe(
        Number.NEGATIVE_INFINITY
      )
      expect(prepareSampleDiagonalGaussianMixture(Arr.empty(), Arr.empty(), Arr.empty())(0.5, Arr.empty())).toEqual(
        Arr.empty()
      )
    }))

  it.effect("prepared sampling preserves normalized-weight ties and asymmetric coordinate rolls", () =>
    Effect.sync(() => {
      const means = Arr.make(Arr.make(-7, 3), Arr.make(2, -4), Arr.make(11, 6))
      const sigmas = Arr.make(Arr.make(0.3, 1.1), Arr.make(0.7, 2.3), Arr.make(1.5, 0.2))
      const weights = Arr.make(0, 1, 3)
      const sample = prepareSampleDiagonalGaussianMixture(means, sigmas, weights)
      const median = Arr.make(0.5, 0.5)
      expect(sample(0, median)).toEqual(Arr.make(2, -4))
      expect(sample(0.25, median)).toEqual(Arr.make(2, -4))
      expect(sample(0.25000000000000006, median)).toEqual(Arr.make(11, 6))
      expect(sample(1, median)).toEqual(Arr.make(11, 6))
      Arr.forEach(Arr.make(0.9, 0.25, 0.1, 0.8, 0.1), (roll) => {
        expect(sample(roll, Arr.make(0.1, 0.9))).toEqual(
          sampleDiagonalGaussianMixture(means, sigmas, weights, roll, Arr.make(0.1, 0.9))
        )
      })
    }))

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
      const preparedSample = prepareSampleDiagonalGaussianMixture(mixture.means, mixture.sigmas, mixture.weights)(
        mixture.componentRoll,
        mixture.valueRolls
      )
      const preparedDensity = prepareDiagonalGaussianMixtureLogDensity(mixture.means, mixture.sigmas, mixture.weights)

      yield* Effect.sync(() => {
        Arr.forEach(mixture.expectedSample, (expectedValue, index) => {
          expect(Arr.get(sample, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expectedValue, 12)
          expect(Arr.get(preparedSample, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expectedValue, 12)
        })
        expect(diagonalGaussianMixtureLogDensity(sample, mixture.means, mixture.sigmas, mixture.weights)).toBeCloseTo(
          mixture.expectedLogDensity,
          12
        )
        expect(preparedDensity(mixture.expectedSample)).toBeCloseTo(mixture.expectedLogDensity, 12)
      })
    }))
})
