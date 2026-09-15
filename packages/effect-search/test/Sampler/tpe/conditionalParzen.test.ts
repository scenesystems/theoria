import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Equal, Match, Option, Schema } from "effect"

import { singleObjectiveSpec } from "../../../src/contracts/index.js"
import {
  LinearTreeConditionalConfigSchema,
  makeLinearTreeConditionalSpace
} from "../../../src/experimental/scenarios/conditionalLinearTree.js"
import { CompletedTrialForSplit } from "../../../src/internal/tpe/splitTrials.js"
import { SuggestCompletedTrial, SuggestContext } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { numericValuesForParameter, primitiveValuesForParameter } from "../../../src/samplers/Tpe/dimensions/values.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"

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
  )

const parameterByName = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name))

describe("TPE conditional branch-aware density behavior", () => {
  it.effect("relaxes nested conditions from the leaf without admitting a sibling branch", () =>
    Effect.gen(function*() {
      const activeWhen = Arr.make(
        new SearchSpace.ActivationCondition({ dimension: "outer", equals: "target" }),
        new SearchSpace.ActivationCondition({ dimension: "inner", equals: "selected" })
      )
      const numeric = new SearchSpace.ParameterMetadata({
        name: "numeric",
        distribution: { type: "float", low: 0, high: 30 },
        activeWhen
      })
      const categorical = new SearchSpace.ParameterMetadata({
        name: "categorical",
        distribution: { type: "categorical", choices: Arr.make("preferred", "excluded") },
        activeWhen
      })
      const history = Arr.make(
        new CompletedTrialForSplit({
          trialNumber: 0,
          config: {
            outer: "target",
            inner: "selected",
            numeric: Number.POSITIVE_INFINITY,
            categorical: { invalid: true }
          },
          value: 0
        }),
        new CompletedTrialForSplit({
          trialNumber: 1,
          config: { outer: "target", inner: "other", numeric: 11, categorical: "preferred" },
          value: 1
        }),
        new CompletedTrialForSplit({
          trialNumber: 2,
          config: { outer: "other", inner: "selected", numeric: 22, categorical: "excluded" },
          value: 2
        })
      )

      expect(numericValuesForParameter(numeric, history)).toEqual(Arr.of(11))
      expect(primitiveValuesForParameter(categorical, history)).toEqual(Arr.of("preferred"))
    }))

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
      const context = new SuggestContext({
        completed: completedHistory(),
        pending: Arr.empty(),
        objectiveSpec: singleObjectiveSpec(),
        nextTrialNumber: 4,
        epsilon: 0
      })

      const suggested = yield* Sampler.suggest(sampler, space, context)
      const decoded = Schema.decodeUnknownEither(LinearTreeConditionalConfigSchema)(suggested)

      expect(Either.isRight(decoded)).toBe(true)

      const branchConfig = yield* decoded

      Match.value(branchConfig.model).pipe(
        Match.when("linear", () => {
          expect(branchConfig).toHaveProperty("learningRate")
          expect(branchConfig).toHaveProperty("regularization")
          expect(branchConfig).not.toHaveProperty("maxDepth")
          expect(branchConfig).not.toHaveProperty("minSamplesLeaf")
        }),
        Match.when("tree", () => {
          expect(branchConfig).toHaveProperty("maxDepth")
          expect(branchConfig).toHaveProperty("minSamplesLeaf")
          expect(branchConfig).not.toHaveProperty("learningRate")
          expect(branchConfig).not.toHaveProperty("regularization")
        }),
        Match.exhaustive
      )
    }))

  it.effect("remains deterministic and decodable with sparse branch history", () =>
    Effect.gen(function*() {
      const space = yield* conditionalSpace
      const sampler = Sampler.tpe({ seed: 91, nStartupTrials: 0, nEiCandidates: 32 })
      const context = new SuggestContext({
        completed: Arr.make(
          new SuggestCompletedTrial({
            trialNumber: 0,
            config: { model: "tree", maxDepth: 11, minSamplesLeaf: 1 },
            value: 3.5
          })
        ),
        pending: Arr.empty(),
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
