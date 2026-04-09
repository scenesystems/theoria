import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Option, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import {
  InvalidStudyConfig,
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported
} from "../../src/Errors/index.js"
import { emptySuggestContext, SuggestCompletedTrial, SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const continuousSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-4, 4),
    y: SearchSpace.float(-2, 2)
  })

const categoricalSpace = () =>
  SearchSpace.unsafeMake({
    optimizer: SearchSpace.categorical(["adam", "sgd"]),
    x: SearchSpace.float(-4, 4)
  })

const multiObjectiveContext = (nextTrialNumber: number) =>
  new SuggestContext({
    completed: [
      SuggestCompletedTrial.fromObservation(0, { x: 0, y: 0 }, [1, 2]),
      SuggestCompletedTrial.fromObservation(1, { x: 1, y: 1 }, [0.5, 1.5])
    ],
    pending: [],
    objectiveSpec: Contracts.multiObjectiveSpec(["minimize", "minimize"]),
    nextTrialNumber,
    epsilon: 0
  })

const drawSequence = (seed: number, count: number) => {
  const sampler = Sampler.cmaEs({ seed, sigma: 0.6, populationSize: 8 })
  const space = continuousSpace()

  return Effect.forEach(
    Arr.makeBy(count, (index) => index),
    (trialNumber) => Sampler.suggest(sampler, space, emptySuggestContext(trialNumber))
  )
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
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.cmaEs({ seed: 11 }), categoricalSpace(), emptySuggestContext(0))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(SamplerSearchSpaceUnsupported)
      }
    }))

  it.effect("rejects multi-objective suggestion contexts with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.cmaEs({ seed: 17 }), continuousSpace(), multiObjectiveContext(2))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(SamplerObjectiveUnsupported)
      }
    }))

  it.effect("fails checkpoint restore when persisted checkpoint mismatches runtime sampler parameters", () =>
    Effect.gen(function*() {
      const sampler = Sampler.cmaEs({ seed: 5, sigma: 0.7, populationSize: 10 })
      const checkpoint = yield* Sampler.checkpoint(sampler)
      const corruptCheckpoint = Match.value(checkpoint).pipe(
        Match.tag("CmaEs", ({ seed, sigma, populationSize }): Sampler.SamplerCheckpoint => ({
          _tag: "CmaEs",
          seed: seed + 1,
          sigma,
          populationSize
        })),
        Match.orElse((value): Sampler.SamplerCheckpoint => value)
      )

      const outcome = yield* Effect.either(Sampler.restoreCheckpoint(sampler, corruptCheckpoint))
      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      }
    }))

  it.effect("produces schema-decodable suggestions within declared bounds", () =>
    Effect.gen(function*() {
      const space = continuousSpace()
      const decode = Schema.decodeUnknownEither(space.schema)
      const candidate = yield* Sampler.suggest(
        Sampler.cmaEs({ seed: 13, sigma: 0.4, populationSize: 6 }),
        space,
        emptySuggestContext(0)
      )
      const decoded = decode(candidate)

      expect(Either.isRight(decoded)).toBe(true)

      if (Either.isLeft(decoded)) {
        return
      }

      expect(decoded.right.x).toBeGreaterThanOrEqual(-4)
      expect(decoded.right.x).toBeLessThanOrEqual(4)
      expect(decoded.right.y).toBeGreaterThanOrEqual(-2)
      expect(decoded.right.y).toBeLessThanOrEqual(2)
    }))

  it.effect("tracks sampled improvements from completed history", () =>
    Effect.gen(function*() {
      const sampler = Sampler.cmaEs({ seed: 37, sigma: 0.5, populationSize: 8 })
      const space = continuousSpace()
      const completed = [
        SuggestCompletedTrial.fromObservation(0, { x: -2, y: -1 }, 12),
        SuggestCompletedTrial.fromObservation(1, { x: 1, y: 1 }, 2),
        SuggestCompletedTrial.fromObservation(2, { x: 0.8, y: 0.9 }, 1.8),
        SuggestCompletedTrial.fromObservation(3, { x: 2, y: 1.5 }, 6)
      ]
      const context = new SuggestContext({
        completed,
        pending: [],
        objectiveSpec: Contracts.singleObjectiveSpec("minimize"),
        nextTrialNumber: 4,
        epsilon: 0
      })

      const suggestion = yield* Sampler.suggest(sampler, space, context)
      const decoded = Schema.decodeUnknownEither(space.schema)(suggestion)

      expect(Either.isRight(decoded)).toBe(true)

      if (Either.isRight(decoded)) {
        expect(Option.isSome(Option.fromNullable(decoded.right.x))).toBe(true)
      }
    }))
})
