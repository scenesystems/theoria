import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const AcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

const acquisitionModes = Schema.decodeUnknownSync(Schema.Array(AcquisitionNameSchema))(Arr.make(
  "ei",
  "pi",
  "thompson"
))

const acquisitionOptimizationSpace = SearchSpace.make({
  x: SearchSpace.float(Num.negate(2), 2),
  branch: SearchSpace.categorical(Arr.make("left", "center", "right"))
})

const branchPenalty = (branch: string): number =>
  Match.value(branch).pipe(
    Match.when("center", () => 0),
    Match.when("left", () => 0.2),
    Match.orElse(() => 0.35)
  )

const objectiveForSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) =>
    Effect.sync(() => {
      const config = decode(raw)

      return Num.sum(Numeric.abs(Num.subtract(config.x, 0.32)), branchPenalty(config.branch))
    })
}

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const runWithAcquisition = (
  acquisition: Schema.Schema.Type<typeof AcquisitionNameSchema>,
  seed: number
) =>
  Effect.gen(function*() {
    const space = yield* acquisitionOptimizationSpace

    return yield* Optimization.run({
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
  })

const runRandom = (seed: number) =>
  Effect.gen(function*() {
    const space = yield* acquisitionOptimizationSpace

    return yield* Optimization.run({
      space,
      sampler: Sampler.random({ seed }),
      direction: "minimize",
      trials: 10,
      objective: objectiveForSpace(space)
    })
  })

const configTrace = (result: Optimization.SingleObjectiveResult) =>
  Arr.map(Arr.fromIterable(result.trials), (trial) => trial.config)

describe("integration tpe acquisition strategies", () => {
  it.effect("replays deterministically for EI, PI, and Thompson with fixed seeds", () =>
    Effect.forEach(
      acquisitionModes,
      (acquisition) =>
        Effect.gen(function*() {
          const left = yield* runWithAcquisition(acquisition, 61)
          const right = yield* runWithAcquisition(acquisition, 61)
          const leftOption = asSingleObjective(left)
          const rightOption = asSingleObjective(right)

          expect(Option.isSome(leftOption), acquisition).toBe(true)
          expect(Option.isSome(rightOption), acquisition).toBe(true)
          const leftResult = yield* leftOption
          const rightResult = yield* rightOption

          expect(configTrace(leftResult), acquisition).toEqual(configTrace(rightResult))
          expect(leftResult.bestTrial.state.value, acquisition).toBe(rightResult.bestTrial.state.value)
        }),
      { discard: true }
    ))

  it.effect(
    "stays competitive with random search while preserving finite convergence across built-ins",
    () =>
      Effect.forEach(
        acquisitionModes,
        (acquisition) =>
          Effect.gen(function*() {
            const optimized = yield* runWithAcquisition(acquisition, 109)
            const random = yield* runRandom(109)
            const optimizedOption = asSingleObjective(optimized)
            const randomOption = asSingleObjective(random)

            expect(Option.isSome(optimizedOption), acquisition).toBe(true)
            expect(Option.isSome(randomOption), acquisition).toBe(true)
            const optimizedResult = yield* optimizedOption
            const randomResult = yield* randomOption

            expect(Numeric.isFinite(optimizedResult.bestTrial.state.value), acquisition).toBe(true)
            expect(optimizedResult.bestTrial.state.value, acquisition).toBeLessThanOrEqual(0.85)
            expect(optimizedResult.bestTrial.state.value, acquisition).toBeLessThanOrEqual(
              Num.sum(randomResult.bestTrial.state.value, 0.2)
            )
          }),
        { discard: true }
      )
  )
})
