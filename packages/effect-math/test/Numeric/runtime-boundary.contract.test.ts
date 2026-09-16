import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Match, Number, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import {
  makeDeterministicRuntimePoliciesLayer,
  makeNondeterministicRuntimePoliciesLayer
} from "../../src/contracts/shared/RuntimePolicies.js"
import { NumericDomainBoundaryError } from "../../src/Numeric/errors.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

const deterministicLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(1337),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const nondeterministicLayer = makeNondeterministicRuntimePoliciesLayer({
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Numeric runtime boundary contracts", () => {
  it.effect("accepts canonical finite numeric boundary input", () =>
    Effect.gen(function*() {
      const result = yield* validateNumericBoundary({
        values: Array.make(0.1, 0.2, 0.3, 0.4),
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(deterministicLayer))

      expect(result.ok).toBe(true)
    }))

  it.effect("rejects invalid numeric boundary payloads with typed boundary errors", () =>
    Effect.gen(function*() {
      const malformedInput = yield* Effect.either(
        validateNumericBoundary({
          values: Array.make(0.1, Number.unsafeDivide(0, 0)),
          tolerance: 1e-9,
          budget: 64
        }).pipe(Effect.provide(deterministicLayer))
      )

      expect(
        Match.value(malformedInput).pipe(
          Match.tag("Left", ({ left }) => Schema.is(NumericDomainBoundaryError)(left)),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))

  it.effect("validates under deterministic and nondeterministic policy layers", () =>
    Effect.gen(function*() {
      const deterministicRun = yield* validateNumericBoundary({
        values: Array.make(0.1, 0.2, 0.3, 0.4),
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(deterministicLayer))
      const nondeterministicRun = yield* validateNumericBoundary({
        values: Array.make(0.1, 0.2, 0.3, 0.4),
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(nondeterministicLayer))

      expect(deterministicRun.ok).toBe(true)
      expect(nondeterministicRun.ok).toBe(true)
    }))
})
