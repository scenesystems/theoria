/**
 * Special Functions — gamma, beta, error function, and digamma.
 *
 * Special functions are the mathematical building blocks consumed by
 * probability distributions, statistical inference, and numerical
 * methods. Pure kernels compute values directly from classical
 * approximations (Lanczos for gamma, A&S 7.1.26 for erf); validated
 * variants decode boundary input; policy-aware variants enforce
 * precision constraints and emit diagnostics.
 *
 * What this shows: `gamma`, `lnGamma`, `beta`, `erf`, `erfc`,
 * `digamma`, schema-validated `gammaValidated` / `betaValidated` /
 * `erfValidated`, and policy-aware `gammaWithPolicies` /
 * `erfWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/06-special-functions.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  beta,
  betaValidated,
  digamma,
  erf,
  erfc,
  erfValidated,
  erfWithPolicies,
  gamma,
  gammaValidated,
  gammaWithPolicies,
  lnGamma
} from "effect-math/Special"

const program = Effect.gen(function*() {
  // ─── Pure kernels — gamma function ───────────────────────────────
  yield* Console.log("Γ(1):", gamma(1))
  yield* Console.log("Γ(5):", gamma(5))
  yield* Console.log("Γ(0.5):", gamma(0.5))
  // Output: Γ(0.5): 1.7724538509055159 (≈ √π)

  // ─── Pure kernels — log-gamma ────────────────────────────────────
  yield* Console.log("ln(Γ(1)):", lnGamma(1))
  yield* Console.log("ln(Γ(100)):", lnGamma(100))
  // Output: ln(Γ(100)): 359.1342... (avoids overflow that Γ(100) would cause)

  // ─── Pure kernels — beta function ────────────────────────────────
  yield* Console.log("B(1,1):", beta(1, 1))
  yield* Console.log("B(0.5,0.5):", beta(0.5, 0.5))
  // Output: B(0.5,0.5): 3.14159... (= π)

  // ─── Pure kernels — error function ───────────────────────────────
  yield* Console.log("erf(0):", erf(0))
  yield* Console.log("erf(1):", erf(1))
  yield* Console.log("erfc(0):", erfc(0))
  yield* Console.log("erf(1) + erfc(1):", erf(1) + erfc(1))
  // Output: erf(1) + erfc(1): 1 (complementary identity)

  // ─── Pure kernels — digamma ──────────────────────────────────────
  yield* Console.log("ψ(1):", digamma(1))
  yield* Console.log("ψ(2):", digamma(2))
  // Output: ψ(1): -0.5772... (= −γ, Euler–Mascheroni constant)

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const gammaV = yield* gammaValidated({ x: 5 })
  yield* Console.log("gammaValidated(x=5):", gammaV)

  const betaV = yield* betaValidated({ a: 2, b: 3 })
  yield* Console.log("betaValidated(a=2, b=3):", betaV)

  const erfV = yield* erfValidated({ x: 1 })
  yield* Console.log("erfValidated(x=1):", erfV)

  // ─── Policy-aware — strict precision ─────────────────────────────
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const gammaP = yield* gammaWithPolicies(5).pipe(Effect.provide(policies))
  yield* Console.log("gammaWithPolicies (strict, x=5):", gammaP)

  const erfP = yield* erfWithPolicies(1).pipe(Effect.provide(policies))
  yield* Console.log("erfWithPolicies (strict, x=1):", erfP)
})

BunRuntime.runMain(program)
