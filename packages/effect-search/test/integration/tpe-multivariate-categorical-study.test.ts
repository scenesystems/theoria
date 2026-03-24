import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const instructionChoices: [string, ...Array<string>] = ["i0", "i1", "i2", "i3", "i4", "i5"]
const demoChoices: [string, ...Array<string>] = ["d0", "d1", "d2", "d3", "d4", "d5"]
const temperatureChoices: [string, ...Array<string>] = ["cool", "warm", "hot"]
const preferredDemos: Array<string> = ["d3", "d5", "d1", "d4", "d0", "d2"]

const CoupledSpace = SearchSpace.unsafeMake({
  instruction: SearchSpace.categorical(instructionChoices),
  demo: SearchSpace.categorical(demoChoices),
  temperature: SearchSpace.categorical(temperatureChoices)
})

const decodeConfig = Schema.decodeUnknownSync(CoupledSpace.schema)

const makeSpace = () => CoupledSpace

const indexOfChoice = (choices: ReadonlyArray<string>, value: string): number => {
  const index = choices.findIndex((choice) => choice === value)

  return index >= 0 ? index : 0
}

const objectiveValue = (raw: unknown): number => {
  const config = decodeConfig(raw)
  const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
  const preferredDemo = Option.fromNullable(preferredDemos[instructionIndex]).pipe(
    Option.getOrElse(() => demoChoices[0])
  )
  const couplingPenalty = config.demo === preferredDemo ? 0 : 4.5
  const temperaturePenalty = config.temperature === "cool" ? 0 : config.temperature === "warm" ? 0.15 : 0.35

  return couplingPenalty + temperaturePenalty + instructionIndex * 0.01
}

const isCoupledBestPair = (raw: unknown): boolean => {
  const config = decodeConfig(raw)
  const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
  const preferredDemo = Option.fromNullable(preferredDemos[instructionIndex]).pipe(
    Option.getOrElse(() => demoChoices[0])
  )

  return config.demo === preferredDemo
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const optimizeWith = (sampler: Sampler.Sampler) =>
  Study.optimize({
    space: makeSpace(),
    sampler,
    direction: "minimize",
    trials: 24,
    objective: (raw) => Effect.succeed(objectiveValue(raw))
  })

describe("integration multivariate categorical tpe study", () => {
  it.effect("models coupled categorical dimensions and beats seeded random search", () =>
    Effect.gen(function*() {
      const seed = 211
      const tpeOptimized = yield* optimizeWith(
        Sampler.tpe({
          seed,
          nStartupTrials: 8,
          nEiCandidates: 80
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

      expect(isCoupledBestPair(tpeOption.value.bestTrial.config)).toBe(true)
      expect(tpeOption.value.bestTrial.state.value).toBeLessThanOrEqual(randomOption.value.bestTrial.state.value)
    }))
})
