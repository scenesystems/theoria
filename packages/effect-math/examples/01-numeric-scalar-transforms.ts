/**
 * Compares near-zero scalar transforms and summation across direct,
 * Schema-validated, and runtime-policy entry points.
 *
 * Run: bun run packages/effect-math/examples/01-numeric-scalar-transforms.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array, Chunk, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import { expm1, log1p, sum, sumValidated, sumWithPolicies } from "@scenesystems/effect-math/Numeric"

const program = Effect.gen(function*() {
  // Direct kernels
  const l = log1p(1e-15)
  yield* Effect.log("Numeric.log1p").pipe(Effect.annotateLogs({ input: "1e-15", result: l }))

  const e = expm1(1e-15)
  yield* Effect.log("Numeric.expm1").pipe(Effect.annotateLogs({ input: "1e-15", result: e }))

  const s = sum(Chunk.make(1.1, 2.2, 3.3, 4.4))
  yield* Effect.log("Numeric.sum").pipe(Effect.annotateLogs({ inputSize: 4, result: s }))

  // Schema-validated boundary
  const validated = yield* sumValidated({ values: Array.make(10, 20, 30, 40, 50) })
  yield* Effect.log("Numeric.sumValidated").pipe(Effect.annotateLogs({ inputSize: 5, result: validated }))

  // Runtime policies
  const policyResult = yield* sumWithPolicies(Chunk.make(100, 200, 300, 400)).pipe(
    Effect.provide(
      makeDeterministicRuntimePoliciesLayer({
        seed: Seed.make(42),
        precision: "strict",
        backend: "compensated",
        diagnostics: "disabled"
      })
    )
  )
  yield* Effect.log("Numeric.sumWithPolicies").pipe(
    Effect.annotateLogs({ backend: "compensated", precision: "strict", result: policyResult })
  )
})

BunRuntime.runMain(program)
