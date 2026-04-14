import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import { abs, logStrict } from "effect-math/Numeric"

import {
  decodeLinearTreeConditionalConfig,
  LinearTreeConditionalConfigSchema,
  LinearTreeConditionalSpace
} from "../../src/experimental/scenarios/conditionalLinearTree.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

type ConditionalConfig = Schema.Schema.Type<typeof LinearTreeConditionalConfigSchema>

const decodeConditional = decodeLinearTreeConditionalConfig
const encodeConfigTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(LinearTreeConditionalConfigSchema)))
const encodeValueTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(Schema.Number)))

const makeSpace = () => LinearTreeConditionalSpace.make()

const objectiveValue = (config: ConditionalConfig): number =>
  Match.value(config).pipe(
    Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
      abs(logStrict(learningRate) - logStrict(0.02)) + abs(regularization - 0.15)),
    Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
      1 + abs(maxDepth - 6) * 0.4 + abs(minSamplesLeaf - 2) * 0.3),
    Match.exhaustive
  )

const objective = (raw: unknown) => Effect.succeed(objectiveValue(decodeConditional(raw)))

const asSingleObjective = (result: Study.StudyResult) =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (singleObjective) => Option.some(singleObjective)),
    Match.orElse(() => Option.none())
  )

const configTrace = (result: Study.SingleObjectiveResult): Array<ConditionalConfig> =>
  Arr.map(result.trials, (trial) => decodeConditional(trial.config))

const valueTrace = (result: Study.SingleObjectiveResult): Array<number> =>
  Arr.flatMap(result.trials, (trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: ({ value }) =>
        Match.value(value).pipe(
          Match.when(Match.number, (resolved) => [resolved]),
          Match.orElse(() => [])
        ),
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state))

const optimizeWith = (concurrency: number) =>
  Study.optimize({
    space: makeSpace(),
    sampler: Sampler.tpe({ seed: 212, nStartupTrials: 4, nEiCandidates: 16 }),
    direction: "minimize",
    trials: 10,
    concurrency,
    objective
  })

describe("integration conditional TPE study", () => {
  it.effect("preserves deterministic semantic traces for each concurrency profile", () =>
    Effect.gen(function*() {
      const singleThreadedA = yield* optimizeWith(1)
      const singleThreadedB = yield* optimizeWith(1)
      const parallelA = yield* optimizeWith(4)
      const parallelB = yield* optimizeWith(4)
      const singleThreadedAOption = asSingleObjective(singleThreadedA)
      const singleThreadedBOption = asSingleObjective(singleThreadedB)
      const parallelAOption = asSingleObjective(parallelA)
      const parallelBOption = asSingleObjective(parallelB)

      expect(Option.isSome(singleThreadedAOption)).toBe(true)
      expect(Option.isSome(singleThreadedBOption)).toBe(true)
      expect(Option.isSome(parallelAOption)).toBe(true)
      expect(Option.isSome(parallelBOption)).toBe(true)

      const tracedRuns = Option.getOrThrow(
        Option.all({
          singleThreadedAOption,
          singleThreadedBOption,
          parallelAOption,
          parallelBOption
        })
      )

      expect(encodeConfigTrace(configTrace(tracedRuns.singleThreadedAOption))).toBe(
        encodeConfigTrace(configTrace(tracedRuns.singleThreadedBOption))
      )
      expect(encodeValueTrace(valueTrace(tracedRuns.singleThreadedAOption))).toBe(
        encodeValueTrace(valueTrace(tracedRuns.singleThreadedBOption))
      )

      expect(encodeConfigTrace(configTrace(tracedRuns.parallelAOption))).toBe(
        encodeConfigTrace(configTrace(tracedRuns.parallelBOption))
      )
      expect(encodeValueTrace(valueTrace(tracedRuns.parallelAOption))).toBe(
        encodeValueTrace(valueTrace(tracedRuns.parallelBOption))
      )
      expect(tracedRuns.parallelAOption.bestTrial.state.value).toBe(tracedRuns.parallelBOption.bestTrial.state.value)
    }))

  it.effect("never emits impossible branch assignments", () =>
    Effect.gen(function*() {
      const optimized = yield* optimizeWith(3)
      const single = asSingleObjective(optimized)

      expect(Option.isSome(single)).toBe(true)

      const verifiedRun = Option.getOrThrow(single)

      Arr.forEach(verifiedRun.trials, (trial) => {
        const decoded = decodeConditional(trial.config)

        Match.value(decoded.model).pipe(
          Match.when("linear", () => {
            expect("learningRate" in decoded).toBe(true)
            expect("regularization" in decoded).toBe(true)
            expect("maxDepth" in decoded).toBe(false)
            expect("minSamplesLeaf" in decoded).toBe(false)
          }),
          Match.when("tree", () => {
            expect("maxDepth" in decoded).toBe(true)
            expect("minSamplesLeaf" in decoded).toBe(true)
            expect("learningRate" in decoded).toBe(false)
            expect("regularization" in decoded).toBe(false)
          }),
          Match.exhaustive
        )
      })
    }))

  it.effect("preserves conditional branch traces across snapshot and resume", () =>
    Effect.gen(function*() {
      const options = {
        seed: 404,
        nStartupTrials: 4,
        nEiCandidates: 16
      }
      const totalTrials = 8
      const firstLegTrials = 5
      const secondLegTrials = totalTrials - firstLegTrials
      const baselineResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: totalTrials,
        objective
      })
      const firstLegResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: firstLegTrials,
        objective
      })

      const baselineSingle = asSingleObjective(baselineResult)
      const firstLegSingle = asSingleObjective(firstLegResult)

      expect(Option.isSome(baselineSingle)).toBe(true)
      expect(Option.isSome(firstLegSingle)).toBe(true)

      const partialRuns = Option.getOrThrow(
        Option.all({
          baselineSingle,
          firstLegSingle
        })
      )

      const snapshot = yield* Study.snapshot(partialRuns.firstLegSingle)
      const resumedResult = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        snapshot,
        direction: "minimize",
        trials: secondLegTrials,
        objective
      })
      const resumedSingle = asSingleObjective(resumedResult)

      expect(Option.isSome(resumedSingle)).toBe(true)

      const resumedRun = Option.getOrThrow(resumedSingle)

      expect(encodeConfigTrace(configTrace(resumedRun))).toBe(
        encodeConfigTrace(configTrace(partialRuns.baselineSingle))
      )
      expect(encodeValueTrace(valueTrace(resumedRun))).toBe(
        encodeValueTrace(valueTrace(partialRuns.baselineSingle))
      )
      expect(resumedRun.bestTrial.state.value).toBe(partialRuns.baselineSingle.bestTrial.state.value)
    }))

  it.effect("supports grouped multivariate conditional decomposition deterministically", () =>
    Effect.gen(function*() {
      const options = {
        seed: 515,
        nStartupTrials: 4,
        nEiCandidates: 16,
        multivariate: true,
        groupDimensions: true
      }
      const left = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: 10,
        objective
      })
      const right = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe(options),
        direction: "minimize",
        trials: 10,
        objective
      })
      const leftSingle = asSingleObjective(left)
      const rightSingle = asSingleObjective(right)

      expect(Option.isSome(leftSingle)).toBe(true)
      expect(Option.isSome(rightSingle)).toBe(true)

      const runs = Option.getOrThrow(
        Option.all({
          leftSingle,
          rightSingle
        })
      )

      Arr.forEach(runs.leftSingle.trials, (trial) => {
        const decoded = decodeConditional(trial.config)

        Match.value(decoded.model).pipe(
          Match.when("linear", () => {
            expect("learningRate" in decoded).toBe(true)
            expect("regularization" in decoded).toBe(true)
            expect("maxDepth" in decoded).toBe(false)
            expect("minSamplesLeaf" in decoded).toBe(false)
          }),
          Match.when("tree", () => {
            expect("maxDepth" in decoded).toBe(true)
            expect("minSamplesLeaf" in decoded).toBe(true)
            expect("learningRate" in decoded).toBe(false)
            expect("regularization" in decoded).toBe(false)
          }),
          Match.exhaustive
        )
      })

      expect(encodeConfigTrace(configTrace(runs.leftSingle))).toBe(
        encodeConfigTrace(configTrace(runs.rightSingle))
      )
      expect(encodeValueTrace(valueTrace(runs.leftSingle))).toBe(
        encodeValueTrace(valueTrace(runs.rightSingle))
      )
    }))
})
