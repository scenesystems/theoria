/**
 * Compares near-zero scalar transforms and summation across direct,
 * Schema-validated, and runtime-policy entry points.
 *
 * Run: bun run packages/effect-math/examples/01-numeric-scalar-transforms.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import { expm1, log1p, sum, sumValidated, sumWithPolicies } from "@scenesystems/effect-math/Numeric"

const program = Effect.gen(function*() {
  // Direct kernels
  const l = log1p(1e-15)
  yield* Console.log("log1p(1e-15):", l)
  // Output: log1p(1e-15): 9.999999999999995e-16

  const e = expm1(1e-15)
  yield* Console.log("expm1(1e-15):", e)

  const s = sum([1.1, 2.2, 3.3, 4.4])
  yield* Console.log("sum([1.1, 2.2, 3.3, 4.4]):", s)

  // Schema-validated boundary
  const validated = yield* sumValidated({ values: [10, 20, 30, 40, 50] })
  yield* Console.log("sumValidated({ values: [10..50] }):", validated)
  // Output: sumValidated({ values: [10..50] }): 150

  // Runtime policies
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
