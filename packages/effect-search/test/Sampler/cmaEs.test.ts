import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Result, Schema, Tuple } from "effect"

import * as Direction from "../../src/Direction.js"
import * as Objective from "../../src/Objective.js"
import { Context, emptyContext, observation } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import {
  InvalidOptimizationConfig,
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported
} from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const continuousSpace = SearchSpace.make({
  x: SearchSpace.float(Num.multiply(-1, 4), 4),
  y: SearchSpace.float(Num.multiply(-1, 2), 2)
})

const categoricalSpace = SearchSpace.make({
  optimizer: SearchSpace.categorical(Arr.make("adam", "sgd")),
  x: SearchSpace.float(Num.multiply(-1, 4), 4)
})

const multiContext = (nextTrialNumber: number) =>
  new Context({
    completed: Arr.make(
      observation(0, { x: 0, y: 0 }, Arr.make(1, 2)),
      observation(1, { x: 1, y: 1 }, Arr.make(0.5, 1.5))
    ),
    pending: Arr.empty(),
    objectiveSpec: Objective.multi(Tuple.make(Direction.minimize, Direction.minimize)),
    nextTrialNumber,
    epsilon: 0
  })

const drawSequence = (seed: number, count: number) => {
  const sampler = Sampler.cmaEs({ seed, sigma: 0.6, populationSize: 8 })
  return Effect.gen(function*() {
    const space = yield* continuousSpace
    return yield* Effect.forEach(
      Arr.makeBy(count, (index) => index),
      (trialNumber) => Sampler.suggest(sampler, space, emptyContext(trialNumber))
    )
  })
}

describe("Sampler.cmaEs", () => {
  it.effect("produces deterministic suggestions for the same seed", () =>
    Effect.gen(function*() {
      const left = yield* drawSequence(91, 10)
      const right = yield* drawSequence(91, 10)

      expect(left).toEqual(right)
    }))

  it.effect("rejects search spaces containing non-continuous dimensions with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.result(
        Sampler.suggest(Sampler.cmaEs({ seed: 11 }), yield* categoricalSpace, emptyContext(0))
      )

      expect(Result.isFailure(outcome)).toBe(true)

      Result.mapError(outcome, (failure) => expect(failure).toBeInstanceOf(SamplerSearchSpaceUnsupported))
    }))

  it.effect("rejects multi-objective suggestion contexts with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.result(
        Sampler.suggest(Sampler.cmaEs({ seed: 17 }), yield* continuousSpace, multiContext(2))
      )

      expect(Result.isFailure(outcome)).toBe(true)

      Result.mapError(outcome, (failure) => expect(failure).toBeInstanceOf(SamplerObjectiveUnsupported))
    }))

  it.effect("fails checkpoint restore when persisted checkpoint mismatches runtime sampler parameters", () =>
    Effect.gen(function*() {
      const sampler = Sampler.cmaEs({ seed: 5, sigma: 0.7, populationSize: 10 })
      const checkpoint = yield* Sampler.checkpoint(sampler)
      const corruptCheckpoint = Match.value(checkpoint).pipe(
        Match.tag("CmaEs", ({ seed, sigma, populationSize }): Sampler.Checkpoint => ({
          _tag: "CmaEs",
          seed: Num.increment(seed),
          sigma,
          populationSize
        })),
        Match.orElse((value): Sampler.Checkpoint => value)
      )

      const outcome = yield* Effect.result(Sampler.restore(sampler, corruptCheckpoint))
      expect(Result.isFailure(outcome)).toBe(true)

      Result.mapError(outcome, (failure) => expect(failure).toBeInstanceOf(InvalidOptimizationConfig))
    }))

  it.effect("produces schema-decodable suggestions within declared bounds", () =>
    Effect.gen(function*() {
      const space = yield* continuousSpace
      const decode = Schema.decodeUnknownResult(space.schema)
      const candidate = yield* Sampler.suggest(
        Sampler.cmaEs({ seed: 13, sigma: 0.4, populationSize: 6 }),
        space,
        emptyContext(0)
      )
      const decoded = decode(candidate)

      expect(Result.isSuccess(decoded)).toBe(true)

      Result.map(decoded, (config) => {
        expect(config.x).toBeGreaterThanOrEqual(Num.multiply(-1, 4))
        expect(config.x).toBeLessThanOrEqual(4)
        expect(config.y).toBeGreaterThanOrEqual(Num.multiply(-1, 2))
        expect(config.y).toBeLessThanOrEqual(2)
      })
    }))

  it.effect("tracks sampled improvements from completed history", () =>
    Effect.gen(function*() {
      const sampler = Sampler.cmaEs({ seed: 37, sigma: 0.5, populationSize: 8 })
      const space = yield* continuousSpace
      const completed = Arr.make(
        observation(0, { x: Num.multiply(-1, 2), y: Num.multiply(-1, 1) }, 12),
        observation(1, { x: 1, y: 1 }, 2),
        observation(2, { x: 0.8, y: 0.9 }, 1.8),
        observation(3, { x: 2, y: 1.5 }, 6)
      )
      const context = new Context({
        completed,
        pending: Arr.empty(),
        objectiveSpec: Objective.single("minimize"),
        nextTrialNumber: 4,
        epsilon: 0
      })

      const suggestion = yield* Sampler.suggest(sampler, space, context)
      const decoded = Schema.decodeUnknownResult(space.schema)(suggestion)

      expect(Result.isSuccess(decoded)).toBe(true)

      Result.map(decoded, (config) => expect(Option.isSome(Option.fromNullishOr(config.x))).toBe(true))
    }))
})
