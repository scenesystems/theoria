import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Number as N, Schema } from "effect"

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
} from "../../src/Calculus/operations.js"
import { IterationBudget, Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"

const singleIterationBudget = Schema.decodeUnknownSync(IterationBudget)(1)

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

const point = Chunk.fromIterable([1, 2])

const scalarSurface = (coordinates: Chunk.Chunk<number>) => {
  const x = Chunk.unsafeGet(coordinates, 0)
  const y = Chunk.unsafeGet(coordinates, 1)
  return N.sum(N.sum(N.multiply(x, x), N.multiply(3, N.multiply(x, y))), N.multiply(y, y))
}

const vectorField = (coordinates: Chunk.Chunk<number>) => {
  const x = Chunk.unsafeGet(coordinates, 0)
  const y = Chunk.unsafeGet(coordinates, 1)
  return Chunk.fromIterable([
    N.sum(N.multiply(x, x), y),
    N.sum(N.multiply(x, y), Math.sin(x))
  ])
}

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectVectorClose = (actual: ReadonlyArray<number>, expected: ReadonlyArray<number>, tolerance: number) => {
  expect(actual.length).toStrictEqual(expected.length)
  actual.forEach((value, index) => expectClose(value, expected[index] ?? Number.NaN, tolerance))
}

const expectMatrixClose = (
  actual: ReadonlyArray<ReadonlyArray<number>>,
  expected: ReadonlyArray<ReadonlyArray<number>>,
  tolerance: number
) => {
  expect(actual.length).toStrictEqual(expected.length)
  actual.forEach((row, rowIndex) => {
    expect(row.length).toStrictEqual(expected[rowIndex]?.length ?? Number.NaN)
    row.forEach((value, columnIndex) => expectClose(value, expected[rowIndex]?.[columnIndex] ?? Number.NaN, tolerance))
  })
}

const toReadonlyMatrix = (matrix: Chunk.Chunk<Chunk.Chunk<number>>) =>
  Chunk.toReadonlyArray(Chunk.map(matrix, (row) => Chunk.toReadonlyArray(row)))

describe("Calculus / multivariate operators", () => {
  it.effect("gradient computes first partials with ridder-style limits", () =>
    Effect.gen(function*() {
      const result = Chunk.toReadonlyArray(gradient(scalarSurface, point))
      expectVectorClose(result, [8, 7], 2e-7)
    }))

  it.effect("jacobian computes m×n derivatives with limit extrapolation", () =>
    Effect.gen(function*() {
      const result = toReadonlyMatrix(jacobian(vectorField, point))
      expectMatrixClose(result, [[2, 1], [2 + Math.cos(1), 1]], 5e-7)
    }))

  it.effect("hessian computes second-order differential matrix", () =>
    Effect.gen(function*() {
      const result = toReadonlyMatrix(hessian(scalarSurface, point))
      expectMatrixClose(result, [[2, 3], [3, 2]], 2e-6)
    }))

  it.effect("jacobian reuses vector-field evaluations across output rows", () =>
    Effect.gen(function*() {
      const counter = { evaluations: 0 }

      const countingField = (coordinates: Chunk.Chunk<number>) => {
        counter.evaluations = N.increment(counter.evaluations)
        return vectorField(coordinates)
      }

      const _result = jacobian(countingField, point, { maxIterations: singleIterationBudget })

      expect(counter.evaluations).toStrictEqual(5)
    }))

  it.effect("hessian constructs symmetric mixed partials with reduced evaluations", () =>
    Effect.gen(function*() {
      const counter = { evaluations: 0 }

      const countingSurface = (coordinates: Chunk.Chunk<number>) => {
        counter.evaluations = N.increment(counter.evaluations)
        return scalarSurface(coordinates)
      }

      const result = toReadonlyMatrix(hessian(countingSurface, point, { maxIterations: singleIterationBudget }))

      expect(result[0]?.[1]).toStrictEqual(result[1]?.[0])
      expect(counter.evaluations).toStrictEqual(10)
    }))

  it.effect("directionalDerivative projects gradient onto normalized direction", () =>
    Effect.gen(function*() {
      const direction = Chunk.fromIterable([3, 4])
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

describe("Calculus / multivariate validated boundaries", () => {
  it.effect("gradientValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* gradientValidated(scalarSurface, { point: [1, 2], maxIterations: 10 })
      expectVectorClose(result, [8, 7], 2e-7)
    }))

  it.effect("jacobianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* jacobianValidated(vectorField, { point: [1, 2], maxIterations: 10 })
      expectMatrixClose(result, [[2, 1], [2 + Math.cos(1), 1]], 5e-7)
    }))

  it.effect("hessianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* hessianValidated(scalarSurface, { point: [1, 2], maxIterations: 10 })
      expectMatrixClose(result, [[2, 3], [3, 2]], 2e-6)
    }))

  it.effect("directionalDerivativeValidated fails when dimensions do not align", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(directionalDerivativeValidated(scalarSurface, {
        point: [1, 2],
        direction: [1, 0, 0]
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("divergenceValidated rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(divergenceValidated(vectorField, {
        point: [1, 2],
        extra: true
      }))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }))

  it.effect("laplacianValidated decodes strict boundary input", () =>
    Effect.gen(function*() {
      const result = yield* laplacianValidated(scalarSurface, {
        point: [1, 2],
        maxIterations: 10
      })

      expectClose(result, 4, 2e-6)
    }))
})

describe("Calculus / multivariate policy behavior", () => {
  it.effect("strict precision rejects non-finite gradient outputs", () =>
    Effect.gen(function*() {
      const nonFiniteSurface = (_point: Chunk.Chunk<number>) => Number.POSITIVE_INFINITY
      const result = yield* Effect.exit(gradientWithPolicies(nonFiniteSurface, point))

      expect(Exit.isFailure(result)).toStrictEqual(true)
    }).pipe(Effect.provide(strictPolicies)))

  it.effect("strict precision keeps finite directional derivatives", () =>
    Effect.gen(function*() {
      const result = yield* directionalDerivativeWithPolicies(scalarSurface, point, Chunk.fromIterable([3, 4]))
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
      const nonFiniteField = (_point: Chunk.Chunk<number>) => Chunk.fromIterable([Number.POSITIVE_INFINITY, Number.NaN])
      const nonFiniteSurface = (_point: Chunk.Chunk<number>) => Number.POSITIVE_INFINITY

      const jacobianResult = yield* jacobianWithPolicies(nonFiniteField, point)
      const hessianResult = yield* hessianWithPolicies(nonFiniteSurface, point)

      const jacobianValues = toReadonlyMatrix(jacobianResult)
      const hessianValues = toReadonlyMatrix(hessianResult)

      expect(jacobianValues.flat().some((value) => Number.isFinite(value) === false)).toStrictEqual(true)
      expect(hessianValues.flat().some((value) => Number.isFinite(value) === false)).toStrictEqual(true)
    }).pipe(Effect.provide(relaxedPolicies)))
})
