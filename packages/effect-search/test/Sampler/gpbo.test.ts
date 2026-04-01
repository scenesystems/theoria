import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Match, Option, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import {
  InvalidStudyConfig,
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported
} from "../../src/Errors/index.js"
import { emptySuggestContext, makeSuggestCompletedTrial, SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const continuousSpace = () =>
  SearchSpace.unsafeMake({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0, 0.6)
  })

const categoricalSpace = () =>
  SearchSpace.unsafeMake({
    optimizer: SearchSpace.categorical(["adam", "sgd"]),
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
  })

const completedContext = (nextTrialNumber: number) =>
  new SuggestContext({
    completed: [
      makeSuggestCompletedTrial(0, { learningRate: 0.01, dropout: 0.2 }, 1.4),
      makeSuggestCompletedTrial(1, { learningRate: 0.02, dropout: 0.1 }, 0.8),
      makeSuggestCompletedTrial(2, { learningRate: 0.005, dropout: 0.3 }, 1.1)
    ],
    pending: [],
    objectiveSpec: Contracts.singleObjectiveSpec("minimize"),
    nextTrialNumber,
    epsilon: 0
  })

const multiObjectiveContext = (nextTrialNumber: number) =>
  new SuggestContext({
    completed: [
      makeSuggestCompletedTrial(0, { learningRate: 0.01, dropout: 0.2 }, [1.4, 0.8]),
      makeSuggestCompletedTrial(1, { learningRate: 0.02, dropout: 0.1 }, [0.8, 1.2])
    ],
    pending: [],
    objectiveSpec: Contracts.multiObjectiveSpec(["minimize", "minimize"]),
    nextTrialNumber,
    epsilon: 0
  })

describe("Sampler.gpBo", () => {
  it.effect("produces deterministic suggestions for the same seed", () =>
    Effect.gen(function*() {
      const space = continuousSpace()
      const leftSampler = Sampler.gpBo({ seed: 44, nStartupTrials: 2, nCandidates: 20 })
      const rightSampler = Sampler.gpBo({ seed: 44, nStartupTrials: 2, nCandidates: 20 })
      const left = yield* Sampler.suggest(leftSampler, space, completedContext(3))
      const right = yield* Sampler.suggest(rightSampler, space, completedContext(3))

      expect(left).toEqual(right)
    }))

  it.effect("keeps acquisition strategy compatibility across EI/PI/Thompson options", () =>
    Effect.gen(function*() {
      const space = continuousSpace()
      const decode = Schema.decodeUnknownEither(space.schema)
      const acquisitions: ReadonlyArray<Sampler.BuiltInAcquisitionName> = ["ei", "pi", "thompson"]

      const outcomes = yield* Effect.forEach(acquisitions, (acquisition) =>
        Sampler.suggest(
          Sampler.gpBo({ seed: 22, nStartupTrials: 2, nCandidates: 24, acquisition }),
          space,
          completedContext(3)
        ))

      outcomes.forEach((candidate) => {
        const decoded = decode(candidate)
        expect(Either.isRight(decoded)).toBe(true)
      })
    }))

  it.effect("rejects search spaces containing unsupported dimensions with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.gpBo({ seed: 3 }), categoricalSpace(), emptySuggestContext(0))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(SamplerSearchSpaceUnsupported)
      }
    }))

  it.effect("rejects multi-objective suggestion contexts with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.gpBo({ seed: 3 }), continuousSpace(), multiObjectiveContext(2))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(SamplerObjectiveUnsupported)
      }
    }))

  it.effect("fails checkpoint restore when persisted checkpoint mismatches runtime sampler parameters", () =>
    Effect.gen(function*() {
      const sampler = Sampler.gpBo({ seed: 5, nStartupTrials: 4, nCandidates: 32, lengthScale: 0.2, noise: 0.01 })
      const checkpoint = yield* Sampler.checkpoint(sampler)
      const corruptCheckpoint = Match.value(checkpoint).pipe(
        Match.tag("GpBo", ({ seed, nStartupTrials, nCandidates, lengthScale, noise }): Sampler.SamplerCheckpoint => ({
          _tag: "GpBo",
          seed,
          nStartupTrials,
          nCandidates: nCandidates + 1,
          lengthScale,
          noise
        })),
        Match.orElse((value): Sampler.SamplerCheckpoint => value)
      )
      const outcome = yield* Effect.either(Sampler.restoreCheckpoint(sampler, corruptCheckpoint))

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isLeft(outcome)) {
        expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      }
    }))

  it.effect("fails checkpoint restore when GP hyperparameters drift across resume", () =>
    Effect.gen(function*() {
      const checkpointSource = Sampler.gpBo({
        seed: 7,
        nStartupTrials: 2,
        nCandidates: 24,
        lengthScale: 0.15,
        noise: 0.005,
        acquisition: "ei"
      })
      const checkpoint = yield* Sampler.checkpoint(checkpointSource)
      const resumedWithDrift = Sampler.gpBo({
        seed: 7,
        nStartupTrials: 2,
        nCandidates: 24,
        lengthScale: 0.9,
        noise: 0.1,
        acquisition: "ei"
      })
      const outcome = yield* Effect.either(Sampler.restoreCheckpoint(resumedWithDrift, checkpoint))

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
        Sampler.gpBo({ seed: 7, nStartupTrials: 0, nCandidates: 32 }),
        space,
        completedContext(3)
      )
      const decoded = decode(candidate)

      expect(Either.isRight(decoded)).toBe(true)

      if (Either.isRight(decoded)) {
        expect(Option.isSome(Option.fromNullable(decoded.right.learningRate))).toBe(true)
      }
    }))
})
