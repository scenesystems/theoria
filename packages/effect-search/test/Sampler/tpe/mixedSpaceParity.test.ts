import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import type { InvalidSamplerConfig } from "../../../src/Errors/index.js"
import {
  decodeMixedOptimizerConfigEffect,
  makeMixedOptimizerSpace
} from "../../../src/experimental/scenarios/mixedOptimizer.js"
import * as Float64 from "../../../src/internal/float64.js"
import { CompletedTrialForSplit, type TrialSplit } from "../../../src/internal/tpe/splitTrials.js"
import { categoricalCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/categorical.js"
import { floatCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/float.js"
import { intCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/int.js"
import { type NamedDimensionScoreTrace, selectBestMixedCandidate } from "../../../src/samplers/Tpe/mixed.js"
import type * as SearchSpace from "../../../src/SearchSpace/index.js"
import { FixtureRegistryLive, loadAllFixtures, MixedSpaceJointTraceFixtureSchema } from "../../helpers/fixtures.js"

const SCORE_TOLERANCE = 1e-9

const numberAt = (values: ReadonlyArray<number>, index: number): number =>
  Option.fromNullable(values[index]).pipe(Option.getOrElse(() => Number.NaN))

const parameterByName = (
  space: SearchSpace.SearchSpace,
  name: string
): Effect.Effect<SearchSpace.ParameterMetadata, string> =>
  Option.fromNullable(space.params.find((parameter) => parameter.name === name)).pipe(
    Option.match({
      onNone: () => Effect.fail(`missing parameter metadata for "${name}"`),
      onSome: Effect.succeed
    })
  )

const expectNumericVector = (
  actual: ReadonlyArray<number>,
  expected: ReadonlyArray<number>,
  label: string,
  tolerance: number
): Effect.Effect<void> =>
  Effect.forEach(expected, (expectedValue, index) =>
    Effect.sync(() => {
      expectWithinTolerance(numberAt(actual, index), expectedValue, tolerance, `${label}[${index}]`)
    }), { discard: true }).pipe(Effect.asVoid)

const expectWithinTolerance = (
  actual: number,
  expected: number,
  tolerance: number,
  label: string
): void => {
  expect(Float64.abs(actual - expected), label).toBeLessThanOrEqual(tolerance)
}

const splitFromFixture = (
  payload: Schema.Schema.Type<typeof MixedSpaceJointTraceFixtureSchema>["payload"]
): TrialSplit => ({
  below: Arr.map(payload.split.below, (trial) =>
    new CompletedTrialForSplit({
      trialNumber: trial.trialNumber,
      config: trial.config,
      value: trial.value
    })),
  above: Arr.map(payload.split.above, (trial) =>
    new CompletedTrialForSplit({
      trialNumber: trial.trialNumber,
      config: trial.config,
      value: trial.value
    }))
})

type MixedSpacePayload = Schema.Schema.Type<typeof MixedSpaceJointTraceFixtureSchema>["payload"]
type MixedSpaceDimension = MixedSpacePayload["dimensions"][number]

const traceFromDimension = (
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  dimension: MixedSpaceDimension
): Effect.Effect<NamedDimensionScoreTrace, string | InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const parameter = yield* parameterByName(space, dimension.name)

    if (dimension.kind === "categorical") {
      if (parameter.distribution.type !== "categorical") {
        return yield* Effect.fail(`expected categorical distribution for parameter "${parameter.name}"`)
      }

      const trace = yield* categoricalCandidateTraceFromRolls(
        parameter,
        parameter.distribution.choices,
        split,
        dimension.candidateRolls
      )

      yield* Effect.sync(() => {
        expect(trace.candidates).toEqual(dimension.candidates)
      })
      yield* expectNumericVector(trace.logL, dimension.logL, `${dimension.name}.logL`, SCORE_TOLERANCE)
      yield* expectNumericVector(trace.logG, dimension.logG, `${dimension.name}.logG`, SCORE_TOLERANCE)
      yield* expectNumericVector(trace.scores, dimension.scores, `${dimension.name}.scores`, SCORE_TOLERANCE)

      return {
        name: parameter.name,
        trace
      }
    }

    if (dimension.kind === "float") {
      if (parameter.distribution.type !== "float") {
        return yield* Effect.fail(`expected float distribution for parameter "${parameter.name}"`)
      }

      const trace = yield* floatCandidateTraceFromRolls(
        parameter,
        parameter.distribution.low,
        parameter.distribution.high,
        Option.fromNullable(parameter.distribution.scale),
        Option.fromNullable(parameter.distribution.step),
        split,
        dimension.candidateRolls
      )

      yield* expectNumericVector(
        trace.candidates,
        dimension.candidates,
        `${dimension.name}.candidates`,
        SCORE_TOLERANCE
      )
      yield* expectNumericVector(trace.logL, dimension.logL, `${dimension.name}.logL`, SCORE_TOLERANCE)
      yield* expectNumericVector(trace.logG, dimension.logG, `${dimension.name}.logG`, SCORE_TOLERANCE)
      yield* expectNumericVector(trace.scores, dimension.scores, `${dimension.name}.scores`, SCORE_TOLERANCE)

      return {
        name: parameter.name,
        trace
      }
    }

    if (parameter.distribution.type !== "int") {
      return yield* Effect.fail(`expected int distribution for parameter "${parameter.name}"`)
    }

    const trace = yield* intCandidateTraceFromRolls(
      parameter,
      parameter.distribution.low,
      parameter.distribution.high,
      Option.fromNullable(parameter.distribution.step),
      split,
      dimension.candidateRolls
    )

    yield* expectNumericVector(trace.candidates, dimension.candidates, `${dimension.name}.candidates`, SCORE_TOLERANCE)
    yield* expectNumericVector(trace.logL, dimension.logL, `${dimension.name}.logL`, SCORE_TOLERANCE)
    yield* expectNumericVector(trace.logG, dimension.logG, `${dimension.name}.logG`, SCORE_TOLERANCE)
    yield* expectNumericVector(trace.scores, dimension.scores, `${dimension.name}.scores`, SCORE_TOLERANCE)

    return {
      name: parameter.name,
      trace
    }
  })

const decodedConfigs = (
  configs: ReadonlyArray<unknown>
) => Effect.forEach(configs, (config) => decodeMixedOptimizerConfigEffect(config))

describe("mixed-space fixture parity", () => {
  it.effect("replays per-dimension rolls and joint EI argmax decisions from mixed-space fixtures", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("mixed-space.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(
        loaded,
        (entry) => Schema.decodeUnknown(MixedSpaceJointTraceFixtureSchema)(entry)
      )

      yield* Effect.forEach(
        fixtures,
        (fixture) =>
          Effect.gen(function*() {
            const space = makeMixedOptimizerSpace()
            const split = splitFromFixture(fixture.payload)

            const traces = yield* Effect.forEach(fixture.payload.dimensions, (dimension) =>
              traceFromDimension(space, split, dimension))

            const selection = yield* selectBestMixedCandidate(traces, split)
            const actualConfigs = yield* decodedConfigs(selection.candidateConfigs)
            const expectedConfigs = yield* decodedConfigs(fixture.payload.expected.candidateConfigs)

            yield* Effect.forEach(
              expectedConfigs,
              (expectedConfig, index) =>
                Effect.sync(() => {
                  const actualConfig = actualConfigs[index]
                  expect(actualConfig?.optimizer).toBe(expectedConfig.optimizer)
                  expect(actualConfig?.depth).toBe(expectedConfig.depth)
                  expectWithinTolerance(
                    actualConfig?.lr ?? Number.NaN,
                    expectedConfig.lr,
                    SCORE_TOLERANCE,
                    `candidate[${index}].lr`
                  )
                }),
              { discard: true }
            )

            yield* expectNumericVector(
              selection.jointScores,
              fixture.payload.expected.jointScores,
              "jointScores",
              SCORE_TOLERANCE
            )

            const bestConfig = yield* decodeMixedOptimizerConfigEffect(selection.bestConfig)
            const expectedBest = yield* decodeMixedOptimizerConfigEffect(fixture.payload.expected.expectedSuggestion)

            yield* Effect.sync(() => {
              expect(selection.bestIndex).toBe(fixture.payload.expected.expectedBestIndex)
              expect(bestConfig.optimizer).toBe(expectedBest.optimizer)
              expect(bestConfig.depth).toBe(expectedBest.depth)
              expectWithinTolerance(bestConfig.lr, expectedBest.lr, SCORE_TOLERANCE, "bestConfig.lr")
            })
          }),
        { discard: true }
      )
    }))
})
