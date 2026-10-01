import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Effect, Number, Schema } from "effect"

import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const seed = Policy.Seed.make(42)
const strictCompensated = Policy.layerDeterministic({
  seed,
  precision: "strict",
  backend: "compensated",
  diagnostics: "disabled"
})
const strictScalar = Policy.layerDeterministic({
  seed,
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})
const relaxedCompensated = Policy.layerDeterministic({
  seed,
  precision: "relaxed",
  backend: "compensated",
  diagnostics: "disabled"
})
const relaxedScalar = Policy.layerDeterministic({
  seed,
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})
const notANumber = Schema.decodeUnknownSync(Schema.NumberFromString)("NaN")

describe("backend and precision policy matrix", () => {
  it.effect("preserves finite sum results in every policy cell", () =>
    Effect.gen(function*() {
      const values = Array.make(0.1, 0.2, 0.3, 0.4, 0.5)
      const results = yield* Effect.all({
        strictCompensated: Numeric.sumWithPolicies(values).pipe(Effect.provide(strictCompensated)),
        strictScalar: Numeric.sumWithPolicies(values).pipe(Effect.provide(strictScalar)),
        relaxedCompensated: Numeric.sumWithPolicies(values).pipe(Effect.provide(relaxedCompensated)),
        relaxedScalar: Numeric.sumWithPolicies(values).pipe(Effect.provide(relaxedScalar))
      })

      expect(results.strictCompensated).toStrictEqual(1.5)
      expect(Number.Equivalence(results.strictCompensated, results.strictScalar)).toStrictEqual(true)
      expect(Number.Equivalence(results.strictCompensated, results.relaxedCompensated)).toStrictEqual(true)
      expect(Number.Equivalence(results.strictCompensated, results.relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("rejects NaN under strict precision and preserves it under relaxed precision", () =>
    Effect.gen(function*() {
      const values = Array.make(1, notANumber, 3)
      const error = yield* Effect.flip(Numeric.sumWithPolicies(values).pipe(Effect.provide(strictCompensated)))
      const result = yield* Numeric.sumWithPolicies(values).pipe(Effect.provide(relaxedScalar))

      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(Boolean.not(Schema.is(Schema.NonNaN)(result))).toStrictEqual(true)
    }))
})
