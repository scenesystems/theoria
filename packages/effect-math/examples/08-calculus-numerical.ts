/**
 * Calculus — numerical differentiation, integration, and ODE solving.
 *
 * Numerical calculus here uses limit-accurate Ridder extrapolation for derivatives
 * and composite quadrature rules (trapezoidal, Simpson's 1/3, adaptive Simpson)
 * for integration. Pure kernels compute values directly from sampled arrays or
 * callable functions; validated variants decode boundary input;
 * policy-aware variants enforce precision constraints and emit
 * diagnostics.
 *
 * What this shows: scalar `derivative` + `secondDerivative` plus
 * `derivativeLimit` + `secondDerivativeLimit` error estimates,
 * multivariate `gradient` / `jacobian` / `hessian` / `directionalDerivative`
 * / `divergence` / `laplacian`, sampled quadrature (`trapezoid`, `simpson`),
 * continuous adaptive quadrature (`adaptiveSimpson`) with independent
 * absolute and relative tolerances, fixed-step plus adaptive IVP solvers,
 * schema-validated boundaries, and policy-aware execution.
 *
 * Run: bun run packages/effect-math/examples/08-calculus-numerical.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Console, Effect, Number as N, Schema } from "effect"

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
  solveAdaptiveRk45Validated,
  solveAdaptiveRk45WithPolicies,
  solveEuler,
  solveEulerValidated,
  solveRk4,
  trapezoid,
  trapezoidValidated,
  trapezoidWithPolicies
} from "effect-math/Calculus"
import {
  AbsoluteTolerance,
  makeDeterministicRuntimePoliciesLayer,
  RelativeTolerance,
  Seed
} from "effect-math/contracts"

const absoluteTolerance = Schema.decodeSync(AbsoluteTolerance)(1e-12)
const relativeTolerance = Schema.decodeSync(RelativeTolerance)(1e-12)
const decayField = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])
const harmonicOscillator = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)])

const program = Effect.gen(function*() {
  // ─── Pure kernels — derivative operators ─────────────────────────
  const xSquared = (x: number) => N.multiply(x, x)
  yield* Console.log("d/dx(x²)|₁:", derivative(xSquared, 1))
  // Output: d/dx(x²)|₁: ≈ 2
  yield* Console.log("d/dx(x²)|₃:", derivative(xSquared, 3))
  // Output: d/dx(x²)|₃: ≈ 6
  yield* Console.log("d/dx(sin)|₀:", derivative(Math.sin, 0))
  // Output: d/dx(sin)|₀: ≈ 1 (cos(0) = 1)

  const xCubed = (x: number) => N.multiply(N.multiply(x, x), x)
  yield* Console.log("d²/dx²(x³)|₂:", secondDerivative(xCubed, 2))
  // Output: d²/dx²(x³)|₂: ≈ 12

  const firstLimit = derivativeLimit(Math.sin, Math.PI / 3, {
    absoluteTolerance,
    relativeTolerance
  })
  yield* Console.log("derivativeLimit d/dx(sin)|π/3:", firstLimit)
  // Output: value ≈ 0.5 with bounded absoluteError and convergence flag

  const secondLimit = secondDerivativeLimit(Math.sin, Math.PI / 3)
  yield* Console.log("secondDerivativeLimit d²/dx²(sin)|π/3:", secondLimit)
  // Output: value ≈ -sin(π/3)

  // ─── Pure kernels — multivariate differential operators ──────────
  const scalarSurface = (point: Chunk.Chunk<number>) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return N.sum(N.sum(N.multiply(x, x), N.multiply(3, N.multiply(x, y))), N.multiply(y, y))
  }

  const vectorField = (point: Chunk.Chunk<number>) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return Chunk.fromIterable([
      N.sum(N.multiply(x, x), y),
      N.sum(N.multiply(x, y), Math.sin(x))
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

  // ─── Pure kernels — trapezoidal integration ──────────────────────
  // Sample sin(x) at 11 evenly-spaced points over [0, π/2]
  const step = N.unsafeDivide(Math.PI, 20)
  const sineValues = Chunk.fromIterable(
    Arr.makeBy(11, (i) => Math.sin(N.multiply(i, step)))
  )
  yield* Console.log("∫sin(x) dx [0, π/2] (trapezoid):", trapezoid(sineValues, step))
  // Output: ∫sin(x) dx [0, π/2] (trapezoid): ≈ 0.998 (exact = 1)

  // ─── Pure kernels — Simpson's integration ────────────────────────
  const quadValues = Chunk.fromIterable([0, 1, 4, 9, 16])
  yield* Console.log("∫x² dx [0,4] (simpson):", simpson(quadValues, 1))
  // Output: ∫x² dx [0,4] (simpson): 21.333... (exact = 64/3)

  yield* Console.log(
    "∫sin(x) dx [0, π] (adaptiveSimpson abs=1e-10 rel=1e-10):",
    adaptiveSimpson(Math.sin, 0, Math.PI, 1e-10, 1e-10)
  )
  // Output: ∫sin(x) dx [0, π] (adaptiveSimpson): ≈ 2

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const trapV = yield* trapezoidValidated({ values: [1, 1, 1, 1, 1], dx: 0.25 })
  yield* Console.log("trapezoidValidated (constant):", trapV)
  // Output: trapezoidValidated (constant): 1

  const simpV = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
  yield* Console.log("simpsonValidated (quadratic):", simpV)
  // Output: simpsonValidated (quadratic): 21.333...

  const adaptiveV = yield* adaptiveSimpsonValidated(Math.sin, {
    a: 0,
    b: Math.PI,
    absoluteTolerance: 1e-8,
    relativeTolerance: 1e-8,
    maxDepth: 12
  })
  yield* Console.log("adaptiveSimpsonValidated (sin over [0, π]):", adaptiveV)

  // ─── Pure and validated ODE solvers — sample-cadence trajectories ───────
  const scalarIvP = solveEuler(decayField, {
    initialTime: 0,
    finalTime: 1,
    initialState: Chunk.fromIterable([1]),
    stepSize: 0.1
  })
  yield* Console.log("solveEuler final decay state:", Chunk.toReadonlyArray(scalarIvP.finalState))
  yield* Console.log("solveEuler trajectory points:", Chunk.size(scalarIvP.trajectory))

  const vectorIvP = solveRk4(harmonicOscillator, {
    initialTime: 0,
    finalTime: 1,
    initialState: Chunk.fromIterable([1, 0]),
    stepSize: 0.05
  })
  yield* Console.log("solveRk4 final harmonic state:", Chunk.toReadonlyArray(vectorIvP.finalState))

  const adaptiveIvP = yield* solveAdaptiveRk45Validated(decayField, {
    initialTime: 0,
    finalTime: 1,
    initialState: [1],
    initialStep: 0.1,
    maxStep: 0.2,
    absoluteTolerance: 1e-8,
    relativeTolerance: 1e-8
  })
  yield* Console.log("solveAdaptiveRk45Validated final decay state:", Chunk.toReadonlyArray(adaptiveIvP.finalState))

  const validatedEuler = yield* solveEulerValidated(decayField, {
    initialTime: 0,
    finalTime: 1,
    initialState: [1],
    stepSize: 0.1
  })
  yield* Console.log("solveEulerValidated status:", validatedEuler.status)

  // ─── Policy-aware — strict precision ─────────────────────────────
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

  const derivativePolicyEstimate = yield* derivativeLimitWithPolicies(Math.sin, Math.PI / 3).pipe(
    Effect.provide(policies)
  )
  yield* Console.log("derivativeLimitWithPolicies d/dx(sin)|π/3:", derivativePolicyEstimate)

  const adaptivePolicyIvP = yield* solveAdaptiveRk45WithPolicies(decayField, {
    initialTime: 0,
    finalTime: 1,
    initialState: Chunk.fromIterable([1]),
    initialStep: 0.1,
    maxStep: 0.2,
    absoluteTolerance: 1e-8,
    relativeTolerance: 1e-8
  }).pipe(Effect.provide(policies))
  yield* Console.log("solveAdaptiveRk45WithPolicies evaluations:", adaptivePolicyIvP.functionEvaluations)
})

BunRuntime.runMain(program)
