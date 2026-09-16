import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Objective from "../../src/Objective.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import {
  AdvancedCmaEsFixture,
  AdvancedGpBoFixture,
  FixtureRegistryLive,
  loadFixture
} from "../helpers/fixtures/index.js"

type CmaPayload = AdvancedCmaEsFixture["payload"]
type GpPayload = AdvancedGpBoFixture["payload"]

const makeSpace = (
  space: CmaPayload["space"] | GpPayload["space"]
) =>
  SearchSpace.make({
    x: SearchSpace.float(space.x.low, space.x.high),
    y: SearchSpace.float(space.y.low, space.y.high)
  })

const makeContext = (
  context: CmaPayload["context"] | GpPayload["context"]
) =>
  new Sampler.Context({
    completed: context.completed.map((entry) => Sampler.observation(entry.trialNumber, entry.config, entry.value)),
    pending: [],
    objectiveSpec: Objective.single("minimize"),
    nextTrialNumber: context.nextTrialNumber,
    epsilon: 0
  })

describe("advanced samplers fixture parity", () => {
  it.effect("matches deterministic fixture trace for cma-es", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.cmaes-parity")
      const fixture = yield* Schema.decodeUnknown(AdvancedCmaEsFixture)(loaded)
      const space = yield* makeSpace(fixture.payload.space)
      const context = makeContext(fixture.payload.context)
      const cmaSampler = Sampler.cmaEs(fixture.payload.sampler)
      const cmaCandidate = yield* Sampler.suggest(cmaSampler, space, context)

      expect(cmaCandidate).toEqual(fixture.payload.expected)
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("matches deterministic fixture trace for gp-bo", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("advanced-samplers.gpbo-parity")
      const fixture = yield* Schema.decodeUnknown(AdvancedGpBoFixture)(loaded)
      const space = yield* makeSpace(fixture.payload.space)
      const context = makeContext(fixture.payload.context)
      const gpSampler = Sampler.gpBo(fixture.payload.sampler)
      const candidate = yield* Sampler.suggest(gpSampler, space, context)

      expect(candidate).toEqual(fixture.payload.expected)
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
