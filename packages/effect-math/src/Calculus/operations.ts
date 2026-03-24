/**
 * Calculus domain operation surface — pure kernel re-exports,
 * Schema-validated boundary variants, and policy-aware operations
 * reading `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Clock, Effect, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { CalculusDecodeError, CalculusDomainViolationError } from "./errors.js"
import * as Differentiation from "./internal/differentiation.js"
import * as Integration from "./internal/integration.js"
import { CalculusDomainModel } from "./model.js"
import { SimpsonInput, TrapezoidInput } from "./schema.js"

/**
 * Lifts the static `CalculusDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadCalculusDomain = Effect.succeed(CalculusDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Central finite difference approximation of the first derivative.
 *
 * f'(x) ≈ (f(x+h) − f(x−h)) / (2h) with default h = 1e-8.
 *
 * @example
 * ```ts
 * import { Calculus } from "effect-math"
 *
 * const f = (x: number) => x * x
 * Calculus.derivative(f, 1)   // ≈ 2
 * Calculus.derivative(f, 3)   // ≈ 6
 * ```
 *
 * @see {@link trapezoid} — composite trapezoidal integration
 * @see {@link simpson} — composite Simpson's integration
 * @since 0.1.0
 * @category operations
 */
export const derivative: (f: (x: number) => number, x: number, h?: number) => number = Differentiation.centralDifference

/**
 * Composite trapezoidal rule for evenly-spaced samples.
 *
 * ∫ ≈ dx · (y₀/2 + y₁ + ... + yₙ/2)
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { Calculus } from "effect-math"
 *
 * const values = Chunk.fromIterable([0, 1, 4, 9, 16])
 * Calculus.trapezoid(values, 1) // ≈ 22
 * ```
 *
 * @see {@link simpson} — higher-order quadrature
 * @see {@link trapezoidValidated} — boundary-validated variant
 * @see {@link trapezoidWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const trapezoid: (values: Chunk.Chunk<number>, dx: number) => number = Integration.trapezoidalRule

/**
 * Composite Simpson's 1/3 rule for evenly-spaced samples.
 *
 * Requires an odd number of points (even number of intervals) for pure
 * Simpson's. When the number of intervals is odd, the last interval is
 * handled with the trapezoidal rule.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { Calculus } from "effect-math"
 *
 * const values = Chunk.fromIterable([0, 1, 4, 9, 16])
 * Calculus.simpson(values, 1) // ≈ 21.333
 * ```
 *
 * @see {@link trapezoid} — lower-order quadrature
 * @see {@link simpsonValidated} — boundary-validated variant
 * @see {@link simpsonWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const simpson: (values: Chunk.Chunk<number>, dx: number) => number = Integration.simpsonsRule

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated trapezoidal rule. Accepts `unknown` input, decodes
 * through `TrapezoidInput` with `onExcessProperty: "error"`, converts
 * the array to `Chunk`, and returns the integral.
 *
 * @see {@link trapezoid} — pure kernel for pre-validated input
 * @since 0.1.0
 * @category validated operations
 */
export const trapezoidValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(TrapezoidInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new CalculusDecodeError({
          operation: "trapezoid",
          message: error.message
        })
      )
    )
    return Integration.trapezoidalRule(Chunk.fromIterable(decoded.values), decoded.dx)
  })

/**
 * Boundary-validated Simpson's rule. Accepts `unknown` input, decodes
 * through `SimpsonInput` with `onExcessProperty: "error"`, converts
 * the array to `Chunk`, and returns the integral.
 *
 * @see {@link simpson} — pure kernel for pre-validated input
 * @since 0.1.0
 * @category validated operations
 */
export const simpsonValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(SimpsonInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new CalculusDecodeError({
          operation: "simpson",
          message: error.message
        })
      )
    )
    return Integration.simpsonsRule(Chunk.fromIterable(decoded.values), decoded.dx)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware trapezoidal rule reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `CalculusDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input size, result, precision, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import { Calculus } from "effect-math"
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
 * const values = Chunk.fromIterable([0, 1, 4, 9, 16])
 * const program = Calculus.trapezoidWithPolicies(values, 1).pipe(
 *   Effect.provide(layer)
 * )
 * ```
 *
 * @see {@link trapezoid} — pure kernel without policy seams
 * @see {@link trapezoidValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const trapezoidWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Integration.trapezoidalRule(values, dx)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new CalculusDomainViolationError({
              operation: "trapezoidWithPolicies",
              message: `Non-finite trapezoid result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Calculus.trapezoidWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              inputSize: String(Chunk.size(values)),
              dx: String(dx),
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
 * Policy-aware Simpson's rule reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `CalculusDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input size, result, precision, and elapsed-ms annotations.
 *
 * @see {@link simpson} — pure kernel without policy seams
 * @see {@link simpsonValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const simpsonWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Integration.simpsonsRule(values, dx)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new CalculusDomainViolationError({
              operation: "simpsonWithPolicies",
              message: `Non-finite simpson result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Calculus.simpsonWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              inputSize: String(Chunk.size(values)),
              dx: String(dx),
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
