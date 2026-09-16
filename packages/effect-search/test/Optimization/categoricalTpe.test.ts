import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import { decodePromptCategoricalConfig, makePromptCategoricalSpace } from "../fixtures/scenarios/promptCategorical.js"

const instructionPenalty = (instruction: string): number =>
  Match.value(instruction).pipe(
    Match.when("rewrite", () => 0),
    Match.when("counterexample", () => 0.35),
    Match.when("socratic", () => 0.6),
    Match.orElse(() => 0.9)
  )

const demosPenalty = (demos: string): number =>
  Match.value(demos).pipe(
    Match.when("curated", () => 0),
    Match.when("few", () => 0.25),
    Match.orElse(() => 0.55)
  )

const scoringPenalty = (scoring: string): number =>
  Match.value(scoring).pipe(
    Match.when("balanced", () => 0),
    Match.when("recall", () => 0.2),
    Match.orElse(() => 0.45)
  )

const interactionPenalty = (instruction: string, demos: string, scoring: string): number =>
  Match.value(Bool.and(
    Equal.equals(instruction, "rewrite"),
    Bool.and(Equal.equals(demos, "curated"), Equal.equals(scoring, "balanced"))
  )).pipe(
    Match.when(true, () => Num.negate(0.25)),
    Match.orElse(() => 0)
  )

const objectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodePromptCategoricalConfig(raw)

    return Num.sumAll(Arr.make(
      instructionPenalty(config.instruction),
      demosPenalty(config.demos),
      scoringPenalty(config.scoring),
      interactionPenalty(config.instruction, config.demos, config.scoring)
    ))
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const runWith = (sampler: Sampler.Sampler) =>
  Effect.gen(function*() {
    const space = yield* makePromptCategoricalSpace()

    return yield* Optimization.run({
      space,
      sampler,
      direction: "minimize",
      trials: 18,
      objective: objectiveValue
    })
  })

describe("integration categorical tpe optimization", () => {
  it.effect("uses random startup trials before switching to TPE suggestions", () =>
    Effect.gen(function*() {
      const startupTrials = 8
      const seed = 73

      const tpeOptimized = yield* runWith(
        Sampler.tpe({
          seed,
          nStartupTrials: startupTrials,
          nEiCandidates: 48
        })
      )

      const randomOptimized = yield* runWith(Sampler.random({ seed }))
      const tpeOption = asSingleObjective(tpeOptimized)
      const randomOption = asSingleObjective(randomOptimized)

      expect(Option.isSome(tpeOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)
      const tpe = yield* tpeOption
      const random = yield* randomOption

      const startupTpeConfigs = Arr.map(
        Arr.take(Arr.fromIterable(tpe.trials), startupTrials),
        (trial) => trial.config
      )
      const startupRandomConfigs = Arr.map(
        Arr.take(Arr.fromIterable(random.trials), startupTrials),
        (trial) => trial.config
      )

      expect(startupTpeConfigs).toEqual(startupRandomConfigs)
    }))

  it.effect("is deterministic with a fixed seed", () =>
    Effect.gen(function*() {
      const sampler = Sampler.tpe({
        seed: 91,
        nStartupTrials: 7,
        nEiCandidates: 40
      })

      const left = yield* runWith(sampler)
      const right = yield* runWith(
        Sampler.tpe({
          seed: 91,
          nStartupTrials: 7,
          nEiCandidates: 40
        })
      )
      const leftOption = asSingleObjective(left)
      const rightOption = asSingleObjective(right)

      expect(Option.isSome(leftOption)).toBe(true)
      expect(Option.isSome(rightOption)).toBe(true)
      const leftResult = yield* leftOption
      const rightResult = yield* rightOption

      expect(Arr.map(Arr.fromIterable(leftResult.trials), (trial) => trial.config)).toEqual(
        Arr.map(Arr.fromIterable(rightResult.trials), (trial) => trial.config)
      )
      expect(leftResult.bestTrial.state.value).toBe(rightResult.bestTrial.state.value)
    }))

  it.effect("outperforms seeded random search on the same categorical objective", () =>
    Effect.gen(function*() {
      const seed = 2
      const tpeOptimized = yield* runWith(
        Sampler.tpe({
          seed,
          nStartupTrials: 6,
          nEiCandidates: 64
        })
      )
      const randomOptimized = yield* runWith(Sampler.random({ seed }))
      const tpeOption = asSingleObjective(tpeOptimized)
      const randomOption = asSingleObjective(randomOptimized)

      expect(Option.isSome(tpeOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)
      const tpe = yield* tpeOption
      const random = yield* randomOption

      expect(tpe.bestTrial.state.value).toBeLessThanOrEqual(random.bestTrial.state.value)

      const randomValues = yield* Effect.forEach(random.trials, (trial) => objectiveValue(trial.config))
      const randomBaseline = Arr.head(randomValues).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const randomFloor = Arr.reduce(randomValues, randomBaseline, Num.min)

      expect(tpe.bestTrial.state.value).toBeLessThanOrEqual(randomFloor)
    }))
})
