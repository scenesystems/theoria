import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import {
  makeDeterministicRuntimePoliciesLayer,
  makeNondeterministicRuntimePoliciesLayer
} from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

const deterministicLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(1337),
  precision: "strict",
  backend: "typed-array",
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
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(deterministicLayer))

      expect(result).toStrictEqual({ ok: true })
    }))

  it.effect("rejects invalid numeric boundary payloads with typed boundary errors", () =>
    Effect.gen(function*() {
      const malformedInput = yield* Effect.either(
        validateNumericBoundary({
          values: [0.1, NaN],
          tolerance: 1e-9,
          budget: 64
        }).pipe(Effect.provide(deterministicLayer))
      )

      expect(
        Match.value(malformedInput).pipe(
          Match.tag("Left", ({ left }) => left._tag === "NumericDomainBoundaryError"),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))

  it.effect("preserves deterministic replay and allows nondeterministic policy execution", () =>
    Effect.gen(function*() {
      const deterministicRunA = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(deterministicLayer))
      const deterministicRunB = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(deterministicLayer))
      const nondeterministicRun = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      }).pipe(Effect.provide(nondeterministicLayer))

      expect(deterministicRunA).toStrictEqual(deterministicRunB)
      expect(Number.Equivalence(nondeterministicRun.ok ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
