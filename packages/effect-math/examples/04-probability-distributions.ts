/**
 * Computes normal and uniform density and cumulative values plus Shannon
 * entropy, then exercises validated and runtime-policy variants.
 *
 * Run: bun run packages/effect-math/examples/04-probability-distributions.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import {
  entropyValidated,
  normalCdf,
  normalCdfValidated,
  normalPdf,
  normalPdfValidated,
  normalPdfWithPolicies,
  shannonEntropy,
  standardNormalCdf,
  standardNormalPdf,
  uniformCdf,
  uniformPdf
} from "@scenesystems/effect-math/Probability"

const program = Effect.gen(function*() {
  // Standard normal kernels
  yield* Console.log("standardNormalPdf(0):", standardNormalPdf(0))
  yield* Console.log("standardNormalCdf(0):", standardNormalCdf(0))
  // Output: standardNormalCdf(0): 0.5

  // Parameterized normal kernels
  const pdfVal = normalPdf(1.5, 0, 1)
  yield* Console.log("normalPdf(x=1.5, μ=0, σ=1):", pdfVal)

  const cdfVal = normalCdf(1.96, 0, 1)
  yield* Console.log("normalCdf(x=1.96, μ=0, σ=1):", cdfVal)
  // Output: normalCdf(x=1.96, μ=0, σ=1): 0.9750021738917761

  // Uniform distribution kernels
  yield* Console.log("uniformPdf(x=0.5, low=0, high=1):", uniformPdf(0.5, 0, 1))
  yield* Console.log("uniformCdf(x=0.5, low=0, high=1):", uniformCdf(0.5, 0, 1))

  // Shannon entropy
  const fairCoin = Chunk.fromIterable([0.5, 0.5])
  yield* Console.log("shannonEntropy(fair coin):", shannonEntropy(fairCoin))

  const biased = Chunk.fromIterable([0.9, 0.1])
  yield* Console.log("shannonEntropy(biased 90/10):", shannonEntropy(biased))

  // Schema-validated boundary
  const normalPdfV = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
  yield* Console.log("normalPdfValidated (standard normal at 0):", normalPdfV)

  const normalCdfV = yield* normalCdfValidated({ x: 0, mu: 0, sigma: 1 })
  yield* Console.log("normalCdfValidated (standard normal at 0):", normalCdfV)

  const entropyV = yield* entropyValidated({ probabilities: [0.25, 0.25, 0.25, 0.25] })
  yield* Console.log("entropyValidated (uniform 4-class):", entropyV)

  // Strict runtime policy
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(7),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const pdfP = yield* normalPdfWithPolicies(0, 0, 1).pipe(Effect.provide(policies))
  yield* Console.log("normalPdfWithPolicies (strict):", pdfP)
  // Output: normalPdfWithPolicies (strict): 0.3989422804014327
})

BunRuntime.runMain(program)
