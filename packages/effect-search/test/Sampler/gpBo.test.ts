import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Option, Schema, Tuple } from "effect"

import { Name } from "../../src/Acquisition.js"
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
  learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
  dropout: SearchSpace.float(0, 0.6)
})

const acquisitionNames = Schema.decodeSync(Schema.Array(Name))(Schema.Literal("ei", "pi", "thompson").literals)

const categoricalSpace = SearchSpace.make({
  optimizer: SearchSpace.categorical(Arr.make("adam", "sgd")),
  learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
})

const completedContext = (nextTrialNumber: number) =>
  new Context({
    completed: Arr.make(
      observation(0, { learningRate: 0.01, dropout: 0.2 }, 1.4),
      observation(1, { learningRate: 0.02, dropout: 0.1 }, 0.8),
      observation(2, { learningRate: 0.005, dropout: 0.3 }, 1.1)
    ),
    pending: Arr.empty(),
    objectiveSpec: Objective.single("minimize"),
    nextTrialNumber,
    epsilon: 0
  })

const multiContext = (nextTrialNumber: number) =>
  new Context({
    completed: Arr.make(
      observation(0, { learningRate: 0.01, dropout: 0.2 }, Arr.make(1.4, 0.8)),
      observation(1, { learningRate: 0.02, dropout: 0.1 }, Arr.make(0.8, 1.2))
    ),
    pending: Arr.empty(),
    objectiveSpec: Objective.multi(Tuple.make(Direction.minimize, Direction.minimize)),
    nextTrialNumber,
    epsilon: 0
  })

describe("Sampler.gpBo", () => {
  it.effect("produces deterministic suggestions for the same seed", () =>
    Effect.gen(function*() {
      const space = yield* continuousSpace
      const leftSampler = Sampler.gpBo({ seed: 44, nStartupTrials: 2, nCandidates: 20 })
      const rightSampler = Sampler.gpBo({ seed: 44, nStartupTrials: 2, nCandidates: 20 })
      const left = yield* Sampler.suggest(leftSampler, space, completedContext(3))
      const right = yield* Sampler.suggest(rightSampler, space, completedContext(3))

      expect(left).toEqual(right)
    }))

  it.effect("keeps acquisition strategy compatibility across EI/PI/Thompson options", () =>
    Effect.gen(function*() {
      const space = yield* continuousSpace
      const decode = Schema.decodeUnknownEither(space.schema)
      const outcomes = yield* Effect.forEach(acquisitionNames, (acquisition) =>
        Sampler.suggest(
          Sampler.gpBo({ seed: 22, nStartupTrials: 2, nCandidates: 24, acquisition }),
          space,
          completedContext(3)
        ))

      Arr.forEach(outcomes, (candidate) => {
        const decoded = decode(candidate)
        expect(Either.isRight(decoded)).toBe(true)
      })
    }))

  it.effect("rejects search spaces containing unsupported dimensions with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.gpBo({ seed: 3 }), yield* categoricalSpace, emptyContext(0))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      Either.mapLeft(outcome, (failure) => expect(failure).toBeInstanceOf(SamplerSearchSpaceUnsupported))
    }))

  it.effect("rejects multi-objective suggestion contexts with typed sampler errors", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Sampler.suggest(Sampler.gpBo({ seed: 3 }), yield* continuousSpace, multiContext(2))
      )

      expect(Either.isLeft(outcome)).toBe(true)

      Either.mapLeft(outcome, (failure) => expect(failure).toBeInstanceOf(SamplerObjectiveUnsupported))
    }))

  it.effect("fails checkpoint restore when persisted checkpoint mismatches runtime sampler parameters", () =>
    Effect.gen(function*() {
      const sampler = Sampler.gpBo({ seed: 5, nStartupTrials: 4, nCandidates: 32, lengthScale: 0.2, noise: 0.01 })
      const checkpoint = yield* Sampler.checkpoint(sampler)
      const corruptCheckpoint = Match.value(checkpoint).pipe(
        Match.tag("GpBo", ({ seed, nStartupTrials, nCandidates, lengthScale, noise }): Sampler.Checkpoint => ({
          _tag: "GpBo",
          seed,
          nStartupTrials,
          nCandidates: Num.increment(nCandidates),
          lengthScale,
          noise
        })),
        Match.orElse((value): Sampler.Checkpoint => value)
      )
      const outcome = yield* Effect.either(Sampler.restore(sampler, corruptCheckpoint))

      expect(Either.isLeft(outcome)).toBe(true)

      Either.mapLeft(outcome, (failure) => expect(failure).toBeInstanceOf(InvalidOptimizationConfig))
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
      const outcome = yield* Effect.either(Sampler.restore(resumedWithDrift, checkpoint))

      expect(Either.isLeft(outcome)).toBe(true)

      Either.mapLeft(outcome, (failure) => expect(failure).toBeInstanceOf(InvalidOptimizationConfig))
    }))

  it.effect("produces schema-decodable suggestions within declared bounds", () =>
    Effect.gen(function*() {
      const space = yield* continuousSpace
      const decode = Schema.decodeUnknownEither(space.schema)
      const candidate = yield* Sampler.suggest(
        Sampler.gpBo({ seed: 7, nStartupTrials: 0, nCandidates: 32 }),
        space,
        completedContext(3)
      )
      const decoded = decode(candidate)

      expect(Either.isRight(decoded)).toBe(true)

      Either.map(decoded, (config) => expect(Option.isSome(Option.fromNullable(config.learningRate))).toBe(true))
    }))
})
