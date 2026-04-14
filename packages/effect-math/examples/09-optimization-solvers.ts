/**
 * Optimization Solvers — legacy scalar solvers plus the canonical nonlinear
 * root-finding surface.
 *
 * What this shows: `bisect`, `goldenSection`, the canonical result-envelope
 * solvers `brent`, `secant`, `newtonRaphson`, schema-validated
 * `findRootValidated`, and policy-aware `findRootWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/09-optimization-solvers.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Number as N } from "effect"

import { AutodiffAuthorityLive, makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  bisect,
  bisectValidated,
  brent,
  findRootValidated,
  findRootWithPolicies,
  goldenSection,
  goldenSectionValidated,
  newtonRaphson,
  secant
} from "effect-math/Optimization"

const program = Effect.gen(function*() {
  const xSquaredMinus2 = (x: number) => N.subtract(N.multiply(x, x), 2)

  // ─── Legacy convenience helpers — scalar root/minimum search ─────
  yield* Console.log("bisect(x²−2, 0, 2):", bisect(xSquaredMinus2, 0, 2))
  const xSquared = (x: number) => N.multiply(x, x)
  yield* Console.log("goldenSection(x², -2, 2):", goldenSection(xSquared, -2, 2))

  // ─── Canonical nonlinear root finding — compare three methods ────
  const brentResult = brent(xSquaredMinus2, 0, 2)
  const secantResult = secant(xSquaredMinus2, 1, 2)
  const newtonResult = newtonRaphson(xSquaredMinus2, 1.5, {
    derivative: (x) => N.multiply(2, x)
  })

  yield* Console.log("brent(x²−2, 0, 2):", brentResult)
  yield* Console.log("secant(x²−2, 1, 2):", secantResult)
  yield* Console.log("newtonRaphson(x²−2, 1.5):", newtonResult)

  // ─── Schema-validated canonical API — autodiff-authority gated ───
  const bisectV = yield* bisectValidated(xSquaredMinus2, { a: 0, b: 2 })
  const goldenV = yield* goldenSectionValidated(xSquared, { a: -2, b: 2 })
  const validatedRoot = yield* findRootValidated(xSquaredMinus2, {
    method: "newtonRaphson",
    initialGuess: 1.5
  })

  yield* Console.log("bisectValidated(x²−2, {a:0, b:2}):", bisectV)
  yield* Console.log("goldenSectionValidated(x², {a:-2, b:2}):", goldenV)
  yield* Console.log("findRootValidated(newtonRaphson, x²−2):", validatedRoot)

  // ─── Policy-aware canonical API — shared dispatch annotations ───
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "typed-array",
    diagnostics: "disabled"
  })

  const policyRoot = yield* findRootWithPolicies(xSquaredMinus2, {
    method: "newtonRaphson",
    initialGuess: 1.5
  }, {
    derivative: (x) => N.multiply(2, x)
  }).pipe(Effect.provide(policies))

  yield* Console.log("findRootWithPolicies(newtonRaphson, x²−2):", policyRoot)
})

BunRuntime.runMain(program.pipe(Effect.provide(AutodiffAuthorityLive)))
