import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Schema } from "effect"

import * as Objective from "../../src/Objective.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import {
  AdvancedCmaEsFixture,
  AdvancedGpBoFixture,
  FixtureRegistryLive,
  loadFixture
} from "../helpers/fixtures/index.js"

type CmaPayload = AdvancedCmaEsFixture["payload"]
const makeSpace = (
  space: CmaPayload["space"]
) =>
  SearchSpace.make({
    x: SearchSpace.float(space.x.low, space.x.high),
    y: SearchSpace.float(space.y.low, space.y.high)
  })

const makeContext = (
  context: CmaPayload["context"],
  nextTrialNumber = context.nextTrialNumber
) =>
  new Sampler.Context({
    completed: Arr.map(context.completed, (entry) => Sampler.observation(entry.trialNumber, entry.config, entry.value)),
    pending: Arr.empty(),
    objectiveSpec: Objective.single("minimize"),
    nextTrialNumber,
    epsilon: 0
  })

const trialNumbers = (start: number, count: number) => Arr.makeBy(count, (index) => Num.sum(start, index))

const suggestions = (
  sampler: Sampler.Sampler,
  space: SearchSpace.SearchSpace,
  context: CmaPayload["context"],
  trials: ReadonlyArray<number>
) => Effect.forEach(trials, (trialNumber) => Sampler.suggest(sampler, space, makeContext(context, trialNumber)))

const expectValidVariedSequence = (
  space: SearchSpace.SearchSpace,
  sequence: ReadonlyArray<unknown>,
  count: number
) =>
  Effect.gen(function*() {
    const decode = Schema.decodeUnknownEffect(space.schema)
    const decoded = yield* Effect.forEach(sequence, (candidate) => decode(candidate))

    expect(decoded).toHaveLength(count)
    expect(decoded).not.toEqual(Arr.makeBy(count, () => decoded[0]))
  })

describe("advanced samplers v4 reproducibility", () => {
  it.effect("replays valid CMA-ES sequences and resumes from a checkpoint", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.cmaes-parity")
      const fixture = yield* Schema.decodeUnknownEffect(AdvancedCmaEsFixture)(loaded)
      const space = yield* makeSpace(fixture.payload.space)
      const trials = trialNumbers(fixture.payload.context.nextTrialNumber, 6)
      const first = yield* suggestions(
        Sampler.cmaEs(fixture.payload.sampler),
        space,
        fixture.payload.context,
        trials
      )
      const replay = yield* suggestions(
        Sampler.cmaEs(fixture.payload.sampler),
        space,
        fixture.payload.context,
        trials
      )
      const otherSeed = yield* suggestions(
        Sampler.cmaEs({ ...fixture.payload.sampler, seed: Num.increment(fixture.payload.sampler.seed) }),
        space,
        fixture.payload.context,
        trials
      )

      expect(first).toEqual(replay)
      expect(first).not.toEqual(otherSeed)
      yield* expectValidVariedSequence(space, first, 6)

      const uninterrupted = Sampler.cmaEs(fixture.payload.sampler)
      yield* suggestions(uninterrupted, space, fixture.payload.context, Arr.take(trials, 3))
      const checkpointJson = yield* Schema.encodeEffect(Schema.fromJsonString(Sampler.Checkpoint))(
        yield* Sampler.checkpoint(uninterrupted)
      )
      const checkpoint = yield* Schema.decodeEffect(Schema.fromJsonString(Sampler.Checkpoint))(checkpointJson)
      const resumed = Sampler.cmaEs(fixture.payload.sampler)
      yield* Sampler.restore(resumed, checkpoint)
      const incompatible = Sampler.cmaEs({
        ...fixture.payload.sampler,
        seed: Num.increment(fixture.payload.sampler.seed)
      })
      const mismatch = yield* Sampler.restore(incompatible, checkpoint).pipe(Effect.flip)
      expect(mismatch).toBeInstanceOf(InvalidOptimizationConfig)
      const continuationTrials = Arr.drop(trials, 3)
      const expectedContinuation = yield* suggestions(
        uninterrupted,
        space,
        fixture.payload.context,
        continuationTrials
      )
      const resumedContinuation = yield* suggestions(resumed, space, fixture.payload.context, continuationTrials)

      expect(resumedContinuation).toEqual(expectedContinuation)
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("replays valid GP-BO sequences and resumes from a checkpoint", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.gpbo-parity")
      const fixture = yield* Schema.decodeUnknownEffect(AdvancedGpBoFixture)(loaded)
      const space = yield* makeSpace(fixture.payload.space)
      const trials = trialNumbers(fixture.payload.context.nextTrialNumber, 5)
      const first = yield* suggestions(Sampler.gpBo(fixture.payload.sampler), space, fixture.payload.context, trials)
      const replay = yield* suggestions(Sampler.gpBo(fixture.payload.sampler), space, fixture.payload.context, trials)
      const otherSeed = yield* suggestions(
        Sampler.gpBo({ ...fixture.payload.sampler, seed: Num.increment(fixture.payload.sampler.seed) }),
        space,
        fixture.payload.context,
        trials
      )

      expect(first).toEqual(replay)
      expect(first).not.toEqual(otherSeed)
      yield* expectValidVariedSequence(space, first, 5)

      const uninterrupted = Sampler.gpBo(fixture.payload.sampler)
      yield* suggestions(uninterrupted, space, fixture.payload.context, Arr.take(trials, 2))
      const checkpointJson = yield* Schema.encodeEffect(Schema.fromJsonString(Sampler.Checkpoint))(
        yield* Sampler.checkpoint(uninterrupted)
      )
      const checkpoint = yield* Schema.decodeEffect(Schema.fromJsonString(Sampler.Checkpoint))(checkpointJson)
      const resumed = Sampler.gpBo(fixture.payload.sampler)
      yield* Sampler.restore(resumed, checkpoint)
      const incompatible = Sampler.gpBo({
        ...fixture.payload.sampler,
        seed: Num.increment(fixture.payload.sampler.seed)
      })
      const mismatch = yield* Sampler.restore(incompatible, checkpoint).pipe(Effect.flip)
      expect(mismatch).toBeInstanceOf(InvalidOptimizationConfig)
      const continuationTrials = Arr.drop(trials, 2)
      const expectedContinuation = yield* suggestions(
        uninterrupted,
        space,
        fixture.payload.context,
        continuationTrials
      )
      const resumedContinuation = yield* suggestions(resumed, space, fixture.payload.context, continuationTrials)

      expect(resumedContinuation).toEqual(expectedContinuation)
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
