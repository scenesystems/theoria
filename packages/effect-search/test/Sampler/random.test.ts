import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

import { emptyContext } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import { makeLogLearningRateSpace, makeRandomTrainingSpace } from "../fixtures/scenarios/randomTraining.js"

const drawConfigs = (seed: number, count: number) => {
  const sampler = Sampler.random({ seed })
  const draws = Arr.makeBy(count, (index) => index)

  return Effect.gen(function*() {
    const space = yield* makeRandomTrainingSpace(64, 1e-3)
    return yield* Effect.forEach(
      draws,
      (trialNumber) => Sampler.suggest(sampler, space, emptyContext(trialNumber))
    )
  })
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
      const space = yield* makeRandomTrainingSpace(64, 1e-3)
      const decode = Schema.decodeUnknownEither(space.schema)

      Arr.forEach(candidates, (candidate) => {
        const decoded = decode(candidate)
        expect(Either.isRight(decoded)).toBe(true)
        Either.map(decoded, (config) => {
          expect(config.lr).toBeGreaterThanOrEqual(1e-3)
          expect(config.lr).toBeLessThanOrEqual(1e-1)
          expect(Arr.make("adam", "sgd", "adamw")).toContain(config.optimizer)
          expect(Arr.make(16, 32, 48, 64)).toContain(config.batchSize)
        })
      })
    }))

  it.effect("supports log-scale float sampling", () =>
    Effect.gen(function*() {
      const sampler = Sampler.random({ seed: 9 })
      const space = yield* makeLogLearningRateSpace()
      const decode = Schema.decodeUnknownEither(space.schema)

      const candidates = yield* Effect.forEach(
        Arr.makeBy(128, (index) => index),
        (trialNumber) => Sampler.suggest(sampler, space, emptyContext(trialNumber))
      )

      Arr.forEach(candidates, (candidate) => {
        const decoded = decode(candidate)

        expect(Either.isRight(decoded)).toBe(true)
        Either.map(decoded, (config) => {
          expect(config.lr).toBeGreaterThanOrEqual(1e-4)
          expect(config.lr).toBeLessThanOrEqual(1e-1)
        })
      })
    }))
})
