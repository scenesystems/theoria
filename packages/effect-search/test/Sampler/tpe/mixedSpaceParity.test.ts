import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { categoricalCandidateTraceFromRolls } from "../../../src/internal/tpe/dimensions/categorical.js"
import { floatCandidateTraceFromRolls } from "../../../src/internal/tpe/dimensions/float.js"
import { intCandidateTraceFromRolls } from "../../../src/internal/tpe/dimensions/int.js"
import { type NamedDimensionScoreTrace, selectBestMixedCandidate } from "../../../src/internal/tpe/mixed.js"
import { CompletedTrialForSplit, type TrialSplit } from "../../../src/internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../../src/SearchError.js"
import type * as SearchSpace from "../../../src/SearchSpace.js"
import { decodeMixedOptimizerConfig, makeMixedOptimizerSpace } from "../../fixtures/scenarios/mixedOptimizer.js"
import { FixtureRegistryLive, loadAllFixtures, MixedSpaceJointTraceFixture } from "../../helpers/fixtures/index.js"

const SCORE_TOLERANCE = 1e-9

class MissingParameterMetadata extends Data.TaggedError("MissingParameterMetadata")<{
  readonly name: string
}> {}

class UnexpectedDistribution extends Data.TaggedError("UnexpectedDistribution")<{
  readonly name: string
  readonly expected: "categorical" | "float" | "int"
}> {}

const numberAt = (values: Iterable<number>, index: number): number =>
  Arr.get(Arr.fromIterable(values), index).pipe(Option.getOrElse(() => Number.NaN))

const parameterByName = (
  space: SearchSpace.SearchSpace,
  name: string
): Effect.Effect<SearchSpace.Parameter, MissingParameterMetadata> =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name)).pipe(
    Option.match({
      onNone: () => Effect.fail(new MissingParameterMetadata({ name })),
      onSome: Effect.succeed
    })
  )

const expectNumericVector = (
  actual: Iterable<number>,
  expected: Iterable<number>,
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
  expect(Numeric.abs(Num.subtract(actual, expected)), label).toBeLessThanOrEqual(tolerance)
}

const splitFromFixture = (
  payload: Schema.Schema.Type<typeof MixedSpaceJointTraceFixture>["payload"]
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

type MixedSpacePayload = Schema.Schema.Type<typeof MixedSpaceJointTraceFixture>["payload"]
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
      Match.when({ kind: "categorical" }, (categorical) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "categorical" }, (distribution) =>
            categoricalCandidateTraceFromRolls(parameter, distribution.choices, split, categorical.candidateRolls).pipe(
              Effect.tap((trace) =>
                Effect.sync(() => expect(Arr.fromIterable(trace.candidates)).toEqual(categorical.candidates))
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logL, categorical.logL, `${categorical.name}.logL`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logG, categorical.logG, `${categorical.name}.logG`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.scores, categorical.scores, `${categorical.name}.scores`, SCORE_TOLERANCE)
              ),
              Effect.map((trace) => ({ name: parameter.name, trace }))
            )),
          Match.orElse(() =>
            new UnexpectedDistribution({ name: parameter.name, expected: "categorical" })
          )
        )),
      Match.when({ kind: "float" }, (continuous) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "float" }, (distribution) =>
            floatCandidateTraceFromRolls(
              parameter,
              distribution.low,
              distribution.high,
              Option.fromNullable(distribution.scale),
              Option.fromNullable(distribution.step),
              split,
              continuous.candidateRolls
            ).pipe(
              Effect.tap((trace) =>
                expectNumericVector(
                  trace.candidates,
                  continuous.candidates,
                  `${continuous.name}.candidates`,
                  SCORE_TOLERANCE
                )
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logL, continuous.logL, `${continuous.name}.logL`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logG, continuous.logG, `${continuous.name}.logG`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.scores, continuous.scores, `${continuous.name}.scores`, SCORE_TOLERANCE)
              ),
              Effect.map((trace) => ({ name: parameter.name, trace }))
            )),
          Match.orElse(() => new UnexpectedDistribution({ name: parameter.name, expected: "float" }))
        )),
      Match.when({ kind: "int" }, (integer) =>
        Match.value(parameter.distribution).pipe(
          Match.when({ type: "int" }, (distribution) =>
            intCandidateTraceFromRolls(
              parameter,
              distribution.low,
              distribution.high,
              Option.fromNullable(distribution.step),
              split,
              integer.candidateRolls
            ).pipe(
              Effect.tap((trace) =>
                expectNumericVector(trace.candidates, integer.candidates, `${integer.name}.candidates`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logL, integer.logL, `${integer.name}.logL`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.logG, integer.logG, `${integer.name}.logG`, SCORE_TOLERANCE)
              ),
              Effect.tap((trace) =>
                expectNumericVector(trace.scores, integer.scores, `${integer.name}.scores`, SCORE_TOLERANCE)
              ),
              Effect.map((trace) => ({ name: parameter.name, trace }))
            )),
          Match.orElse(() => new UnexpectedDistribution({ name: parameter.name, expected: "int" }))
        )),
      Match.exhaustive
    )
  })

const decodedConfigs = (
  configs: Iterable<unknown>
) => Effect.forEach(configs, (config) => decodeMixedOptimizerConfig(config))

describe("mixed-space fixture parity", () => {
  it.effect("replays per-dimension rolls and joint EI argmax decisions from mixed-space fixtures", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("mixed-space.").pipe(Effect.provide(FixtureRegistryLive))
      const fixtures = yield* Effect.forEach(
        loaded,
        (entry) => Schema.decodeUnknown(MixedSpaceJointTraceFixture)(entry)
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
