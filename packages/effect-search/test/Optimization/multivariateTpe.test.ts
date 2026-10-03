import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeCorrelatedSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.multiply(-1, 2), 2),
    y: SearchSpace.float(Num.multiply(-1, 2), 2)
  })

const correlatedObjective = (config: { readonly x: number; readonly y: number }): Effect.Effect<number> => {
  const difference = Num.subtract(config.x, config.y)
  const offset = Num.subtract(Num.sum(config.x, config.y), 1)
  return Effect.succeed(Num.sum(Num.multiply(difference, difference), Num.multiply(offset, offset)))
}

const oneDimensionalSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.multiply(-1, 2), 2)
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
    "improves on random search across a fixed seed cohort with equal trial budgets",
    () =>
      Effect.gen(function*() {
        const space = yield* makeCorrelatedSpace()

        // Fix the cohort before sampling; do not select seeds for favorable trajectories.
        const scores = yield* Effect.forEach(Arr.range(0, 19), (seed) =>
          Effect.gen(function*() {
            const tpeResult = yield* Optimization.run(
              new Optimization.FlatOptions({
                space,
                sampler: Sampler.tpe(
                  new Sampler.TpeOptions({ seed, nStartupTrials: 5, nEiCandidates: 32 })
                ),
                direction: "minimize",
                trials: 24,
                objective: correlatedObjective
              })
            )
            const randomResult = yield* Optimization.run(
              new Optimization.FlatOptions({
                space,
                sampler: Sampler.random({ seed }),
                direction: "minimize",
                trials: 24,
                objective: correlatedObjective
              })
            )
            const tpe = bestSingleObjectiveValue(tpeResult)
            const random = bestSingleObjectiveValue(randomResult)
            // The sum of squares has its exact global minimum at (0.5, 0.5).
            expect(tpe).toBeGreaterThanOrEqual(0)
            expect(random).toBeGreaterThanOrEqual(0)
            return { tpe, random }
          }))

        expect(scores).toHaveLength(20)
        expect(Num.sumAll(Arr.map(scores, ({ tpe }) => tpe)))
          .toBeLessThan(Num.sumAll(Arr.map(scores, ({ random }) => random)))
        expect(Arr.length(Arr.filter(scores, ({ tpe, random }) => Num.isLessThan(tpe, random))))
          .toBeGreaterThan(Num.divideUnsafe(Arr.length(scores), 2))
      }),
    30_000
  )

  it.effect(
    "keeps multivariate correlated optimization deterministic for identical seeds",
    () =>
      Effect.gen(function*() {
        const space = yield* makeCorrelatedSpace()
        const left = yield* Optimization.run(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.tpe(
              new Sampler.TpeOptions({
                seed: 33,
                nStartupTrials: 5,
                nEiCandidates: 32,
                multivariate: true
              })
            ),
            direction: "minimize",
            trials: 24,
            objective: correlatedObjective
          })
        )
        const right = yield* Optimization.run(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.tpe(
              new Sampler.TpeOptions({
                seed: 33,
                nStartupTrials: 5,
                nEiCandidates: 32,
                multivariate: true
              })
            ),
            direction: "minimize",
            trials: 24,
            objective: correlatedObjective
          })
        )
        const random = yield* Optimization.run(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.random({ seed: 33 }),
            direction: "minimize",
            trials: 24,
            objective: correlatedObjective
          })
        )
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
      const univariate = yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler: Sampler.tpe(
            new Sampler.TpeOptions({
              seed: 17,
              nStartupTrials: 4,
              nEiCandidates: 24
            })
          ),
          direction: "minimize",
          trials: 20,
          objective: oneDimensionalObjective
        })
      )
      const multivariate = yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler: Sampler.tpe(
            new Sampler.TpeOptions({
              seed: 17,
              nStartupTrials: 4,
              nEiCandidates: 24,
              multivariate: true
            })
          ),
          direction: "minimize",
          trials: 20,
          objective: oneDimensionalObjective
        })
      )

      expect(bestSingleObjectiveValue(multivariate)).toBe(bestSingleObjectiveValue(univariate))
    }), 15_000)
})
