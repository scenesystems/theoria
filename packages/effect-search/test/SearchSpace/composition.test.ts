import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import * as EffectSearch from "../../src/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const makeLearningRateSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(0.0001, 0.1, { scale: "log" })
  })

const makeBatchSpace = () =>
  SearchSpace.unsafeMake({
    batchSize: SearchSpace.int(16, 128, { step: 16 })
  })

const makeConditionalSpace = () =>
  SearchSpace.unsafeMakeConditional(
    {
      model: SearchSpace.categorical(["linear", "tree"]),
      seed: SearchSpace.int(0, 10)
    },
    SearchSpace.switch("model", [
      SearchSpace.when(
        "linear",
        SearchSpace.unsafeMake({
          lr: SearchSpace.float(0.0001, 0.1, { scale: "log" }),
          regularization: SearchSpace.float(0, 1)
        })
      ),
      SearchSpace.when(
        "tree",
        SearchSpace.unsafeMake({
          maxDepth: SearchSpace.int(2, 12)
        })
      )
    ])
  )

const requireMergedConfig = (config: { readonly lr: number; readonly batchSize: number }) => config

describe("SearchSpace composition", () => {
  it.effect("exports extend / pick / omit from the package SearchSpace namespace", () =>
    Effect.gen(function*() {
      const extended = yield* EffectSearch.SearchSpace.extend(makeLearningRateSpace(), makeBatchSpace())
      const picked = yield* EffectSearch.SearchSpace.pick(makeConditionalSpace(), ["lr"])
      const omitted = yield* EffectSearch.SearchSpace.omit(makeConditionalSpace(), ["model"])

      expect(EffectSearch.SearchSpace.extend).toBe(SearchSpace.extend)
      expect(EffectSearch.SearchSpace.pick).toBe(SearchSpace.pick)
      expect(EffectSearch.SearchSpace.omit).toBe(SearchSpace.omit)
      expect(extended.params.map((parameter) => parameter.name)).toEqual(["lr", "batchSize"])
      expect(picked.params.map((parameter) => parameter.name)).toEqual(["model", "lr"])
      expect(omitted.params.map((parameter) => parameter.name)).toEqual(["seed"])
    }))

  it.effect("extends two spaces and preserves merged config typing", () =>
    Effect.gen(function*() {
      const extended = yield* SearchSpace.extend(makeLearningRateSpace(), makeBatchSpace())
      const decoded = Schema.decodeUnknownSync(extended.schema)({ lr: 0.01, batchSize: 32 })
      const typed = requireMergedConfig(decoded)

      expect(typed.batchSize).toBe(32)
      expect(extended.params.map((parameter) => parameter.name)).toEqual(["lr", "batchSize"])
    }))

  it.effect("rejects extend conflicts when spaces reuse parameter names", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        SearchSpace.extend(
          makeLearningRateSpace(),
          SearchSpace.unsafeMake({
            lr: SearchSpace.int(1, 5)
          })
        )
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toContain("duplicate parameter")
      }
    }))

  it.effect("pick computes activation dependency closure for conditional dimensions", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.pick(makeConditionalSpace(), ["lr"])
      const decode = Schema.decodeUnknownEither(projected.schema)
      const learningRateParameter = projected.params.find((parameter) => parameter.name === "lr")

      expect(projected.params.map((parameter) => parameter.name)).toEqual(["model", "lr"])
      expect(learningRateParameter?.activeWhen).toEqual([{ dimension: "model", equals: "linear" }])
      expect(Either.isRight(decode({ model: "linear", lr: 0.01 }))).toBe(true)
      expect(Either.isRight(decode({ model: "tree" }))).toBe(true)
      expect(Either.isLeft(decode({ model: "linear" }))).toBe(true)
      const treeWithLinearOnlyField = decode({ model: "tree", lr: 0.01 })
      expect(Either.isRight(treeWithLinearOnlyField)).toBe(true)

      if (Either.isRight(treeWithLinearOnlyField)) {
        expect(treeWithLinearOnlyField.right).toEqual({ model: "tree" })
      }
    }))

  it.effect("omit removes descendants when dropping a conditional discriminant", () =>
    Effect.gen(function*() {
      const projected = yield* SearchSpace.omit(makeConditionalSpace(), ["model"])
      const decode = Schema.decodeUnknownEither(projected.schema)

      expect(projected.params.map((parameter) => parameter.name)).toEqual(["seed"])
      expect(Either.isRight(decode({ seed: 4 }))).toBe(true)
      const withOmittedDiscriminant = decode({ model: "tree", seed: 4 })
      expect(Either.isRight(withOmittedDiscriminant)).toBe(true)

      if (Either.isRight(withOmittedDiscriminant)) {
        expect(withOmittedDiscriminant.right).toEqual({ seed: 4 })
      }
    }))

  it.effect("fails deterministically on invalid projection requests", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(SearchSpace.pick(makeConditionalSpace(), ["unknown"]))

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("effect-search/InvalidSearchSpace")
        expect(result.left.reason).toContain("unknown parameter")
      }
    }))
})
