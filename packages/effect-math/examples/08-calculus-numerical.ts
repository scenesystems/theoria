/**
 * Calculus — numerical differentiation and integration.
 *
 * Numerical calculus approximates derivatives via central finite
 * differences and integrals via composite quadrature rules
 * (trapezoidal, Simpson's 1/3). Pure kernels compute values directly
 * from evenly-spaced samples; validated variants decode boundary input;
 * policy-aware variants enforce precision constraints and emit
 * diagnostics.
 *
 * What this shows: `derivative`, `trapezoid`, `simpson`,
 * schema-validated `trapezoidValidated` / `simpsonValidated`, and
 * policy-aware `trapezoidWithPolicies` / `simpsonWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/08-calculus-numerical.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Console, Effect, Number as N } from "effect"

import {
  derivative,
  simpson,
  simpsonValidated,
  simpsonWithPolicies,
  trapezoid,
  trapezoidValidated,
  trapezoidWithPolicies
} from "effect-math/Calculus"
import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"

const program = Effect.gen(function*() {
  // ─── Pure kernels — derivative ───────────────────────────────────
  const xSquared = (x: number) => N.multiply(x, x)
  yield* Console.log("d/dx(x²)|₁:", derivative(xSquared, 1))
  // Output: d/dx(x²)|₁: ≈ 2
  yield* Console.log("d/dx(x²)|₃:", derivative(xSquared, 3))
  // Output: d/dx(x²)|₃: ≈ 6
  yield* Console.log("d/dx(sin)|₀:", derivative(Math.sin, 0))
  // Output: d/dx(sin)|₀: ≈ 1 (cos(0) = 1)

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

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const trapV = yield* trapezoidValidated({ values: [1, 1, 1, 1, 1], dx: 0.25 })
  yield* Console.log("trapezoidValidated (constant):", trapV)
  // Output: trapezoidValidated (constant): 1

  const simpV = yield* simpsonValidated({ values: [0, 1, 4, 9, 16], dx: 1 })
  yield* Console.log("simpsonValidated (quadratic):", simpV)
  // Output: simpsonValidated (quadratic): 21.333...

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
})

BunRuntime.runMain(program)
