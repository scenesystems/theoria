import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Either, Equal, Option, Schema } from "effect"

import * as SearchSpace from "../../src/SearchSpace.js"
import { makeLinearTreeConditionalSpace } from "../fixtures/scenarios/conditionalLinearTree.js"
import {
  ConditionalFilteringFixture,
  ConditionalGroupDecompositionFixture,
  FixtureRegistryLive,
  loadFixture
} from "../helpers/fixtures/index.js"

const conditionalSpace = makeLinearTreeConditionalSpace()

const treeStructuredSpace = Effect.gen(function*() {
  const linear = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    regularization: SearchSpace.float(0, 1)
  })
  const shallow = yield* SearchSpace.make({
    shallowMaxDepth: SearchSpace.int(2, 6)
  })
  const deep = yield* SearchSpace.make({
    maxDepth: SearchSpace.int(7, 16),
    minSamplesLeaf: SearchSpace.int(1, 4)
  })
  const tree = yield* SearchSpace.makeConditional(
    {
      depthMode: SearchSpace.categorical(Arr.make("shallow", "deep"))
    },
    SearchSpace.switchOn("depthMode", Chunk.make(SearchSpace.when("shallow", shallow), SearchSpace.when("deep", deep)))
  )

  return yield* SearchSpace.makeConditional(
    {
      model: SearchSpace.categorical(Arr.make("linear", "tree"))
    },
    SearchSpace.switchOn("model", Chunk.make(SearchSpace.when("linear", linear), SearchSpace.when("tree", tree)))
  )
})

const branchParitySpace = Effect.gen(function*() {
  const adam = yield* SearchSpace.make({
    beta1: SearchSpace.float(0.8, 0.99),
    beta2: SearchSpace.float(0.9, 0.999)
  })
  const sgd = yield* SearchSpace.make({
    momentum: SearchSpace.float(0, 1)
  })

  return yield* SearchSpace.makeConditional(
    {
      optimizer: SearchSpace.categorical(Arr.make("adam", "sgd")),
      lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
    },
    SearchSpace.switchOn("optimizer", Chunk.make(SearchSpace.when("adam", adam), SearchSpace.when("sgd", sgd)))
  )
})

const decodeSpace = (space: SearchSpace.SearchSpace, value: unknown) => Schema.decodeUnknownEither(space.schema)(value)

const parameterByName = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name))

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
    Effect.gen(function*() {
      const space = yield* conditionalSpace
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
    Effect.gen(function*() {
      const space = yield* treeStructuredSpace
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

      expect(tracked.model.activeWhen).toEqual(Arr.empty())
      expect(tracked.learningRate.activeWhen).toEqual(Arr.of({ dimension: "model", equals: "linear" }))
      expect(tracked.maxDepth.activeWhen).toEqual(Arr.of({ dimension: "model", equals: "tree" }))

      const activeLinear = Arr.map(SearchSpace.activeParameters(space, { model: "linear" }), (parameter) =>
        parameter.name)
      const activeTree = Arr.map(SearchSpace.activeParameters(space, { model: "tree" }), (parameter) =>
        parameter.name)

      expect(activeLinear).toEqual(Arr.make("model", "learningRate", "regularization"))
      expect(activeTree).toEqual(Arr.make("model", "maxDepth", "minSamplesLeaf"))
    }))

  it.effect("rejects switch discriminants that are not categorical dimensions", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(Arr.make("a", "b"))
          },
          SearchSpace.switchOn(
            "missing",
            Chunk.make(
              SearchSpace.when(
                "a",
                yield* SearchSpace.make({
                  alpha: SearchSpace.float(0.01, 1)
                })
              )
            )
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => expect(failure._tag).toBe("effect-search/InvalidSearchSpace"))
    }))

  it.effect("rejects unreachable switch branch values", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(Arr.of("linear"))
          },
          SearchSpace.switchOn(
            "mode",
            Chunk.make(
              SearchSpace.when(
                "tree",
                yield* SearchSpace.make({
                  maxDepth: SearchSpace.int(1, 4)
                })
              )
            )
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => expect(failure._tag).toBe("effect-search/InvalidSearchSpace"))
    }))

  it.effect("rejects duplicate parameter names across conditional branches", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.makeConditional(
          {
            mode: SearchSpace.categorical(Arr.make("a", "b"))
          },
          SearchSpace.switchOn(
            "mode",
            Chunk.make(
              SearchSpace.when(
                "a",
                yield* SearchSpace.make({
                  shared: SearchSpace.float(0.01, 1)
                })
              ),
              SearchSpace.when(
                "b",
                yield* SearchSpace.make({
                  shared: SearchSpace.float(0.01, 1)
                })
              )
            )
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.mapLeft(result, (failure) => expect(failure._tag).toBe("effect-search/InvalidSearchSpace"))
    }))

  it.effect("replays FM-10 conditional filtering fixture for active-branch subset extraction", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("conditional.filtering").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(ConditionalFilteringFixture)(loaded)
      const space = yield* branchParitySpace

      Arr.forEach(fixture.payload.cases, (entry) => {
        const trials = Arr.map(
          entry.trials,
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
      const fixture = yield* Schema.decodeUnknown(ConditionalGroupDecompositionFixture)(loaded)
      const space = yield* branchParitySpace
      const groups = Arr.map(SearchSpace.decomposeConditionalGroups(space), (group) => ({
        key: group.key,
        dimensions: Arr.fromIterable(group.dimensions)
      }))

      expect(groups).toEqual(fixture.payload.expectedGroups)
    }))
})
