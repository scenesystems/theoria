/**
 * Numeric Scalar Transforms — log1p, expm1, sum, and policy-aware sum.
 *
 * Numerically stable scalar transforms avoid catastrophic cancellation
 * for values near zero. The three tiers (pure kernel → schema-validated
 * boundary → policy-aware) show how effect-math progressively adds
 * safety without changing the underlying algorithm.
 *
 * What this shows: pure scalar kernels (`log1p`, `expm1`, `sum`),
 * schema-validated `sumValidated`, and policy-aware `sumWithPolicies`.
 *
 * Feature Type Links:
 * - {@link Seed}
 * - {@link RuntimePolicies}
 *
 * Run: bun run packages/effect-math/examples/01-numeric-scalar-transforms.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import {
  expm1,
  log1p,
  makeDeterministicRuntimePoliciesLayer,
  Seed,
  sum,
  sumValidated,
  sumWithPolicies
} from "effect-math"

const program = Effect.gen(function*() {
  // ─── Pure kernels — synchronous, no Effect wrapper ───────────────
  const l = log1p(1e-15)
  yield* Console.log("log1p(1e-15):", l)
  // Output: log1p(1e-15): 9.999999999999995e-16

  const e = expm1(1e-15)
  yield* Console.log("expm1(1e-15):", e)

  const s = sum([1.1, 2.2, 3.3, 4.4])
  yield* Console.log("sum([1.1, 2.2, 3.3, 4.4]):", s)

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const validated = yield* sumValidated({ values: [10, 20, 30, 40, 50] })
  yield* Console.log("sumValidated({ values: [10..50] }):", validated)
  // Output: sumValidated({ values: [10..50] }): 150

  // ─── Policy-aware — reads runtime services from context ──────────
  const policyResult = yield* sumWithPolicies([100, 200, 300, 400]).pipe(
    Effect.provide(
      makeDeterministicRuntimePoliciesLayer({
        seed: Seed.make(42),
        precision: "strict",
        backend: "typed-array",
        diagnostics: "disabled"
      })
    )
  )
  yield* Console.log("sumWithPolicies (strict, typed-array):", policyResult)
  // Output: sumWithPolicies (strict, typed-array): 1000
})

BunRuntime.runMain(program)
