import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Equal, Match, Option, Predicate, Schema } from "effect"

import { numericValuesForParameter, primitiveValuesForParameter } from "../../../src/internal/tpe/dimensions/values.js"
import { CompletedTrialForSplit } from "../../../src/internal/tpe/splitTrials.js"
import { single } from "../../../src/Objective.js"
import { Context, Observation } from "../../../src/Sampler.js"
import * as Sampler from "../../../src/Sampler.js"
import type * as SearchSpace from "../../../src/SearchSpace.js"
import {
  LinearTreeConditionalConfig,
  makeLinearTreeConditionalSpace
} from "../../fixtures/scenarios/conditionalLinearTree.js"

const conditionalSpace = makeLinearTreeConditionalSpace()

const splitHistory = () =>
  Arr.make(
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
  )

const completedHistory = () =>
  Arr.make(
    new Observation({
      trialNumber: 0,
      config: { model: "linear", learningRate: 0.03, regularization: 0.4 },
      value: 0.5
    }),
    new Observation({
      trialNumber: 1,
      config: { model: "linear", learningRate: 0.01, regularization: 0.2 },
      value: 0.2
    }),
    new Observation({
      trialNumber: 2,
      config: { model: "tree", maxDepth: 9, minSamplesLeaf: 2 },
      value: 2.8
    }),
    new Observation({
      trialNumber: 3,
      config: { model: "tree", maxDepth: 4, minSamplesLeaf: 1 },
      value: 2.1
    })
  )

const parameterByName = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name))

describe("TPE conditional branch-aware density behavior", () => {
  it.effect("filters branch-local observations from mixed trial history", () =>
    Effect.gen(function*() {
      const space = yield* conditionalSpace
      const model = parameterByName(space, "model")
      const learningRate = parameterByName(space, "learningRate")
      const maxDepth = parameterByName(space, "maxDepth")

      expect(Option.isSome(model)).toBe(true)
      expect(Option.isSome(learningRate)).toBe(true)
      expect(Option.isSome(maxDepth)).toBe(true)

      const tracked = yield* Option.all({
        model,
        learningRate,
        maxDepth
      })

      const history = splitHistory()

      expect(numericValuesForParameter(tracked.learningRate, history)).toEqual(Arr.make(0.03, 0.01))
      expect(numericValuesForParameter(tracked.maxDepth, history)).toEqual(Arr.make(9, 4))
      expect(primitiveValuesForParameter(tracked.model, history)).toEqual(Arr.make("linear", "linear", "tree", "tree"))
    }))

  it.effect("emits only branch-consistent conditional assignments in model-driven mode", () =>
    Effect.gen(function*() {
      const space = yield* conditionalSpace
      const sampler = Sampler.tpe({ seed: 77, nStartupTrials: 0, nEiCandidates: 40 })
      const context = new Context({
        completed: completedHistory(),
        pending: Arr.empty(),
        objectiveSpec: single(),
        nextTrialNumber: 4,
        epsilon: 0
      })

      const suggested = yield* Sampler.suggest(sampler, space, context)
      const decoded = Schema.decodeUnknownEither(LinearTreeConditionalConfig)(suggested)

      expect(Either.isRight(decoded)).toBe(true)

      const branchConfig = yield* decoded

      Match.value(branchConfig.model).pipe(
        Match.when("linear", () => {
          expect(Predicate.hasProperty(branchConfig, "learningRate")).toBe(true)
          expect(Predicate.hasProperty(branchConfig, "regularization")).toBe(true)
          expect(Predicate.hasProperty(branchConfig, "maxDepth")).toBe(false)
          expect(Predicate.hasProperty(branchConfig, "minSamplesLeaf")).toBe(false)
        }),
        Match.when("tree", () => {
          expect(Predicate.hasProperty(branchConfig, "maxDepth")).toBe(true)
          expect(Predicate.hasProperty(branchConfig, "minSamplesLeaf")).toBe(true)
          expect(Predicate.hasProperty(branchConfig, "learningRate")).toBe(false)
          expect(Predicate.hasProperty(branchConfig, "regularization")).toBe(false)
        }),
        Match.exhaustive
      )
    }))

  it.effect("remains deterministic and decodable with sparse branch history", () =>
    Effect.gen(function*() {
      const space = yield* conditionalSpace
      const sampler = Sampler.tpe({ seed: 91, nStartupTrials: 0, nEiCandidates: 32 })
      const context = new Context({
        completed: Arr.of(
          new Observation({
            trialNumber: 0,
            config: { model: "tree", maxDepth: 11, minSamplesLeaf: 1 },
            value: 3.5
          })
        ),
        pending: Arr.empty(),
        objectiveSpec: single(),
        nextTrialNumber: 1,
        epsilon: 0
      })

      const left = yield* Sampler.suggest(sampler, space, context)
      const right = yield* Sampler.suggest(
        Sampler.tpe({ seed: 91, nStartupTrials: 0, nEiCandidates: 32 }),
        space,
        context
      )

      expect(Either.isRight(Schema.decodeUnknownEither(LinearTreeConditionalConfig)(left))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(LinearTreeConditionalConfig)(right))).toBe(true)
      expect(left).toEqual(right)
    }))
})
