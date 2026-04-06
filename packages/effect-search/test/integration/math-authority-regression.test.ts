import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import { makeSuggestCompletedTrial, SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import { buildPosterior, GpObservationLike, predictPosterior } from "../../src/samplers/GpBo/gaussianProcess.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const continuousSpace = SearchSpace.unsafeMake({
  learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
  dropout: SearchSpace.float(0, 0.6)
})

const completedContext = (nextTrialNumber: number) =>
  new SuggestContext({
    completed: [
      makeSuggestCompletedTrial(0, { learningRate: 0.01, dropout: 0.2 }, 1.4),
      makeSuggestCompletedTrial(1, { learningRate: 0.02, dropout: 0.1 }, 0.8),
      makeSuggestCompletedTrial(2, { learningRate: 0.005, dropout: 0.3 }, 1.1)
    ],
    pending: [],
    objectiveSpec: Contracts.singleObjectiveSpec("minimize"),
    nextTrialNumber,
    epsilon: 0
  })

const posteriorObservations = Arr.make(
  new GpObservationLike({ vector: [0.2, 0.1], value: 1.2 }),
  new GpObservationLike({ vector: [0.5, 0.4], value: 0.4 }),
  new GpObservationLike({ vector: [0.8, 0.3], value: 0.9 })
)

const posteriorCandidates = Arr.make([0.3, 0.15], [0.55, 0.35], [0.75, 0.25])

describe("math authority regression", () => {
  it.effect("preserves deterministic seeded suggestions across public effect-math-backed sampler lanes", () =>
    Effect.gen(function*() {
      const tpeLeft = yield* Sampler.suggest(
        Sampler.tpe({ seed: 21, nStartupTrials: 1, nEiCandidates: 16 }),
        continuousSpace,
        completedContext(3)
      )
      const tpeRight = yield* Sampler.suggest(
        Sampler.tpe({ seed: 21, nStartupTrials: 1, nEiCandidates: 16 }),
        continuousSpace,
        completedContext(3)
      )
      const gpLeft = yield* Sampler.suggest(
        Sampler.gpBo({ seed: 21, nStartupTrials: 1, nCandidates: 16, acquisition: "ei" }),
        continuousSpace,
        completedContext(3)
      )
      const gpRight = yield* Sampler.suggest(
        Sampler.gpBo({ seed: 21, nStartupTrials: 1, nCandidates: 16, acquisition: "ei" }),
        continuousSpace,
        completedContext(3)
      )

      expect(tpeLeft).toEqual(tpeRight)
      expect(gpLeft).toEqual(gpRight)
    }))

  it.effect("preserves gp-bo posterior ordering and score magnitudes under public math kernels", () =>
    Effect.gen(function*() {
      const posteriorOption = buildPosterior(posteriorObservations, 0.35, 0.01)

      expect(Option.isSome(posteriorOption)).toBe(true)

      if (Option.isNone(posteriorOption)) {
        return
      }

      const predictions = Arr.map(posteriorCandidates, (candidate) => ({
        candidate,
        ...predictPosterior(posteriorOption.value, candidate)
      }))
      const ranking = predictions
        .slice()
        .sort((left, right) => left.mean - right.mean)
        .map(({ candidate }) => candidate)

      expect(predictions[0]?.mean).toBeCloseTo(1.075083099436, 12)
      expect(predictions[0]?.variance).toBeCloseTo(0.061181844418, 12)
      expect(predictions[1]?.mean).toBeCloseTo(0.569532780008, 12)
      expect(predictions[1]?.variance).toBeCloseTo(0.032287956699, 12)
      expect(predictions[2]?.mean).toBeCloseTo(0.909548603521, 12)
      expect(predictions[2]?.variance).toBeCloseTo(0.050916802305, 12)
      expect(ranking).toEqual([[0.55, 0.35], [0.75, 0.25], [0.3, 0.15]])
    }))
})
