/**
 * Distribution operation surface — pure kernel re-exports, Schema-validated
 * variants with boundary input checking, and policy-aware operations
 * that respect `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * Covers 11 distribution families: Normal, LogNormal, Exponential, Uniform,
 * Beta, Gamma, StudentT, NoncentralT, Categorical, Binomial, Poisson.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Number as N, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { DistributionDecodeError, DistributionDomainViolationError, DistributionParameterError } from "./errors.js"
import * as BetaKernel from "./internal/beta.js"
import * as BinomialKernel from "./internal/binomial.js"
import * as CategoricalKernel from "./internal/categorical.js"
import * as ExponentialKernel from "./internal/exponential.js"
import * as GammaKernel from "./internal/gamma.js"
import * as LogNormalKernel from "./internal/logNormal.js"
import * as NoncentralTKernel from "./internal/noncentralT.js"
import * as NormalKernel from "./internal/normal.js"
import * as PoissonKernel from "./internal/poisson.js"
import * as StudentTKernel from "./internal/studentT.js"
import * as UniformKernel from "./internal/uniform.js"
import { DistributionDomainModel } from "./model.js"
import {
  BetaDistEvalInput,
  BetaQuantileInput,
  CategoricalDistEvalInput,
  NoncentralTDistEvalInput,
  NoncentralTQuantileInput,
  NormalDistEvalInput,
  NormalQuantileInput,
  UniformDistEvalInput
} from "./schema.js"

/**
 * Lifts the static `DistributionDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadDistributionDomain = Effect.succeed(DistributionDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Normal
// ---------------------------------------------------------------------------

/**
 * Normal PDF: f(x | μ, σ) = (1/(σ√(2π))) exp(−(x−μ)²/(2σ²)).
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdf: (x: number, mu: number, sigma: number) => number = NormalKernel.normalPdf

/**
 * Normal log-PDF: ln f(x | μ, σ).
 *
 * @since 0.1.0
 * @category operations
 */
export const normalLogpdf: (x: number, mu: number, sigma: number) => number = NormalKernel.normalLogpdf

/**
 * Normal CDF: P(X ≤ x) for X ~ N(μ, σ²). Delegates to erf.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdf: (x: number, mu: number, sigma: number) => number = NormalKernel.normalCdf

/**
 * Normal quantile (inverse CDF): x such that P(X ≤ x) = p. Delegates to erfinv.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalQuantile: (p: number, mu: number, sigma: number) => number = NormalKernel.normalQuantile

/**
 * Normal mean: μ.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalMean: (mu: number, sigma: number) => number = NormalKernel.normalMean

/**
 * Normal variance: σ².
 *
 * @since 0.1.0
 * @category operations
 */
export const normalVariance: (mu: number, sigma: number) => number = NormalKernel.normalVariance

/**
 * Normal differential entropy: ½ ln(2πeσ²).
 *
 * @since 0.1.0
 * @category operations
 */
export const normalEntropy: (mu: number, sigma: number) => number = NormalKernel.normalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — LogNormal
// ---------------------------------------------------------------------------

/**
 * Log-normal PDF for x > 0 with log-space parameters μ and σ.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalPdf: (x: number, mu: number, sigma: number) => number = LogNormalKernel.logNormalPdf

/**
 * Log-normal log-PDF: ln f(x; μ, σ) = −ln(x) − ln(σ) − ½ln(2π) − ½((ln x − μ)/σ)².
 * Returns −∞ for x ≤ 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalLogpdf: (x: number, mu: number, sigma: number) => number = LogNormalKernel.logNormalLogpdf

/**
 * Log-normal CDF: F(x; μ, σ) = ½(1 + erf((ln x − μ)/(σ√2))). Returns 0 for x ≤ 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalCdf: (x: number, mu: number, sigma: number) => number = LogNormalKernel.logNormalCdf

/**
 * Log-normal quantile (inverse CDF): Q(p) = exp(μ + σ√2 · erfinv(2p − 1)).
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalQuantile: (p: number, mu: number, sigma: number) => number = LogNormalKernel.logNormalQuantile

/**
 * Log-normal mean: exp(μ + σ²/2).
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalMean: (mu: number, sigma: number) => number = LogNormalKernel.logNormalMean

/**
 * Log-normal variance: (exp(σ²) − 1) · exp(2μ + σ²).
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalVariance: (mu: number, sigma: number) => number = LogNormalKernel.logNormalVariance

/**
 * Log-normal differential entropy: μ + ½ + ½ln(2π) + ln(σ).
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalEntropy: (mu: number, sigma: number) => number = LogNormalKernel.logNormalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Exponential
// ---------------------------------------------------------------------------

/**
 * Exponential PDF: λ exp(−λx) for x ≥ 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialPdf: (x: number, rate: number) => number = ExponentialKernel.exponentialPdf

/**
 * Exponential log-PDF: ln(λ) − λx for x ≥ 0, −∞ otherwise.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialLogpdf: (x: number, rate: number) => number = ExponentialKernel.exponentialLogpdf

/**
 * Exponential CDF: 1 − exp(−λx) for x ≥ 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialCdf: (x: number, rate: number) => number = ExponentialKernel.exponentialCdf

/**
 * Exponential quantile: −ln(1−p)/λ.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialQuantile: (p: number, rate: number) => number = ExponentialKernel.exponentialQuantile

/**
 * Exponential mean: 1/λ.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialMean: (rate: number) => number = ExponentialKernel.exponentialMean

/**
 * Exponential variance: 1/λ².
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialVariance: (rate: number) => number = ExponentialKernel.exponentialVariance

/**
 * Exponential differential entropy: 1 − ln(λ).
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialEntropy: (rate: number) => number = ExponentialKernel.exponentialEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Uniform
// ---------------------------------------------------------------------------

/**
 * Uniform PDF: 1/(high−low) when low ≤ x ≤ high.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdf: (x: number, low: number, high: number) => number = UniformKernel.uniformPdf

/**
 * Uniform log-PDF: −ln(high − low) when low ≤ x ≤ high, −∞ otherwise.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformLogpdf: (x: number, low: number, high: number) => number = UniformKernel.uniformLogpdf

/**
 * Uniform CDF: (x − low)/(high − low) clamped to [0, 1].
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformCdf: (x: number, low: number, high: number) => number = UniformKernel.uniformCdf

/**
 * Uniform quantile: low + p·(high−low).
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformQuantile: (p: number, low: number, high: number) => number = UniformKernel.uniformQuantile

/**
 * Uniform mean: (low+high)/2.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformMean: (low: number, high: number) => number = UniformKernel.uniformMean

/**
 * Uniform variance: (high−low)²/12.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformVariance: (low: number, high: number) => number = UniformKernel.uniformVariance

/**
 * Uniform differential entropy: ln(high−low).
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformEntropy: (low: number, high: number) => number = UniformKernel.uniformEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Beta
// ---------------------------------------------------------------------------

/**
 * Beta PDF for x ∈ (0,1) with shape parameters α and β.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaPdf: (x: number, alpha: number, beta: number) => number = BetaKernel.betaPdf

/**
 * Beta log-PDF: (α−1)ln(x) + (β−1)ln(1−x) − ln B(α,β). Returns −∞ outside (0,1).
 *
 * @since 0.1.0
 * @category operations
 */
export const betaLogpdf: (x: number, alpha: number, beta: number) => number = BetaKernel.betaLogpdf

/**
 * Beta CDF via regularized incomplete beta function.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdf: (x: number, alpha: number, beta: number) => number = BetaKernel.betaCdf

/**
 * Beta quantile via Newton iteration on CDF inverse.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaQuantile: (p: number, alpha: number, beta: number) => number = BetaKernel.betaQuantile

/**
 * Beta mean: α/(α+β).
 *
 * @since 0.1.0
 * @category operations
 */
export const betaMean: (alpha: number, beta: number) => number = BetaKernel.betaMean

/**
 * Beta variance: αβ/((α+β)²(α+β+1)).
 *
 * @since 0.1.0
 * @category operations
 */
export const betaVariance: (alpha: number, beta: number) => number = BetaKernel.betaVariance

/**
 * Beta differential entropy: ln B(α,β) − (α−1)ψ(α) − (β−1)ψ(β) + (α+β−2)ψ(α+β).
 *
 * @since 0.1.0
 * @category operations
 */
export const betaEntropy: (alpha: number, beta: number) => number = BetaKernel.betaEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Gamma
// ---------------------------------------------------------------------------

/**
 * Gamma PDF for x > 0 with shape k and scale θ.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaPdf: (x: number, shape: number, scale: number) => number = GammaKernel.gammaPdf

/**
 * Gamma log-PDF: (k−1)ln(x) − x/θ − k·ln(θ) − ln Γ(k). Returns −∞ for x ≤ 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaLogpdf: (x: number, shape: number, scale: number) => number = GammaKernel.gammaLogpdf

/**
 * Gamma CDF via regularized incomplete gamma function.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaCdf: (x: number, shape: number, scale: number) => number = GammaKernel.gammaCdf

/**
 * Gamma quantile via Newton iteration on CDF inverse.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaQuantile: (p: number, shape: number, scale: number) => number = GammaKernel.gammaQuantile

/**
 * Gamma mean: kθ.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaMean: (shape: number, scale: number) => number = GammaKernel.gammaMean

/**
 * Gamma variance: kθ².
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaVariance: (shape: number, scale: number) => number = GammaKernel.gammaVariance

/**
 * Gamma differential entropy: k + ln(θ) + ln Γ(k) + (1−k)ψ(k).
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaEntropy: (shape: number, scale: number) => number = GammaKernel.gammaEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — StudentT
// ---------------------------------------------------------------------------

/**
 * Student's t-distribution PDF with ν degrees of freedom.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTPdf: (x: number, df: number) => number = StudentTKernel.studentTPdf

/**
 * Student's t log-PDF: ln Γ((ν+1)/2) − ln Γ(ν/2) − ½ln(νπ) − ((ν+1)/2)ln(1+x²/ν).
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTLogpdf: (x: number, df: number) => number = StudentTKernel.studentTLogpdf

/**
 * Student's t CDF via regularized incomplete beta function.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTCdf: (x: number, df: number) => number = StudentTKernel.studentTCdf

/**
 * Student's t quantile via Newton iteration.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTQuantile: (p: number, df: number) => number = StudentTKernel.studentTQuantile

/**
 * Student's t mean: 0 for ν > 1, NaN otherwise.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTMean: (df: number) => number = StudentTKernel.studentTMean

/**
 * Student's t variance: ν/(ν−2) for ν > 2.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTVariance: (df: number) => number = StudentTKernel.studentTVariance

/**
 * Noncentral Student's t CDF.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTCdf: (x: number, df: number, noncentrality: number) => number = NoncentralTKernel.noncentralTCdf

/**
 * Noncentral Student's t quantile.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTQuantile: (p: number, df: number, noncentrality: number) => number =
  NoncentralTKernel.noncentralTQuantile

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Categorical
// ---------------------------------------------------------------------------

/**
 * Categorical PMF: P(X = k) = probs[k].
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalPmf: (k: number, probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalPmf

/**
 * Categorical log-PMF: ln(probs[k]). Returns −∞ when k is out of range.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalLogpmf: (k: number, probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalLogpmf

/**
 * Categorical CDF: P(X ≤ k).
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalCdf: (k: number, probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalCdf

/**
 * Categorical mean: Σ i·pᵢ.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalMean: (probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalMean

/**
 * Categorical variance: Σ i²·pᵢ − μ².
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalVariance: (probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalVariance

/**
 * Categorical entropy: −Σ pᵢ ln(pᵢ).
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalEntropy: (probs: Chunk.Chunk<number>) => number = CategoricalKernel.categoricalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Binomial
// ---------------------------------------------------------------------------

/**
 * Binomial PMF: P(X = k) for X ~ Binom(n, p).
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialPmf: (k: number, n: number, p: number) => number = BinomialKernel.binomialPmf

/**
 * Binomial log-PMF: ln C(n,k) + k·ln(p) + (n−k)·ln(1−p).
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialLogpmf: (k: number, n: number, p: number) => number = BinomialKernel.binomialLogPmf

/**
 * Binomial CDF via regularized incomplete beta function.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialCdf: (k: number, n: number, p: number) => number = BinomialKernel.binomialCdf

/**
 * Binomial mean: n·p.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialMean: (n: number, p: number) => number = BinomialKernel.binomialMean

/**
 * Binomial variance: n·p·(1−p).
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialVariance: (n: number, p: number) => number = BinomialKernel.binomialVariance

// ---------------------------------------------------------------------------
// Pure kernel re-exports — Poisson
// ---------------------------------------------------------------------------

/**
 * Poisson PMF: P(X = k) for X ~ Poisson(μ).
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonPmf: (k: number, mu: number) => number = PoissonKernel.poissonPmf

/**
 * Poisson log-PMF: k·ln(μ) − μ − ln(k!).
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonLogpmf: (k: number, mu: number) => number = PoissonKernel.poissonLogPmf

/**
 * Poisson CDF via upper incomplete gamma function.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonCdf: (k: number, mu: number) => number = PoissonKernel.poissonCdf

/**
 * Poisson mean: μ.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonMean: (mu: number) => number = PoissonKernel.poissonMean

/**
 * Poisson variance: μ.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonVariance: (mu: number) => number = PoissonKernel.poissonVariance

// ---------------------------------------------------------------------------
// Schema-validated operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated normal PDF — decodes `input` through `NormalDistEvalInput`.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalPdf",
          message: error.message
        })
      )
    )

    return NormalKernel.normalPdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Boundary-validated normal CDF.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalCdf",
          message: error.message
        })
      )
    )

    return NormalKernel.normalCdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Boundary-validated normal quantile.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalQuantileValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalQuantileInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalQuantile",
          message: error.message
        })
      )
    )

    return NormalKernel.normalQuantile(decoded.p, decoded.mu, decoded.sigma)
  })

/**
 * Boundary-validated uniform PDF with parameter checking.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(UniformDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "uniformPdf",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.lessThan(d.low, d.high),
      (d) =>
        new DistributionParameterError({
          operation: "uniformPdf",
          message: `Uniform distribution requires low < high, got low=${d.low}, high=${d.high}`
        })
    )

    return UniformKernel.uniformPdf(decoded.x, decoded.low, decoded.high)
  })

/**
 * Boundary-validated beta CDF.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "betaCdf",
          message: error.message
        })
      )
    )

    return BetaKernel.betaCdf(decoded.x, decoded.alpha, decoded.beta)
  })

/**
 * Boundary-validated beta quantile.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaQuantileValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaQuantileInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "betaQuantile",
          message: error.message
        })
      )
    )

    return BetaKernel.betaQuantile(decoded.p, decoded.alpha, decoded.beta)
  })

/**
 * Boundary-validated categorical PMF.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalPmfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(CategoricalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "categoricalPmf",
          message: error.message
        })
      )
    )

    return CategoricalKernel.categoricalPmf(decoded.k, Chunk.fromIterable(decoded.probs))
  })

/**
 * Boundary-validated noncentral Student's t CDF.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NoncentralTDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "noncentralTCdf",
          message: error.message
        })
      )
    )

    return NoncentralTKernel.noncentralTCdf(decoded.x, decoded.df, decoded.noncentrality)
  })

/**
 * Boundary-validated noncentral Student's t quantile.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTQuantileValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NoncentralTQuantileInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "noncentralTQuantile",
          message: error.message
        })
      )
    )

    return NoncentralTKernel.noncentralTQuantile(decoded.p, decoded.df, decoded.noncentrality)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware normal PDF — reads `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from context.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.normalPdfWithPolicies",
    compute: () => NormalKernel.normalPdf(x, mu, sigma),
    makeError: (message) => new DistributionDomainViolationError({ operation: "normalPdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), mu: String(mu), sigma: String(sigma), result: String(result) })
  })

/**
 * Policy-aware normal CDF.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.normalCdfWithPolicies",
    compute: () => NormalKernel.normalCdf(x, mu, sigma),
    makeError: (message) => new DistributionDomainViolationError({ operation: "normalCdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), mu: String(mu), sigma: String(sigma), result: String(result) })
  })

/**
 * Policy-aware noncentral Student's t CDF.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTCdfWithPolicies = (x: number, df: number, noncentrality: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.noncentralTCdfWithPolicies",
    compute: () => NoncentralTKernel.noncentralTCdf(x, df, noncentrality),
    makeError: (message) => new DistributionDomainViolationError({ operation: "noncentralTCdfWithPolicies", message }),
    annotations: (result) => ({
      x: String(x),
      df: String(df),
      noncentrality: String(noncentrality),
      result: String(result)
    })
  })

/**
 * Policy-aware noncentral Student's t quantile.
 *
 * @since 0.3.0
 * @category operations
 */
export const noncentralTQuantileWithPolicies = (p: number, df: number, noncentrality: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.noncentralTQuantileWithPolicies",
    compute: () => NoncentralTKernel.noncentralTQuantile(p, df, noncentrality),
    makeError: (message) =>
      new DistributionDomainViolationError({ operation: "noncentralTQuantileWithPolicies", message }),
    annotations: (result) => ({
      p: String(p),
      df: String(df),
      noncentrality: String(noncentrality),
      result: String(result)
    })
  })

/**
 * Policy-aware beta CDF.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdfWithPolicies = (x: number, alpha: number, beta: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.betaCdfWithPolicies",
    compute: () => BetaKernel.betaCdf(x, alpha, beta),
    makeError: (message) => new DistributionDomainViolationError({ operation: "betaCdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), alpha: String(alpha), beta: String(beta), result: String(result) })
  })
