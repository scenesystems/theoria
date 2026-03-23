import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as EffectNumber, Schema } from "effect"

import { Seed } from "../../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../../src/contracts/shared/RuntimePolicies.js"
import { sumWithPolicies } from "../../../src/Numeric/operations.js"

const seed = Schema.decodeUnknownSync(Seed)(42)

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "typed-array",
  diagnostics: "disabled"
})

const strictScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const relaxedTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "typed-array",
  diagnostics: "disabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed,
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("backend × precision policy matrix", () => {
  it.effect("all 4 cells produce equivalent results for finite inputs (small array)", () =>
    Effect.gen(function*() {
      const values = [0.1, 0.2, 0.3, 0.4, 0.5]

      const strictTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedTypedArrayLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(EffectNumber.Equivalence(strictTypedArray, strictScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedTypedArray)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("all 4 cells produce equivalent results for finite inputs (larger array)", () =>
    Effect.gen(function*() {
      const values = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.0]

      const strictTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      const strictScalar = yield* sumWithPolicies(values).pipe(Effect.provide(strictScalarLayer))
      const relaxedTypedArray = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedTypedArrayLayer))
      const relaxedScalar = yield* sumWithPolicies(values).pipe(Effect.provide(relaxedScalarLayer))

      expect(EffectNumber.Equivalence(strictTypedArray, strictScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedTypedArray)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictTypedArray, relaxedScalar)).toStrictEqual(true)
      expect(EffectNumber.Equivalence(strictScalar, relaxedScalar)).toStrictEqual(true)
    }))

  it.effect("strict + typed-array rejects NaN while relaxed does not", () =>
    Effect.gen(function*() {
      const valuesWithNaN = [1.0, NaN, 3.0]

      const strictError = yield* Effect.flip(
        sumWithPolicies(valuesWithNaN).pipe(Effect.provide(strictTypedArrayLayer))
      )
      expect(strictError._tag).toStrictEqual("NumericDomainViolationError")
      expect(strictError.operation).toStrictEqual("sumWithPolicies")

      const relaxedResult = yield* sumWithPolicies(valuesWithNaN).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))
})
