import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Exit, MutableRef, Number, Schema, String } from "effect"

import {
  adaptiveSimpson,
  adaptiveSimpsonValidated,
  adaptiveSimpsonWithPolicies,
  simpson,
  simpsonValidated,
  simpsonWithPolicies,
  trapezoid,
  trapezoidValidated,
  trapezoidWithPolicies
} from "../../src/Calculus.js"
import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const strictPolicies = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedPolicies = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Calculus / sampled integration", () => {
  it.effect("trapezoid computes stable integral for quadratic samples", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0, 1, 4, 9, 16)
      expectClose(trapezoid(values, 1), 22, 1e-12)
    }))

  it.effect("simpson stays exact for cubic polynomials with uniform spacing", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0, 1, 8, 27, 64)
      expectClose(simpson(values, 1), 64, 1e-12)
    }))
})

describe("Calculus / adaptive Simpson integration", () => {
  it.effect("integrates sin(x) over [0, π] to machine-level tolerance", () =>
    Effect.gen(function*() {
      expectClose(adaptiveSimpson(Numeric.sin, 0, Numeric.pi), 2, 1e-10)
    }))

  it.effect("keeps endpoint and refinement callback evaluation order when the first interval converges", () =>
    Effect.gen(function*() {
      const evaluated = MutableRef.make(Chunk.empty<number>())
      const result = adaptiveSimpson(
        (x) => {
          MutableRef.update(evaluated, Chunk.append(x))
          return x
        },
        0,
        1
      )

      expectClose(result, 0.5, 1e-12)
      expect(MutableRef.get(evaluated)).toStrictEqual(Chunk.make(0, 0.5, 1, 0.25, 0.75))
    }))

  it.effect("preserves orientation for reversed interval bounds", () =>
    Effect.gen(function*() {
      expectClose(adaptiveSimpson(Numeric.sin, Numeric.pi, 0), -2, 1e-10)
    }))

  it.effect("integrates odd polynomial over symmetric interval to zero", () =>
    Effect.gen(function*() {
      const oddPolynomial = (x: number) => Number.multiply(Number.multiply(x, x), x)
      expectClose(adaptiveSimpson(oddPolynomial, -1, 1), 0, 1e-11)
    }))
})

describe("Calculus / integration validation", () => {
  it.effect("trapezoidValidated decodes strict input contracts", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidValidated({ values: Array.make(1, 1, 1, 1, 1), dx: 0.25 })
      expectClose(result, 1, 1e-12)
    }))

  it.effect("simpsonValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(simpsonValidated({
        values: Array.make(0, 1, 4, 9, 16),
        dx: 1,
        extra: true
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("adaptiveSimpsonValidated decodes strict input contracts", () =>
    Effect.gen(function*() {
      const result = yield* adaptiveSimpsonValidated(Numeric.sin, {
        a: 0,
        b: Numeric.pi,
        absoluteTolerance: 1e-10,
        relativeTolerance: 1e-10,
        maxDepth: 16
      })

      expectClose(result, 2, 1e-10)
    }))

  it.effect("adaptiveSimpsonValidated maps callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(adaptiveSimpsonValidated(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        {
          a: 0,
          b: 1
        }
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("adaptiveSimpson")
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }))
})

describe("Calculus / integration policy behavior", () => {
  it.effect("strict precision rejects non-finite adaptive integrals", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(adaptiveSimpsonWithPolicies(() => Number.unsafeDivide(1, 0), 0, 1))
      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("strict precision keeps finite sampled integrations", () =>
    Effect.gen(function*() {
      const values = Chunk.make(0, 1, 4, 9, 16)
      const trapezoidResult = yield* trapezoidWithPolicies(values, 1)
      const simpsonResult = yield* simpsonWithPolicies(values, 1)

      expectClose(trapezoidResult, 22, 1e-12)
      expectClose(simpsonResult, 21.333333333333332, 1e-12)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("relaxed precision permits non-finite sampled integration outputs", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidWithPolicies(Chunk.make(Number.unsafeDivide(1, 0), 1), 1)
      expect(Numeric.isFinite(result)).toStrictEqual(false)
    }).pipe(Effect.provide(relaxedPolicies)))

  it.effect("policy wrappers map callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(adaptiveSimpsonWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        0,
        1
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("adaptiveSimpsonWithPolicies")
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))
})
