import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, FastCheck, Number } from "effect"

import { log } from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"
import { entropy, entropyValidated, entropyWithPolicies } from "../../src/Probability.js"

const strictLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Probability / entropy", () => {
  it.effect("computes entropy in nats without normalizing masses", () =>
    Effect.gen(function*() {
      expect(entropy(Chunk.make(0.5, 0.5))).toBeCloseTo(log(2))
      expect(entropy(Chunk.make(1, 1))).toBeCloseTo(0)
    }))

  it.effect.prop("is invariant under reordering", {
    first: FastCheck.double({ min: 0, max: 1, noNaN: true }),
    second: FastCheck.double({ min: 0, max: 1, noNaN: true })
  }, ({ first, second }) =>
    Effect.gen(function*() {
      expect(entropy(Chunk.make(first, second))).toBe(entropy(Chunk.make(second, first)))
    }))

  it.effect("validated entropy decodes array masses into a Chunk", () =>
    Effect.gen(function*() {
      const result = yield* entropyValidated({ probabilities: Array.make(0.25, 0.25, 0.25, 0.25) })
      expect(result).toBeCloseTo(log(4))
    }))

  it.effect("validated entropy rejects empty, negative, and excess input", () =>
    Effect.gen(function*() {
      const empty = yield* Effect.flip(entropyValidated({ probabilities: Array.empty<number>() }))
      const negative = yield* Effect.flip(entropyValidated({ probabilities: Array.make(-0.5, 1.5) }))
      const excess = yield* Effect.flip(
        entropyValidated({ probabilities: Array.make(0.5, 0.5), extra: true })
      )
      expect(empty._tag).toBe("ProbabilityDecodeError")
      expect(negative._tag).toBe("ProbabilityDecodeError")
      expect(excess._tag).toBe("ProbabilityDecodeError")
    }))

  it.effect("policy-aware entropy uses the configured policies", () =>
    Effect.gen(function*() {
      const result = yield* entropyWithPolicies(Chunk.make(0.25, 0.25, 0.25, 0.25))
      expect(result).toBeCloseTo(log(4))
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects a non-finite entropy result", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(entropyWithPolicies(Chunk.of(Number.unsafeDivide(1, 0))))
      expect(error._tag).toBe("ProbabilityDomainViolationError")
      expect(error.operation).toBe("entropyWithPolicies")
    }).pipe(Effect.provide(strictLayer)))
})
