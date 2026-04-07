import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { acosWithPolicies, atan2WithPolicies, hypotWithPolicies } from "../../src/Numeric/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(7),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const strictScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(7),
  precision: "strict",
  backend: "scalar",
  diagnostics: "enabled"
})

const strictScalarSilentLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(7),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(7),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Numeric scalar runtime boundary contracts", () => {
  it.effect("honors strict-versus-relaxed precision on out-of-domain scalar policies", () =>
    Effect.gen(function*() {
      const strictError = yield* Effect.flip(acosWithPolicies(2).pipe(Effect.provide(strictTypedArrayLayer)))
      const relaxedResult = yield* acosWithPolicies(2).pipe(Effect.provide(relaxedScalarLayer))

      expect(strictError._tag).toStrictEqual("NumericDomainViolationError")
      expect(strictError.operation).toStrictEqual("acosWithPolicies")
      expect(Number.isNaN(relaxedResult)).toStrictEqual(true)
    }))

  it.effect("accepts the shared backend policy matrix without a Numeric-local fork", () =>
    Effect.gen(function*() {
      const typedArrayResult = yield* atan2WithPolicies(1, -1).pipe(Effect.provide(strictTypedArrayLayer))
      const scalarResult = yield* atan2WithPolicies(1, -1).pipe(Effect.provide(strictScalarLayer))

      expect(typedArrayResult).toBeCloseTo((3 * Math.PI) / 4, 12)
      expect(scalarResult).toBeCloseTo((3 * Math.PI) / 4, 12)
    }))

  it.effect("keeps diagnostics policy orthogonal to scalar results", () =>
    Effect.gen(function*() {
      const verbose = yield* hypotWithPolicies(3, 4).pipe(Effect.provide(strictScalarLayer))
      const silent = yield* hypotWithPolicies(3, 4).pipe(Effect.provide(strictScalarSilentLayer))

      expect(verbose).toStrictEqual(5)
      expect(silent).toStrictEqual(5)
    }))
})
