/**
 * Policy-aware wrappers for synchronous computations.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Clock, Effect, Match, Number as N } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "./RuntimePolicies.js"

/**
 * Runs `compute`, rejects a non-finite result under strict precision using
 * `makeError`, and emits one annotated debug log when diagnostics are enabled.
 * The returned Effect requires {@link PrecisionPolicyService} and
 * {@link DiagnosticsPolicyService}; exceptions from either callback are not
 * converted to typed failures.
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
 * Applies the same policy behavior as {@link withScalarPolicyGuards}, using
 * `isValid` for strict-precision validation of an arbitrary result type.
 * A `false` predicate result fails with `makeError`; relaxed precision skips
 * the predicate.
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
