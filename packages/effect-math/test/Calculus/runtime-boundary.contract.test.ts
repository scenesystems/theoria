import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Number, Option, Schema } from "effect"

import {
  adaptiveSimpsonValidated,
  derivativeLimitValidated,
  directionalDerivativeValidated,
  divergenceValidated,
  gradientValidated,
  hessianValidated,
  jacobianValidated,
  laplacianValidated,
  secondDerivativeLimitValidated,
  simpsonValidated,
  trapezoidValidated
} from "../../src/Calculus/operations.js"
import * as Numeric from "../../src/Numeric/index.js"

describe("Calculus runtime boundary contracts", () => {
  it.effect("accepts canonical valid sampled integration input", () =>
    Effect.gen(function*() {
      const values = Array.make(0, 1, 4, 9, 16)
      const trapezoidResult = yield* trapezoidValidated({ values, dx: 1 })
      const simpsonResult = yield* simpsonValidated({ values, dx: 1 })

      expect(trapezoidResult).toBe(22)
      expect(simpsonResult).toBeCloseTo(21.333, 3)
    }))

  it.effect("accepts canonical valid adaptive integration input", () =>
    Effect.gen(function*() {
      const result = yield* adaptiveSimpsonValidated(Numeric.sin, {
        a: 0,
        b: Numeric.pi,
        absoluteTolerance: 1e-10,
        relativeTolerance: 1e-10,
        maxDepth: 16
      })

      expect(result).toBeCloseTo(2, 10)
    }))

  it.effect("accepts canonical valid univariate limit derivative input", () =>
    Effect.gen(function*() {
      const point = Number.unsafeDivide(Numeric.pi, 3)
      const first = yield* derivativeLimitValidated(Numeric.sin, {
        x: point,
        initialStep: 1e-3,
        maxIterations: 10
      })
      const second = yield* secondDerivativeLimitValidated(Numeric.sin, {
        x: point,
        initialStep: 1e-3,
        maxIterations: 10
      })

      expect(first.converged).toStrictEqual(true)
      expect(first.value).toBeCloseTo(0.5, 9)
      expect(second.converged).toStrictEqual(false)
      expect(second.value).toBeCloseTo(Number.negate(Numeric.sin(point)), 8)
    }))

  it.effect("accepts canonical valid multivariate boundary inputs", () =>
    Effect.gen(function*() {
      const scalarSurface = (point: Chunk.Chunk<number>) => {
        const x = Chunk.unsafeGet(point, 0)
        const y = Chunk.unsafeGet(point, 1)
        return Number.sum(
          Number.sum(Number.multiply(x, x), Number.multiply(3, Number.multiply(x, y))),
          Number.multiply(y, y)
        )
      }

      const vectorField = (point: Chunk.Chunk<number>) => {
        const x = Chunk.unsafeGet(point, 0)
        const y = Chunk.unsafeGet(point, 1)
        return Chunk.make(Number.sum(Number.multiply(x, x), y), Number.sum(Number.multiply(x, y), Numeric.sin(x)))
      }

      const inputPoint = Array.make(1, 2)
      const gradient = yield* gradientValidated(scalarSurface, { point: inputPoint, maxIterations: 10 })
      const jacobian = yield* jacobianValidated(vectorField, { point: inputPoint, maxIterations: 10 })
      const hessian = yield* hessianValidated(scalarSurface, { point: inputPoint, maxIterations: 10 })
      const directional = yield* directionalDerivativeValidated(scalarSurface, {
        point: inputPoint,
        direction: Array.make(3, 4),
        maxIterations: 10
      })
      const divergence = yield* divergenceValidated(vectorField, { point: inputPoint, maxIterations: 10 })
      const laplacian = yield* laplacianValidated(scalarSurface, { point: inputPoint, maxIterations: 10 })

      expect(Option.getOrElse(Chunk.get(gradient, 0), () => Number.unsafeDivide(0, 0))).toBeCloseTo(8, 6)
      expect(
        Option.getOrElse(Option.flatMap(Chunk.get(jacobian, 0), (row) => Chunk.get(row, 0)), () =>
          Number.unsafeDivide(0, 0))
      )
        .toBeCloseTo(2, 6)
      expect(
        Option.getOrElse(
          Option.flatMap(Chunk.get(hessian, 0), (row) =>
            Chunk.get(row, 0)),
          () => Number.unsafeDivide(0, 0)
        )
      )
        .toBeCloseTo(2, 5)
      expect(directional).toBeCloseTo(10.4, 5)
      expect(divergence).toBeCloseTo(3, 6)
      expect(laplacian).toBeCloseTo(4, 5)
    }))

  it.effect("rejects excess properties and malformed boundary payloads", () =>
    Effect.gen(function*() {
      const integrationResult = yield* Effect.either(simpsonValidated({
        values: Array.make(0, 1, 4, 9, 16),
        dx: 1,
        extra: true
      }))
      const derivativeResult = yield* Effect.either(derivativeLimitValidated(Numeric.sin, {
        x: "invalid"
      }))
      const directionalResult = yield* Effect.either(directionalDerivativeValidated(
        () => 1,
        {
          point: Array.make(1, 2),
          direction: Array.make(1, 0, 0)
        }
      ))

      expect(integrationResult._tag).toBe("Left")
      expect(derivativeResult._tag).toBe("Left")
      expect(directionalResult._tag).toBe("Left")
    }))

  it.effect("preserves the callback error message in a typed execution failure", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        derivativeLimitValidated(() => Schema.decodeUnknownSync(Schema.Number)("invalid"), { x: 1 })
      )

      expect(error._tag).toBe("KernelExecutionError")
      expect(error.operation).toBe("derivativeLimit")
      expect(error.message).toBe("Expected number, actual \"invalid\"")
    }))
})
