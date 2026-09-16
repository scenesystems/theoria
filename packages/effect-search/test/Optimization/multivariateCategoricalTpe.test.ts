import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const instructionChoices = Arr.make("i0", "i1", "i2", "i3", "i4", "i5")
const demoChoices = Arr.make("d0", "d1", "d2", "d3", "d4", "d5")
const temperatureChoices = Arr.make("cool", "warm", "hot")
const preferredDemos = Arr.make("d3", "d5", "d1", "d4", "d0", "d2")

const CoupledSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(instructionChoices),
  demo: SearchSpace.categorical(demoChoices),
  temperature: SearchSpace.categorical(temperatureChoices)
})

const decodeConfig = (raw: unknown) => Effect.flatMap(CoupledSpace, (space) => Schema.decodeUnknown(space.schema)(raw))

const indexOfChoice = (choices: Iterable<string>, value: string): number =>
  Arr.findFirstIndex(choices, Equal.equals(value)).pipe(Option.getOrElse(() => 0))

const objectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = Arr.get(preferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(demoChoices))
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
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = Arr.get(preferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(demoChoices))
    )

    return Equal.equals(config.demo, preferredDemo)
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const runWith = (sampler: Sampler.Sampler) =>
  Effect.gen(function*() {
    const space = yield* CoupledSpace
    return yield* Optimization.run({
      space,
      sampler,
      direction: "minimize",
      trials: 24,
      objective: objectiveValue
    })
  })

describe("integration multivariate categorical tpe optimization", () => {
  it.effect("models coupled categorical dimensions and beats seeded random search", () =>
    Effect.gen(function*() {
      const seed = 211
      const tpeOptimized = yield* runWith(
        Sampler.tpe({
          seed,
          nStartupTrials: 8,
          nEiCandidates: 80
        })
      )
      const randomOptimized = yield* runWith(Sampler.random({ seed }))
      const tpeOption = asSingleObjective(tpeOptimized)
      const randomOption = asSingleObjective(randomOptimized)

      expect(Option.isSome(tpeOption)).toBe(true)
      expect(Option.isSome(randomOption)).toBe(true)
      const tpe = yield* tpeOption
      const random = yield* randomOption

      expect(yield* isCoupledBestPair(tpe.bestTrial.config)).toBe(true)
      expect(tpe.bestTrial.state.value).toBeLessThanOrEqual(random.bestTrial.state.value)
    }))
})
