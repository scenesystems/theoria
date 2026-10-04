import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Equal, Option, Result, Schema } from "effect"

import * as SearchSpace from "../../src/SearchSpace.js"

const learningRateSpace = SearchSpace.make({
  lr: SearchSpace.float(0.0001, 0.1, { scale: "log" })
})

const batchSpace = SearchSpace.make({
  batchSize: SearchSpace.int(16, 128, { step: 16 })
})

const conditionalSpace = Effect.gen(function*() {
  const linear = yield* SearchSpace.make({
    lr: SearchSpace.float(0.0001, 0.1, { scale: "log" }),
    regularization: SearchSpace.float(0, 1)
  })
  const tree = yield* SearchSpace.make({
    maxDepth: SearchSpace.int(2, 12)
  })

  return yield* SearchSpace.makeConditional(
    {
      model: SearchSpace.categorical(Arr.make("linear", "tree")),
      seed: SearchSpace.int(0, 10)
    },
    SearchSpace.switchOn("model", Chunk.make(SearchSpace.when("linear", linear), SearchSpace.when("tree", tree)))
  )
})

describe("SearchSpace composition", () => {
  it.effect("extends, picks and omits parameters by name", () =>
    Effect.gen(function*() {
      const extended = yield* SearchSpace.extend(yield* learningRateSpace, yield* batchSpace)
      const picked = yield* SearchSpace.pick(yield* conditionalSpace, Arr.of("lr"))
      const omitted = yield* SearchSpace.omit(yield* conditionalSpace, Arr.of("model"))

      expect(Arr.map(extended.params, (parameter) => parameter.name)).toEqual(Arr.make("lr", "batchSize"))
      expect(Arr.map(picked.params, (parameter) => parameter.name)).toEqual(Arr.make("model", "lr"))
      expect(Arr.map(omitted.params, (parameter) => parameter.name)).toEqual(Arr.of("seed"))
    }))

  it.effect("extends two spaces and decodes the merged config", () =>
    Effect.gen(function*() {
      const extended = yield* SearchSpace.extend(yield* learningRateSpace, yield* batchSpace)
      const decoded = yield* Schema.decodeEffect(Schema.toType(extended.schema))({ lr: 0.01, batchSize: 32 })

      expect(decoded).toEqual({ lr: 0.01, batchSize: 32 })
      expect(Arr.map(extended.params, (parameter) => parameter.name)).toEqual(Arr.make("lr", "batchSize"))
    }))

  it.effect("rejects extend conflicts when spaces reuse parameter names", () =>
    Effect.gen(function*() {
      const result = yield* Effect.result(
        SearchSpace.extend(
          yield* learningRateSpace,
          yield* SearchSpace.make({
            lr: SearchSpace.int(1, 5)
          })
        )
      )

      expect(Result.isFailure(result)).toBe(true)

      Result.match(result, {
        onFailure: (failure) => {
          expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
          expect(failure.reason).toContain("duplicate parameter")
        },
        onSuccess: () => undefined
      })
    }))

  it.effect("pick computes activation dependency closure for conditional dimensions", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.pick(yield* conditionalSpace, Arr.of("lr"))
      const decode = Schema.decodeUnknownResult(Schema.toType(projected.schema))
      const learningRateParameter = Arr.findFirst(projected.params, (parameter) => Equal.equals(parameter.name, "lr"))

      expect(Arr.map(projected.params, (parameter) => parameter.name)).toEqual(Arr.make("model", "lr"))
      expect(Option.map(learningRateParameter, (parameter) => parameter.activeWhen)).toEqual(
        Option.some(Arr.of({ dimension: "model", equals: "linear" }))
      )
      expect(Result.isSuccess(decode({ model: "linear", lr: 0.01 }))).toBe(true)
      expect(Result.isSuccess(decode({ model: "tree" }))).toBe(true)
      expect(Result.isFailure(decode({ model: "linear" }))).toBe(true)
      const treeWithLinearOnlyField = decode({ model: "tree", lr: 0.01 })
      expect(Result.isSuccess(treeWithLinearOnlyField)).toBe(true)

      expect(Result.getOrElse(treeWithLinearOnlyField, () => ({ model: "invalid" }))).toEqual({ model: "tree" })
    }))

  it.effect("omit removes descendants when dropping a conditional discriminant", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.omit(yield* conditionalSpace, Arr.of("model"))
      const decode = Schema.decodeUnknownResult(Schema.toType(projected.schema))

      expect(Arr.map(projected.params, (parameter) => parameter.name)).toEqual(Arr.of("seed"))
      expect(Result.isSuccess(decode({ seed: 4 }))).toBe(true)
      const withOmittedDiscriminant = decode({ model: "tree", seed: 4 })
      expect(Result.isSuccess(withOmittedDiscriminant)).toBe(true)

      expect(Result.getOrElse(withOmittedDiscriminant, () => ({ seed: Number.NaN }))).toEqual({ seed: 4 })
    }))

  it.effect("fails deterministically on invalid projection requests", () =>
    Effect.gen(function*() {
      const result = yield* Effect.result(SearchSpace.pick(yield* conditionalSpace, Arr.of("unknown")))

      expect(Result.isFailure(result)).toBe(true)

      Result.match(result, {
        onFailure: (failure) => {
          expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
          expect(failure.reason).toContain("unknown parameter")
        },
        onSuccess: () => undefined
      })
    }))
})
