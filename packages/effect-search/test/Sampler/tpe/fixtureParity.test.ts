import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema, String as Str } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { sampleWeightedCategoricalCandidatesFromRolls } from "../../../src/internal/tpe/candidates.js"
import { buildCategoricalParzen } from "../../../src/internal/tpe/categoricalParzen.js"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../../src/internal/tpe/continuousParzen.js"
import { prepareLogDensity } from "../../../src/internal/tpe/continuousParzen/density.js"
import { argmax, expectedImprovementScore } from "../../../src/internal/tpe/expectedImprovement.js"
import {
  CategoricalParzenFixture,
  ContinuousKdeFixture,
  EiCategoricalFixture,
  FixtureRegistryLive,
  loadAllFixtures
} from "../../helpers/fixtures/index.js"

const PROBABILITY_TOLERANCE = 1e-12
const SIGMA_TOLERANCE = 1e-10
const SCORE_TOLERANCE = 1e-9

const expectWithinTolerance = (actual: number, expected: number, tolerance: number): void => {
  expect(Numeric.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const numberAt = (valuesInput: Iterable<number>, index: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))
}

const asDistanceInput = (value: Option.Option<unknown>): number =>
  Option.match(value, {
    onNone: () => 0,
    onSome: (present) =>
      Match.value(present).pipe(
        Match.when(Match.number, (numeric) => numeric),
        Match.when(Match.boolean, (booleanValue) =>
          Match.value(booleanValue).pipe(
            Match.when(true, () => 1),
            Match.orElse(() => 0)
          )),
        Match.when(Match.string, Str.length),
        Match.orElse(() => 0)
      )
  })

const absoluteDistance = (left: unknown, right: unknown): number =>
  Numeric.abs(Num.subtract(asDistanceInput(Option.fromNullable(left)), asDistanceInput(Option.fromNullable(right))))

describe("fixture-backed parity", () => {
  it.effect("replays categorical parzen probabilities, kernel weights, and candidate rolls", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("categorical-parzen.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(
        loaded,
        (entry) => Schema.decodeUnknown(CategoricalParzenFixture)(entry)
      )

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            const options = Match.value(fixture.payload.distanceMetric).pipe(
              Match.when("absolute", () => ({ distance: absoluteDistance })),
              Match.orElse(() => ({}))
            )
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
                  const actualKernel = yield* Arr.get(parzen.kernels, kernelIndex)

                  yield* Effect.forEach(
                    expectedKernel,
                    (expectedValue, valueIndex) =>
                      Effect.sync(() => {
                        expectWithinTolerance(
                          numberAt(actualKernel.probabilities, valueIndex),
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
      const fixtures = yield* Effect.forEach(loaded, (entry) => Schema.decodeUnknown(EiCategoricalFixture)(entry))

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

            yield* Effect.sync(() => {
              expect(argmax(fixture.payload.scoreVector)).toBe(fixture.payload.expectedBestIndex)
            })
          }),
        { discard: true }
      )
    }))

  it.effect("replays continuous KDE kernels, log-density traces, and sample rolls", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("continuous-kde.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(loaded, (entry) => Schema.decodeUnknown(ContinuousKdeFixture)(entry))

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            const parzen = buildContinuousParzen(
              fixture.payload.observations,
              fixture.payload.low,
              fixture.payload.high
            )
            const preparedLogDensity = prepareLogDensity(parzen)

            yield* Effect.forEach(
              fixture.payload.expected.kernels,
              (expectedKernel, kernelIndex) =>
                Effect.gen(function*() {
                  const actualKernel = yield* Arr.get(parzen.kernels, kernelIndex)

                  expectWithinTolerance(actualKernel.mean, expectedKernel.mean, SCORE_TOLERANCE)
                  expectWithinTolerance(actualKernel.sigma, expectedKernel.sigma, SIGMA_TOLERANCE)
                  expectWithinTolerance(actualKernel.weight, expectedKernel.weight, SCORE_TOLERANCE)
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
                  expectWithinTolerance(preparedLogDensity(trace.probe), trace.expected, SCORE_TOLERANCE)
                  expect(preparedLogDensity(trace.probe)).toBe(logDensity(parzen, trace.probe))
                }),
              { discard: true }
            )

            const replayedSamples = Arr.map(
              fixture.payload.expected.candidateRolls,
              ([kernelRoll, valueRoll]) => sampleFromParzen(parzen, kernelRoll, valueRoll)
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
