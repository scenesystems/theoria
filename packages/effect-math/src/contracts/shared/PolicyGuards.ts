/**
 * Applies shared precision checks and diagnostic logging to synchronous computations.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Clock, Data, Effect, Inspectable, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "./RuntimePolicies.js"

const LogAnnotations = Schema.Record({ key: Schema.String, value: Schema.String })
const isFinite = Schema.is(Schema.Finite)

class ScalarPolicyGuardOptions<E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => number
  readonly makeError: (message: string) => E
  readonly annotations: (result: number) => typeof LogAnnotations.Type
}> {}

class CustomPolicyGuardOptions<A, E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => A
  readonly isValid: (result: A) => boolean
  readonly makeError: (message: string) => E
  readonly annotations: (result: A) => typeof LogAnnotations.Type
}> {}

/**
 * Evaluates a numeric computation under precision and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects `NaN` and infinities through `makeError`. Relaxed
 * precision returns them. Enabled diagnostics emit one debug log after a
 * successful precision check, using `operation` as the message and adding
 * precision, elapsed milliseconds, and caller annotations. Exceptions from
 * any callback become Effect defects. The returned Effect requires
 * {@link PrecisionPolicyService} and {@link DiagnosticsPolicyService}.
 *
 * @typeParam E - Typed failure produced when strict precision rejects the result.
 * @param options - Synchronous computation, error constructor, log identity, and annotation builder.
 * @returns The computed number when the active precision policy accepts it.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withScalarPolicyGuards = <E>(options: ScalarPolicyGuardOptions<E>) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = yield* Effect.sync(options.compute)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.succeed(result).pipe(
          Effect.filterOrFail(
            isFinite,
            () =>
              options.makeError(
                `Non-finite ${options.operation} result: ${Inspectable.toStringUnknown(result)}`
              )
          ),
          Effect.asVoid
        )),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          const annotations = yield* Effect.sync(() => options.annotations(result))
          yield* Effect.logDebug(options.operation).pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              ...annotations,
              elapsedMs: Inspectable.toStringUnknown(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Evaluates an arbitrary synchronous result under caller-defined strict validation.
 *
 * @remarks
 * Strict precision calls `isValid` and uses `makeError` when it returns
 * `false`. Relaxed precision skips `isValid`. Enabled diagnostics emit one
 * debug log only after validation succeeds. Exceptions from callbacks become
 * Effect defects. The returned Effect requires {@link PrecisionPolicyService}
 * and {@link DiagnosticsPolicyService}.
 *
 * @typeParam A - Value produced by the synchronous computation.
 * @typeParam E - Typed failure produced when strict validation rejects the value.
 * @param options - Computation, strict predicate, error constructor, log identity, and annotation builder.
 * @returns The computed value when the active precision policy accepts it.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withCustomPolicyGuards = <A, E>(options: CustomPolicyGuardOptions<A, E>) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = yield* Effect.sync(options.compute)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.succeed(result).pipe(
          Effect.filterOrFail(
            options.isValid,
            () => options.makeError(`Non-finite ${options.operation} result`)
          ),
          Effect.asVoid
        )),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          const annotations = yield* Effect.sync(() => options.annotations(result))
          yield* Effect.logDebug(options.operation).pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              ...annotations,
              elapsedMs: Inspectable.toStringUnknown(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
