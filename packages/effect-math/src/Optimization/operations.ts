/**
 * Optimization domain operations — pure kernel re-exports,
 * Schema-validated boundary variants, and policy-aware operations
 * reading `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { OptimizationDecodeError, OptimizationDomainViolationError } from "./errors.js"
import * as Bisect from "./internal/bisect.js"
import * as GoldenSection from "./internal/goldenSection.js"
import { OptimizationDomainModel } from "./model.js"
import { BisectInput, GoldenSectionInput } from "./schema.js"

/**
 * Returns the canonical provisional root-finding and minimization descriptor
 * for registration or startup discovery, without service requirements or a
 * failure channel.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadOptimizationDomain = Effect.succeed(OptimizationDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Approximates a root by repeatedly halving `[a, b]`. The bracket must have
 * endpoint values with opposite signs; endpoint signs are not checked.
 * The current midpoint is returned when the bracket
 * width is less than `tolerance` or the iteration budget is exhausted.
 * Defaults are `1e-12` and 100 iterations.
 *
 * @example
 * ```ts
 * import { Optimization } from "@scenesystems/effect-math"
 *
 * Optimization.bisect((x) => x * x - 2, 0, 2) // ≈ √2 ≈ 1.41421
 * ```
 *
 * @see {@link bisectValidated} — boundary-validated variant
 * @see {@link bisectWithPolicies} — policy-aware variant
 * @param f - Scalar function whose root is bracketed.
 * @param a - First bracket endpoint; ordering is not validated.
 * @param b - Second bracket endpoint; ordering is not validated.
 * @param tolerance - Positive target bracket width. The pure function does not validate it.
 * @param maxIterations - Maximum halvings. The pure function does not validate it.
 * @returns The final bracket midpoint; exhaustion is not reported separately.
 * @since 0.1.0
 * @category operations
 */
export const bisect: (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
) => number = Bisect.bisectKernel

/**
 * Approximates a scalar-function minimizer by golden-section reduction.
 *
 * @remarks
 * The caller must provide an interval containing the desired minimum;
 * unimodality and endpoint ordering are not checked. The current midpoint is
 * returned once the interval width is below `tolerance` or the iteration
 * budget is exhausted. Defaults are `1e-12` and 100 iterations.
 *
 * @example
 * ```ts
 * import { Optimization } from "@scenesystems/effect-math"
 *
 * Optimization.goldenSection((x) => x * x, -2, 2) // ≈ 0
 * ```
 *
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @see {@link goldenSectionWithPolicies} — policy-aware variant
 * @param f - Objective function to minimize.
 * @param a - First search endpoint; ordering is not validated.
 * @param b - Second search endpoint; ordering is not validated.
 * @param tolerance - Positive target interval width. The pure function does not validate it.
 * @param maxIterations - Maximum reductions. The pure function does not validate it.
 * @returns The final search-interval midpoint, not the objective value.
 * @since 0.1.0
 * @category operations
 */
export const goldenSection: (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
) => number = GoldenSection.goldenSectionKernel

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Finds a bracketed root from boundary-validated bisection input.
 *
 * @remarks
 * Decodes finite endpoints, a positive finite tolerance, and a positive
 * integer iteration budget through `BisectInput`, rejecting excess fields.
 * Bracketing and endpoint ordering remain caller preconditions. Schema failure
 * is mapped to `OptimizationDecodeError`; reaching the iteration budget still
 * succeeds with the final midpoint.
 *
 * @see {@link bisect} — pure kernel for pre-validated input
 * @param f - Scalar function whose root is bracketed.
 * @param input - Unknown value expected to satisfy `BisectInput`.
 * @returns An Effect that succeeds with the final midpoint or fails on decoding.
 * @since 0.1.0
 * @category validated operations
 */
export const bisectValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BisectInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new OptimizationDecodeError({
          operation: "bisect",
          message: error.message
        })
      )
    )
    return Bisect.bisectKernel(f, decoded.a, decoded.b, decoded.tolerance, decoded.maxIterations)
  })

/**
 * Minimizes a scalar function from boundary-validated golden-section input.
 *
 * @remarks
 * Decodes finite endpoints, a positive finite tolerance, and a positive
 * integer iteration budget through `GoldenSectionInput`, rejecting excess
 * fields. Endpoint ordering and unimodality remain caller preconditions.
 * Schema failure is mapped to `OptimizationDecodeError`; budget exhaustion
 * succeeds with the final midpoint.
 *
 * @see {@link goldenSection} — pure kernel for pre-validated input
 * @param f - Objective function to minimize.
 * @param input - Unknown value expected to satisfy `GoldenSectionInput`.
 * @returns An Effect that succeeds with the final midpoint or fails on decoding.
 * @since 0.1.0
 * @category validated operations
 */
export const goldenSectionValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GoldenSectionInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new OptimizationDecodeError({
          operation: "goldenSection",
          message: error.message
        })
      )
    )
    return GoldenSection.goldenSectionKernel(f, decoded.a, decoded.b, decoded.tolerance, decoded.maxIterations)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Approximates a bracketed root with the default tolerance and iteration
 * budget. Precision policy governs acceptance of the final midpoint.
 *
 * @remarks
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Optimization } from "@scenesystems/effect-math"
 * import { Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "@scenesystems/effect-math/contracts"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const fn = (x: number) => x * x - 2
 * const program = Optimization.bisectWithPolicies(fn, 0, 2).pipe(
 *   Effect.provide(layer)
 * )
 * ```
 *
 * @see {@link bisect} — pure kernel without policy seams
 * @see {@link bisectValidated} — boundary-validated variant
 * @param f - Scalar function whose root is bracketed.
 * @param a - First bracket endpoint.
 * @param b - Second bracket endpoint.
 * @returns An Effect requiring both policy services and failing only when strict precision rejects a non-finite result.
 * @since 0.1.0
 * @category operations
 */
export const bisectWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Optimization.bisectWithPolicies",
    compute: () => Bisect.bisectKernel(f, a, b),
    makeError: (message) => new OptimizationDomainViolationError({ operation: "bisectWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })

/**
 * Approximates a scalar minimizer with golden-section reduction and the
 * default stopping settings. Precision policy governs acceptance of the final
 * interval midpoint.
 *
 * @remarks
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link goldenSection} — pure kernel without policy seams
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @param f - Objective function to minimize.
 * @param a - First search endpoint.
 * @param b - Second search endpoint.
 * @returns An Effect requiring both policy services and failing only when strict precision rejects a non-finite result.
 * @since 0.1.0
 * @category operations
 */
export const goldenSectionWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Optimization.goldenSectionWithPolicies",
    compute: () => GoldenSection.goldenSectionKernel(f, a, b),
    makeError: (message) => new OptimizationDomainViolationError({ operation: "goldenSectionWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })
