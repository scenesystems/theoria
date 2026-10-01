import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Layer, Schema } from "effect"

import * as Scalar from "../../src/Scalar.js"

const primaryBigDecimal = Schema.decodeUnknownSync(Scalar.Settings)({
  policy: {
    primaryKind: "bigdecimal",
    fallbackOrder: Array.make("bigdecimal", "float64")
  },
  capabilities: Array.make(
    {
      kind: "float64",
      supportedCategories: Array.make("numeric", "linear-algebra", "calculus", "optimization"),
      deterministic: true,
      supportsExactArithmetic: false
    },
    {
      kind: "bigdecimal",
      supportedCategories: Array.make("numeric"),
      deterministic: true,
      supportsExactArithmetic: true
    }
  )
})
const layer = Layer.succeed(Scalar.Scalar, primaryBigDecimal)

describe("Scalar.resolve", () => {
  it.effect("uses the policy primary when no lane is requested", () =>
    Effect.gen(function*() {
      const resolved = yield* Scalar.resolve({ operation: "sum", operationCategory: "numeric" }).pipe(
        Effect.provide(layer)
      )

      expect(resolved).toStrictEqual({ kind: "bigdecimal", source: "policy-primary" })
    }))

  it.effect("falls back when the primary does not support the operation category", () =>
    Effect.gen(function*() {
      const resolved = yield* Scalar.resolve({ operation: "gradient", operationCategory: "calculus" }).pipe(
        Effect.provide(layer)
      )

      expect(resolved).toStrictEqual({ kind: "float64", source: "policy-fallback" })
    }))

  it.effect("honors an explicit lane before policy order", () =>
    Effect.gen(function*() {
      const resolved = yield* Scalar.resolve({
        operation: "sum",
        operationCategory: "numeric",
        requestedKind: "float64"
      }).pipe(Effect.provide(layer))

      expect(resolved).toStrictEqual({ kind: "float64", source: "requested" })
    }))
})
