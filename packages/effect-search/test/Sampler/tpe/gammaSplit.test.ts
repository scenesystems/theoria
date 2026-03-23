import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { defaultGamma, hyperoptGamma } from "../../../src/internal/tpe/gammaSplit.js"
import { FixtureRegistryLive, GammaFixtureSchema, loadFixture } from "../../helpers/fixtures.js"

describe("tpe gamma fixture parity", () => {
  it.effect("replays default and hyperopt gamma fixtures", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("gamma.default-gamma").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(GammaFixtureSchema)(loaded)

      fixture.payload.cases.forEach((entry) => {
        expect(defaultGamma(entry.nTrials)).toBe(entry.defaultGamma)
        expect(hyperoptGamma(entry.nTrials)).toBe(entry.hyperoptGamma)
      })

      expect(defaultGamma(100_000)).toBe(fixture.payload.cap)
      expect(hyperoptGamma(1_000_000)).toBe(fixture.payload.cap)
    }))
})
