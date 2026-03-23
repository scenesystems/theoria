import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  AbsoluteTolerance,
  Axis,
  Dimension,
  IterationBudget,
  RelativeTolerance,
  Seed
} from "../../src/contracts/shared/BrandedScalars.js"
import {
  BackendPolicyService,
  DiagnosticsPolicyService,
  makeDeterministicRuntimePoliciesLayer,
  PrecisionPolicyService,
  RngPolicyService
} from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"
import { decodeNumericDomain, encodeNumericDomain, NumericDomainSchema } from "../../src/Numeric/schema.js"

/**
 * Target-state red tests for foundation requirements.
 *
 * These tests are intentionally written against APIs that SHOULD exist:
 * - Branded numeric identities with decode/encode boundary helpers
 * - Runtime service seams with deterministic layers and typed boundary errors
 *
 * They are expected to fail until those APIs are implemented.
 */
describe("target-state foundation contracts", () => {
  it("branded scalar contracts enforce nominal numeric semantics", () => {
    expect(Schema.decodeUnknownEither(Dimension)(3)).toMatchObject({ _tag: "Right", right: 3 })
    expect(Schema.decodeUnknownEither(Axis)(0)).toMatchObject({ _tag: "Right", right: 0 })
    expect(Schema.decodeUnknownEither(AbsoluteTolerance)(1e-9)).toMatchObject({ _tag: "Right", right: 1e-9 })
    expect(Schema.decodeUnknownEither(RelativeTolerance)(1e-6)).toMatchObject({ _tag: "Right", right: 1e-6 })
    expect(Schema.decodeUnknownEither(Seed)(42)).toMatchObject({ _tag: "Right", right: 42 })
    expect(Schema.decodeUnknownEither(IterationBudget)(1000)).toMatchObject({ _tag: "Right", right: 1000 })
    expect(Schema.decodeUnknownEither(Dimension)(0)).toMatchObject({ _tag: "Left" })
    expect(Schema.decodeUnknownEither(Axis)(-1)).toMatchObject({ _tag: "Left" })
    expect(Schema.decodeUnknownEither(AbsoluteTolerance)(-1e-9)).toMatchObject({ _tag: "Left" })
    expect(Schema.decodeUnknownEither(RelativeTolerance)(0)).toMatchObject({ _tag: "Left" })
  })

  it.effect("Numeric boundary exposes decode/encode roundtrip helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeNumericDomain({
        domain: "Numeric",
        stability: "stable"
      })
      expect(decoded).toEqual({ domain: "Numeric", stability: "stable" })

      const encoded = yield* encodeNumericDomain(decoded)
      expect(encoded).toEqual(decoded)
      expect(Schema.decodeUnknownEither(NumericDomainSchema)(encoded)).toMatchObject({
        _tag: "Right",
        right: encoded
      })

      const invalidDecode = yield* Effect.either(
        decodeNumericDomain({
          domain: "Numeric",
          stability: "invalid"
        })
      )
      expect(invalidDecode).toMatchObject({
        _tag: "Left",
        left: {
          _tag: "BoundaryDecodeError",
          domain: "Numeric"
        }
      })
    }))

  it.effect("runtime policy services compose with typed numeric boundary validation", () =>
    Effect.gen(function*() {
      const rng = yield* RngPolicyService
      const precision = yield* PrecisionPolicyService
      const backend = yield* BackendPolicyService
      const diagnostics = yield* DiagnosticsPolicyService

      const valid = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3],
        tolerance: 1e-9,
        budget: 64
      })

      const invalid = yield* validateNumericBoundary({
        values: [0.1, Number.NaN],
        tolerance: 1e-9,
        budget: 64
      })

      expect(rng).toMatchObject({ policy: "deterministic", seed: 42 })
      expect(precision).toMatchObject({ policy: "strict" })
      expect(backend).toMatchObject({ policy: "typed-array" })
      expect(diagnostics).toMatchObject({ policy: "enabled" })
      expect(valid).toMatchObject({ ok: true })
      expect(invalid).toMatchObject({ ok: false })
    }).pipe(
      Effect.provide(
        makeDeterministicRuntimePoliciesLayer({
          seed: 42,
          precision: "strict",
          backend: "typed-array",
          diagnostics: "enabled"
        })
      )
    ))
})
