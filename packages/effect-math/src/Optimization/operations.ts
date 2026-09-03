/**
 * Approximates bracketed roots and scalar minima for synchronous numeric functions.
 *
 * @remarks
 * Pure operations trust their interval and stopping arguments. Validated
 * operations decode those arguments but retain the mathematical preconditions.
 * Policy-aware operations apply runtime policy only to the final estimate.
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
 * Approximates a root by repeatedly halving a sign-changing bracket.
 *
 * @remarks
 * Endpoint signs and ordering are not checked. The search returns the current
 * midpoint when the bracket width is below `tolerance` or `maxIterations` is
 * reached. The defaults are `1e-12` and `100`.
 *
 * @example
 * ```ts
 * import { Numeric, Optimization } from "@scenesystems/effect-math"
 * import { Effect } from "effect"
 *
 * export const program = Effect.sync(() =>
 *   Optimization.bisect((x) => Numeric.sum([Numeric.pow(x, 2), -2]), 0, 2)
 * ).pipe(
 *   Effect.filterOrFail(
 *     (root) => Numeric.between(root, { minimum: 1.4142, maximum: 1.4143 }),
 *     () => "UnexpectedRoot"
 *   )
 * )
 * ```
 *
 * @param f - Synchronous function whose root is bracketed. Exceptions escape the pure call.
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
 * Approximates the minimizer of a unimodal scalar function by golden-section reduction.
 *
 * @remarks
 * The interval must contain the desired minimum. Unimodality and endpoint
 * ordering are not checked. The search returns the current midpoint when the
 * interval width is below `tolerance` or `maxIterations` is reached. The
 * defaults are `1e-12` and `100`.
 *
 * @example
 * ```ts
 * import { Numeric, Optimization } from "@scenesystems/effect-math"
 * import { Effect } from "effect"
 *
 * export const program = Effect.sync(() =>
 *   Optimization.goldenSection(
 *     (x) => Numeric.pow(Numeric.sum([x, -3]), 2),
 *     0,
 *     6
 *   )
 * ).pipe(
 *   Effect.filterOrFail(
 *     (minimizer) => Numeric.between(minimizer, { minimum: 2.999, maximum: 3.001 }),
 *     () => "UnexpectedMinimizer"
 *   )
 * )
 * ```
 *
 * @param f - Synchronous objective function. Exceptions escape the pure call.
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
 * Decodes bisection settings before approximating a bracketed root.
 *
 * @remarks
 * Excess fields are rejected. A sign-changing bracket and ordered endpoints
 * remain caller preconditions. Reaching the iteration budget succeeds with the
 * final midpoint. Exceptions from `f` become Effect defects.
 *
 * @param f - Synchronous function whose root is bracketed.
 * @param input - Untrusted bisection settings decoded by {@link BisectInput}.
 * @returns The final bracket midpoint.
 * @throws {@link OptimizationDecodeError} in the Effect error channel when an
 * endpoint or option is invalid, missing, or unexpected.
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
 * Decodes golden-section settings before approximating a scalar minimizer.
 *
 * @remarks
 * Excess fields are rejected. Endpoint ordering and unimodality remain caller
 * preconditions. Reaching the iteration budget succeeds with the final
 * midpoint. Exceptions from `f` become Effect defects.
 *
 * @param f - Synchronous objective function.
 * @param input - Untrusted search settings decoded by {@link GoldenSectionInput}.
 * @returns The final search-interval midpoint rather than the objective value.
 * @throws {@link OptimizationDecodeError} in the Effect error channel when an
 * endpoint or option is invalid, missing, or unexpected.
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
 * Approximates a bracketed root with default stopping settings and applies runtime policies.
 *
 * @remarks
 * Strict precision rejects a non-finite midpoint. Relaxed precision returns it.
 * Enabled diagnostics emit one debug log with the bracket, result, precision
 * mode, and elapsed milliseconds. Bracketing and endpoint ordering are not
 * validated. Exceptions from `f` become Effect defects.
 *
 * @example
 * ```ts
 * import { Numeric, Optimization } from "@scenesystems/effect-math"
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
 * const fn = (x: number) => Numeric.sum([Numeric.pow(x, 2), -2])
 * export const program = Optimization.bisectWithPolicies(fn, 0, 2).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (root) => Numeric.between(root, { minimum: 1.4142, maximum: 1.4143 }),
 *     () => "UnexpectedRoot"
 *   )
 * )
 * ```
 *
 * @param f - Synchronous function whose root is bracketed.
 * @param a - First bracket endpoint.
 * @param b - Second bracket endpoint.
 * @returns The final bracket midpoint.
 * @throws {@link OptimizationDomainViolationError} in the Effect error channel
 * when strict precision rejects a non-finite result.
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
 * Approximates a scalar minimizer with default stopping settings and applies runtime policies.
 *
 * @remarks
 * Strict precision rejects a non-finite midpoint. Relaxed precision returns it.
 * Enabled diagnostics emit one debug log with the interval, result, precision
 * mode, and elapsed milliseconds. Endpoint ordering and unimodality are not
 * validated. Exceptions from `f` become Effect defects.
 *
 * @param f - Synchronous objective function.
 * @param a - First search endpoint.
 * @param b - Second search endpoint.
 * @returns The final search-interval midpoint rather than the objective value.
 * @throws {@link OptimizationDomainViolationError} in the Effect error channel
 * when strict precision rejects a non-finite result.
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
