import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Equal, Match, Option, Schema } from "effect"

import { emptyContext } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import { GridIncompatible } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const categoricalOnlySpace = SearchSpace.make({
  optimizer: SearchSpace.categorical(Arr.make("adam", "sgd", "adamw"))
})

const intStepSpace = SearchSpace.make({
  width: SearchSpace.int(16, 64, { step: 16 })
})

const floatNoStepSpace = SearchSpace.make({
  lr: SearchSpace.float(1e-4, 1e-1)
})

const mixedSpace = SearchSpace.make({
  optimizer: SearchSpace.categorical(Arr.make("adam", "sgd")),
  width: SearchSpace.int(16, 64, { step: 16 })
})

const exhaustiveSpace = SearchSpace.make({
  alpha: SearchSpace.categorical(Arr.make("a", "b", "c")),
  beta: SearchSpace.categorical(Arr.make("x", "y", "z", "w")),
  useBatchNorm: SearchSpace.boolean()
})

const collectSuggestions = (space: SearchSpace.SearchSpace, count: number) => {
  const sampler = Sampler.grid()

  return Effect.forEach(
    Arr.makeBy(count, (index) => index),
    (trialNumber) => Sampler.suggest(sampler, space, emptyContext(trialNumber))
  )
}

const configKey = (config: { readonly alpha: string; readonly beta: string; readonly useBatchNorm: boolean }): string =>
  `${config.alpha}|${config.beta}|${config.useBatchNorm}`

const choicesFor = (
  space: SearchSpace.SearchSpace,
  name: string
) =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name)).pipe(
    Option.flatMap((parameter) =>
      Match.value(parameter.distribution).pipe(
        Match.when({ type: "categorical" }, ({ choices }) => Option.some(choices)),
        Match.orElse(() => Option.none())
      )
    ),
    Option.getOrElse(() => Arr.empty())
  )

describe("Sampler.grid", () => {
  it.effect("validates finite-space compatibility for categorical, stepped-int, and mixed spaces", () =>
    Effect.gen(function*() {
      const categoricalSpace = yield* categoricalOnlySpace
      const intSpace = yield* intStepSpace
      const mixedFiniteSpace = yield* mixedSpace
      const categoricalCandidate = yield* Sampler.suggest(Sampler.grid(), categoricalSpace, emptyContext(0))
      const intCandidate = yield* Sampler.suggest(Sampler.grid(), intSpace, emptyContext(0))
      const mixedCandidate = yield* Sampler.suggest(Sampler.grid(), mixedFiniteSpace, emptyContext(0))

      expect(Either.isRight(Schema.decodeUnknownEither(categoricalSpace.schema)(categoricalCandidate))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(intSpace.schema)(intCandidate))).toBe(true)
      expect(Either.isRight(Schema.decodeUnknownEither(mixedFiniteSpace.schema)(mixedCandidate))).toBe(true)

      const incompatible = yield* Effect.either(
        Sampler.suggest(Sampler.grid(), yield* floatNoStepSpace, emptyContext(0))
      )

      expect(Either.isLeft(incompatible)).toBe(true)

      Either.mapLeft(incompatible, (failure) => expect(failure).toBeInstanceOf(GridIncompatible))
    }))

  it.effect("enumerates deterministic 3×4×2 cartesian order with no duplicates", () =>
    Effect.gen(function*() {
      const space = yield* exhaustiveSpace
      const candidates = yield* collectSuggestions(space, 24)
      const decoded = yield* Effect.forEach(candidates, (candidate) => Schema.decodeUnknown(space.schema)(candidate))
      const observedKeys = Arr.map(decoded, configKey)
      const alphaChoices = Arr.map(choicesFor(space, "alpha"), (choice) => String(choice))
      const betaChoices = Arr.map(choicesFor(space, "beta"), (choice) => String(choice))
      const batchNormChoices = Arr.map(choicesFor(space, "useBatchNorm"), (choice) => Equal.equals(choice, true))

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
        Sampler.suggest(Sampler.grid(), yield* exhaustiveSpace, emptyContext(24))
      )

      expect(Either.isLeft(exhaustedSuggestion)).toBe(true)
    }))
})
