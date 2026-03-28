import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect } from "effect"

import {
  adaptiveSimpsonValidated,
  derivativeLimit,
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

describe("Calculus runtime boundary contracts", () => {
  it.effect("accepts canonical valid sampled integration input", () =>
    Effect.gen(function*() {
      const trapezoidResult = yield* trapezoidValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
      const simpsonResult = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })

      expect(trapezoidResult).toBe(22)
      expect(simpsonResult).toBeCloseTo(21.333, 3)
    }))

  it.effect("accepts canonical valid adaptive integration input", () =>
    Effect.gen(function*() {
      const result = yield* adaptiveSimpsonValidated(Math.sin, {
        a: 0,
        b: Math.PI,
        absoluteTolerance: 1e-10,
        relativeTolerance: 1e-10,
        maxDepth: 16
      })

      expect(result).toBeCloseTo(2, 10)
    }))

  it.effect("accepts canonical valid univariate limit derivative input", () =>
    Effect.gen(function*() {
      const first = yield* derivativeLimitValidated(Math.sin, {
        x: Math.PI / 3,
        initialStep: 1e-3,
        maxIterations: 10
      })
      const second = yield* secondDerivativeLimitValidated(Math.sin, {
        x: Math.PI / 3,
        initialStep: 1e-3,
        maxIterations: 10
      })

      expect(first.converged).toStrictEqual(true)
      expect(first.value).toBeCloseTo(0.5, 9)
      expect(second.converged).toStrictEqual(true)
      expect(second.value).toBeCloseTo(-Math.sin(Math.PI / 3), 8)
    }))

  it.effect("accepts canonical valid multivariate boundary inputs", () =>
    Effect.gen(function*() {
      const scalarSurface = (point: Chunk.Chunk<number>) => {
        const x = Chunk.unsafeGet(point, 0)
        const y = Chunk.unsafeGet(point, 1)
        return x * x + 3 * x * y + y * y
      }

      const vectorField = (point: Chunk.Chunk<number>) => {
        const x = Chunk.unsafeGet(point, 0)
        const y = Chunk.unsafeGet(point, 1)
        return Chunk.fromIterable([x * x + y, x * y + Math.sin(x)])
      }

      const gradient = yield* gradientValidated(scalarSurface, { point: [1, 2], maxIterations: 10 })
      const jacobian = yield* jacobianValidated(vectorField, { point: [1, 2], maxIterations: 10 })
      const hessian = yield* hessianValidated(scalarSurface, { point: [1, 2], maxIterations: 10 })
      const directional = yield* directionalDerivativeValidated(scalarSurface, {
        point: [1, 2],
        direction: [3, 4],
        maxIterations: 10
      })
      const divergence = yield* divergenceValidated(vectorField, { point: [1, 2], maxIterations: 10 })
      const laplacian = yield* laplacianValidated(scalarSurface, { point: [1, 2], maxIterations: 10 })

      expect(gradient[0]).toBeCloseTo(8, 6)
      expect(jacobian[0]?.[0]).toBeCloseTo(2, 6)
      expect(hessian[0]?.[0]).toBeCloseTo(2, 5)
      expect(directional).toBeCloseTo(10.4, 5)
      expect(divergence).toBeCloseTo(3, 6)
      expect(laplacian).toBeCloseTo(4, 5)
    }))

  it.effect("rejects excess properties and malformed boundary payloads", () =>
    Effect.gen(function*() {
      const integrationResult = yield* Effect.either(simpsonValidated({
        values: [0, 1, 4, 9, 16],
        dx: 1,
        extra: true
      }))
      const derivativeResult = yield* Effect.either(derivativeLimitValidated(Math.sin, {
        x: "invalid"
      }))
      const directionalResult = yield* Effect.either(directionalDerivativeValidated(
        () => 1,
        {
          point: [1, 2],
          direction: [1, 0, 0]
        }
      ))

      expect(integrationResult._tag).toBe("Left")
      expect(derivativeResult._tag).toBe("Left")
      expect(directionalResult._tag).toBe("Left")
    }))

  it.effect("rejects legacy numeric third-arg Ridder config at runtime boundaries", () =>
    Effect.gen(function*() {
      expect(() => Reflect.apply(derivativeLimit, undefined, [Math.sin, 0, 1])).toThrow()
    }))
})
