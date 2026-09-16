/**
 * Computes vector norms, vector arithmetic, and matrix operations with immutable
 * chunks, then exercises validated and runtime-policy variants.
 *
 * Run: bun run packages/effect-math/examples/02-linear-algebra-vectors.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array, Chunk, Console, Effect } from "effect"

import {
  add,
  dot,
  dotValidated,
  dotWithPolicies,
  frobeniusNorm,
  matvec,
  normL1,
  normL2,
  normLinf,
  normWithPolicies,
  scale,
  transpose
} from "@scenesystems/effect-math/LinearAlgebra"
import * as Policy from "@scenesystems/effect-math/Policy"

const program = Effect.gen(function*() {
  const a = Chunk.make(1, 2, 3)
  const b = Chunk.make(4, 5, 6)

  // Direct kernels
  yield* Console.log("dot([1,2,3], [4,5,6]):", dot(a, b))
  // Output: dot([1,2,3], [4,5,6]): 32
  yield* Console.log("normL1([1,2,3]):", normL1(a))
  yield* Console.log("normL2([1,2,3]):", normL2(a))
  yield* Console.log("normLinf([1,2,3]):", normLinf(a))

  const added = add(a, b)
  yield* Console.log("add:", added)

  const scaled = scale(a, 2.5)
  yield* Console.log("scale(2.5):", scaled)

  // 2×3 matrix times 3-vector
  const matrix = Chunk.make(1, 0, 0, 0, 1, 0)
  const x = Chunk.make(7, 8, 9)
  const y = matvec(matrix, 2, 3, x)
  yield* Console.log("matvec(2×3 · [7,8,9]):", y)
  // Output: matvec(2×3 · [7,8,9]): [ 7, 8 ]

  const t = transpose(matrix, 2, 3)
  yield* Console.log("transpose(2×3):", t)

  const frob = frobeniusNorm(Chunk.make(1, 2, 3, 4), 2, 2)
  yield* Console.log("frobeniusNorm(2×2):", frob)

  // Schema-validated boundary
  const dotVal = yield* dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5, 6) })
  yield* Console.log("dotValidated:", dotVal)

  // Runtime policies
  const policies = Policy.layerDeterministic({
    seed: Policy.Seed.make(42),
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
