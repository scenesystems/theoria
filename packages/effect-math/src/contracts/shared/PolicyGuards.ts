/**
 * Applies shared precision checks and diagnostic logging to synchronous computations.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Clock, Data, Effect, Match, Number, Record, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "./RuntimePolicies.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

/**
 * Describes callbacks used to guard and annotate a scalar computation.
 *
 * @since 0.1.0
 * @category models
 */
export class ScalarPolicyGuardOptions<E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => number
  readonly makeError: (message: string) => E
  readonly annotations: (result: number) => Record.ReadonlyRecord<string, string>
}> {}

/**
 * Describes callbacks used to validate and annotate an arbitrary computation.
 *
 * @since 0.1.0
 * @category models
 */
export class CustomPolicyGuardOptions<A, E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => A
  readonly isValid: (result: A) => boolean
  readonly makeError: (message: string) => E
  readonly annotations: (result: A) => Record.ReadonlyRecord<string, string>
}> {}

const withPolicyGuards = <A, E>(
  options: CustomPolicyGuardOptions<A, E>,
  failureMessage: (result: A) => string
) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const compute = Effect.sync(options.compute).pipe(
      Effect.flatMap((result) =>
        Match.value(precision.policy).pipe(
          Match.when("strict", () =>
            Effect.filterOrFail(
              Effect.succeed(result),
              options.isValid,
              (invalid) => options.makeError(failureMessage(invalid))
            )),
          Match.when("relaxed", () => Effect.succeed(result)),
          Match.exhaustive
        )
      )
    )

    return yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const startedAt = yield* Clock.currentTimeMillis
          const result = yield* compute
          const finishedAt = yield* Clock.currentTimeMillis
          const annotations = Record.set(
            Record.set(options.annotations(result), "precision", precision.policy),
            "elapsedMs",
            encodeNumber(Number.subtract(finishedAt, startedAt))
          )
          yield* Effect.logDebug(options.operation).pipe(Effect.annotateLogs(annotations))
          return result
        })),
      Match.when("disabled", () => compute),
      Match.exhaustive
    )
  })

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
  withPolicyGuards(
    new CustomPolicyGuardOptions({
      operation: options.operation,
      compute: options.compute,
      isValid: Schema.is(FiniteNumber),
      makeError: options.makeError,
      annotations: options.annotations
    }),
    (result) => `Non-finite ${options.operation} result: ${encodeNumber(result)}`
  )

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
  withPolicyGuards(
    options,
    () => `Non-finite ${options.operation} result`
  )
