import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Option, Schema } from "effect"

import type { PrimitiveChoice } from "../../src/contracts/index.js"
import { GridIncompatible } from "../../src/Errors/index.js"
import { SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const categoricalOnlySpace = () =>
  SearchSpace.unsafeMake({
    optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"])
  })

const intStepSpace = () =>
  SearchSpace.unsafeMake({
    width: SearchSpace.int(16, 64, { step: 16 })
  })

const floatNoStepSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(1e-4, 1e-1)
  })

const mixedSpace = () =>
  SearchSpace.unsafeMake({
    optimizer: SearchSpace.categorical(["adam", "sgd"]),
    width: SearchSpace.int(16, 64, { step: 16 })
  })

const exhaustiveSpace = () =>
  SearchSpace.unsafeMake({
    alpha: SearchSpace.categorical(["a", "b", "c"]),
    beta: SearchSpace.categorical(["x", "y", "z", "w"]),
    useBatchNorm: SearchSpace.boolean()
  })

const collectSuggestions = (space: SearchSpace.SearchSpace, count: number) => {
  const sampler = Sampler.grid()

  return Effect.forEach(
    Arr.makeBy(count, (index) => index),
    (trialNumber) => Sampler.suggest(sampler, space, SuggestContext.empty(trialNumber))
  )
}

const configKey = (config: { readonly alpha: string; readonly beta: string; readonly useBatchNorm: boolean }): string =>
  `${config.alpha}|${config.beta}|${config.useBatchNorm}`

const choicesFor = (
  space: SearchSpace.SearchSpace,
  name: string
): ReadonlyArray<PrimitiveChoice> =>
  Arr.findFirst(space.params, (parameter) => parameter.name === name).pipe(
    Option.flatMap((parameter) =>
      Match.value(parameter.distribution).pipe(
        Match.when({ type: "categorical" }, ({ choices }) => Option.some(choices)),
        Match.orElse(() => Option.none())
      )
    ),
    Option.getOrElse((): ReadonlyArray<PrimitiveChoice> => [])
  )

describe("Sampler.grid", () => {
  it.effect("validates finite-space compatibility for categorical, stepped-int, and mixed spaces", () =>
    Effect.gen(function*() {
      const categoricalSpace = categoricalOnlySpace()
      const intSpace = intStepSpace()
      const mixedFiniteSpace = mixedSpace()
      const categoricalCandidate = yield* Sampler.suggest(Sampler.grid(), categoricalSpace, SuggestContext.empty(0))
      const intCandidate = yield* Sampler.suggest(Sampler.grid(), intSpace, SuggestContext.empty(0))
      const mixedCandidate = yield* Sampler.suggest(Sampler.grid(), mixedFiniteSpace, SuggestContext.empty(0))

      expect(Either.isRight(Schema.decodeUnknownEither(categoricalSpace.schema)(categoricalCandidate))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(intSpace.schema)(intCandidate))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(mixedFiniteSpace.schema)(mixedCandidate))).toBe(true)

      const incompatible = yield* Effect.either(
        Sampler.suggest(Sampler.grid(), floatNoStepSpace(), SuggestContext.empty(0))
      )

      expect(Either.isLeft(incompatible)).toBe(true)

      if (Either.isLeft(incompatible)) {
        expect(incompatible.left).toBeInstanceOf(GridIncompatible)
      }
    }))

  it.effect("enumerates deterministic 3×4×2 cartesian order with no duplicates", () =>
    Effect.gen(function*() {
      const space = exhaustiveSpace()
      const decode = Schema.decodeUnknownSync(space.schema)
      const candidates = yield* collectSuggestions(space, 24)
      const decoded = Arr.map(candidates, (candidate) => decode(candidate))
      const observedKeys = Arr.map(decoded, configKey)
      const alphaChoices = Arr.map(choicesFor(space, "alpha"), (choice) => String(choice))
      const betaChoices = Arr.map(choicesFor(space, "beta"), (choice) => String(choice))
      const batchNormChoices = Arr.map(choicesFor(space, "useBatchNorm"), (choice) => choice === true)

      const expectedKeys = Arr.flatMap(alphaChoices, (alpha) =>
        Arr.flatMap(betaChoices, (beta) =>
          Arr.map(batchNormChoices, (useBatchNorm) =>
            configKey({ alpha, beta, useBatchNorm }))))

      expect(candidates).toHaveLength(24)
      expect(observedKeys).toEqual(expectedKeys)
      expect(Arr.dedupe(observedKeys)).toHaveLength(24)
    }))

  it.effect("does not recycle configurations after the finite grid is exhausted", () =>
    Effect.gen(function*() {
      const exhaustedSuggestion = yield* Effect.either(
        Sampler.suggest(Sampler.grid(), exhaustiveSpace(), SuggestContext.empty(24))
      )

      expect(Either.isLeft(exhaustedSuggestion)).toBe(true)
    }))
})
