import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Option, Schema } from "effect"

import { singleObjectiveSpec } from "../../../src/contracts/index.js"
import {
  LinearTreeConditionalConfigSchema,
  LinearTreeConditionalSpace
} from "../../../src/experimental/scenarios/conditionalLinearTree.js"
import { CompletedTrialForSplit } from "../../../src/internal/tpe/splitTrials.js"
import { SuggestCompletedTrial, SuggestContext } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { numericValuesForParameter, primitiveValuesForParameter } from "../../../src/samplers/Tpe/dimensions/values.js"
import type * as SearchSpace from "../../../src/SearchSpace/index.js"

const makeConditionalSpace = () => LinearTreeConditionalSpace.make()

const splitHistory = () => [
  new CompletedTrialForSplit({
    trialNumber: 0,
    config: { model: "linear", learningRate: 0.03, regularization: 0.4 },
    value: 0.5
  }),
  new CompletedTrialForSplit({
    trialNumber: 1,
    config: { model: "linear", learningRate: 0.01, regularization: 0.2 },
    value: 0.2
  }),
  new CompletedTrialForSplit({
    trialNumber: 2,
    config: { model: "tree", maxDepth: 9, minSamplesLeaf: 2 },
    value: 2.8
  }),
  new CompletedTrialForSplit({
    trialNumber: 3,
    config: { model: "tree", maxDepth: 4, minSamplesLeaf: 1 },
    value: 2.1
  })
]

const completedHistory = () => [
  new SuggestCompletedTrial({
    trialNumber: 0,
    config: { model: "linear", learningRate: 0.03, regularization: 0.4 },
    value: 0.5
  }),
  new SuggestCompletedTrial({
    trialNumber: 1,
    config: { model: "linear", learningRate: 0.01, regularization: 0.2 },
    value: 0.2
  }),
  new SuggestCompletedTrial({
    trialNumber: 2,
    config: { model: "tree", maxDepth: 9, minSamplesLeaf: 2 },
    value: 2.8
  }),
  new SuggestCompletedTrial({
    trialNumber: 3,
    config: { model: "tree", maxDepth: 4, minSamplesLeaf: 1 },
    value: 2.1
  })
]

const parameterByName = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (parameter) => parameter.name === name)

describe("TPE conditional branch-aware density behavior", () => {
  it.effect("filters branch-local observations from mixed trial history", () =>
    Effect.sync(() => {
      const space = makeConditionalSpace()
      const model = parameterByName(space, "model")
      const learningRate = parameterByName(space, "learningRate")
      const maxDepth = parameterByName(space, "maxDepth")

      expect(Option.isSome(model)).toBe(true)
      expect(Option.isSome(learningRate)).toBe(true)
      expect(Option.isSome(maxDepth)).toBe(true)

      const tracked = Option.getOrThrow(
        Option.all({
          model,
          learningRate,
          maxDepth
        })
      )

      const history = splitHistory()

      expect(numericValuesForParameter(tracked.learningRate, history)).toEqual([0.03, 0.01])
      expect(numericValuesForParameter(tracked.maxDepth, history)).toEqual([9, 4])
      expect(primitiveValuesForParameter(tracked.model, history)).toEqual(["linear", "linear", "tree", "tree"])
    }))

  it.effect("emits only branch-consistent conditional assignments in model-driven mode", () =>
    Effect.gen(function*() {
      const space = makeConditionalSpace()
      const sampler = Sampler.tpe({ seed: 77, nStartupTrials: 0, nEiCandidates: 40 })
      const context = new SuggestContext({
        completed: completedHistory(),
        pending: [],
        objectiveSpec: singleObjectiveSpec(),
        nextTrialNumber: 4,
        epsilon: 0
      })

      const suggested = yield* Sampler.suggest(sampler, space, context)
      const decoded = Schema.decodeUnknownEither(LinearTreeConditionalConfigSchema)(suggested)

      expect(Either.isRight(decoded)).toBe(true)

      const branchConfig = Either.getOrThrow(decoded)

      Match.value(branchConfig.model).pipe(
        Match.when("linear", () => {
          expect("learningRate" in branchConfig).toBe(true)
          expect("regularization" in branchConfig).toBe(true)
          expect("maxDepth" in branchConfig).toBe(false)
          expect("minSamplesLeaf" in branchConfig).toBe(false)
        }),
        Match.when("tree", () => {
          expect("maxDepth" in branchConfig).toBe(true)
          expect("minSamplesLeaf" in branchConfig).toBe(true)
          expect("learningRate" in branchConfig).toBe(false)
          expect("regularization" in branchConfig).toBe(false)
        }),
        Match.exhaustive
      )
    }))

  it.effect("remains deterministic and decodable with sparse branch history", () =>
    Effect.gen(function*() {
      const space = makeConditionalSpace()
      const sampler = Sampler.tpe({ seed: 91, nStartupTrials: 0, nEiCandidates: 32 })
      const context = new SuggestContext({
        completed: [
          new SuggestCompletedTrial({
            trialNumber: 0,
            config: { model: "tree", maxDepth: 11, minSamplesLeaf: 1 },
            value: 3.5
          })
        ],
        pending: [],
        objectiveSpec: singleObjectiveSpec(),
        nextTrialNumber: 1,
        epsilon: 0
      })

      const left = yield* Sampler.suggest(sampler, space, context)
      const right = yield* Sampler.suggest(
        Sampler.tpe({ seed: 91, nStartupTrials: 0, nEiCandidates: 32 }),
        space,
        context
      )

      expect(Either.isRight(Schema.decodeUnknownEither(LinearTreeConditionalConfigSchema)(left))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(LinearTreeConditionalConfigSchema)(right))).toBe(true)
      expect(left).toEqual(right)
    }))
})
