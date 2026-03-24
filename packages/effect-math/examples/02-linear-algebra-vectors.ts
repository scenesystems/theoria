/**
 * Linear Algebra — dot product, norms, vector ops, and matrix-vector multiply.
 *
 * Vectors live in immutable `Chunk` carriers. Pure kernels accept and return
 * Chunks directly; schema-validated variants decode boundary input; policy-aware
 * variants read precision and backend from the Effect context.
 *
 * What this shows: `dot`, `normL1`/`normL2`/`normLinf`, `vectorAdd`, `vectorScale`,
 * `matvec`, `transpose`, `frobeniusNorm`, schema-validated `dotValidated`,
 * and policy-aware `dotWithPolicies` / `normWithPolicies`.
 *
 * Feature Type Links:
 * - {@link Chunk}
 * - {@link Seed}
 * - {@link RuntimePolicies}
 *
 * Run: bun run packages/effect-math/examples/02-linear-algebra-vectors.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  dot,
  dotValidated,
  dotWithPolicies,
  frobeniusNorm,
  matvec,
  normL1,
  normL2,
  normLinf,
  normWithPolicies,
  transpose,
  vectorAdd,
  vectorScale
} from "effect-math/LinearAlgebra"

const program = Effect.gen(function*() {
  const a = Chunk.fromIterable([1, 2, 3])
  const b = Chunk.fromIterable([4, 5, 6])

  // ─── Pure kernels — Chunk in, scalar/Chunk out ───────────────────
  yield* Console.log("dot([1,2,3], [4,5,6]):", dot(a, b))
  // Output: dot([1,2,3], [4,5,6]): 32
  yield* Console.log("normL1([1,2,3]):", normL1(a))
  yield* Console.log("normL2([1,2,3]):", normL2(a))
  yield* Console.log("normLinf([1,2,3]):", normLinf(a))

  const added = vectorAdd(a, b)
  yield* Console.log("vectorAdd:", Chunk.toReadonlyArray(added))

  const scaled = vectorScale(2.5, a)
  yield* Console.log("vectorScale(2.5):", Chunk.toReadonlyArray(scaled))

  // 2×3 matrix times 3-vector
  const matrix = Chunk.fromIterable([1, 0, 0, 0, 1, 0])
  const x = Chunk.fromIterable([7, 8, 9])
  const y = matvec(matrix, 2, 3, x)
  yield* Console.log("matvec(2×3 · [7,8,9]):", Chunk.toReadonlyArray(y))
  // Output: matvec(2×3 · [7,8,9]): [ 7, 8 ]

  const t = transpose(matrix, 2, 3)
  yield* Console.log("transpose(2×3):", Chunk.toReadonlyArray(t))

  const frob = frobeniusNorm(Chunk.fromIterable([1, 2, 3, 4]), 2, 2)
  yield* Console.log("frobeniusNorm(2×2):", frob)

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const dotVal = yield* dotValidated({ a: [1, 2, 3], b: [4, 5, 6] })
  yield* Console.log("dotValidated:", dotVal)

  // ─── Policy-aware — reads runtime services from context ──────────
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const dotP = yield* dotWithPolicies(a, b).pipe(Effect.provide(policies))
  yield* Console.log("dotWithPolicies (strict):", dotP)

  const normP = yield* normWithPolicies(a, "L2").pipe(Effect.provide(policies))
  yield* Console.log("normWithPolicies (L2, strict):", normP)
  // Output: normWithPolicies (L2, strict): 3.7416573867739413
})

BunRuntime.runMain(program)
