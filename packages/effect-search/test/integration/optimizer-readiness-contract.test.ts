import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number as Num, Option, Ref, Schema } from "effect"

import { normalizeObjectiveVector } from "../../src/contracts/index.js"
import {
  decodeLinearTreeConditionalConfig,
  LinearTreeConditionalConfigSchema,
  makeLinearTreeConditionalSpace
} from "../../src/experimental/scenarios/conditionalLinearTree.js"
import { makeRandomTrainingSpace } from "../../src/experimental/scenarios/randomTraining.js"
import { makeSlotSpace } from "../../src/experimental/scenarios/slot.js"
import * as Float64 from "../../src/internal/float64.js"
import { pendingAsZeroImputationPolicy } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const deterministicSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroImputationPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

const singleSpace = () => makeSlotSpace(40)

const decodeSingleConfig = Schema.decodeUnknownSync(singleSpace().schema)

const singleObjective = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSingleConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* runtime.report(1, config.slot)

    return config.slot
  })

const singlePruningPolicy = new Study.PruningPolicy({
  name: "bootstrap-pruner",
  decide: ({ latestReport }) =>
    latestReport.value < 3
      ? Study.PruneTrialDecision({
        step: latestReport.step,
        reason: "bootstrap-filter",
        policy: "bootstrap-pruner"
      })
      : Study.ContinuePruneDecision()
})

const multiSpace = () =>
  SearchSpace.unsafeMake({
    instruction: SearchSpace.categorical(["baseline", "rewrite", "socratic"]),
    demos: SearchSpace.categorical(["none", "few", "curated"])
  })

const decodeMultiConfig = Schema.decodeUnknownSync(multiSpace().schema)

const latency = (instruction: string, demos: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => (demos === "none" ? 0.3 : demos === "few" ? 0.6 : 1.1)),
    Match.when("rewrite", () => (demos === "none" ? 0.5 : demos === "few" ? 0.9 : 1.4)),
    Match.orElse(() => (demos === "none" ? 0.8 : demos === "few" ? 1.2 : 1.8))
  )

const loss = (instruction: string, demos: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => (demos === "none" ? 2.2 : demos === "few" ? 1.7 : 1.2)),
    Match.when("rewrite", () => (demos === "none" ? 1.6 : demos === "few" ? 1 : 0.7)),
    Match.orElse(() => (demos === "none" ? 1.3 : demos === "few" ? 0.8 : 0.4))
  )

const multiObjective = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeMultiConfig(raw)
    const objectiveLatency = latency(config.instruction, config.demos)
    const objectiveLoss = loss(config.instruction, config.demos)

    yield* runtime.report(0, objectiveLatency + objectiveLoss)

    return [objectiveLatency, objectiveLoss]
  })

const multiPruningPolicy = new Study.PruningPolicy({
  name: "gepa-pruner",
  decide: ({ latestReport }) =>
    latestReport.value > 2.4
      ? Study.PruneTrialDecision({
        step: latestReport.step,
        reason: "latency+loss-budget",
        policy: "gepa-pruner"
      })
      : Study.ContinuePruneDecision()
})

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const asMultiObjective = (result: Study.StudyResult) =>
  result._tag === "MultiObjective" ? Option.some(result) : Option.none()

const bootstrapSpace = makeRandomTrainingSpace(32)
const decodeBootstrapConfig = Schema.decodeUnknownSync(bootstrapSpace.schema)

const bootstrapFiniteGridSpace = SearchSpace.unsafeMake({
  prompt: SearchSpace.categorical(["baseline", "rewrite", "socratic"]),
  shots: SearchSpace.int(0, 2, { step: 1 }),
  strict: SearchSpace.boolean()
})
const decodeBootstrapFiniteGridConfig = Schema.decodeUnknownSync(bootstrapFiniteGridSpace.schema)

const coupledInstructionChoices: [string, ...Array<string>] = ["i0", "i1", "i2", "i3", "i4", "i5"]
const coupledDemoChoices: [string, ...Array<string>] = ["d0", "d1", "d2", "d3", "d4", "d5"]
const coupledTemperatureChoices: [string, ...Array<string>] = ["cool", "warm", "hot"]
const coupledPreferredDemos: Array<string> = ["d3", "d5", "d1", "d4", "d0", "d2"]

const coupledSpace = SearchSpace.unsafeMake({
  instruction: SearchSpace.categorical(coupledInstructionChoices),
  demo: SearchSpace.categorical(coupledDemoChoices),
  temperature: SearchSpace.categorical(coupledTemperatureChoices)
})
const decodeCoupledConfig = Schema.decodeUnknownSync(coupledSpace.schema)

const indexOfChoice = (choices: ReadonlyArray<string>, value: string): number => {
  const index = choices.findIndex((choice) => choice === value)

  return index >= 0 ? index : 0
}

const coupledObjectiveValue = (raw: unknown): number => {
  const config = decodeCoupledConfig(raw)
  const instructionIndex = indexOfChoice(coupledInstructionChoices, config.instruction)
  const preferredDemo = Option.fromNullable(coupledPreferredDemos[instructionIndex]).pipe(
    Option.getOrElse(() => coupledDemoChoices[0])
  )
  const couplingPenalty = config.demo === preferredDemo ? 0 : 4.5
  const temperaturePenalty = config.temperature === "cool" ? 0 : config.temperature === "warm" ? 0.15 : 0.35

  return couplingPenalty + temperaturePenalty + instructionIndex * 0.01
}

const isCoupledBestPair = (raw: unknown): boolean => {
  const config = decodeCoupledConfig(raw)
  const instructionIndex = indexOfChoice(coupledInstructionChoices, config.instruction)
  const preferredDemo = Option.fromNullable(coupledPreferredDemos[instructionIndex]).pipe(
    Option.getOrElse(() => coupledDemoChoices[0])
  )

  return config.demo === preferredDemo
}

const conditionalSpace = makeLinearTreeConditionalSpace()
const decodeConditionalConfig = decodeLinearTreeConditionalConfig
const encodeConditionalTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(LinearTreeConditionalConfigSchema))
)
const encodeObjectiveVectors = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Array(Schema.Number)))
)

const conditionalLatency = (raw: unknown): number =>
  Match.value(decodeConditionalConfig(raw)).pipe(
    Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
      Float64.abs(Float64.log(learningRate) - Float64.log(0.015)) + regularization * 0.2),
    Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
      0.6 + Float64.abs(maxDepth - 6) * 0.2 + Float64.abs(minSamplesLeaf - 2) * 0.1),
    Match.exhaustive
  )

const conditionalLoss = (raw: unknown): number =>
  Match.value(decodeConditionalConfig(raw)).pipe(
    Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
      Float64.abs(learningRate - 0.02) * 6 + Float64.abs(regularization - 0.2)),
    Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
      0.4 + Float64.abs(maxDepth - 7) * 0.25 + Float64.abs(minSamplesLeaf - 2) * 0.35),
    Match.exhaustive
  )

const gepaObjective = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const latencyValue = conditionalLatency(raw)
    const lossValue = conditionalLoss(raw)

    yield* runtime.report(0, latencyValue + lossValue)

    return [latencyValue, lossValue]
  })

const isBranchSafe = (raw: unknown): boolean =>
  Match.value(decodeConditionalConfig(raw)).pipe(
    Match.when({ model: "linear" }, (config) =>
      "learningRate" in config && "regularization" in config && !("maxDepth" in config)),
    Match.when({ model: "tree" }, (config) =>
      "maxDepth" in config && "minSamplesLeaf" in config && !("learningRate" in config)),
    Match.exhaustive
  )

describe("optimizer readiness pruning regression", () => {
  it.effect("keeps single-objective optimizer paths stable with pruning enabled", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: singleSpace(),
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 8,
        pruningPolicy: singlePruningPolicy,
        objective: singleObjective
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const prunedCount = result.trials.filter((trial) => Trial.isState("Pruned")(trial.state)).length

      expect(prunedCount).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
      expect(result.bestTrial.trialNumber).toBeGreaterThanOrEqual(3)
    }))

  it.effect("keeps multi-objective Pareto outputs free of pruned trials", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: multiSpace(),
        sampler: Sampler.tpe({ seed: 717, nStartupTrials: 4, nEiCandidates: 20 }),
        directions: ["minimize", "minimize"],
        trials: 12,
        pruningPolicy: multiPruningPolicy,
        objective: multiObjective
      })

      const resultOption = asMultiObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const prunedCount = result.trials.filter((trial) => Trial.isState("Pruned")(trial.state)).length

      expect(prunedCount).toBeGreaterThan(0)
      expect(result.paretoFront.length).toBeGreaterThan(0)
      expect(result.paretoFront.every((trial) => Trial.isState("Completed")(trial.state))).toBe(true)
    }))

  it.live("BootstrapFewShot readiness keeps deterministic random/grid baselines with bounded concurrency", () =>
    Effect.gen(function*() {
      const activeRef = yield* Ref.make(0)
      const maxActiveRef = yield* Ref.make(0)

      const runRandomBaseline = (seed: number) =>
        Study.optimize({
          space: bootstrapSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          concurrency: 3,
          trials: 18,
          objective: (raw) =>
            Effect.acquireUseRelease(
              Ref.updateAndGet(activeRef, (active) => Num.increment(active)).pipe(
                Effect.tap((active) => Ref.update(maxActiveRef, (maxActive) => Num.max(maxActive, active)))
              ),
              () => {
                const config = decodeBootstrapConfig(raw)
                const optimizerPenalty = config.optimizer === "adamw" ? 0 : config.optimizer === "adam" ? 0.2 : 0.45

                return Effect.sleep("4 millis").pipe(
                  Effect.as(
                    Float64.abs(Float64.log(config.lr) - Float64.log(0.01)) +
                      Float64.abs(config.batchSize - 32) * 0.05 +
                      (config.useBatchNorm ? 0 : 0.15) +
                      optimizerPenalty
                  )
                )
              },
              () => Ref.update(activeRef, (active) => Num.decrement(active))
            )
        })

      const left = yield* runRandomBaseline(901)
      const right = yield* runRandomBaseline(901)
      const leftOption = asSingleObjective(left)
      const rightOption = asSingleObjective(right)

      expect(Option.isSome(leftOption)).toBe(true)
      expect(Option.isSome(rightOption)).toBe(true)

      if (Option.isNone(leftOption) || Option.isNone(rightOption)) {
        return
      }

      const maxActive = yield* Ref.get(maxActiveRef)

      expect(leftOption.value.trials.map((trial) => trial.config)).toEqual(
        rightOption.value.trials.map((trial) => trial.config)
      )
      expect(leftOption.value.bestTrial.state.value).toBe(rightOption.value.bestTrial.state.value)
      expect(maxActive).toBeGreaterThanOrEqual(2)
      expect(maxActive).toBeLessThanOrEqual(3)

      const gridResult = yield* Study.optimize({
        space: bootstrapFiniteGridSpace,
        sampler: Sampler.grid({ shuffle: false, seed: 0 }),
        direction: "minimize",
        trials: 100,
        objective: (raw) => {
          const config = decodeBootstrapFiniteGridConfig(raw)
          const promptPenalty = config.prompt === "baseline" ? 0 : config.prompt === "rewrite" ? 0.2 : 0.4
          const shotPenalty = config.shots * 0.1
          const strictPenalty = config.strict ? 0 : 0.15

          return Effect.succeed(promptPenalty + shotPenalty + strictPenalty)
        }
      })

      const gridOption = asSingleObjective(gridResult)
      expect(Option.isSome(gridOption)).toBe(true)

      if (Option.isNone(gridOption)) {
        return
      }

      expect(gridOption.value.completionReason).toBe("spaceExhausted")
      expect(gridOption.value.trials).toHaveLength(18)
    }))

  it.effect("MIPROv2 readiness keeps categorical-coupled multivariate TPE deterministic and competitive", () =>
    Effect.gen(function*() {
      const tpeLeft = yield* Study.optimize({
        space: coupledSpace,
        sampler: Sampler.tpe({ seed: 211, nStartupTrials: 8, nEiCandidates: 80 }),
        direction: "minimize",
        trials: 24,
        objective: (raw) => Effect.succeed(coupledObjectiveValue(raw))
      })
      const tpeRight = yield* Study.optimize({
        space: coupledSpace,
        sampler: Sampler.tpe({ seed: 211, nStartupTrials: 8, nEiCandidates: 80 }),
        direction: "minimize",
        trials: 24,
        objective: (raw) => Effect.succeed(coupledObjectiveValue(raw))
      })
      const randomBaseline = yield* Study.optimize({
        space: coupledSpace,
        sampler: Sampler.random({ seed: 211 }),
        direction: "minimize",
        trials: 24,
        objective: (raw) => Effect.succeed(coupledObjectiveValue(raw))
      })

      const tpeLeftOption = asSingleObjective(tpeLeft)
      const tpeRightOption = asSingleObjective(tpeRight)
      const randomOption = asSingleObjective(randomBaseline)

      expect(Option.isSome(tpeLeftOption)).toBe(true)
      expect(Option.isSome(tpeRightOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)

      if (Option.isNone(tpeLeftOption) || Option.isNone(tpeRightOption) || Option.isNone(randomOption)) {
        return
      }

      expect(tpeLeftOption.value.trials.map((trial) => trial.config)).toEqual(
        tpeRightOption.value.trials.map((trial) => trial.config)
      )
      expect(isCoupledBestPair(tpeLeftOption.value.bestTrial.config)).toBe(true)
      expect(tpeLeftOption.value.bestTrial.state.value).toBeLessThanOrEqual(randomOption.value.bestTrial.state.value)
    }))

  it.effect(
    "GEPA readiness combines MOTPE, conditional dimensions, and snapshot/resume parity",
    () =>
      Effect.gen(function*() {
        const options = {
          seed: 628,
          nStartupTrials: 6,
          nEiCandidates: 42
        }
        const totalTrials = 18
        const firstLegTrials = 10
        const secondLegTrials = totalTrials - firstLegTrials

        const baselineResult = yield* Study.optimize({
          space: conditionalSpace,
          sampler: Sampler.tpe(options),
          directions: ["minimize", "minimize"],
          trials: totalTrials,
          objective: gepaObjective
        })
        const firstLegResult = yield* Study.optimize({
          space: conditionalSpace,
          sampler: Sampler.tpe(options),
          directions: ["minimize", "minimize"],
          trials: firstLegTrials,
          objective: gepaObjective
        })

        const baselineOption = asMultiObjective(baselineResult)
        const firstLegOption = asMultiObjective(firstLegResult)

        expect(Option.isSome(baselineOption)).toBe(true)
        expect(Option.isSome(firstLegOption)).toBe(true)

        if (Option.isNone(baselineOption) || Option.isNone(firstLegOption)) {
          return
        }

        const snapshot = yield* Study.snapshot(firstLegOption.value)
        const resumedResult = yield* Study.resume({
          space: conditionalSpace,
          sampler: Sampler.tpe(options),
          snapshot,
          directions: ["minimize", "minimize"],
          trials: secondLegTrials,
          objective: gepaObjective
        })

        const resumedOption = asMultiObjective(resumedResult)
        expect(Option.isSome(resumedOption)).toBe(true)

        if (Option.isNone(resumedOption)) {
          return
        }

        const baseline = baselineOption.value
        const resumed = resumedOption.value
        const baselineTrace = baseline.trials.map((trial) => decodeConditionalConfig(trial.config))
        const resumedTrace = resumed.trials.map((trial) => decodeConditionalConfig(trial.config))
        const baselinePareto = baseline.paretoFront.map((trial) => normalizeObjectiveVector(trial.state.value))
        const resumedPareto = resumed.paretoFront.map((trial) => normalizeObjectiveVector(trial.state.value))

        expect(encodeConditionalTrace(resumedTrace)).toBe(encodeConditionalTrace(baselineTrace))
        expect(encodeObjectiveVectors(resumedPareto)).toBe(encodeObjectiveVectors(baselinePareto))
        expect(resumed.paretoFront.length).toBeGreaterThan(0)
        expect(resumed.trials.every((trial) => isBranchSafe(trial.config))).toBe(true)
      }),
    10_000
  )
})
