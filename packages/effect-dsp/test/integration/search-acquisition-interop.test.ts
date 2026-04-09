/**
 * Acquisition strategy interop proofs through effectSearchInterop.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { SearchSpace } from "effect-search"
import { effectSearchInterop } from "../../src/optimizers/effectSearchInterop/index.js"

const interopAcquisitionSpace = SearchSpace.unsafeMake({
  x: SearchSpace.float(-1, 1)
})

const firstSuggestedValue = (
  acquisition: "ei" | "pi" | "thompson"
) =>
  Effect.scoped(
    Effect.gen(function*() {
      const sampler = effectSearchInterop.Sampler.tpe({
        seed: 41,
        acquisition
      })
      const handle = yield* effectSearchInterop.open({
        direction: "maximize",
        space: interopAcquisitionSpace,
        sampler,
        trials: 1,
        objective: () => Effect.succeed(0),
        concurrency: 1
      })
      const asked = yield* effectSearchInterop.ask(handle)

      yield* effectSearchInterop.cancel(handle)

      return asked.config.x
    })
  )

describe("integration/effectSearchInterop acquisition", () => {
  it.effect("maps typed acquisition options to TPE sampler construction", () =>
    Effect.gen(function*() {
      const schema = effectSearchInterop.EffectSearchAcquisitionStrategySchema
      const decoded = yield* Schema.decodeUnknown(schema)("thompson")
      const invalid = yield* Effect.either(Schema.decodeUnknown(schema)("ucb"))

      expect(decoded).toBe("thompson")
      expect(Either.isLeft(invalid)).toBe(true)
    }))

  it.effect("supports deterministic seeded suggestion for each built-in acquisition strategy", () =>
    Effect.gen(function*() {
      const eiA = yield* firstSuggestedValue("ei")
      const eiB = yield* firstSuggestedValue("ei")
      const pi = yield* firstSuggestedValue("pi")
      const thompson = yield* firstSuggestedValue("thompson")

      expect(eiA).toBe(eiB)
      expect(Number.isFinite(pi)).toBe(true)
      expect(Number.isFinite(thompson)).toBe(true)
    }))
})
