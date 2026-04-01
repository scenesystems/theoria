import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Number as N, Schema } from "effect"

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
} from "../../src/Calculus/operations.js"
import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"

const strictPolicies = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedPolicies = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Calculus / sampled integration", () => {
  it.effect("trapezoid computes stable integral for quadratic samples", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      expectClose(trapezoid(values, 1), 22, 1e-12)
    }))

  it.effect("simpson stays exact for cubic polynomials with uniform spacing", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 8, 27, 64])
      expectClose(simpson(values, 1), 64, 1e-12)
    }))
})

describe("Calculus / adaptive Simpson integration", () => {
  it.effect("integrates sin(x) over [0, π] to machine-level tolerance", () =>
    Effect.gen(function*() {
      expectClose(adaptiveSimpson(Math.sin, 0, Math.PI), 2, 1e-10)
    }))

  it.effect("preserves orientation for reversed interval bounds", () =>
    Effect.gen(function*() {
      expectClose(adaptiveSimpson(Math.sin, Math.PI, 0), -2, 1e-10)
    }))

  it.effect("integrates odd polynomial over symmetric interval to zero", () =>
    Effect.gen(function*() {
      const oddPolynomial = (x: number) => N.multiply(N.multiply(x, x), x)
      expectClose(adaptiveSimpson(oddPolynomial, -1, 1), 0, 1e-11)
    }))
})

describe("Calculus / integration validated boundaries", () => {
  it.effect("trapezoidValidated decodes strict input contracts", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidValidated({ values: [1, 1, 1, 1, 1], dx: 0.25 })
      expectClose(result, 1, 1e-12)
    }))

  it.effect("simpsonValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(simpsonValidated({
        values: [0, 1, 4, 9, 16],
        dx: 1,
        extra: true
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("adaptiveSimpsonValidated decodes strict input contracts", () =>
    Effect.gen(function*() {
      const result = yield* adaptiveSimpsonValidated(Math.sin, {
        a: 0,
        b: Math.PI,
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
      expect(error.message.length > 0).toStrictEqual(true)
    }))
})

describe("Calculus / integration policy behavior", () => {
  it.effect("strict precision rejects non-finite adaptive integrals", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(adaptiveSimpsonWithPolicies(() => Number.POSITIVE_INFINITY, 0, 1))
      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("strict precision keeps finite sampled integrations", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([0, 1, 4, 9, 16])
      const trapezoidResult = yield* trapezoidWithPolicies(values, 1)
      const simpsonResult = yield* simpsonWithPolicies(values, 1)

      expectClose(trapezoidResult, 22, 1e-12)
      expectClose(simpsonResult, 21.333333333333332, 1e-12)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("relaxed precision permits non-finite sampled integration outputs", () =>
    Effect.gen(function*() {
      const result = yield* trapezoidWithPolicies(Chunk.fromIterable([Number.POSITIVE_INFINITY, 1]), 1)
      expect(Number.isFinite(result)).toStrictEqual(false)
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
      expect(error.message.length > 0).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))
})
