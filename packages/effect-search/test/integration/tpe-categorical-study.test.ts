import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option } from "effect"

import {
  decodePromptCategoricalConfig,
  PromptCategoricalSpace
} from "../../src/experimental/scenarios/promptCategorical.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"

const instructionPenalty = (instruction: string): number =>
  instruction === "rewrite" ? 0 : instruction === "counterexample" ? 0.35 : instruction === "socratic" ? 0.6 : 0.9

const demosPenalty = (demos: string): number => demos === "curated" ? 0 : demos === "few" ? 0.25 : 0.55

const scoringPenalty = (scoring: string): number => scoring === "balanced" ? 0 : scoring === "recall" ? 0.2 : 0.45

const interactionPenalty = (instruction: string, demos: string, scoring: string): number =>
  instruction === "rewrite" && demos === "curated" && scoring === "balanced" ? -0.25 : 0

const objectiveValue = (raw: unknown): number => {
  const config = decodePromptCategoricalConfig(raw)

  return (
    instructionPenalty(config.instruction) +
    demosPenalty(config.demos) +
    scoringPenalty(config.scoring) +
    interactionPenalty(config.instruction, config.demos, config.scoring)
  )
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const optimizeWith = (sampler: Sampler.Sampler) => {
  const space = PromptCategoricalSpace.make()

  return Study.optimize({
    space,
    sampler,
    direction: "minimize",
    trials: 18,
    objective: (raw) => Effect.succeed(objectiveValue(raw))
  })
}

describe("integration categorical tpe study", () => {
  it.effect("uses random startup trials before switching to TPE suggestions", () =>
    Effect.gen(function*() {
      const startupTrials = 8
      const seed = 73

      const tpeOptimized = yield* optimizeWith(
        Sampler.tpe({
          seed,
          nStartupTrials: startupTrials,
          nEiCandidates: 48
        })
      )

      const randomOptimized = yield* optimizeWith(Sampler.random({ seed }))
      const tpeOption = asSingleObjective(tpeOptimized)
      const randomOption = asSingleObjective(randomOptimized)

      expect(Option.isSome(tpeOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)

      if (Option.isNone(tpeOption) || Option.isNone(randomOption)) {
        return
      }

      const startupTpeConfigs = tpeOption.value.trials.slice(0, startupTrials).map((trial) => trial.config)
      const startupRandomConfigs = randomOption.value.trials.slice(0, startupTrials).map((trial) => trial.config)

      expect(startupTpeConfigs).toEqual(startupRandomConfigs)
    }))

  it.effect("is deterministic with a fixed seed", () =>
    Effect.gen(function*() {
      const sampler = Sampler.tpe({
        seed: 91,
        nStartupTrials: 7,
        nEiCandidates: 40
      })

      const left = yield* optimizeWith(sampler)
      const right = yield* optimizeWith(
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

      if (Option.isNone(leftOption) || Option.isNone(rightOption)) {
        return
      }

      expect(leftOption.value.trials.map((trial) => trial.config)).toEqual(
        rightOption.value.trials.map((trial) => trial.config)
      )
      expect(leftOption.value.bestTrial.state.value).toBe(rightOption.value.bestTrial.state.value)
    }))

  it.effect("outperforms seeded random search on the same categorical objective", () =>
    Effect.gen(function*() {
      const seed = 2
      const tpeOptimized = yield* optimizeWith(
        Sampler.tpe({
          seed,
          nStartupTrials: 6,
          nEiCandidates: 64
        })
      )
      const randomOptimized = yield* optimizeWith(Sampler.random({ seed }))
      const tpeOption = asSingleObjective(tpeOptimized)
      const randomOption = asSingleObjective(randomOptimized)

      expect(Option.isSome(tpeOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)

      if (Option.isNone(tpeOption) || Option.isNone(randomOption)) {
        return
      }

      expect(tpeOption.value.bestTrial.state.value).toBeLessThanOrEqual(randomOption.value.bestTrial.state.value)

      const randomValues = randomOption.value.trials.map((trial) => objectiveValue(trial.config))
      const randomBaseline = Option.fromNullable(randomValues[0]).pipe(
        Option.getOrElse(() => Number.POSITIVE_INFINITY)
      )
      const randomFloor = randomValues.reduce(
        (best, value) => Num.min(best, value),
        randomBaseline
      )

      expect(tpeOption.value.bestTrial.state.value).toBeLessThanOrEqual(randomFloor)
    }))
})
