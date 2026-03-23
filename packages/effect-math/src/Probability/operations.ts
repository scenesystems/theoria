/**
 * Probability operation surface — pure kernel re-exports, Effect-wrapped
 * variants with Schema-validated boundary input, and policy-aware operations
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
 * Standard normal PDF: (1 / √(2π)) · exp(-x²/2).
 *
 * @since 0.1.0
 * @category operations
 */
export const standardNormalPdf: (x: number) => number = Distributions.standardNormalPdf

/**
 * Normal PDF with parameters mu and sigma.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdf: (x: number, mu: number, sigma: number) => number = Distributions.normalPdf

/**
 * Standard normal CDF via Abramowitz & Stegun rational approximation.
 *
 * @since 0.1.0
 * @category operations
 */
export const standardNormalCdf: (x: number) => number = Distributions.standardNormalCdf

/**
 * Normal CDF with parameters mu and sigma.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdf: (x: number, mu: number, sigma: number) => number = Distributions.normalCdf

/**
 * Uniform PDF: 1 / (high − low) when low ≤ x ≤ high, else 0.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdf: (x: number, low: number, high: number) => number = Distributions.uniformPdf

/**
 * Uniform CDF: linear interpolation between low and high.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformCdf: (x: number, low: number, high: number) => number = Distributions.uniformCdf

/**
 * Shannon entropy: −Σ pᵢ · ln(pᵢ) over a discrete probability distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const shannonEntropy: (probabilities: Chunk.Chunk<number>) => number = EntropyKernel.shannonEntropy

// ---------------------------------------------------------------------------
// Effect-wrapped operations with schema-validated input
// ---------------------------------------------------------------------------

/**
 * Effect-wrapped normal PDF that decodes `input` through `NormalEvalInput`,
 * validates parameters, and computes the PDF value. Fails with
 * `ProbabilityDecodeError` for malformed input.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfEffect = (input: unknown) =>
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
 * Effect-wrapped normal CDF with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdfEffect = (input: unknown) =>
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
 * Effect-wrapped uniform PDF with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdfEffect = (input: unknown) =>
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
 * Effect-wrapped uniform CDF with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformCdfEffect = (input: unknown) =>
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
 * Effect-wrapped Shannon entropy with schema-validated input. Decodes
 * through `EntropyInput` and computes −Σ pᵢ · ln(pᵢ).
 *
 * @since 0.1.0
 * @category operations
 */
export const entropyEffect = (input: unknown) =>
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
 * Policy-aware normal PDF that reads `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from the Effect context. Under `"strict"`
 * precision, rejects non-finite results with `ProbabilityDomainViolationError`.
 * Under `"enabled"` diagnostics, emits `Effect.logDebug` with operation metadata.
 *
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
