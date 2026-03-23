import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Option, Schema } from "effect"

import { makeLinearTreeConditionalSpace } from "../../src/experimental/scenarios/conditionalLinearTree.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import {
  ConditionalFilteringFixtureSchema,
  ConditionalGroupDecompositionFixtureSchema,
  FixtureRegistryLive,
  loadFixture
} from "../helpers/fixtures.js"

const makeConditionalSpace = () => makeLinearTreeConditionalSpace()

const makeTreeStructuredSpace = () =>
  SearchSpace.unsafeMakeConditional(
    {
      model: SearchSpace.categorical(["linear", "tree"])
    },
    SearchSpace.switch("model", [
      SearchSpace.when(
        "linear",
        SearchSpace.unsafeMake({
          learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
          regularization: SearchSpace.float(0, 1)
        })
      ),
      SearchSpace.when(
        "tree",
        SearchSpace.unsafeMakeConditional(
          {
            depthMode: SearchSpace.categorical(["shallow", "deep"])
          },
          SearchSpace.switch("depthMode", [
            SearchSpace.when(
              "shallow",
              SearchSpace.unsafeMake({
                shallowMaxDepth: SearchSpace.int(2, 6)
              })
            ),
            SearchSpace.when(
              "deep",
              SearchSpace.unsafeMake({
                maxDepth: SearchSpace.int(7, 16),
                minSamplesLeaf: SearchSpace.int(1, 4)
              })
            )
          ])
        )
      )
    ])
  )

const makeBranchParitySpace = () =>
  SearchSpace.unsafeMakeConditional(
    {
      optimizer: SearchSpace.categorical(["adam", "sgd"]),
      lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
    },
    SearchSpace.switch("optimizer", [
      SearchSpace.when(
        "adam",
        SearchSpace.unsafeMake({
          beta1: SearchSpace.float(0.8, 0.99),
          beta2: SearchSpace.float(0.9, 0.999)
        })
      ),
      SearchSpace.when(
        "sgd",
        SearchSpace.unsafeMake({
          momentum: SearchSpace.float(0, 1)
        })
      )
    ])
  )

const decodeSpace = (space: SearchSpace.SearchSpace, value: unknown) => Schema.decodeUnknownEither(space.schema)(value)

const parameterByName = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (parameter) => parameter.name === name)

const typeInferenceProof = (_space: SearchSpace.SearchSpace) => {
  type Config = Schema.Schema.Type<typeof _space.schema>

  const linear: Config = {
    model: "linear",
    learningRate: 0.02,
    regularization: 0.2
  }
  const tree: Config = {
    model: "tree",
    maxDepth: 6,
    minSamplesLeaf: 3
  }

  return {
    linear,
    tree
  }
}

const treeStructuredTypeInferenceProof = (_space: SearchSpace.SearchSpace) => {
  type Config = Schema.Schema.Type<typeof _space.schema>

  const linear: Config = {
    model: "linear",
    learningRate: 0.02,
    regularization: 0.1
  }
  const shallowTree: Config = {
    model: "tree",
    depthMode: "shallow",
    shallowMaxDepth: 5
  }
  const deepTree: Config = {
    model: "tree",
    depthMode: "deep",
    maxDepth: 12,
    minSamplesLeaf: 2
  }

  return {
    linear,
    shallowTree,
    deepTree
  }
}

describe("SearchSpace conditional contracts", () => {
  it.effect("builds branch-safe typing and schema decode boundaries", () =>
    Effect.sync(() => {
      const space = makeConditionalSpace()
      const proof = typeInferenceProof(space)

      expect(Either.isRight(decodeSpace(space, proof.linear))).toBe(true)
      expect(Either.isRight(decodeSpace(space, proof.tree))).toBe(true)
      expect(Either.isLeft(decodeSpace(space, { model: "linear", maxDepth: 4, minSamplesLeaf: 1 }))).toBe(true)
      expect(
        Either.isLeft(
          decodeSpace(space, {
            model: "tree",
            learningRate: 0.01,
            regularization: 0.5
          })
        )
      ).toBe(true)
    }))

  it.effect("builds nested tree-structured branch typing and schema decode boundaries", () =>
    Effect.sync(() => {
      const space = makeTreeStructuredSpace()
      const proof = treeStructuredTypeInferenceProof(space)

      expect(Either.isRight(decodeSpace(space, proof.linear))).toBe(true)
      expect(Either.isRight(decodeSpace(space, proof.shallowTree))).toBe(true)
      expect(Either.isRight(decodeSpace(space, proof.deepTree))).toBe(true)
      expect(
        Either.isLeft(
          decodeSpace(space, {
            model: "tree",
            depthMode: "shallow",
            maxDepth: 9,
            minSamplesLeaf: 1
          })
        )
      ).toBe(true)
      expect(
        Either.isLeft(
          decodeSpace(space, {
            model: "linear",
            learningRate: 0.03,
            depthMode: "deep"
          })
        )
      ).toBe(true)
      expect(
        Either.isLeft(
          decodeSpace(space, {
            model: "tree",
            depthMode: "deep",
            maxDepth: 11
          })
        )
      ).toBe(true)
    }))

  it.effect("tracks activation metadata for branch-scoped parameters", () =>
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

      expect(tracked.model.activeWhen).toEqual([])
      expect(tracked.learningRate.activeWhen).toEqual([{ dimension: "model", equals: "linear" }])
      expect(tracked.maxDepth.activeWhen).toEqual([{ dimension: "model", equals: "tree" }])

      const activeLinear = Arr.map(SearchSpace.activeParameters(space, { model: "linear" }), (parameter) =>
        parameter.name)
      const activeTree = Arr.map(SearchSpace.activeParameters(space, { model: "tree" }), (parameter) =>
        parameter.name)

      expect(activeLinear).toEqual(["model", "learningRate", "regularization"])
      expect(activeTree).toEqual(["model", "maxDepth", "minSamplesLeaf"])
    }))

  it.effect("rejects switch discriminants that are not categorical dimensions", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(["a", "b"])
          },
          SearchSpace.switch("missing", [
            SearchSpace.when(
              "a",
              SearchSpace.unsafeMake({
                alpha: SearchSpace.float(0.01, 1)
              })
            )
          ])
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
      }
    }))

  it.effect("rejects unreachable switch branch values", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(["linear"])
          },
          SearchSpace.switch("mode", [
            SearchSpace.when(
              "tree",
              SearchSpace.unsafeMake({
                maxDepth: SearchSpace.int(1, 4)
              })
            )
          ])
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
      }
    }))

  it.effect("rejects duplicate parameter names across conditional branches", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(["a", "b"])
          },
          SearchSpace.switch("mode", [
            SearchSpace.when(
              "a",
              SearchSpace.unsafeMake({
                shared: SearchSpace.float(0.01, 1)
              })
            ),
            SearchSpace.when(
              "b",
              SearchSpace.unsafeMake({
                shared: SearchSpace.float(0.01, 1)
              })
            )
          ])
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
      }
    }))

  it.effect("replays FM-10 conditional filtering fixture for active-branch subset extraction", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("conditional.filtering").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(ConditionalFilteringFixtureSchema)(loaded)
      const space = makeBranchParitySpace()

      fixture.payload.cases.forEach((entry) => {
        const trials = entry.trials.map(
          (trial) =>
            new SearchSpace.ConditionalTraceTrial({
              trialNumber: trial.trialNumber,
              params: trial.params
            })
        )
        const partition = SearchSpace.partitionTrialNumbersByRequiredParameters(space, entry.requiredParams, trials)

        expect(partition.included).toEqual(entry.expectedIncluded)
        expect(partition.excluded).toEqual(entry.expectedExcluded)
      })
    }))

  it.effect("replays FM-11 group decomposition fixture for deterministic key ordering", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("conditional.group-decomposition").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(ConditionalGroupDecompositionFixtureSchema)(loaded)
      const space = makeBranchParitySpace()
      const groups = SearchSpace.decomposeConditionalGroups(space).map((group) => ({
        key: group.key,
        dimensions: [...group.dimensions]
      }))

      expect(groups).toEqual(fixture.payload.expectedGroups)
    }))
})
