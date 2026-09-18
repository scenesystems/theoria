import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Chunk, Effect, Exit, MutableRef, Number, Option, Schema, String } from "effect"

import {
  directionalDerivative,
  directionalDerivativeValidated,
  directionalDerivativeWithPolicies,
  divergence,
  divergenceValidated,
  divergenceWithPolicies,
  gradient,
  gradientValidated,
  gradientWithPolicies,
  hessian,
  hessianValidated,
  hessianWithPolicies,
  jacobian,
  jacobianValidated,
  jacobianWithPolicies,
  laplacian,
  laplacianValidated,
  laplacianWithPolicies
} from "../../src/Calculus.js"
import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"

const singleIterationBudget = Numeric.IterationBudget.make(1)

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

const point = Chunk.make(1, 2)

const scalarSurface = (coordinates: Chunk.Chunk<number>) => {
  const x = Chunk.unsafeGet(coordinates, 0)
  const y = Chunk.unsafeGet(coordinates, 1)
  return Number.sum(Number.sum(Number.multiply(x, x), Number.multiply(3, Number.multiply(x, y))), Number.multiply(y, y))
}

const vectorField = (coordinates: Chunk.Chunk<number>) => {
  const x = Chunk.unsafeGet(coordinates, 0)
  const y = Chunk.unsafeGet(coordinates, 1)
  return Chunk.make(
    Number.sum(Number.multiply(x, x), y),
    Number.sum(Number.multiply(x, y), Numeric.sin(x))
  )
}

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectVectorClose = (actual: Chunk.Chunk<number>, expected: Chunk.Chunk<number>, tolerance: number) => {
  expect(Chunk.size(actual)).toStrictEqual(Chunk.size(expected))
  Chunk.forEach(
    actual,
    (value, index) =>
      expectClose(value, Option.getOrElse(Chunk.get(expected, index), () => Number.unsafeDivide(0, 0)), tolerance)
  )
}

const expectMatrixClose = (
  actual: Chunk.Chunk<Chunk.Chunk<number>>,
  expected: Chunk.Chunk<Chunk.Chunk<number>>,
  tolerance: number
) => {
  expect(Chunk.size(actual)).toStrictEqual(Chunk.size(expected))
  Chunk.forEach(actual, (row, rowIndex) => {
    const expectedRow = Option.getOrElse(Chunk.get(expected, rowIndex), Chunk.empty)
    expect(Chunk.size(row)).toStrictEqual(Chunk.size(expectedRow))
    expectVectorClose(row, expectedRow, tolerance)
  })
}

describe("Calculus / multivariate operators", () => {
  it.effect("gradient of a zero-dimensional point is empty without evaluating the surface", () =>
    Effect.gen(function*() {
      const counter = MutableRef.make(0)
      const result = gradient((_coordinates) => {
        MutableRef.increment(counter)
        return 0
      }, Chunk.empty())

      expect(Chunk.isEmpty(result)).toStrictEqual(true)
      expect(MutableRef.get(counter)).toStrictEqual(0)
    }))

  it.effect("jacobian of a zero-dimensional point has empty rows without perturbation evaluations", () =>
    Effect.gen(function*() {
      const counter = MutableRef.make(0)
      const result = jacobian((_coordinates) => {
        MutableRef.increment(counter)
        return Chunk.make(1, 2)
      }, Chunk.empty())

      expect(Chunk.size(result)).toStrictEqual(2)
      expect(Chunk.every(result, Chunk.isEmpty)).toStrictEqual(true)
      expect(MutableRef.get(counter)).toStrictEqual(1)
    }))

  it.effect("hessian of a zero-dimensional point is empty without evaluating the surface", () =>
    Effect.gen(function*() {
      const counter = MutableRef.make(0)
      const result = hessian((_coordinates) => {
        MutableRef.increment(counter)
        return 0
      }, Chunk.empty())

      expect(Chunk.isEmpty(result)).toStrictEqual(true)
      expect(MutableRef.get(counter)).toStrictEqual(0)
    }))

  it.effect("gradient computes first partials with ridder-style limits", () =>
    Effect.gen(function*() {
      const result = gradient(scalarSurface, point)
      expectVectorClose(result, Chunk.make(8, 7), 2e-7)
    }))

  it.effect("jacobian computes m×n derivatives with limit extrapolation", () =>
    Effect.gen(function*() {
      const result = jacobian(vectorField, point)
      expectMatrixClose(result, Chunk.make(Chunk.make(2, 1), Chunk.make(Number.sum(2, Numeric.cos(1)), 1)), 5e-7)
    }))

  it.effect("hessian computes second-order differential matrix", () =>
    Effect.gen(function*() {
      const result = hessian(scalarSurface, point)
      expectMatrixClose(result, Chunk.make(Chunk.make(2, 3), Chunk.make(3, 2)), 2e-6)
    }))

  it.effect("jacobian reuses vector-field evaluations across output rows", () =>
    Effect.gen(function*() {
      const counter = MutableRef.make(0)

      const countingField = (coordinates: Chunk.Chunk<number>) => {
        MutableRef.increment(counter)
        return vectorField(coordinates)
      }

      const _result = jacobian(countingField, point, { maxIterations: singleIterationBudget })

      expect(MutableRef.get(counter)).toStrictEqual(5)
    }))

  it.effect("hessian constructs symmetric mixed partials with reduced evaluations", () =>
    Effect.gen(function*() {
      const counter = MutableRef.make(0)

      const countingSurface = (coordinates: Chunk.Chunk<number>) => {
        MutableRef.increment(counter)
        return scalarSurface(coordinates)
      }

      const result = hessian(countingSurface, point, { maxIterations: singleIterationBudget })

      const upper = Option.flatMap(Chunk.get(result, 0), (row) => Chunk.get(row, 1))
      const lower = Option.flatMap(Chunk.get(result, 1), (row) => Chunk.get(row, 0))
      expect(Option.getEquivalence(Number.Equivalence)(upper, lower)).toStrictEqual(true)
      expect(MutableRef.get(counter)).toStrictEqual(10)
    }))

  it.effect("hessian preserves upper-triangle callback evaluation order while mirroring mixed partials", () =>
    Effect.gen(function*() {
      const evaluated = MutableRef.make(Chunk.empty<Chunk.Chunk<number>>())
      const countingSurface = (coordinates: Chunk.Chunk<number>) => {
        MutableRef.update(evaluated, Chunk.append(coordinates))
        return scalarSurface(coordinates)
      }

      const _result = hessian(countingSurface, point, { maxIterations: singleIterationBudget })

      expect(MutableRef.get(evaluated)).toStrictEqual(Chunk.make(
        point,
        Chunk.make(1.01, 2),
        Chunk.make(0.99, 2),
        Chunk.make(1.01, 2.01),
        Chunk.make(1.01, 1.99),
        Chunk.make(0.99, 2.01),
        Chunk.make(0.99, 1.99),
        point,
        Chunk.make(1, 2.01),
        Chunk.make(1, 1.99)
      ))
    }))

  it.effect("directionalDerivative projects gradient onto normalized direction", () =>
    Effect.gen(function*() {
      const direction = Chunk.make(3, 4)
      expectClose(directionalDerivative(scalarSurface, point, direction), 10.4, 1e-6)
    }))

  it.effect("divergence sums matching partial derivatives of vector fields", () =>
    Effect.gen(function*() {
      expectClose(divergence(vectorField, point), 3, 1e-6)
    }))

  it.effect("laplacian equals trace of the hessian for scalar fields", () =>
    Effect.gen(function*() {
      expectClose(laplacian(scalarSurface, point), 4, 2e-6)
    }))
})

describe("Calculus / multivariate validation", () => {
  it.effect("gradientValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* gradientValidated(scalarSurface, { point: Array.make(1, 2), maxIterations: 10 })
      expectVectorClose(result, Chunk.make(8, 7), 2e-7)
    }))

  it.effect("jacobianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* jacobianValidated(vectorField, { point: Array.make(1, 2), maxIterations: 10 })
      expectMatrixClose(result, Chunk.make(Chunk.make(2, 1), Chunk.make(Number.sum(2, Numeric.cos(1)), 1)), 5e-7)
    }))

  it.effect("hessianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* hessianValidated(scalarSurface, { point: Array.make(1, 2), maxIterations: 10 })
      expectMatrixClose(result, Chunk.make(Chunk.make(2, 3), Chunk.make(3, 2)), 2e-6)
    }))

  it.effect("directionalDerivativeValidated fails when dimensions do not align", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(directionalDerivativeValidated(scalarSurface, {
        point: Array.make(1, 2),
        direction: Array.make(1, 0, 0)
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("divergenceValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(divergenceValidated(vectorField, {
        point: Array.make(1, 2),
        extra: true
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("laplacianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* laplacianValidated(scalarSurface, {
        point: Array.make(1, 2),
        maxIterations: 10
      })

      expectClose(result, 4, 2e-6)
    }))

  it.effect("gradientValidated maps callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gradientValidated(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        {
          point: Array.make(1, 2)
        }
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("gradient")
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }))
})

describe("Calculus / multivariate policy behavior", () => {
  it.effect("strict precision rejects non-finite gradient outputs", () =>
    Effect.gen(function*() {
      const nonFiniteSurface = (_point: Chunk.Chunk<number>) => Number.unsafeDivide(1, 0)
      const result = yield* Effect.exit(gradientWithPolicies(nonFiniteSurface, point))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("strict precision keeps finite directional derivatives", () =>
    Effect.gen(function*() {
      const result = yield* directionalDerivativeWithPolicies(scalarSurface, point, Chunk.make(3, 4))
      expectClose(result, 10.4, 1e-6)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("strict precision keeps finite divergence and laplacian", () =>
    Effect.gen(function*() {
      const divergenceResult = yield* divergenceWithPolicies(vectorField, point)
      const laplacianResult = yield* laplacianWithPolicies(scalarSurface, point)

      expectClose(divergenceResult, 3, 1e-6)
      expectClose(laplacianResult, 4, 2e-6)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("relaxed precision permits non-finite Jacobian and Hessian outputs", () =>
    Effect.gen(function*() {
      const nonFiniteField = (_point: Chunk.Chunk<number>) =>
        Chunk.make(Number.unsafeDivide(1, 0), Number.unsafeDivide(0, 0))
      const nonFiniteSurface = (_point: Chunk.Chunk<number>) => Number.unsafeDivide(1, 0)

      const jacobianResult = yield* jacobianWithPolicies(nonFiniteField, point)
      const hessianResult = yield* hessianWithPolicies(nonFiniteSurface, point)

      const containsNonFinite = (values: Chunk.Chunk<Chunk.Chunk<number>>) =>
        Chunk.some(values, (row) => Chunk.some(row, (value) => Boolean.not(Numeric.isFinite(value))))
      expect(containsNonFinite(jacobianResult)).toStrictEqual(true)
      expect(containsNonFinite(hessianResult)).toStrictEqual(true)
    }).pipe(Effect.provide(relaxedPolicies)))

  it.effect("policy wrappers map callback throws to typed kernel errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(gradientWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ invalid: true }),
        point
      ))

      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("gradientWithPolicies")
      expect(String.isNonEmpty(error.message)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))
})
