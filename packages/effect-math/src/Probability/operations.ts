/**
 * Probability operation surface — pure kernel re-exports, Schema-validated
 * variants with boundary input checking, and policy-aware operations
 * that respect `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { ProbabilityDecodeError, ProbabilityDomainViolationError, ProbabilityParameterError } from "./errors.js"
import * as Distributions from "./internal/distributions.js"
import * as EntropyKernel from "./internal/entropy.js"
import { ProbabilityDomainModel } from "./model.js"
import { EntropyInput, NormalEvalInput, UniformEvalInput } from "./schema.js"

/**
 * Lifts the static `ProbabilityDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadProbabilityDomain = Effect.succeed(ProbabilityDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Standard normal (μ=0, σ=1) probability density function:
 * `(1 / √(2π)) · exp(−x²/2)`. Pure scalar function.
 *
 * @see {@link normalPdf} for arbitrary μ and σ
 * @see {@link normalPdfValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const standardNormalPdf: (x: number) => number = Distributions.standardNormalPdf

/**
 * Normal (Gaussian) PDF — `(1 / (σ√(2π))) · exp(−(x−μ)² / (2σ²))`.
 * Requires σ > 0; no runtime guard is applied.
 *
 * @see {@link normalPdfValidated} for Schema-validated boundary input
 * @see {@link normalPdfWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const normalPdf: (x: number, mu: number, sigma: number) => number = Distributions.normalPdf

/**
 * Standard normal (μ=0, σ=1) cumulative distribution function via
 * Abramowitz & Stegun rational approximation (maximum error ≈ 7.5×10⁻⁸).
 *
 * @see {@link normalCdf} for arbitrary μ and σ
 * @since 0.1.0
 * @category operations
 */
export const standardNormalCdf: (x: number) => number = Distributions.standardNormalCdf

/**
 * Normal CDF — `P(X ≤ x)` for `X ~ N(μ, σ²)`. Computed by standardising
 * and delegating to `standardNormalCdf`.
 *
 * @see {@link normalCdfValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const normalCdf: (x: number, mu: number, sigma: number) => number = Distributions.normalCdf

/**
 * Uniform PDF — `1 / (high − low)` when `low ≤ x ≤ high`, else `0`.
 * Requires `low < high`; no runtime guard is applied.
 *
 * @see {@link uniformPdfValidated} for Schema-validated boundary input with parameter checking
 * @since 0.1.0
 * @category operations
 */
export const uniformPdf: (x: number, low: number, high: number) => number = Distributions.uniformPdf

/**
 * Uniform CDF — linear interpolation `(x − low) / (high − low)` clamped
 * to `[0, 1]`. Requires `low < high`; no runtime guard is applied.
 *
 * @see {@link uniformCdfValidated} for Schema-validated boundary input with parameter checking
 * @since 0.1.0
 * @category operations
 */
export const uniformCdf: (x: number, low: number, high: number) => number = Distributions.uniformCdf

/**
 * Shannon entropy `H = −Σ pᵢ · ln(pᵢ)` over a discrete probability
 * distribution. Zero-probability bins are skipped (0·ln(0) = 0 by
 * convention). Result is in nats; divide by `ln(2)` for bits.
 *
 * @see {@link entropyValidated} for Schema-validated boundary input
 * @since 0.1.0
 * @category operations
 */
export const shannonEntropy: (probabilities: Chunk.Chunk<number>) => number = EntropyKernel.shannonEntropy

// ---------------------------------------------------------------------------
// Schema-validated operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated normal PDF — decodes `input` through `NormalEvalInput`
 * and computes `f(x | μ, σ)`. Fails with `ProbabilityDecodeError` for
 * malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { normalPdfValidated } from "effect-math"
 *
 * const program = normalPdfValidated({ x: 0, mu: 0, sigma: 1 })
 * // Effect succeeds with ≈ 0.3989
 * ```
 *
 * @see {@link normalPdf} for the pure kernel (no validation overhead)
 * @see {@link normalPdfWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const normalPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ProbabilityDecodeError({
          operation: "normalPdf",
          message: error.message
        })
      )
    )

    return Distributions.normalPdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Boundary-validated normal CDF — decodes `input` through `NormalEvalInput`
 * and computes `P(X ≤ x)` for `X ~ N(μ, σ²)`. Fails with
 * `ProbabilityDecodeError` for malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { normalCdfValidated } from "effect-math"
 *
 * const program = normalCdfValidated({ x: 0, mu: 0, sigma: 1 })
 * // Effect succeeds with 0.5
 * ```
 *
 * @see {@link normalCdf} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const normalCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ProbabilityDecodeError({
          operation: "normalCdf",
          message: error.message
        })
      )
    )

    return Distributions.normalCdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Boundary-validated uniform PDF — decodes `input` through
 * `UniformEvalInput`, validates `low < high`, and computes
 * `1 / (high − low)` when `low ≤ x ≤ high`. Fails with
 * `ProbabilityDecodeError` for malformed input or
 * `ProbabilityParameterError` when `low ≥ high`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { uniformPdfValidated } from "effect-math"
 *
 * const program = uniformPdfValidated({ x: 0.5, low: 0, high: 1 })
 * // Effect succeeds with 1
 * ```
 *
 * @see {@link uniformPdf} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const uniformPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(UniformEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ProbabilityDecodeError({
          operation: "uniformPdf",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.lessThan(d.low, d.high),
      (d) =>
        new ProbabilityParameterError({
          operation: "uniformPdf",
          message: `Uniform distribution requires low < high, got low=${d.low}, high=${d.high}`
        })
    )

    return Distributions.uniformPdf(decoded.x, decoded.low, decoded.high)
  })

/**
 * Boundary-validated uniform CDF — decodes `input` through
 * `UniformEvalInput`, validates `low < high`, and computes `P(X ≤ x)`
 * for the uniform distribution. Fails with `ProbabilityDecodeError` for
 * malformed input or `ProbabilityParameterError` when `low ≥ high`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { uniformCdfValidated } from "effect-math"
 *
 * const program = uniformCdfValidated({ x: 0.5, low: 0, high: 1 })
 * // Effect succeeds with 0.5
 * ```
 *
 * @see {@link uniformCdf} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const uniformCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(UniformEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ProbabilityDecodeError({
          operation: "uniformCdf",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.lessThan(d.low, d.high),
      (d) =>
        new ProbabilityParameterError({
          operation: "uniformCdf",
          message: `Uniform distribution requires low < high, got low=${d.low}, high=${d.high}`
        })
    )

    return Distributions.uniformCdf(decoded.x, decoded.low, decoded.high)
  })

/**
 * Boundary-validated Shannon entropy — decodes through `EntropyInput`
 * and computes `H = −Σ pᵢ · ln(pᵢ)`. Fails with `ProbabilityDecodeError`
 * for malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { entropyValidated } from "effect-math"
 *
 * const program = entropyValidated({ probabilities: [0.5, 0.5] })
 * // Effect succeeds with ln(2) ≈ 0.6931
 * ```
 *
 * @see {@link shannonEntropy} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const entropyValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(EntropyInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ProbabilityDecodeError({
          operation: "entropy",
          message: error.message
        })
      )
    )

    return EntropyKernel.shannonEntropy(Chunk.fromIterable(decoded.probabilities))
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware normal PDF that reads two runtime services from context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results with `ProbabilityDomainViolationError`; `"relaxed"` passes through
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug` with `x`, `mu`, `sigma`, and precision metadata
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { normalPdfWithPolicies, PrecisionPolicyService, DiagnosticsPolicyService } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = normalPdfWithPolicies(0, 0, 1).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link normalPdf} for the pure kernel (no service requirements)
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const normalPdfWithPolicies = (x: number, mu: number, sigma: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const result = Distributions.normalPdf(x, mu, sigma)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new ProbabilityDomainViolationError({
              operation: "normalPdfWithPolicies",
              message: `Non-finite normal PDF result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("Probability.normalPdfWithPolicies").pipe(
          Effect.annotateLogs({
            precision: precision.policy,
            x: String(x),
            mu: String(mu),
            sigma: String(sigma)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
