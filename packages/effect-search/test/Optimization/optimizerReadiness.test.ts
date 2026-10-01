import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Predicate,
  Ref,
  Schema
} from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Direction } from "../../src/Direction.js"
import { toVector } from "../../src/Objective.js"
import * as Optimization from "../../src/Optimization.js"
import * as Pruning from "../../src/Pruning.js"
import { pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Trial from "../../src/Trial.js"
import {
  decodeLinearTreeConditionalConfig,
  LinearTreeConditionalConfig,
  makeLinearTreeConditionalSpace
} from "../fixtures/scenarios/conditionalLinearTree.js"
import { decodeRandomTrainingConfig, makeRandomTrainingSpace } from "../fixtures/scenarios/randomTraining.js"
import { decodeSlotConfig, makeSlotSpace } from "../fixtures/scenarios/slot.js"

const deterministicSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

const singleSpace = makeSlotSpace(40)

const singleObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* runtime.report(1, config.slot)

    return config.slot
  })

const singlePruningPolicy = new Pruning.Policy({
  name: "bootstrap-pruner",
  decide: ({ latestReport }) =>
    Match.value(Num.lessThan(latestReport.value, 3)).pipe(
      Match.when(true, () =>
        Pruning.prune({
          step: latestReport.step,
          reason: "bootstrap-filter",
          policy: "bootstrap-pruner"
        })),
      Match.orElse(() => Pruning.continueEvaluation())
    )
})

const multiSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(Arr.make("baseline", "rewrite", "socratic")),
  demos: SearchSpace.categorical(Arr.make("none", "few", "curated"))
})

const decodeMultiConfig = (raw: unknown) =>
  Effect.flatMap(multiSpace, (space) => Schema.decodeUnknown(space.schema)(raw))

const demoValue = (demos: string, none: number, few: number, curated: number): number =>
  Match.value(demos).pipe(
    Match.when("none", () => none),
    Match.when("few", () => few),
    Match.orElse(() => curated)
  )

const latency = (instruction: string, demos: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => demoValue(demos, 0.3, 0.6, 1.1)),
    Match.when("rewrite", () => demoValue(demos, 0.5, 0.9, 1.4)),
    Match.orElse(() => demoValue(demos, 0.8, 1.2, 1.8))
  )

const loss = (instruction: string, demos: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => demoValue(demos, 2.2, 1.7, 1.2)),
    Match.when("rewrite", () => demoValue(demos, 1.6, 1, 0.7)),
    Match.orElse(() => demoValue(demos, 1.3, 0.8, 0.4))
  )

const multiObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeMultiConfig(raw)
    const objectiveLatency = latency(config.instruction, config.demos)
    const objectiveLoss = loss(config.instruction, config.demos)

    yield* runtime.report(0, Num.sum(objectiveLatency, objectiveLoss))

    return Arr.make(objectiveLatency, objectiveLoss)
  })

const multiPruningPolicy = new Pruning.Policy({
  name: "gepa-pruner",
  decide: ({ latestReport }) =>
    Match.value(Num.greaterThan(latestReport.value, 2.4)).pipe(
      Match.when(true, () =>
        Pruning.prune({
          step: latestReport.step,
          reason: "latency+loss-budget",
          policy: "gepa-pruner"
        })),
      Match.orElse(() => Pruning.continueEvaluation())
    )
})

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const asMultiObjective = (result: Optimization.Result): Option.Option<Optimization.MultiObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", (multi) => Option.some(multi)),
    Match.orElse(() => Option.none())
  )

const bootstrapSpace = makeRandomTrainingSpace(32)
const decodeBootstrapConfig = decodeRandomTrainingConfig

const bootstrapFiniteGridSpace = SearchSpace.make({
  prompt: SearchSpace.categorical(Arr.make("baseline", "rewrite", "socratic")),
  shots: SearchSpace.int(0, 2, { step: 1 }),
  strict: SearchSpace.boolean()
})
const decodeBootstrapFiniteGridConfig = (raw: unknown) =>
  Effect.flatMap(bootstrapFiniteGridSpace, (space) => Schema.decodeUnknown(space.schema)(raw))

const coupledInstructionChoices = Arr.make("i0", "i1", "i2", "i3", "i4", "i5")
const coupledDemoChoices = Arr.make("d0", "d1", "d2", "d3", "d4", "d5")
const coupledTemperatureChoices = Arr.make("cool", "warm", "hot")
const coupledPreferredDemos = Arr.make("d3", "d5", "d1", "d4", "d0", "d2")

const coupledSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(coupledInstructionChoices),
  demo: SearchSpace.categorical(coupledDemoChoices),
  temperature: SearchSpace.categorical(coupledTemperatureChoices)
})
const decodeCoupledConfig = (raw: unknown) =>
  Effect.flatMap(coupledSpace, (space) => Schema.decodeUnknown(space.schema)(raw))

const indexOfChoice = (choices: Iterable<string>, value: string): number =>
  Arr.findFirstIndex(choices, Equal.equals(value)).pipe(Option.getOrElse(() => 0))

const coupledObjectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeCoupledConfig(raw)
    const instructionIndex = indexOfChoice(coupledInstructionChoices, config.instruction)
    const preferredDemo = Arr.get(coupledPreferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(coupledDemoChoices))
    )
    const couplingPenalty = Match.value(Equal.equals(config.demo, preferredDemo)).pipe(
      Match.when(true, () => 0),
      Match.orElse(() => 4.5)
    )
    const temperaturePenalty = Match.value(config.temperature).pipe(
      Match.when("cool", () => 0),
      Match.when("warm", () => 0.15),
      Match.orElse(() => 0.35)
    )

    return Num.sumAll(Arr.make(couplingPenalty, temperaturePenalty, Num.multiply(instructionIndex, 0.01)))
  })

const isCoupledBestPair = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeCoupledConfig(raw)
    const instructionIndex = indexOfChoice(coupledInstructionChoices, config.instruction)
    const preferredDemo = Arr.get(coupledPreferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(coupledDemoChoices))
    )

    return Equal.equals(config.demo, preferredDemo)
  })

const conditionalSpace = makeLinearTreeConditionalSpace()
const decodeConditionalConfig = decodeLinearTreeConditionalConfig
const encodeConditionalTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(LinearTreeConditionalConfig))
)
const encodeObjectiveVectors = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Array(Schema.Number)))
)

const conditionalLatency = (raw: unknown) =>
  decodeConditionalConfig(raw).pipe(Effect.map((config) =>
    Match.value(config).pipe(
      Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
        Num.sum(
          Numeric.abs(Num.subtract(Numeric.logStrict(learningRate), Numeric.logStrict(0.015))),
          Num.multiply(regularization, 0.2)
        )),
      Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
        Num.sumAll(Arr.make(
          0.6,
          Num.multiply(Numeric.abs(Num.subtract(maxDepth, 6)), 0.2),
          Num.multiply(Numeric.abs(Num.subtract(minSamplesLeaf, 2)), 0.1)
        ))),
      Match.exhaustive
    )
  ))

const conditionalLoss = (raw: unknown) =>
  decodeConditionalConfig(raw).pipe(Effect.map((config) =>
    Match.value(config).pipe(
      Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
        Num.sum(
          Num.multiply(Numeric.abs(Num.subtract(learningRate, 0.02)), 6),
          Numeric.abs(Num.subtract(regularization, 0.2))
        )),
      Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
        Num.sumAll(Arr.make(
          0.4,
          Num.multiply(Numeric.abs(Num.subtract(maxDepth, 7)), 0.25),
          Num.multiply(Numeric.abs(Num.subtract(minSamplesLeaf, 2)), 0.35)
        ))),
      Match.exhaustive
    )
  ))

const gepaObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const latencyValue = yield* conditionalLatency(raw)
    const lossValue = yield* conditionalLoss(raw)

    yield* runtime.report(0, Num.sum(latencyValue, lossValue))

    return Arr.make(latencyValue, lossValue)
  })

const isBranchSafe = (raw: unknown) =>
  decodeConditionalConfig(raw).pipe(Effect.map((config) =>
    Match.value(config).pipe(
      Match.when({ model: "linear" }, (config) =>
        Bool.and(
          Predicate.hasProperty(config, "learningRate"),
          Bool.and(Predicate.hasProperty(config, "regularization"), Bool.not(Predicate.hasProperty(config, "maxDepth")))
        )),
      Match.when({ model: "tree" }, (config) =>
        Bool.and(
          Predicate.hasProperty(config, "maxDepth"),
          Bool.and(
            Predicate.hasProperty(config, "minSamplesLeaf"),
            Bool.not(Predicate.hasProperty(config, "learningRate"))
          )
        )),
      Match.exhaustive
    )
  ))

describe("optimizer readiness pruning regression", () => {
  it.effect("keeps single-objective optimizer paths stable with pruning enabled", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* singleSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 8,
        pruningPolicy: singlePruningPolicy,
        objective: singleObjective
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      const prunedCount = Arr.length(
        Arr.filter(Arr.fromIterable(result.trials), (trial) => Trial.isState("Pruned")(trial.state))
      )

      expect(prunedCount).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
      expect(result.bestTrial.trialNumber).toBeGreaterThanOrEqual(3)
    }))

  it.effect("keeps multi-objective Pareto outputs free of pruned trials", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* multiSpace,
        sampler: Sampler.tpe({ seed: 717, nStartupTrials: 4, nEiCandidates: 20 }),
        directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
        trials: 12,
        pruningPolicy: multiPruningPolicy,
        objective: multiObjective
      })

      const resultOption = asMultiObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      const prunedCount = Arr.length(
        Arr.filter(Arr.fromIterable(result.trials), (trial) => Trial.isState("Pruned")(trial.state))
      )

      expect(prunedCount).toBeGreaterThan(0)
      expect(Arr.length(Arr.fromIterable(result.paretoFront))).toBeGreaterThan(0)
      expect(Arr.every(Arr.fromIterable(result.paretoFront), (trial) => Trial.isState("Completed")(trial.state))).toBe(
        true
      )
    }))

  it.live("BootstrapFewShot readiness keeps deterministic random/grid baselines with bounded concurrency", () =>
    Effect.gen(function*() {
      const resolvedBootstrapSpace = yield* bootstrapSpace
      const resolvedGridSpace = yield* bootstrapFiniteGridSpace
      const activeRef = yield* Ref.make(0)
      const maxActiveRef = yield* Ref.make(0)

      const runRandomBaseline = (seed: number) =>
        Optimization.run({
          space: resolvedBootstrapSpace,
          sampler: Sampler.random({ seed }),
          direction: "minimize",
          concurrency: 3,
          trials: 18,
          objective: (raw) =>
            Effect.acquireUseRelease(
              Ref.updateAndGet(activeRef, (active) => Num.increment(active)).pipe(
                Effect.tap((active) => Ref.update(maxActiveRef, (maxActive) => Num.max(maxActive, active)))
              ),
              () =>
                Effect.gen(function*() {
                  const config = yield* decodeBootstrapConfig(raw)
                  const optimizerPenalty = Match.value(config.optimizer).pipe(
                    Match.when("adamw", () => 0),
                    Match.when("adam", () => 0.2),
                    Match.orElse(() => 0.45)
                  )

                  return yield* Effect.sleep("4 millis").pipe(
                    Effect.as(Num.sumAll(Arr.make(
                      Numeric.abs(Num.subtract(Numeric.logStrict(config.lr), Numeric.logStrict(0.01))),
                      Num.multiply(Numeric.abs(Num.subtract(config.batchSize, 32)), 0.05),
                      Match.value(config.useBatchNorm).pipe(
                        Match.when(true, () => 0),
                        Match.orElse(() => 0.15)
                      ),
                      optimizerPenalty
                    )))
                  )
                }),
              () => Ref.update(activeRef, (active) => Num.decrement(active))
            )
        })

      const left = yield* runRandomBaseline(901)
      const right = yield* runRandomBaseline(901)
      const leftOption = asSingleObjective(left)
      const rightOption = asSingleObjective(right)

      expect(Option.isSome(leftOption)).toBe(true)
      expect(Option.isSome(rightOption)).toBe(true)
      const leftResult = yield* leftOption
      const rightResult = yield* rightOption

      const maxActive = yield* Ref.get(maxActiveRef)

      expect(Arr.map(Arr.fromIterable(leftResult.trials), (trial) => trial.config)).toEqual(
        Arr.map(Arr.fromIterable(rightResult.trials), (trial) => trial.config)
      )
      expect(leftResult.bestTrial.state.value).toBe(rightResult.bestTrial.state.value)
      expect(maxActive).toBeGreaterThanOrEqual(2)
      expect(maxActive).toBeLessThanOrEqual(3)

      const gridResult = yield* Optimization.run({
        space: resolvedGridSpace,
        sampler: Sampler.grid({ shuffle: false, seed: 0 }),
        direction: "minimize",
        trials: 100,
        objective: (raw) =>
          Effect.gen(function*() {
            const config = yield* decodeBootstrapFiniteGridConfig(raw)
            const promptPenalty = Match.value(config.prompt).pipe(
              Match.when("baseline", () => 0),
              Match.when("rewrite", () => 0.2),
              Match.orElse(() => 0.4)
            )
            const shotPenalty = Num.multiply(config.shots, 0.1)
            const strictPenalty = Match.value(config.strict).pipe(
              Match.when(true, () => 0),
              Match.orElse(() => 0.15)
            )

            return Num.sumAll(Arr.make(promptPenalty, shotPenalty, strictPenalty))
          })
      })

      const gridOption = asSingleObjective(gridResult)
      expect(Option.isSome(gridOption)).toBe(true)
      const grid = yield* gridOption

      expect(grid.completionReason).toBe("spaceExhausted")
      expect(grid.trials).toHaveLength(18)
    }))

  it.effect("MIPROv2 readiness keeps categorical-coupled multivariate TPE deterministic and competitive", () =>
    Effect.gen(function*() {
      const space = yield* coupledSpace
      const tpeLeft = yield* Optimization.run({
        space,
        sampler: Sampler.tpe({ seed: 211, nStartupTrials: 8, nEiCandidates: 80 }),
        direction: "minimize",
        trials: 24,
        objective: coupledObjectiveValue
      })
      const tpeRight = yield* Optimization.run({
        space,
        sampler: Sampler.tpe({ seed: 211, nStartupTrials: 8, nEiCandidates: 80 }),
        direction: "minimize",
        trials: 24,
        objective: coupledObjectiveValue
      })
      const randomBaseline = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 211 }),
        direction: "minimize",
        trials: 24,
        objective: coupledObjectiveValue
      })

      const tpeLeftOption = asSingleObjective(tpeLeft)
      const tpeRightOption = asSingleObjective(tpeRight)
      const randomOption = asSingleObjective(randomBaseline)

      expect(Option.isSome(tpeLeftOption)).toBe(true)
      expect(Option.isSome(tpeRightOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)
      const left = yield* tpeLeftOption
      const right = yield* tpeRightOption
      const random = yield* randomOption

      expect(Arr.map(Arr.fromIterable(left.trials), (trial) => trial.config)).toEqual(
        Arr.map(Arr.fromIterable(right.trials), (trial) => trial.config)
      )
      expect(yield* isCoupledBestPair(left.bestTrial.config)).toBe(true)
      expect(left.bestTrial.state.value).toBeLessThanOrEqual(random.bestTrial.state.value)
    }))

  it.effect(
    "GEPA readiness combines MOTPE, conditional dimensions, and snapshot/resume parity",
    () =>
      Effect.gen(function*() {
        const space = yield* conditionalSpace
        const options = {
          seed: 628,
          nStartupTrials: 6,
          nEiCandidates: 42
        }
        const totalTrials = 18
        const firstLegTrials = 10
        const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)

        const baselineResult = yield* Optimization.run({
          space,
          sampler: Sampler.tpe(options),
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: totalTrials,
          objective: gepaObjective
        })
        const firstLegResult = yield* Optimization.run({
          space,
          sampler: Sampler.tpe(options),
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: firstLegTrials,
          objective: gepaObjective
        })

        const baselineOption = asMultiObjective(baselineResult)
        const firstLegOption = asMultiObjective(firstLegResult)

        expect(Option.isSome(baselineOption)).toBe(true)
        expect(Option.isSome(firstLegOption)).toBe(true)
        const baseline = yield* baselineOption
        const firstLeg = yield* firstLegOption

        const snapshot = yield* Optimization.snapshot(firstLeg)
        const resumedResult = yield* Optimization.resume({
          space,
          sampler: Sampler.tpe(options),
          snapshot,
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: secondLegTrials,
          objective: gepaObjective
        })

        const resumedOption = asMultiObjective(resumedResult)
        expect(Option.isSome(resumedOption)).toBe(true)
        const resumed = yield* resumedOption
        const baselineTrace = yield* Effect.forEach(baseline.trials, (trial) => decodeConditionalConfig(trial.config))
        const resumedTrace = yield* Effect.forEach(resumed.trials, (trial) => decodeConditionalConfig(trial.config))
        const baselinePareto = Arr.map(Arr.fromIterable(baseline.paretoFront), (trial) => toVector(trial.state.value))
        const resumedPareto = Arr.map(Arr.fromIterable(resumed.paretoFront), (trial) => toVector(trial.state.value))

        expect(encodeConditionalTrace(resumedTrace)).toBe(encodeConditionalTrace(baselineTrace))
        expect(encodeObjectiveVectors(resumedPareto)).toBe(encodeObjectiveVectors(baselinePareto))
        expect(Arr.length(Arr.fromIterable(resumed.paretoFront))).toBeGreaterThan(0)
        const branchSafety = yield* Effect.forEach(resumed.trials, (trial) => isBranchSafe(trial.config))
        expect(Arr.every(branchSafety, Predicate.isTruthy)).toBe(true)
      }),
    30_000
  )
})
