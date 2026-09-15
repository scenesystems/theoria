import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import { singleObjectiveSpec } from "../../src/contracts/index.js"
import { InvalidSamplerConfig } from "../../src/Errors/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const instructionChoices = Arr.make("i0", "i1", "i2", "i3", "i4", "i5")
const demoChoices = Arr.make("d0", "d1", "d2", "d3", "d4", "d5")
const Temperature = Schema.Literal("cool", "warm", "hot")
const preferredDemos = Arr.make("d3", "d5", "d1", "d4", "d0", "d2")

const CoupledSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(instructionChoices),
  demo: SearchSpace.categorical(demoChoices),
  temperature: SearchSpace.categorical(Temperature.literals)
})

const decodeConfig = (raw: unknown) => Effect.flatMap(CoupledSpace, (space) => Schema.decodeUnknown(space.schema)(raw))

const indexOfChoice = (choices: Schema.Array$<typeof Schema.String>["Type"], value: string): number =>
  Arr.findFirstIndex(choices, Equal.equals(value)).pipe(Option.getOrElse(() => 0))

const objectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = yield* Arr.get(preferredDemos, instructionIndex)
    const couplingPenalty = Boolean.match(Equal.equals(config.demo, preferredDemo), {
      onTrue: () => 0,
      onFalse: () => 4.5
    })
    const temperaturePenalty = Match.value(config.temperature).pipe(
      Match.when("cool", () => 0),
      Match.when("warm", () => 0.15),
      Match.when("hot", () => 0.35),
      Match.exhaustive
    )

    return Num.sum(Num.sum(couplingPenalty, temperaturePenalty), Num.multiply(instructionIndex, 0.01))
  })

const isCoupledBestPair = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = yield* Arr.get(preferredDemos, instructionIndex)

    return Equal.equals(config.demo, preferredDemo)
  })

const asSingleObjective = (result: Study.StudyResult) =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.tag("MultiObjective", () => Option.none()),
    Match.exhaustive
  )

const optimizeWith = (sampler: Sampler.Sampler) =>
  Effect.gen(function*() {
    const space = yield* CoupledSpace
    return yield* Study.optimize({
      space,
      sampler,
      direction: "minimize",
      trials: 24,
      objective: objectiveValue
    })
  })

describe("integration multivariate categorical tpe study", () => {
  it.effect("rejects a categorical product beyond the supported domain before sampling", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        left: SearchSpace.categorical(Arr.range(0, 256)),
        right: SearchSpace.categorical(Arr.range(0, 255))
      })
      const error = yield* Sampler.suggest(
        Sampler.tpe({ seed: 19, nStartupTrials: 0, nEiCandidates: 1 }),
        space,
        new Sampler.SuggestContext({
          completed: Arr.empty(),
          pending: Arr.empty(),
          objectiveSpec: singleObjectiveSpec(),
          nextTrialNumber: 0,
          epsilon: 0
        })
      ).pipe(Effect.flip, Effect.flatMap(Schema.decodeUnknown(InvalidSamplerConfig)))

      expect(error.reason).toBe("tpe joint categorical sampling supports at most 65536 tuples")
    }))

  it.effect("samples at the joint categorical domain limit", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        left: SearchSpace.categorical(Arr.range(0, 255)),
        right: SearchSpace.categorical(Arr.range(0, 255))
      })
      const result = yield* Sampler.suggest(
        Sampler.tpe({ seed: 19, nStartupTrials: 0, nEiCandidates: 1 }),
        space,
        new Sampler.SuggestContext({
          completed: Arr.empty(),
          pending: Arr.empty(),
          objectiveSpec: singleObjectiveSpec(),
          nextTrialNumber: 0,
          epsilon: 0
        })
      ).pipe(Effect.flatMap(Schema.decodeUnknown(space.schema)))

      expect(result.left).toBeGreaterThanOrEqual(0)
      expect(result.left).toBeLessThan(256)
      expect(result.right).toBeGreaterThanOrEqual(0)
      expect(result.right).toBeLessThan(256)
    }))

  it.effect("reports unencodable categorical choices as a checked sampler failure", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({ choice: SearchSpace.categorical(Arr.make("valid", "\ud800")) })
      const sampler = Sampler.tpe({ seed: 19, nStartupTrials: 0 })
      const error = yield* Sampler.suggest(
        sampler,
        space,
        new Sampler.SuggestContext({
          completed: Arr.empty(),
          pending: Arr.empty(),
          objectiveSpec: singleObjectiveSpec(),
          nextTrialNumber: 0,
          epsilon: 0
        })
      ).pipe(Effect.flip, Effect.flatMap(Schema.decodeUnknown(InvalidSamplerConfig)))
      expect(error.sampler).toBe("tpe")
      expect(error.reason).toBe("tpe categorical search space contains an unencodable choice")
    }))

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
      const tpe = yield* asSingleObjective(tpeOptimized)
      const random = yield* asSingleObjective(randomOptimized)

      const postStartupTrace = Arr.drop(
        Arr.map(tpe.trials, (trial) => trial.config),
        8
      )

      expect(Arr.take(postStartupTrace, 4)).toEqual(Arr.make(
        { instruction: "i4", demo: "d0", temperature: "warm" },
        { instruction: "i2", demo: "d2", temperature: "cool" },
        { instruction: "i4", demo: "d0", temperature: "warm" },
        { instruction: "i4", demo: "d0", temperature: "warm" }
      ))
      expect(yield* isCoupledBestPair(tpe.bestTrial.config)).toBe(true)
      expect(tpe.bestTrial.state.value).toBeLessThanOrEqual(random.bestTrial.state.value)
    }))
})
