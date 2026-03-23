import { describe, expect, it } from "@effect/vitest"
import { Effect, Match } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeCorrelatedSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    y: SearchSpace.float(-2, 2)
  })

const correlatedObjective = (config: { readonly x: number; readonly y: number }): Effect.Effect<number> =>
  Effect.succeed(
    (config.x - config.y) * (config.x - config.y) +
      (config.x + config.y - 1) * (config.x + config.y - 1)
  )

const oneDimensionalSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2)
  })

const oneDimensionalObjective = (config: { readonly x: number }): Effect.Effect<number> =>
  Effect.succeed((config.x - 0.25) * (config.x - 0.25))

const bestSingleObjectiveValue = <Config>(result: Study.StudyResult<Config>): number =>
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
        const space = makeCorrelatedSpace()

        const tpeResult = yield* Study.optimize({
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

        const randomResult = yield* Study.optimize({
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
        const space = makeCorrelatedSpace()
        const left = yield* Study.optimize({
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
        const right = yield* Study.optimize({
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
        const random = yield* Study.optimize({
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
      const space = oneDimensionalSpace()
      const univariate = yield* Study.optimize({
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
      const multivariate = yield* Study.optimize({
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
    }),
    15_000
  )
})
