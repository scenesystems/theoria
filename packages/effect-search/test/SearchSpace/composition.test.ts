import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Either, Equal, Option, Schema } from "effect"

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

const requireMergedConfig = (config: { readonly lr: number; readonly batchSize: number }) => config

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

  it.effect("extends two spaces and preserves merged config typing", () =>
    Effect.gen(function*() {
      const extended = yield* SearchSpace.extend(yield* learningRateSpace, yield* batchSpace)
      const decoded = yield* Schema.decodeUnknown(extended.schema)({ lr: 0.01, batchSize: 32 })
      const typed = requireMergedConfig(decoded)

      expect(typed.batchSize).toBe(32)
      expect(Arr.map(extended.params, (parameter) => parameter.name)).toEqual(Arr.make("lr", "batchSize"))
    }))

  it.effect("rejects extend conflicts when spaces reuse parameter names", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.extend(
          yield* learningRateSpace,
          yield* SearchSpace.make({
            lr: SearchSpace.int(1, 5)
          })
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      Either.match(result, {
        onLeft: (failure) => {
          expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
          expect(failure.reason).toContain("duplicate parameter")
        },
        onRight: () => undefined
      })
    }))

  it.effect("pick computes activation dependency closure for conditional dimensions", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.pick(yield* conditionalSpace, Arr.of("lr"))
      const decode = Schema.decodeUnknownEither(projected.schema)
      const learningRateParameter = Arr.findFirst(projected.params, (parameter) => Equal.equals(parameter.name, "lr"))

      expect(Arr.map(projected.params, (parameter) => parameter.name)).toEqual(Arr.make("model", "lr"))
      expect(Option.map(learningRateParameter, (parameter) => parameter.activeWhen)).toEqual(
        Option.some(Arr.of({ dimension: "model", equals: "linear" }))
      )
      expect(Either.isRight(decode({ model: "linear", lr: 0.01 }))).toBe(true)
      expect(Either.isRight(decode({ model: "tree" }))).toBe(true)
      expect(Either.isLeft(decode({ model: "linear" }))).toBe(true)
      const treeWithLinearOnlyField = decode({ model: "tree", lr: 0.01 })
      expect(Either.isRight(treeWithLinearOnlyField)).toBe(true)

      expect(Either.getOrElse(treeWithLinearOnlyField, () => ({ model: "invalid" }))).toEqual({ model: "tree" })
    }))

  it.effect("omit removes descendants when dropping a conditional discriminant", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.omit(yield* conditionalSpace, Arr.of("model"))
      const decode = Schema.decodeUnknownEither(projected.schema)

      expect(Arr.map(projected.params, (parameter) => parameter.name)).toEqual(Arr.of("seed"))
      expect(Either.isRight(decode({ seed: 4 }))).toBe(true)
      const withOmittedDiscriminant = decode({ model: "tree", seed: 4 })
      expect(Either.isRight(withOmittedDiscriminant)).toBe(true)

      expect(Either.getOrElse(withOmittedDiscriminant, () => ({ seed: Number.NaN }))).toEqual({ seed: 4 })
    }))

  it.effect("fails deterministically on invalid projection requests", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(SearchSpace.pick(yield* conditionalSpace, Arr.of("unknown")))

      expect(Either.isLeft(result)).toBe(true)

      Either.match(result, {
        onLeft: (failure) => {
          expect(failure._tag).toBe("effect-search/InvalidSearchSpace")
          expect(failure.reason).toContain("unknown parameter")
        },
        onRight: () => undefined
      })
    }))
})
