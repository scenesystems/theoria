/**
 * Evaluates normal and uniform distributions and computes discrete Shannon
 * entropy from decoded, untrusted, or policy-governed inputs.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Number as N, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { ProbabilityDecodeError, ProbabilityDomainViolationError, ProbabilityParameterError } from "./errors.js"
import * as Distributions from "./internal/distributions.js"
import * as EntropyKernel from "./internal/entropy.js"
import { ProbabilityDomainModel } from "./model.js"
import { EntropyInput, NormalEvalInput, UniformEvalInput } from "./schema.js"

/**
 * Yields the immutable descriptor used to register Probability capabilities.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadProbabilityDomain = Effect.succeed(ProbabilityDomainModel)

// ---------------------------------------------------------------------------
// Pure operations
// ---------------------------------------------------------------------------

/**
 * Computes the standard normal density `(1 / sqrt(2 * pi)) * exp(-x^2 / 2)`.
 * @since 0.1.0
 * @category operations
 */
export const standardNormalPdf: (x: number) => number = Distributions.standardNormalPdf

/**
 * Computes the normal density at `x` for location `mu` and scale `sigma`.
 * The formula assumes `sigma > 0`; this pure operation does not validate it.
 * @since 0.1.0
 * @category operations
 */
export const normalPdf: (x: number, mu: number, sigma: number) => number = Distributions.normalPdf

/**
 * Approximates the standard normal cumulative distribution function using
 * Abramowitz and Stegun formula 7.1.26, with maximum absolute error about
 * `1.5e-7`.
 * @since 0.1.0
 * @category operations
 */
export const standardNormalCdf: (x: number) => number = Distributions.standardNormalCdf

/**
 * Maps a unit-interval roll to a standard normal variate through the inverse
 * CDF. Inputs are first clamped to `[1e-12, 1 - 1e-12]`, so endpoints and
 * values outside `[0, 1]` produce finite tail values.
 * @since 0.1.0
 * @category operations
 */
export const standardNormalTransform: (roll: number) => number = Distributions.standardNormalTransform

/**
 * Approximates `P(X <= x)` for a normal distribution with location `mu` and
 * scale `sigma`. The formula assumes `sigma > 0`; this pure operation does not
 * validate it.
 * @since 0.1.0
 * @category operations
 */
export const normalCdf: (x: number, mu: number, sigma: number) => number = Distributions.normalCdf

/**
 * Computes `1 / (high - low)` for `x` inside the closed interval and `0`
 * outside it. The formula assumes `low < high`; this pure operation does not
 * validate the bounds.
 * @since 0.1.0
 * @category operations
 */
export const uniformPdf: (x: number, low: number, high: number) => number = Distributions.uniformPdf

/**
 * Computes `(x - low) / (high - low)` inside the interval, returning `0`
 * below `low` and `1` above `high`. The formula assumes `low < high`; this
 * pure operation does not validate the bounds.
 * @since 0.1.0
 * @category operations
 */
export const uniformCdf: (x: number, low: number, high: number) => number = Distributions.uniformCdf

/**
 * Computes `-sum(p * ln(p))` in nats. Zero entries contribute `0`. This pure
 * operation neither validates non-negativity nor requires the values to sum
 * to `1`.
 * @since 0.1.0
 * @category operations
 */
export const shannonEntropy: (probabilities: Chunk.Chunk<number>) => number = EntropyKernel.shannonEntropy

// ---------------------------------------------------------------------------
// Schema-validated operations
// ---------------------------------------------------------------------------

/**
 * Decodes finite `x` and `mu` values plus a positive finite `sigma`, then
 * computes the normal density. Malformed or excess input fails with
 * `ProbabilityDecodeError`.
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
 * Decodes finite `x` and `mu` values plus a positive finite `sigma`, then
 * approximates the normal cumulative probability. Malformed or excess input
 * fails with `ProbabilityDecodeError`.
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
 * Decodes finite input and computes uniform density over ordered bounds.
 * Malformed or excess input fails with `ProbabilityDecodeError`; `low >= high`
 * fails with `ProbabilityParameterError`.
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
 * Decodes finite input and computes uniform cumulative probability over
 * ordered bounds. Malformed or excess input fails with
 * `ProbabilityDecodeError`; `low >= high` fails with
 * `ProbabilityParameterError`.
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
 * Decodes a non-empty collection of non-negative finite values and computes
 * `-sum(p * ln(p))` in nats. Malformed or excess input fails with
 * `ProbabilityDecodeError`. The values are not normalized or required to sum
 * to `1`.
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
 * Computes normal density under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `ProbabilityDomainViolationError`; it does not validate `sigma > 0` when a
 * finite result is possible. Enabled diagnostics emits one debug log with the
 * inputs, result, precision policy, and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService,
 *   Probability
 * } from "@scenesystems/effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * export const program = Probability.normalPdfWithPolicies(0, 0, 1).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (density) => density > 0.398 && density < 0.399,
 *     () => "UnexpectedNormalDensity"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Probability.normalPdfWithPolicies",
    compute: () => Distributions.normalPdf(x, mu, sigma),
    makeError: (message) => new ProbabilityDomainViolationError({ operation: "normalPdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), mu: String(mu), sigma: String(sigma), result: String(result) })
  })

/**
 * Computes normal cumulative probability under the configured finite-result
 * and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `ProbabilityDomainViolationError`; it does not validate `sigma > 0` when a
 * finite result is possible. Enabled diagnostics emits one debug log with the
 * inputs, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const normalCdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Probability.normalCdfWithPolicies",
    compute: () => Distributions.normalCdf(x, mu, sigma),
    makeError: (message) => new ProbabilityDomainViolationError({ operation: "normalCdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), mu: String(mu), sigma: String(sigma), result: String(result) })
  })

/**
 * Computes uniform density under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `ProbabilityDomainViolationError`; it does not validate `low < high` when a
 * finite result is possible. Enabled diagnostics emits one debug log with the
 * inputs, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const uniformPdfWithPolicies = (x: number, low: number, high: number) =>
  withScalarPolicyGuards({
    operation: "Probability.uniformPdfWithPolicies",
    compute: () => Distributions.uniformPdf(x, low, high),
    makeError: (message) => new ProbabilityDomainViolationError({ operation: "uniformPdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), low: String(low), high: String(high), result: String(result) })
  })

/**
 * Computes uniform cumulative probability under the configured finite-result
 * and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `ProbabilityDomainViolationError`; it does not validate `low < high` when a
 * finite result is possible. Enabled diagnostics emits one debug log with the
 * inputs, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const uniformCdfWithPolicies = (x: number, low: number, high: number) =>
  withScalarPolicyGuards({
    operation: "Probability.uniformCdfWithPolicies",
    compute: () => Distributions.uniformCdf(x, low, high),
    makeError: (message) => new ProbabilityDomainViolationError({ operation: "uniformCdfWithPolicies", message }),
    annotations: (result) => ({ x: String(x), low: String(low), high: String(high), result: String(result) })
  })

/**
 * Computes `-sum(p * ln(p))` under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite aggregate with
 * `ProbabilityDomainViolationError`. Neither policy validates or normalizes
 * the input probabilities. Enabled diagnostics emits one debug log with the
 * input size, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const entropyWithPolicies = (probabilities: Chunk.Chunk<number>) =>
  withScalarPolicyGuards({
    operation: "Probability.entropyWithPolicies",
    compute: () => EntropyKernel.shannonEntropy(probabilities),
    makeError: (message) => new ProbabilityDomainViolationError({ operation: "entropyWithPolicies", message }),
    annotations: (result) => ({ inputSize: String(Chunk.size(probabilities)), result: String(result) })
  })
