import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import fixturePayload from "../fixtures/advanced-samplers/single-objective-trace.json" with { type: "json" }

const AdvancedSamplerFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("advanced-samplers.single-objective-trace"),
  space: Schema.Struct({
    x: Schema.Struct({ low: Schema.Number, high: Schema.Number }),
    y: Schema.Struct({ low: Schema.Number, high: Schema.Number })
  }),
  context: Schema.Struct({
    nextTrialNumber: Schema.Number,
    completed: Schema.Array(
      Schema.Struct({
        trialNumber: Schema.Number,
        config: Schema.Struct({
          x: Schema.Number,
          y: Schema.Number
        }),
        value: Schema.Number
      })
    )
  }),
  expected: Schema.Struct({
    cmaEs: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    gpBo: Schema.Struct({ x: Schema.Number, y: Schema.Number })
  })
})

describe("advanced samplers fixture parity", () => {
  it.effect("matches deterministic fixture traces for cma-es and gp-bo", () =>
    Effect.gen(function*() {
      const fixture = Schema.decodeUnknownSync(AdvancedSamplerFixtureSchema)(fixturePayload)
      const space = SearchSpace.unsafeMake({
        x: SearchSpace.float(fixture.space.x.low, fixture.space.x.high),
        y: SearchSpace.float(fixture.space.y.low, fixture.space.y.high)
      })
      const context = new Sampler.SuggestContext({
        completed: fixture.context.completed.map((entry) =>
          Sampler.makeSuggestCompletedTrial(entry.trialNumber, entry.config, entry.value)
        ),
        pending: [],
        objectiveSpec: Contracts.singleObjectiveSpec("minimize"),
        nextTrialNumber: fixture.context.nextTrialNumber,
        epsilon: 0
      })
      const cmaSampler = Sampler.cmaEs({ seed: 23, sigma: 0.55, populationSize: 8 })
      const gpSampler = Sampler.gpBo({ seed: 23, nStartupTrials: 2, nCandidates: 16, acquisition: "ei" })
      const cmaCandidate = yield* Sampler.suggest(cmaSampler, space, context)
      const gpCandidate = yield* Sampler.suggest(gpSampler, space, context)

      expect(cmaCandidate).toEqual(fixture.expected.cmaEs)
      expect(gpCandidate).toEqual(fixture.expected.gpBo)
    }))
})
