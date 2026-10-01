import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import type { Direction } from "../../src/Direction.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import { SamplerObjectiveUnsupported } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const objectiveSpace = SearchSpace.make({
  x: SearchSpace.float(Num.negate(5), 5),
  y: SearchSpace.float(Num.negate(5), 5)
})

const objective = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) =>
    Effect.sync(() => {
      const config = decode(raw)
      const xDistance = Num.subtract(config.x, 1.2)
      const yDistance = Num.sum(config.y, 0.7)
      return Num.sum(Num.multiply(xDistance, xDistance), Num.multiply(yDistance, yDistance))
    })
}

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("integration advanced samplers", () => {
  it.effect("runs end-to-end optimization with CMA-ES and GP-BO samplers", () =>
    Effect.gen(function*() {
      const space = yield* objectiveSpace
      const objectiveEffect = objective(space)
      const cmaResult = yield* Optimization.minimize({
        space,
        sampler: Sampler.cmaEs({ seed: 71, sigma: 0.6, populationSize: 10 }),
        objective: objectiveEffect,
        trials: 18
      })
      const gpResult = yield* Optimization.minimize({
        space,
        sampler: Sampler.gpBo({ seed: 71, nStartupTrials: 4, nCandidates: 32, acquisition: "ei" }),
        objective: objectiveEffect,
        trials: 18
      })

      const cmaSingle = asSingleObjective(cmaResult)
      const gpSingle = asSingleObjective(gpResult)
      expect(Option.isSome(cmaSingle)).toBe(true)
      expect(Option.isSome(gpSingle)).toBe(true)
      const cma = yield* cmaSingle
      const gp = yield* gpSingle

      expect(Numeric.isFinite(cma.bestTrial.state.value)).toBe(true)
      expect(Numeric.isFinite(gp.bestTrial.state.value)).toBe(true)
      expect(Arr.length(Arr.fromIterable(cma.trials))).toBe(18)
      expect(Arr.length(Arr.fromIterable(gp.trials))).toBe(18)
    }))

  it.effect("preserves sampler checkpoint continuity across snapshot and resume", () =>
    Effect.gen(function*() {
      const space = yield* objectiveSpace
      const objectiveEffect = objective(space)
      const firstLeg = yield* Optimization.minimize({
        space,
        sampler: Sampler.gpBo({ seed: 24, nStartupTrials: 3, nCandidates: 20, acquisition: "thompson" }),
        objective: objectiveEffect,
        trials: 8
      })
      const firstSingle = asSingleObjective(firstLeg)
      expect(Option.isSome(firstSingle)).toBe(true)
      const first = yield* firstSingle

      const snapshot = yield* Optimization.snapshot(first)
      const resumed = yield* Optimization.resume({
        space,
        sampler: Sampler.gpBo({ seed: 24, nStartupTrials: 3, nCandidates: 20, acquisition: "thompson" }),
        snapshot,
        direction: "minimize",
        trials: 6,
        objective: objectiveEffect
      })
      const resumedSingle = asSingleObjective(resumed)
      expect(Option.isSome(resumedSingle)).toBe(true)
      const completed = yield* resumedSingle

      expect(Arr.length(Arr.fromIterable(completed.trials))).toBe(14)
      expect(Arr.map(Arr.fromIterable(completed.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13
      ))
    }))

  it.effect("fails Optimization.run with typed sampler errors for unsupported multi-objective runs", () =>
    Effect.gen(function*() {
      const space = yield* objectiveSpace
      const outcome = yield* Effect.either(
        Optimization.run({
          space,
          sampler: Sampler.cmaEs({ seed: 19, sigma: 0.5, populationSize: 8 }),
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: 4,
          objective: (raw) =>
            Schema.decodeUnknown(space.schema)(raw).pipe(
              Effect.map((config) => Arr.make(Num.multiply(config.x, config.x), Num.multiply(config.y, config.y)))
            )
        })
      )

      expect(Either.getOrThrow(Either.flip(outcome))).toBeInstanceOf(SamplerObjectiveUnsupported)
    }))
})
