import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeCorrelatedSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2),
    y: SearchSpace.float(Num.negate(2), 2)
  })

const correlatedObjective = (config: { readonly x: number; readonly y: number }): Effect.Effect<number> => {
  const difference = Num.subtract(config.x, config.y)
  const offset = Num.subtract(Num.sum(config.x, config.y), 1)
  return Effect.succeed(Num.sum(Num.multiply(difference, difference), Num.multiply(offset, offset)))
}

const oneDimensionalSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2)
  })

const oneDimensionalObjective = (config: { readonly x: number }): Effect.Effect<number> => {
  const distance = Num.subtract(config.x, 0.25)
  return Effect.succeed(Num.multiply(distance, distance))
}

const bestSingleObjectiveValue = <Config>(result: Optimization.Result<Config>): number =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
    Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

describe("integration correlated-space TPE baseline", () => {
  it.effect(
    "keeps a deterministic correlated objective baseline ready for multivariate rollout",
    () =>
      Effect.gen(function*() {
        const space = yield* makeCorrelatedSpace()

        const tpeResult = yield* Optimization.run({
          space,
          sampler: Sampler.tpe({
            seed: 11,
            nStartupTrials: 5,
            nEiCandidates: 32
          }),
          direction: "minimize",
          trials: 24,
          objective: correlatedObjective
        })

        const randomResult = yield* Optimization.run({
          space,
          sampler: Sampler.random({ seed: 11 }),
          direction: "minimize",
          trials: 24,
          objective: correlatedObjective
        })

        const tpeValue = bestSingleObjectiveValue(tpeResult)
        const randomValue = bestSingleObjectiveValue(randomResult)

        expect(tpeValue).toBeLessThanOrEqual(randomValue)
        expect(tpeValue).toBeLessThan(0.1)
      }),
    30_000
  )

  it.effect(
    "keeps multivariate correlated optimization deterministic for identical seeds",
    () =>
      Effect.gen(function*() {
        const space = yield* makeCorrelatedSpace()
        const left = yield* Optimization.run({
          space,
          sampler: Sampler.tpe({
            seed: 33,
            nStartupTrials: 5,
            nEiCandidates: 32,
            multivariate: true
          }),
          direction: "minimize",
          trials: 24,
          objective: correlatedObjective
        })
        const right = yield* Optimization.run({
          space,
          sampler: Sampler.tpe({
            seed: 33,
            nStartupTrials: 5,
            nEiCandidates: 32,
            multivariate: true
          }),
          direction: "minimize",
          trials: 24,
          objective: correlatedObjective
        })
        const random = yield* Optimization.run({
          space,
          sampler: Sampler.random({ seed: 33 }),
          direction: "minimize",
          trials: 24,
          objective: correlatedObjective
        })
        const leftValue = bestSingleObjectiveValue(left)
        const randomValue = bestSingleObjectiveValue(random)

        expect(leftValue).toBe(bestSingleObjectiveValue(right))
        expect(leftValue).toBeLessThanOrEqual(randomValue)
        expect(leftValue).toBeLessThan(0.2)
      }),
    30_000
  )

  it.effect("falls back to univariate behavior for one-dimensional spaces", () =>
    Effect.gen(function*() {
      const space = yield* oneDimensionalSpace()
      const univariate = yield* Optimization.run({
        space,
        sampler: Sampler.tpe({
          seed: 17,
          nStartupTrials: 4,
          nEiCandidates: 24
        }),
        direction: "minimize",
        trials: 20,
        objective: oneDimensionalObjective
      })
      const multivariate = yield* Optimization.run({
        space,
        sampler: Sampler.tpe({
          seed: 17,
          nStartupTrials: 4,
          nEiCandidates: 24,
          multivariate: true
        }),
        direction: "minimize",
        trials: 20,
        objective: oneDimensionalObjective
      })

      expect(bestSingleObjectiveValue(multivariate)).toBe(bestSingleObjectiveValue(univariate))
    }), 15_000)
})
