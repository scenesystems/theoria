/**
 * Optimization domain operations — pure kernel re-exports,
 * Schema-validated boundary variants, and policy-aware operations
 * reading `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Clock, Effect, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { OptimizationDecodeError, OptimizationDomainViolationError } from "./errors.js"
import * as Bisect from "./internal/bisect.js"
import * as GoldenSection from "./internal/goldenSection.js"
import { OptimizationDomainModel } from "./model.js"
import { BisectInput, GoldenSectionInput } from "./schema.js"

/**
 * Lifts the static `OptimizationDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadOptimizationDomain = Effect.succeed(OptimizationDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Bisection method root-finding. Finds x where f(x) ≈ 0 in [a, b],
 * assuming f(a) and f(b) have opposite signs. Uses recursive tail-call
 * style with configurable tolerance and iteration budget.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 *
 * Optimization.bisect((x) => x * x - 2, 0, 2) // ≈ √2 ≈ 1.41421
 * ```
 *
 * @see {@link bisectValidated} — boundary-validated variant
 * @see {@link bisectWithPolicies} — policy-aware variant
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
 * Golden section search for 1D minimization. Uses the golden ratio
 * φ = (√5 − 1) / 2 to progressively narrow the bracket containing
 * the minimum.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 *
 * Optimization.goldenSection((x) => x * x, -2, 2) // ≈ 0
 * ```
 *
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @see {@link goldenSectionWithPolicies} — policy-aware variant
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
 * Boundary-validated bisect. Accepts a function and `unknown` input,
 * decodes through `BisectInput` with `onExcessProperty: "error"`, and
 * returns the root.
 *
 * @see {@link bisect} — pure kernel for pre-validated input
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
 * Boundary-validated golden section search. Accepts a function and
 * `unknown` input, decodes through `GoldenSectionInput` with
 * `onExcessProperty: "error"`, and returns the minimizer.
 *
 * @see {@link goldenSection} — pure kernel for pre-validated input
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
 * Policy-aware bisect reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 * import { Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "effect-math/contracts"
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
 * @since 0.1.0
 * @category operations
 */
export const bisectWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Bisect.bisectKernel(f, a, b)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new OptimizationDomainViolationError({
              operation: "bisectWithPolicies",
              message: `Non-finite bisect result: bisect(${a}, ${b}) = ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Optimization.bisectWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              input: `a=${a}, b=${b}`,
              result: String(result),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Policy-aware golden section search reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link goldenSection} — pure kernel without policy seams
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const goldenSectionWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = GoldenSection.goldenSectionKernel(f, a, b)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new OptimizationDomainViolationError({
              operation: "goldenSectionWithPolicies",
              message: `Non-finite goldenSection result: goldenSection(${a}, ${b}) = ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Optimization.goldenSectionWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              input: `a=${a}, b=${b}`,
              result: String(result),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
