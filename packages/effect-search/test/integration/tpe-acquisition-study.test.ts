import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Float64 from "../../src/internal/float64.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const AcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

const acquisitionModes = Schema.decodeUnknownSync(Schema.Array(AcquisitionNameSchema))([
  "ei",
  "pi",
  "thompson"
])

const makeAcquisitionStudySpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    branch: SearchSpace.categorical(["left", "center", "right"])
  })

const branchPenalty = (branch: string): number => branch === "center" ? 0 : branch === "left" ? 0.2 : 0.35

const objectiveForSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) =>
    Effect.sync(() => {
      const config = decode(raw)

      return Float64.abs(config.x - 0.32) + branchPenalty(config.branch)
    })
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const optimizeWithAcquisition = (
  acquisition: Schema.Schema.Type<typeof AcquisitionNameSchema>,
  seed: number
) => {
  const space = makeAcquisitionStudySpace()

  return Study.optimize({
    space,
    sampler: Sampler.tpe({
      seed,
      nStartupTrials: 4,
      nEiCandidates: 16,
      acquisition
    }),
    direction: "minimize",
    trials: 10,
    objective: objectiveForSpace(space)
  })
}

const optimizeRandom = (seed: number) => {
  const space = makeAcquisitionStudySpace()

  return Study.optimize({
    space,
    sampler: Sampler.random({ seed }),
    direction: "minimize",
    trials: 10,
    objective: objectiveForSpace(space)
  })
}

const configTrace = (result: Study.SingleObjectiveResult) => result.trials.map((trial) => trial.config)

describe("integration tpe acquisition strategies", () => {
  it.effect("replays deterministically for EI, PI, and Thompson with fixed seeds", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(
        acquisitionModes,
        (acquisition) =>
          Effect.gen(function*() {
            const left = yield* optimizeWithAcquisition(acquisition, 61)
            const right = yield* optimizeWithAcquisition(acquisition, 61)
            const leftOption = asSingleObjective(left)
            const rightOption = asSingleObjective(right)

            expect(Option.isSome(leftOption), acquisition).toBe(true)
            expect(Option.isSome(rightOption), acquisition).toBe(true)

            if (Option.isNone(leftOption) || Option.isNone(rightOption)) {
              return
            }

            expect(configTrace(leftOption.value), acquisition).toEqual(configTrace(rightOption.value))
            expect(leftOption.value.bestTrial.state.value, acquisition).toBe(rightOption.value.bestTrial.state.value)
          }),
        { discard: true }
      )
    }))

  it.effect(
    "stays competitive with random search while preserving finite convergence across built-ins",
    () =>
      Effect.gen(function*() {
        yield* Effect.forEach(
          acquisitionModes,
          (acquisition) =>
            Effect.gen(function*() {
              const optimized = yield* optimizeWithAcquisition(acquisition, 109)
              const random = yield* optimizeRandom(109)
              const optimizedOption = asSingleObjective(optimized)
              const randomOption = asSingleObjective(random)

              expect(Option.isSome(optimizedOption), acquisition).toBe(true)
              expect(Option.isSome(randomOption), acquisition).toBe(true)

              if (Option.isNone(optimizedOption) || Option.isNone(randomOption)) {
                return
              }

              expect(Number.isFinite(optimizedOption.value.bestTrial.state.value), acquisition).toBe(true)
              expect(optimizedOption.value.bestTrial.state.value, acquisition).toBeLessThanOrEqual(0.85)
              expect(optimizedOption.value.bestTrial.state.value, acquisition).toBeLessThanOrEqual(
                randomOption.value.bestTrial.state.value + 0.2
              )
            }),
          { discard: true }
        )
      })
  )
})
