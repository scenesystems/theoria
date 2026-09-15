import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import type { InvalidSamplerConfig } from "../../../src/Errors/index.js"
import {
  decodeMixedOptimizerConfig,
  makeMixedOptimizerSpace
} from "../../../src/experimental/scenarios/mixedOptimizer.js"
import * as Float64 from "../../../src/internal/float64.js"
import { CompletedTrialForSplit, type TrialSplit } from "../../../src/internal/tpe/splitTrials.js"
import { categoricalCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/categorical.js"
import { floatCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/float.js"
import { intCandidateTraceFromRolls } from "../../../src/samplers/Tpe/dimensions/int.js"
import { NamedDimensionScoreTrace, selectBestMixedCandidate } from "../../../src/samplers/Tpe/mixed.js"
import type * as SearchSpace from "../../../src/SearchSpace/index.js"
import { FixtureRegistryLive, loadAllFixtures, MixedSpaceJointTraceFixtureSchema } from "../../helpers/fixtures.js"

const SCORE_TOLERANCE = 1e-9

class MissingParameterMetadata extends Data.TaggedError("MissingParameterMetadata")<{
  readonly name: string
}> {}

class UnexpectedDistribution extends Data.TaggedError("UnexpectedDistribution")<{
  readonly name: string
  readonly expected: "categorical" | "float" | "int"
}> {}

const numberAt = (values: Schema.Array$<typeof Schema.Number>["Type"], index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))

const parameterByName = (
  space: SearchSpace.SearchSpace,
  name: string
): Effect.Effect<SearchSpace.ParameterMetadata, MissingParameterMetadata> =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name)).pipe(
    Option.match({
      onNone: () => Effect.fail(new MissingParameterMetadata({ name })),
      onSome: Effect.succeed
    })
  )

const expectNumericVector = (
  actual: Schema.Array$<typeof Schema.Number>["Type"],
  expected: Schema.Array$<typeof Schema.Number>["Type"],
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
  expect(Float64.abs(Num.subtract(actual, expected)), label).toBeLessThanOrEqual(tolerance)
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
): Effect.Effect<
  NamedDimensionScoreTrace,
  MissingParameterMetadata | UnexpectedDistribution | InvalidSamplerConfig
> =>
  Effect.gen(function*() {
    const parameter = yield* parameterByName(space, dimension.name)

    return yield* Match.value(dimension).pipe(
      Match.when({ kind: "categorical" }, (categoricalDimension) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "categorical" }, ({ choices }) =>
            Effect.gen(function*() {
              const trace = yield* categoricalCandidateTraceFromRolls(
                parameter,
                choices,
                split,
                categoricalDimension.candidateRolls
              )

              yield* Effect.sync(() => {
                expect(trace.candidates).toEqual(categoricalDimension.candidates)
              })
              yield* expectNumericVector(
                trace.logL,
                categoricalDimension.logL,
                `${categoricalDimension.name}.logL`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(
                trace.logG,
                categoricalDimension.logG,
                `${categoricalDimension.name}.logG`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(
                trace.scores,
                categoricalDimension.scores,
                `${categoricalDimension.name}.scores`,
                SCORE_TOLERANCE
              )

              return new NamedDimensionScoreTrace({ name: parameter.name, trace })
            })),
          Match.orElse(() => Effect.fail(new UnexpectedDistribution({ name: parameter.name, expected: "categorical" })))
        )),
      Match.when({ kind: "float" }, (floatDimension) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "float" }, ({ high, low, scale, step }) =>
            Effect.gen(function*() {
              const trace = yield* floatCandidateTraceFromRolls(
                parameter,
                low,
                high,
                Option.fromNullable(scale),
                Option.fromNullable(step),
                split,
                floatDimension.candidateRolls
              )

              yield* expectNumericVector(
                trace.candidates,
                floatDimension.candidates,
                `${floatDimension.name}.candidates`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(
                trace.logL,
                floatDimension.logL,
                `${floatDimension.name}.logL`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(
                trace.logG,
                floatDimension.logG,
                `${floatDimension.name}.logG`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(
                trace.scores,
                floatDimension.scores,
                `${floatDimension.name}.scores`,
                SCORE_TOLERANCE
              )

              return new NamedDimensionScoreTrace({ name: parameter.name, trace })
            })),
          Match.orElse(() => Effect.fail(new UnexpectedDistribution({ name: parameter.name, expected: "float" })))
        )),
      Match.when({ kind: "int" }, (intDimension) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "int" }, ({ high, low, step }) =>
            Effect.gen(function*() {
              const trace = yield* intCandidateTraceFromRolls(
                parameter,
                low,
                high,
                Option.fromNullable(step),
                split,
                intDimension.candidateRolls
              )

              yield* expectNumericVector(
                trace.candidates,
                intDimension.candidates,
                `${intDimension.name}.candidates`,
                SCORE_TOLERANCE
              )
              yield* expectNumericVector(trace.logL, intDimension.logL, `${intDimension.name}.logL`, SCORE_TOLERANCE)
              yield* expectNumericVector(trace.logG, intDimension.logG, `${intDimension.name}.logG`, SCORE_TOLERANCE)
              yield* expectNumericVector(
                trace.scores,
                intDimension.scores,
                `${intDimension.name}.scores`,
                SCORE_TOLERANCE
              )

              return new NamedDimensionScoreTrace({ name: parameter.name, trace })
            })),
          Match.orElse(() => Effect.fail(new UnexpectedDistribution({ name: parameter.name, expected: "int" })))
        )),
      Match.exhaustive
    )
  })

const decodedConfigs = (
  configs: Schema.Array$<typeof Schema.Unknown>["Type"]
) => Effect.forEach(configs, (config) => decodeMixedOptimizerConfig(config))

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
            const space = yield* makeMixedOptimizerSpace()
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
                  const actualConfig = Arr.get(actualConfigs, index)
                  expect(Option.map(actualConfig, (config) =>
                    config.optimizer)).toEqual(Option.some(expectedConfig.optimizer))
                  expect(Option.map(actualConfig, (config) =>
                    config.depth)).toEqual(Option.some(expectedConfig.depth))
                  expectWithinTolerance(
                    Option.map(actualConfig, (config) =>
                      config.lr).pipe(Option.getOrElse(() => Number.NaN)),
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

            const bestConfig = yield* decodeMixedOptimizerConfig(selection.bestConfig)
            const expectedBest = yield* decodeMixedOptimizerConfig(fixture.payload.expected.expectedSuggestion)

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
