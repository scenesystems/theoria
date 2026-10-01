/**
 * Computes scalar and multivariate derivatives plus sampled and adaptive
 * integrals, including convergence estimates, validated boundaries, and
 * runtime-policy execution.
 *
 * Run: bun run packages/effect-math/examples/08-calculus-numerical.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array, Chunk, Console, Data, Effect, Number, Option, Schema } from "effect"

import {
  adaptiveSimpson,
  adaptiveSimpsonValidated,
  complexStep,
  derivative,
  derivativeLimit,
  derivativeLimitWithPolicies,
  directionalDerivative,
  divergence,
  gradient,
  hessian,
  jacobian,
  laplacian,
  secondDerivative,
  secondDerivativeLimit,
  simpson,
  simpsonValidated,
  simpsonWithPolicies,
  trapezoid,
  trapezoidValidated,
  trapezoidWithPolicies
} from "@scenesystems/effect-math/Calculus"
import * as Complex from "@scenesystems/effect-math/Complex"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Policy from "@scenesystems/effect-math/Policy"

class UnexpectedZeroDivisor extends Data.TaggedError("UnexpectedZeroDivisor") {}

const coordinateAt = (point: Chunk.Chunk<number>, index: number): number =>
  Option.getOrElse(Chunk.get(point, index), () => 0)

const program = Effect.gen(function*() {
  const absoluteTolerance = yield* Schema.decode(Numeric.AbsoluteTolerance)(1e-12)
  const relativeTolerance = yield* Schema.decode(Numeric.RelativeTolerance)(1e-12)

  // Derivative operators
  const xSquared = (x: number) => Number.multiply(x, x)
  yield* Console.log("d/dx(x²)|₁:", derivative(xSquared, 1))
  // Output: d/dx(x²)|₁: ≈ 2
  yield* Console.log("d/dx(x²)|₃:", derivative(xSquared, 3))
  // Output: d/dx(x²)|₃: ≈ 6
  yield* Console.log("d/dx(sin)|₀:", derivative(Numeric.sin, 0))
  // Output: d/dx(sin)|₀: ≈ 1 (cos(0) = 1)

  yield* Console.log("complexStep d/dx(exp)|₀:", complexStep(Complex.exp, 0))
  // Output: complexStep d/dx(exp)|₀: 1

  const xCubed = (x: number) => Number.multiply(Number.multiply(x, x), x)
  yield* Console.log("d²/dx²(x³)|₂:", secondDerivative(xCubed, 2))
  // Output: d²/dx²(x³)|₂: ≈ 12

  const firstLimit = derivativeLimit(Numeric.sin, Number.unsafeDivide(Numeric.pi, 3), {
    absoluteTolerance,
    relativeTolerance
  })
  yield* Console.log("derivativeLimit d/dx(sin)|π/3:", firstLimit)
  // Output: value ≈ 0.5 with bounded absoluteError and convergence flag

  const secondLimit = secondDerivativeLimit(Numeric.sin, Number.unsafeDivide(Numeric.pi, 3))
  yield* Console.log("secondDerivativeLimit d²/dx²(sin)|π/3:", secondLimit)
  // Output: value ≈ -sin(π/3)

  // Multivariate differential operators
  const scalarSurface = (point: Chunk.Chunk<number>) => {
    const x = coordinateAt(point, 0)
    const y = coordinateAt(point, 1)
    return Number.sum(
      Number.sum(Number.multiply(x, x), Number.multiply(3, Number.multiply(x, y))),
      Number.multiply(y, y)
    )
  }

  const vectorField = (point: Chunk.Chunk<number>) => {
    const x = coordinateAt(point, 0)
    const y = coordinateAt(point, 1)
    return Chunk.make(
      Number.sum(Number.multiply(x, x), y),
      Number.sum(Number.multiply(x, y), Numeric.sin(x))
    )
  }

  const point = Chunk.make(1, 2)
  const direction = Chunk.make(3, 4)
  yield* Console.log("gradient at [1,2]:", gradient(scalarSurface, point))
  yield* Console.log(
    "jacobian at [1,2]:",
    jacobian(vectorField, point)
  )
  yield* Console.log(
    "hessian at [1,2]:",
    hessian(scalarSurface, point)
  )
  yield* Console.log(
    "directionalDerivative at [1,2] along [3,4]:",
    directionalDerivative(scalarSurface, point, direction)
  )
  yield* Console.log("divergence at [1,2]:", divergence(vectorField, point))
  yield* Console.log("laplacian at [1,2]:", laplacian(scalarSurface, point))

  // Trapezoidal integration
  // Sample sin(x) at 11 evenly-spaced points over [0, π/2]
  const step = yield* Option.match(Numeric.safeDivide(Numeric.pi, 20), {
    onNone: () => Effect.fail(new UnexpectedZeroDivisor()),
    onSome: Effect.succeed
  })
  const sineValues = Chunk.makeBy(11, (i) => Numeric.sin(Number.multiply(i, step)))
  yield* Console.log("∫sin(x) dx [0, π/2] (trapezoid):", trapezoid(sineValues, step))
  // Output: ∫sin(x) dx [0, π/2] (trapezoid): ≈ 0.998 (exact = 1)

  // Simpson's integration
  const quadValues = Chunk.make(0, 1, 4, 9, 16)
  yield* Console.log("∫x² dx [0,4] (simpson):", simpson(quadValues, 1))
  // Output: ∫x² dx [0,4] (simpson): 21.333... (exact = 64/3)

  yield* Console.log(
    "∫sin(x) dx [0, π] (adaptiveSimpson abs=1e-10 rel=1e-10):",
    adaptiveSimpson(Numeric.sin, 0, Numeric.pi, 1e-10, 1e-10)
  )
  // Output: ∫sin(x) dx [0, π] (adaptiveSimpson): ≈ 2

  // Schema-validated boundary
  const trapV = yield* trapezoidValidated({ values: Array.make(1, 1, 1, 1, 1), dx: 0.25 })
  yield* Console.log("trapezoidValidated (constant):", trapV)
  // Output: trapezoidValidated (constant): 1

  const simpV = yield* simpsonValidated({ values: Array.make(0, 1, 4, 9, 16), dx: 1 })
  yield* Console.log("simpsonValidated (quadratic):", simpV)
  // Output: simpsonValidated (quadratic): 21.333...

  const adaptiveV = yield* adaptiveSimpsonValidated(Numeric.sin, {
    a: 0,
    b: Numeric.pi,
    absoluteTolerance: 1e-8,
    relativeTolerance: 1e-8,
    maxDepth: 12
  })
  yield* Console.log("adaptiveSimpsonValidated (sin over [0, π]):", adaptiveV)

  // Strict runtime policy
  const policies = Policy.layerDeterministic({
    seed: Policy.Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const trapP = yield* trapezoidWithPolicies(quadValues, 1).pipe(Effect.provide(policies))
  yield* Console.log("trapezoidWithPolicies (strict):", trapP)
  // Output: trapezoidWithPolicies (strict): 22

  const simpP = yield* simpsonWithPolicies(quadValues, 1).pipe(Effect.provide(policies))
  yield* Console.log("simpsonWithPolicies (strict):", simpP)
  // Output: simpsonWithPolicies (strict): 21.333...

  const derivativePolicyEstimate = yield* derivativeLimitWithPolicies(Numeric.sin, Number.unsafeDivide(Numeric.pi, 3))
    .pipe(
      Effect.provide(policies)
    )
  yield* Console.log("derivativeLimitWithPolicies d/dx(sin)|π/3:", derivativePolicyEstimate)
})

BunRuntime.runMain(program)
