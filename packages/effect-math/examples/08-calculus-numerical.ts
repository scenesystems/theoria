/**
 * Computes scalar and multivariate derivatives plus sampled and adaptive
 * integrals, including convergence estimates, validated boundaries, and
 * runtime-policy execution.
 *
 * Run: bun run packages/effect-math/examples/08-calculus-numerical.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Console, Effect, Number as N, Option, Schema } from "effect"

import {
  adaptiveSimpson,
  adaptiveSimpsonValidated,
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
import {
  AbsoluteTolerance,
  makeDeterministicRuntimePoliciesLayer,
  RelativeTolerance,
  Seed
} from "@scenesystems/effect-math/contracts"
import * as Numeric from "@scenesystems/effect-math/Numeric"

const coordinateAt = (point: Chunk.Chunk<number>, index: number): number =>
  Option.getOrElse(Chunk.get(point, index), () => 0)

const program = Effect.gen(function*() {
  const absoluteTolerance = yield* Schema.decode(AbsoluteTolerance)(1e-12)
  const relativeTolerance = yield* Schema.decode(RelativeTolerance)(1e-12)

  // Derivative operators
  const xSquared = (x: number) => N.multiply(x, x)
  yield* Console.log("d/dx(x²)|₁:", derivative(xSquared, 1))
  // Output: d/dx(x²)|₁: ≈ 2
  yield* Console.log("d/dx(x²)|₃:", derivative(xSquared, 3))
  // Output: d/dx(x²)|₃: ≈ 6
  yield* Console.log("d/dx(sin)|₀:", derivative(Numeric.sin, 0))
  // Output: d/dx(sin)|₀: ≈ 1 (cos(0) = 1)

  const xCubed = (x: number) => N.multiply(N.multiply(x, x), x)
  yield* Console.log("d²/dx²(x³)|₂:", secondDerivative(xCubed, 2))
  // Output: d²/dx²(x³)|₂: ≈ 12

  const firstLimit = derivativeLimit(Numeric.sin, Numeric.pi / 3, {
    absoluteTolerance,
    relativeTolerance
  })
  yield* Console.log("derivativeLimit d/dx(sin)|π/3:", firstLimit)
  // Output: value ≈ 0.5 with bounded absoluteError and convergence flag

  const secondLimit = secondDerivativeLimit(Numeric.sin, Numeric.pi / 3)
  yield* Console.log("secondDerivativeLimit d²/dx²(sin)|π/3:", secondLimit)
  // Output: value ≈ -sin(π/3)

  // Multivariate differential operators
  const scalarSurface = (point: Chunk.Chunk<number>) => {
    const x = coordinateAt(point, 0)
    const y = coordinateAt(point, 1)
    return N.sum(N.sum(N.multiply(x, x), N.multiply(3, N.multiply(x, y))), N.multiply(y, y))
  }

  const vectorField = (point: Chunk.Chunk<number>) => {
    const x = coordinateAt(point, 0)
    const y = coordinateAt(point, 1)
    return Chunk.fromIterable([
      N.sum(N.multiply(x, x), y),
      N.sum(N.multiply(x, y), Numeric.sin(x))
    ])
  }

  const point = Chunk.fromIterable([1, 2])
  const direction = Chunk.fromIterable([3, 4])
  yield* Console.log("gradient at [1,2]:", Chunk.toReadonlyArray(gradient(scalarSurface, point)))
  yield* Console.log(
    "jacobian at [1,2]:",
    Chunk.toReadonlyArray(Chunk.map(jacobian(vectorField, point), (row) => Chunk.toReadonlyArray(row)))
  )
  yield* Console.log(
    "hessian at [1,2]:",
    Chunk.toReadonlyArray(Chunk.map(hessian(scalarSurface, point), (row) => Chunk.toReadonlyArray(row)))
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
    onNone: () => Effect.fail("UnexpectedZeroDivisor"),
    onSome: Effect.succeed
  })
  const sineValues = Chunk.fromIterable(
    Arr.makeBy(11, (i) => Numeric.sin(N.multiply(i, step)))
  )
  yield* Console.log("∫sin(x) dx [0, π/2] (trapezoid):", trapezoid(sineValues, step))
  // Output: ∫sin(x) dx [0, π/2] (trapezoid): ≈ 0.998 (exact = 1)

  // Simpson's integration
  const quadValues = Chunk.fromIterable([0, 1, 4, 9, 16])
  yield* Console.log("∫x² dx [0,4] (simpson):", simpson(quadValues, 1))
  // Output: ∫x² dx [0,4] (simpson): 21.333... (exact = 64/3)

  yield* Console.log(
    "∫sin(x) dx [0, π] (adaptiveSimpson abs=1e-10 rel=1e-10):",
    adaptiveSimpson(Numeric.sin, 0, Numeric.pi, 1e-10, 1e-10)
  )
  // Output: ∫sin(x) dx [0, π] (adaptiveSimpson): ≈ 2

  // Schema-validated boundary
  const trapV = yield* trapezoidValidated({ values: [1, 1, 1, 1, 1], dx: 0.25 })
  yield* Console.log("trapezoidValidated (constant):", trapV)
  // Output: trapezoidValidated (constant): 1

  const simpV = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
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
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
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

  const derivativePolicyEstimate = yield* derivativeLimitWithPolicies(Numeric.sin, Numeric.pi / 3).pipe(
    Effect.provide(policies)
  )
  yield* Console.log("derivativeLimitWithPolicies d/dx(sin)|π/3:", derivativePolicyEstimate)
})

BunRuntime.runMain(program)
