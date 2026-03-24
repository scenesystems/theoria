/**
 * Optimization Solvers — bisection root-finding and golden section
 * minimization.
 *
 * Iterative numerical solvers for 1D root-finding and minimization.
 * Pure kernels compute values directly via recursive bisection or
 * golden ratio bracketing; validated variants decode boundary input;
 * policy-aware variants enforce precision constraints and emit
 * diagnostics.
 *
 * What this shows: `bisect`, `goldenSection`, schema-validated
 * `bisectValidated` / `goldenSectionValidated`, and policy-aware
 * `bisectWithPolicies` / `goldenSectionWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/09-optimization-solvers.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Number as N } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  bisect,
  bisectValidated,
  bisectWithPolicies,
  goldenSection,
  goldenSectionValidated,
  goldenSectionWithPolicies
} from "effect-math/Optimization"

const program = Effect.gen(function*() {
  // ─── Pure kernels — bisection root-finding ──────────────────────
  const xSquaredMinus2 = (x: number) => N.subtract(N.multiply(x, x), 2)
  yield* Console.log("bisect(x²−2, 0, 2):", bisect(xSquaredMinus2, 0, 2))
  // Output: ≈ 1.4142135623730951 (√2)

  yield* Console.log("bisect(cos, 0, 2):", bisect(Math.cos, 0, 2))
  // Output: ≈ 1.5707963267948966 (π/2)

  // ─── Pure kernels — golden section minimization ─────────────────
  const xSquared = (x: number) => N.multiply(x, x)
  yield* Console.log("goldenSection(x², -2, 2):", goldenSection(xSquared, -2, 2))
  // Output: ≈ 0 (minimum of x²)

  const xMinus1Squared = (x: number) => N.multiply(N.subtract(x, 1), N.subtract(x, 1))
  yield* Console.log("goldenSection((x−1)², -2, 4):", goldenSection(xMinus1Squared, -2, 4))
  // Output: ≈ 1 (minimum of (x−1)²)

  // ─── Schema-validated — boundary input decoded via Schema ───────
  const bisectV = yield* bisectValidated(xSquaredMinus2, { a: 0, b: 2 })
  yield* Console.log("bisectValidated(x²−2, {a:0, b:2}):", bisectV)
  // Output: bisectValidated(x²−2, {a:0, b:2}): ≈ 1.41421 (√2)

  const goldenV = yield* goldenSectionValidated(xSquared, { a: -2, b: 2 })
  yield* Console.log("goldenSectionValidated(x², {a:-2, b:2}):", goldenV)
  // Output: goldenSectionValidated(x², {a:-2, b:2}): ≈ 0

  // ─── Policy-aware — strict precision ────────────────────────────
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const bisectP = yield* bisectWithPolicies(xSquaredMinus2, 0, 2).pipe(Effect.provide(policies))
  yield* Console.log("bisectWithPolicies (strict, x²−2):", bisectP)
  // Output: bisectWithPolicies (strict, x²−2): ≈ 1.41421 (√2)

  const goldenP = yield* goldenSectionWithPolicies(xSquared, -2, 2).pipe(Effect.provide(policies))
  yield* Console.log("goldenSectionWithPolicies (strict, x²):", goldenP)
  // Output: goldenSectionWithPolicies (strict, x²): ≈ 0
})

BunRuntime.runMain(program)
