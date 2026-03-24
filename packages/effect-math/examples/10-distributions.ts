/**
 * Distribution — full algebra of 10 distribution families.
 *
 * Each family provides PDF/CDF, logPDF, quantile (where applicable),
 * mean, variance, and entropy. Pure kernels compute directly;
 * schema-validated variants decode boundary input; policy-aware variants
 * read precision settings from the RuntimePolicies layer.
 *
 * What this shows: pure kernels across Normal, LogNormal, Exponential,
 * Uniform, Beta, Gamma, Student-t, Categorical, Binomial, and Poisson;
 * schema-validated `normalPdfValidated` / `betaCdfValidated`;
 * and policy-aware `normalPdfWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/10-distributions.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  betaCdf,
  betaCdfValidated,
  betaMean,
  binomialMean,
  binomialPmf,
  categoricalEntropy,
  categoricalPmf,
  exponentialCdf,
  exponentialMean,
  gammaCdf,
  gammaMean,
  logNormalMean,
  logNormalPdf,
  normalCdf,
  normalEntropy,
  normalMean,
  normalPdf,
  normalPdfValidated,
  normalPdfWithPolicies,
  normalQuantile,
  normalVariance,
  poissonMean,
  poissonPmf,
  studentTCdf,
  studentTMean,
  uniformMean,
  uniformPdf
} from "effect-math/Distribution"

const program = Effect.gen(function*() {
  // ─── Normal ──────────────────────────────────────────────────────
  yield* Console.log("=== Normal ===")
  yield* Console.log("  pdf(0, μ=0, σ=1):", normalPdf(0, 0, 1))
  yield* Console.log("  cdf(1.96, μ=0, σ=1):", normalCdf(1.96, 0, 1))
  yield* Console.log("  quantile(0.975, μ=0, σ=1):", normalQuantile(0.975, 0, 1))
  yield* Console.log("  mean(μ=5, σ=2):", normalMean(5, 2))
  yield* Console.log("  variance(μ=0, σ=3):", normalVariance(0, 3))
  yield* Console.log("  entropy(μ=0, σ=1):", normalEntropy(0, 1))

  // ─── LogNormal ───────────────────────────────────────────────────
  yield* Console.log("\n=== LogNormal ===")
  yield* Console.log("  pdf(1, μ=0, σ=1):", logNormalPdf(1, 0, 1))
  yield* Console.log("  mean(μ=0, σ=1):", logNormalMean(0, 1))

  // ─── Exponential ─────────────────────────────────────────────────
  yield* Console.log("\n=== Exponential ===")
  yield* Console.log("  cdf(1, rate=1):", exponentialCdf(1, 1))
  yield* Console.log("  mean(rate=2):", exponentialMean(2))

  // ─── Uniform ─────────────────────────────────────────────────────
  yield* Console.log("\n=== Uniform ===")
  yield* Console.log("  pdf(0.5, low=0, high=1):", uniformPdf(0.5, 0, 1))
  yield* Console.log("  mean(low=0, high=10):", uniformMean(0, 10))

  // ─── Beta ────────────────────────────────────────────────────────
  yield* Console.log("\n=== Beta ===")
  yield* Console.log("  cdf(0.5, α=2, β=2):", betaCdf(0.5, 2, 2))
  yield* Console.log("  mean(α=2, β=5):", betaMean(2, 5))

  // ─── Gamma ───────────────────────────────────────────────────────
  yield* Console.log("\n=== Gamma ===")
  yield* Console.log("  cdf(1, shape=2, scale=1):", gammaCdf(1, 2, 1))
  yield* Console.log("  mean(shape=5, scale=2):", gammaMean(5, 2))

  // ─── Student-t ───────────────────────────────────────────────────
  yield* Console.log("\n=== Student-t ===")
  yield* Console.log("  cdf(0, df=5):", studentTCdf(0, 5))
  yield* Console.log("  mean(df=10):", studentTMean(10))

  // ─── Categorical ─────────────────────────────────────────────────
  yield* Console.log("\n=== Categorical ===")
  const probs = Chunk.fromIterable([0.2, 0.3, 0.5])
  yield* Console.log("  pmf(k=2, [.2,.3,.5]):", categoricalPmf(2, probs))
  yield* Console.log("  entropy([.2,.3,.5]):", categoricalEntropy(probs))

  // ─── Binomial ────────────────────────────────────────────────────
  yield* Console.log("\n=== Binomial ===")
  yield* Console.log("  pmf(k=3, n=10, p=0.5):", binomialPmf(3, 10, 0.5))
  yield* Console.log("  mean(n=10, p=0.5):", binomialMean(10, 0.5))

  // ─── Poisson ─────────────────────────────────────────────────────
  yield* Console.log("\n=== Poisson ===")
  yield* Console.log("  pmf(k=3, μ=5):", poissonPmf(3, 5))
  yield* Console.log("  mean(μ=5):", poissonMean(5))

  // ─── Schema-validated ────────────────────────────────────────────
  yield* Console.log("\n=== Schema-validated ===")
  const pdfV = yield* normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
  yield* Console.log("  normalPdfValidated:", pdfV)

  const betaV = yield* betaCdfValidated({ x: 0.5, alpha: 2, beta: 2 })
  yield* Console.log("  betaCdfValidated:", betaV)

  // ─── Policy-aware ────────────────────────────────────────────────
  yield* Console.log("\n=== Policy-aware ===")
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })
  const pdfP = yield* normalPdfWithPolicies(0, 0, 1).pipe(Effect.provide(policies))
  yield* Console.log("  normalPdfWithPolicies (strict):", pdfP)
})

BunRuntime.runMain(program)
