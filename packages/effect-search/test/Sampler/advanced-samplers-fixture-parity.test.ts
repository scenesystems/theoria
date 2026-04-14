import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import {
  AdvancedCmaEsFixtureSchema,
  AdvancedGpBoFixtureSchema,
  FixtureRegistryLive,
  loadFixture
} from "../helpers/fixtures/index.js"

const makeSpace = (
  space: {
    readonly x: { readonly low: number; readonly high: number }
    readonly y: { readonly low: number; readonly high: number }
  }
) =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(space.x.low, space.x.high),
    y: SearchSpace.float(space.y.low, space.y.high)
  })

const makeContext = (
  context: {
    readonly nextTrialNumber: number
    readonly completed: ReadonlyArray<{
      readonly trialNumber: number
      readonly config: { readonly x: number; readonly y: number }
      readonly value: number
    }>
  }
) =>
  Sampler.SuggestContext.make({
    completed: context.completed.map((entry) =>
      Sampler.SuggestCompletedTrial.fromObservation(entry.trialNumber, entry.config, entry.value)
    ),
    pending: [],
    objectiveSpec: Contracts.singleObjectiveSpec("minimize"),
    nextTrialNumber: context.nextTrialNumber,
    epsilon: 0
  })

describe("advanced samplers fixture parity", () => {
  it.effect("matches deterministic fixture trace for cma-es", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.cmaes-parity")
      const fixture = yield* Schema.decodeUnknown(AdvancedCmaEsFixtureSchema)(loaded)
      const space = makeSpace(fixture.payload.space)
      const context = makeContext(fixture.payload.context)
      const cmaSampler = Sampler.cmaEs(fixture.payload.sampler)
      const cmaCandidate = yield* Sampler.suggest(cmaSampler, space, context)

      expect(cmaCandidate).toEqual(fixture.payload.expected)
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("matches deterministic fixture trace for gp-bo", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.gpbo-parity")
      const fixture = yield* Schema.decodeUnknown(AdvancedGpBoFixtureSchema)(loaded)
      const space = makeSpace(fixture.payload.space)
      const context = makeContext(fixture.payload.context)
      const gpSampler = Sampler.gpBo(fixture.payload.sampler)
      const candidate = yield* Sampler.suggest(gpSampler, space, context)

      expect(candidate).toEqual(fixture.payload.expected)
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
