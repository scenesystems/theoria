import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import { sampleWeightedCategoricalCandidatesFromRolls } from "../../../src/internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../src/internal/tpe/categoricalParzen.js"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../../src/internal/tpe/continuousParzen.js"
import { argmax, expectedImprovementScore } from "../../../src/internal/tpe/expectedImprovement.js"
import {
  CategoricalParzenFixtureSchema,
  ContinuousKdeFixtureSchema,
  EiCategoricalFixtureSchema,
  FixtureRegistryLive,
  loadAllFixtures
} from "../../helpers/fixtures.js"

const PROBABILITY_TOLERANCE = 1e-12
const SIGMA_TOLERANCE = 1e-10
const SCORE_TOLERANCE = 1e-9

const REQUIRED_CONTINUOUS_FIXTURES = Arr.make(
  "continuous-kde.micro-positive-span",
  "continuous-kde.extreme-asymmetric-range",
  "continuous-kde.upper-boundary-cluster"
)

const expectWithinTolerance = (actual: number, expected: number, tolerance: number): void => {
  expect(abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

const numberAt = (values: ReadonlyArray<number>, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))

const asDistanceInput = (value: string | number | boolean | null): number => {
  return Match.value(value).pipe(
    Match.when(Match.number, (numeric) => numeric),
    Match.when(Match.boolean, (booleanValue) => (booleanValue ? 1 : 0)),
    Match.when((candidate): candidate is null => candidate === null, () => 0),
    Match.orElse((text) => text.length)
  )
}

const absoluteDistance = (left: string | number | boolean | null, right: string | number | boolean | null): number =>
  abs(asDistanceInput(left) - asDistanceInput(right))

describe("fixture-backed parity", () => {
  it.effect("replays categorical parzen probabilities, kernel weights, and candidate rolls", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("categorical-parzen.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(
        loaded,
        (entry) => Schema.decodeUnknown(CategoricalParzenFixtureSchema)(entry)
      )

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            const options = fixture.payload.distanceMetric === "absolute"
              ? { distance: absoluteDistance }
              : {}
            const parzen = yield* buildCategoricalParzen(
              fixture.payload.choices,
              fixture.payload.observations,
              options
            )

            yield* Effect.forEach(
              fixture.payload.expected.kernelWeights,
              (expectedWeight, index) =>
                Effect.sync(() => {
                  expectWithinTolerance(numberAt(parzen.kernelWeights, index), expectedWeight, PROBABILITY_TOLERANCE)
                }),
              { discard: true }
            )

            yield* Effect.forEach(
              fixture.payload.expected.probabilities,
              (expectedProbability, index) =>
                Effect.sync(() => {
                  expectWithinTolerance(
                    numberAt(parzen.probabilities, index),
                    expectedProbability,
                    PROBABILITY_TOLERANCE
                  )
                }),
              { discard: true }
            )

            yield* Effect.forEach(
              fixture.payload.expected.kernels,
              (expectedKernel, kernelIndex) =>
                Effect.gen(function*() {
                  const actualKernel = parzen.kernels[kernelIndex]

                  yield* Effect.sync(() => {
                    expect(actualKernel).toBeDefined()
                  })

                  yield* Effect.forEach(
                    expectedKernel,
                    (expectedValue, valueIndex) =>
                      Effect.sync(() => {
                        expectWithinTolerance(
                          numberAt(actualKernel?.probabilities ?? Arr.empty<number>(), valueIndex),
                          expectedValue,
                          PROBABILITY_TOLERANCE
                        )
                      }),
                    { discard: true }
                  )
                }),
              { discard: true }
            )

            const replayedCandidates = sampleWeightedCategoricalCandidatesFromRolls(
              fixture.payload.choices,
              fixture.payload.expected.probabilities,
              fixture.payload.expected.candidateRolls
            )

            yield* Effect.sync(() => {
              expect(replayedCandidates).toEqual(fixture.payload.expected.expectedCandidates)
            })
          }),
        { discard: true }
      )
    }))

  it.effect("replays EI score traces and deterministic argmax selection", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("ei.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(loaded, (entry) => Schema.decodeUnknown(EiCategoricalFixtureSchema)(entry))

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            yield* Effect.forEach(
              fixture.payload.scoreTrace,
              (trace) =>
                Effect.sync(() => {
                  expectWithinTolerance(
                    expectedImprovementScore(trace.logL, trace.logG),
                    trace.expected,
                    SCORE_TOLERANCE
                  )
                }),
              { discard: true }
            )

            const expectedScoreVector = Arr.map(fixture.payload.scoreTrace, (trace) => trace.expected)

            yield* Effect.sync(() => {
              expect(fixture.payload.scoreVector).toEqual(expectedScoreVector)
              expect(argmax(fixture.payload.scoreVector)).toBe(fixture.payload.expectedBestIndex)
            })
          }),
        { discard: true }
      )
    }))

  it.effect("replays continuous KDE kernels, log-density traces, and sample rolls", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("continuous-kde.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(loaded, (entry) => Schema.decodeUnknown(ContinuousKdeFixtureSchema)(entry))

      yield* Effect.sync(() => {
        const fixtureNames = Arr.map(fixtures, (fixture) => fixture.fixture)
        expect(Arr.every(REQUIRED_CONTINUOUS_FIXTURES, (name) => Arr.contains(fixtureNames, name))).toBe(true)
      })

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            const parzen = buildContinuousParzen(
              fixture.payload.observations,
              fixture.payload.low,
              fixture.payload.high
            )

            yield* Effect.forEach(
              fixture.payload.expected.kernels,
              (expectedKernel, kernelIndex) =>
                Effect.sync(() => {
                  const actualKernel = parzen.kernels[kernelIndex]

                  expect(actualKernel).toBeDefined()

                  expectWithinTolerance(actualKernel?.mean ?? Number.NaN, expectedKernel.mean, SCORE_TOLERANCE)
                  expectWithinTolerance(actualKernel?.sigma ?? Number.NaN, expectedKernel.sigma, SIGMA_TOLERANCE)
                  expectWithinTolerance(actualKernel?.weight ?? Number.NaN, expectedKernel.weight, SCORE_TOLERANCE)
                }),
              { discard: true }
            )

            yield* Effect.forEach(
              fixture.payload.expected.logDensities,
              (trace) =>
                Effect.sync(() => {
                  expectWithinTolerance(
                    logDensity(parzen, trace.probe),
                    trace.expected,
                    SCORE_TOLERANCE
                  )
                }),
              { discard: true }
            )

            const replayedSamples = Arr.map(
              fixture.payload.expected.candidateRolls,
              (roll) => sampleFromParzen(parzen, roll.kernelRoll, roll.valueRoll)
            )

            yield* Effect.forEach(
              replayedSamples,
              (value, index) =>
                Effect.sync(() => {
                  expectWithinTolerance(
                    value,
                    numberAt(fixture.payload.expected.expectedSamples, index),
                    SCORE_TOLERANCE
                  )
                }),
              { discard: true }
            )
          }),
        { discard: true }
      )
    }))
})
