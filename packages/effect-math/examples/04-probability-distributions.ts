/**
 * Probability — normal PDF/CDF, uniform PDF/CDF, and Shannon entropy.
 *
 * Distribution functions are the building blocks of Bayesian inference,
 * hypothesis testing, and information-theoretic scoring. Pure kernels
 * compute density/cumulative values directly; schema-validated variants
 * decode boundary input; policy-aware variants read precision settings.
 *
 * What this shows: `standardNormalPdf`/`standardNormalCdf`, parameterized
 * `normalPdf`/`normalCdf`, `uniformPdf`/`uniformCdf`, `shannonEntropy`,
 * schema-validated `normalPdfValidated` / `normalCdfValidated` /
 * `entropyValidated`, and policy-aware `normalPdfWithPolicies`.
 *
 * Feature Type Links:
 * - {@link Chunk}
 * - {@link Seed}
 * - {@link RuntimePolicies}
 *
 * Run: bun run packages/effect-math/examples/04-probability-distributions.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import {
  entropyValidated,
  makeDeterministicRuntimePoliciesLayer,
  normalCdf,
  normalCdfValidated,
  normalPdf,
  normalPdfValidated,
  normalPdfWithPolicies,
  Seed,
  shannonEntropy,
  standardNormalCdf,
  standardNormalPdf,
  uniformCdf,
  uniformPdf
} from "effect-math"

const program = Effect.gen(function*() {
  // ─── Pure kernels — standard normal ──────────────────────────────
  yield* Console.log("standardNormalPdf(0):", standardNormalPdf(0))
  yield* Console.log("standardNormalCdf(0):", standardNormalCdf(0))
  // Output: standardNormalCdf(0): 0.5

  // ─── Pure kernels — parameterized normal ─────────────────────────
  const pdfVal = normalPdf(1.5, 0, 1)
  yield* Console.log("normalPdf(x=1.5, μ=0, σ=1):", pdfVal)

  const cdfVal = normalCdf(1.96, 0, 1)
  yield* Console.log("normalCdf(x=1.96, μ=0, σ=1):", cdfVal)
  // Output: normalCdf(x=1.96, μ=0, σ=1): 0.9750021738917761

  // ─── Pure kernels — uniform distribution ─────────────────────────
  yield* Console.log("uniformPdf(x=0.5, low=0, high=1):", uniformPdf(0.5, 0, 1))
  yield* Console.log("uniformCdf(x=0.5, low=0, high=1):", uniformCdf(0.5, 0, 1))

  // ─── Pure kernel — Shannon entropy ───────────────────────────────
  const fairCoin = Chunk.fromIterable([0.5, 0.5])
  yield* Console.log("shannonEntropy(fair coin):", shannonEntropy(fairCoin))

  const biased = Chunk.fromIterable([0.9, 0.1])
  yield* Console.log("shannonEntropy(biased 90/10):", shannonEntropy(biased))

  // ─── Schema-validated — boundary input decoded via Schema ─────────
  const normalPdfV = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
  yield* Console.log("normalPdfValidated (standard normal at 0):", normalPdfV)

  const normalCdfV = yield* normalCdfValidated({ x: 0, mu: 0, sigma: 1 })
  yield* Console.log("normalCdfValidated (standard normal at 0):", normalCdfV)

  const entropyV = yield* entropyValidated({ probabilities: [0.25, 0.25, 0.25, 0.25] })
  yield* Console.log("entropyValidated (uniform 4-class):", entropyV)

  // ─── Policy-aware — strict precision ─────────────────────────────
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
