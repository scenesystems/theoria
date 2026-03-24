/**
 * Shared policy guard combinators that eliminate boilerplate in policy-aware
 * operations across all domains.
 *
 * Every policy-aware operation follows the same three-phase pattern:
 * 1. Optionally start a timer (diagnostics enabled)
 * 2. Validate the result (precision strict → reject non-finite)
 * 3. Optionally log diagnostics (diagnostics enabled)
 *
 * This module extracts that pattern into composable combinators so each
 * domain operation only specifies *what* it computes and *how* to describe
 * the result — not the policy wiring.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Clock, Effect, Match, Number as N } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "./RuntimePolicies.js"

/**
 * Wraps a pure scalar computation with precision and diagnostics policy
 * guards. The caller provides:
 *
 * - `operation` — the operation name for error messages and log labels
 * - `compute` — a thunk that produces the scalar result
 * - `makeError` — a factory that creates the domain-specific violation error
 * - `annotations` — a thunk that returns log annotation key-value pairs
 *
 * The combinator reads `PrecisionPolicyService` and `DiagnosticsPolicyService`
 * from context, applies the three-phase pattern using `Match.exhaustive`,
 * and returns the result.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withScalarPolicyGuards = <E>(options: {
  readonly operation: string
  readonly compute: () => number
  readonly makeError: (message: string) => E
  readonly annotations: (result: number) => Record<string, string>
}) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = options.compute()

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Number.isFinite(result)
          ? Effect.void
          : Effect.fail(options.makeError(
            `Non-finite ${options.operation} result: ${result}`
          ))),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug(options.operation).pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              ...options.annotations(result),
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
 * Like {@link withScalarPolicyGuards} but accepts a custom predicate for
 * the strict-precision check. Use when the result is not a scalar (e.g.,
 * `Chunk<number>`) or when the finiteness check needs custom logic.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withCustomPolicyGuards = <A, E>(options: {
  readonly operation: string
  readonly compute: () => A
  readonly isValid: (result: A) => boolean
  readonly makeError: (message: string) => E
  readonly annotations: (result: A) => Record<string, string>
}) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = options.compute()

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        options.isValid(result)
          ? Effect.void
          : Effect.fail(options.makeError(
            `Non-finite ${options.operation} result`
          ))),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug(options.operation).pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              ...options.annotations(result),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
