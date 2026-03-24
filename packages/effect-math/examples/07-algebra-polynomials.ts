/**
 * Algebra — polynomials, GCD, LCM, and factorial.
 *
 * The Algebra domain provides pure kernels for polynomial evaluation
 * (Horner's method), polynomial differentiation, Euclidean GCD, LCM,
 * and factorial. Validated variants decode boundary input via Schema;
 * policy-aware variants enforce precision constraints and emit
 * diagnostics.
 *
 * What this shows: `polyEval`, `polyDerivative`, `gcd`, `lcm`,
 * `factorial`, schema-validated `polyEvalValidated` /
 * `factorialValidated`, and policy-aware `polyEvalWithPolicies` /
 * `factorialWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/07-algebra-polynomials.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import {
  factorial,
  factorialValidated,
  factorialWithPolicies,
  gcd,
  lcm,
  polyDerivative,
  polyEval,
  polyEvalValidated,
  polyEvalWithPolicies
} from "effect-math/Algebra"
import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"

const program = Effect.gen(function*() {
  // ─── Pure kernels — polynomial evaluation ─────────────────────────
  const coeffs = Chunk.fromIterable([1, -2, 1]) // 1 − 2x + x²
  yield* Console.log("P(3) where P = 1 − 2x + x²:", polyEval(coeffs, 3))
  // Output: P(3) where P = 1 − 2x + x²: 4

  yield* Console.log("P(0):", polyEval(coeffs, 0))
  // Output: P(0): 1

  // ─── Pure kernels — polynomial derivative ─────────────────────────
  const deriv = polyDerivative(coeffs)
  yield* Console.log("P'(x) coefficients:", Chunk.toReadonlyArray(deriv))
  // Output: P'(x) coefficients: [-2, 2]

  // ─── Pure kernels — GCD & LCM ────────────────────────────────────
  yield* Console.log("gcd(12, 8):", gcd(12, 8))
  // Output: gcd(12, 8): 4
  yield* Console.log("lcm(12, 8):", lcm(12, 8))
  // Output: lcm(12, 8): 24
  yield* Console.log("gcd(462, 1071):", gcd(462, 1071))
  // Output: gcd(462, 1071): 21
  yield* Console.log("lcm(462, 1071):", lcm(462, 1071))
  // Output: lcm(462, 1071): 23562

  // ─── Pure kernels — factorial ────────────────────────────────────
  yield* Console.log("0!:", factorial(0))
  // Output: 0!: 1
  yield* Console.log("5!:", factorial(5))
  // Output: 5!: 120
  yield* Console.log("10!:", factorial(10))
  // Output: 10!: 3628800
  yield* Console.log("20!:", factorial(20))
  // Output: 20!: 2432902008176640000

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const polyV = yield* polyEvalValidated({ coefficients: [1, -2, 1], x: 3 })
  yield* Console.log("polyEvalValidated(x=3):", polyV)
  // Output: polyEvalValidated(x=3): 4

  const factV = yield* factorialValidated({ n: 10 })
  yield* Console.log("factorialValidated(n=10):", factV)
  // Output: factorialValidated(n=10): 3628800

  // ─── Policy-aware — strict precision ─────────────────────────────
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const polyP = yield* polyEvalWithPolicies(coeffs, 3).pipe(Effect.provide(policies))
  yield* Console.log("polyEvalWithPolicies (strict, x=3):", polyP)
  // Output: polyEvalWithPolicies (strict, x=3): 4

  const factP = yield* factorialWithPolicies(5).pipe(Effect.provide(policies))
  yield* Console.log("factorialWithPolicies (strict, n=5):", factP)
  // Output: factorialWithPolicies (strict, n=5): 120
})

BunRuntime.runMain(program)
