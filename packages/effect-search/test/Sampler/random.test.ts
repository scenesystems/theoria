import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

import { LogLearningRateSpace, RandomTrainingSpace } from "../../src/experimental/scenarios/randomTraining.js"
import { emptySuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"

const drawConfigs = (seed: number, count: number) => {
  const sampler = Sampler.random({ seed })
  const space = RandomTrainingSpace.make(64, 1e-3)
  const draws = Arr.makeBy(count, (index) => index)

  return Effect.forEach(draws, (trialNumber) => Sampler.suggest(sampler, space, emptySuggestContext(trialNumber)))
}

describe("Sampler.random", () => {
  it.effect("produces deterministic suggestions for the same seed", () =>
    Effect.gen(function*() {
      const left = yield* drawConfigs(42, 20)
      const right = yield* drawConfigs(42, 20)

      expect(left).toEqual(right)
    }))

  it.effect("produces different sequences for different seeds", () =>
    Effect.gen(function*() {
      const left = yield* drawConfigs(42, 20)
      const right = yield* drawConfigs(43, 20)

      expect(left).not.toEqual(right)
    }))

  it.effect("generates values within declared space bounds", () =>
    Effect.gen(function*() {
      const candidates = yield* drawConfigs(7, 200)
      const decode = Schema.decodeUnknownEither(RandomTrainingSpace.make(64, 1e-3).schema)

      candidates.forEach((candidate) => {
        const decoded = decode(candidate)
        expect(Either.isRight(decoded)).toBe(true)

        if (Either.isLeft(decoded)) {
          return
        }

        expect(decoded.right.lr).toBeGreaterThanOrEqual(1e-3)
        expect(decoded.right.lr).toBeLessThanOrEqual(1e-1)
        expect(["adam", "sgd", "adamw"]).toContain(decoded.right.optimizer)
        expect([16, 32, 48, 64]).toContain(decoded.right.batchSize)
        expect(typeof decoded.right.useBatchNorm).toBe("boolean")
      })
    }))

  it.effect("supports log-scale float sampling", () =>
    Effect.gen(function*() {
      const sampler = Sampler.random({ seed: 9 })
      const space = LogLearningRateSpace.make()
      const decode = Schema.decodeUnknownEither(space.schema)

      const candidates = yield* Effect.forEach(
        Arr.makeBy(128, (index) => index),
        (trialNumber) => Sampler.suggest(sampler, space, emptySuggestContext(trialNumber))
      )

      candidates.forEach((candidate) => {
        const decoded = decode(candidate)

        expect(Either.isRight(decoded)).toBe(true)

        if (Either.isLeft(decoded)) {
          return
        }

        expect(decoded.right.lr).toBeGreaterThanOrEqual(1e-4)
        expect(decoded.right.lr).toBeLessThanOrEqual(1e-1)
      })
    }))
})
