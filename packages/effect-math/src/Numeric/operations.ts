/**
 * Numeric domain operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Clock, Effect, Match, Number as EffectNumber, Option, Schema } from "effect"

import {
  BackendPolicyService,
  collectRuntimePolicies,
  DiagnosticsPolicyService,
  PrecisionPolicyService,
  RuntimePolicies
} from "../contracts/shared/RuntimePolicies.js"
import {
  NumericBoundaryValidationInput,
  NumericBoundaryValidationResult,
  NumericDecodeError,
  NumericDomainBoundaryError,
  NumericDomainViolationError
} from "./errors.js"
import * as Reduction from "./internal/reduction.js"
import * as Scalar from "./internal/scalar.js"
import * as Selection from "./internal/selection.js"
import * as Transcendental from "./internal/transcendental.js"
import { NumericDomainModel } from "./model.js"
import { ArgmaxInput, DivideInput, LogInput, ReductionInput } from "./schema.js"

/**
 * Safe division returning `None` on zero divisor via `Number.divide`.
 *
 * @since 0.1.0
 * @category operations
 */
export const safeDivide: {
  (divisor: number): (dividend: number) => Option.Option<number>
  (dividend: number, divisor: number): Option.Option<number>
} = EffectNumber.divide

/**
 * Unsafe division via `Number.unsafeDivide`.
 *
 * @since 0.1.0
 * @category operations
 */
export const unsafeDivide: {
  (divisor: number): (dividend: number) => number
  (dividend: number, divisor: number): number
} = EffectNumber.unsafeDivide

/**
 * Finite-guarded safe division. Returns `None` when inputs or result are non-finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const safeDivideFinite: (dividend: number, divisor: number) => Option.Option<number> = Scalar.safeDivideFinite

/**
 * Natural logarithm. Returns `NaN` for non-positive input.
 *
 * @since 0.1.0
 * @category operations
 */
export const log: (value: number) => number = Math.log

/**
 * Numerically stable `ln(1 + x)` for small `x`.
 *
 * @since 0.1.0
 * @category operations
 */
export const log1p: (value: number) => number = Transcendental.log1pRelaxed

/**
 * Numerically stable `exp(x) - 1` for small `x`.
 *
 * @since 0.1.0
 * @category operations
 */
export const expm1: (value: number) => number = Transcendental.expm1Relaxed

/**
 * Sum over iterable via `Number.sumAll`.
 *
 * @since 0.1.0
 * @category operations
 */
export const sum: (values: Iterable<number>) => number = EffectNumber.sumAll

/**
 * Index of the maximum element. `None` for empty arrays.
 *
 * @since 0.1.0
 * @category operations
 */
export const argmaxIndex: (values: ReadonlyArray<number>) => Option.Option<number> = Selection.argmaxIndex

/**
 * Clamp `value` into `[minimum, maximum]` via `Number.clamp`.
 *
 * @since 0.1.0
 * @category operations
 */
export const clamp: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => number
  (self: number, options: { readonly minimum: number; readonly maximum: number }): number
} = EffectNumber.clamp

/**
 * Returns `true` when `value` is in `[minimum, maximum]` via `Number.between`.
 *
 * @since 0.1.0
 * @category operations
 */
export const between: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => boolean
  (self: number, options: { readonly minimum: number; readonly maximum: number }): boolean
} = EffectNumber.between

/**
 * Numeric domain model loader.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadNumericDomain = Effect.succeed(NumericDomainModel)

/**
 * Effect-wrapped safe division with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const safeDivideEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DivideInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "safeDivide",
          message: error.message
        })
      )
    )
    return EffectNumber.divide(decoded.dividend, decoded.divisor)
  })

/**
 * Effect-wrapped unsafe division with typed domain violation errors.
 *
 * @since 0.1.0
 * @category operations
 */
export const unsafeDivideEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DivideInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "unsafeDivide",
          message: error.message
        })
      )
    )
    return yield* Effect.filterOrFail(
      Effect.succeed(EffectNumber.divide(decoded.dividend, decoded.divisor)),
      Option.isSome,
      () =>
        new NumericDomainViolationError({
          operation: "unsafeDivide",
          message: `Division by zero: ${decoded.dividend} / ${decoded.divisor}`
        })
    ).pipe(Effect.map(Option.getOrThrow))
  })

/**
 * Effect-wrapped log with domain validation.
 *
 * @since 0.1.0
 * @category operations
 */
export const logEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "log",
          message: error.message
        })
      )
    )
    return Math.log(decoded.value)
  })

/**
 * Effect-wrapped sum with schema-validated non-empty vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const sumEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ReductionInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "sum",
          message: error.message
        })
      )
    )
    return EffectNumber.sumAll(decoded.values)
  })

/**
 * Effect-wrapped argmax with schema-validated non-empty vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const argmaxEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ArgmaxInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "argmax",
          message: error.message
        })
      )
    )
    return Selection.argmaxIndex(decoded.values)
  })

/**
 * Policy-aware sum. Backend policy selects between Kahan-compensated
 * `Float64Array` accumulation and `Number.sumAll`. Precision policy
 * rejects non-finite results under `strict`. Diagnostics policy emits
 * `Effect.logDebug` with operation metadata when `enabled`.
 *
 * @since 0.1.0
 * @category operations
 */
export const sumWithPolicies = (values: ReadonlyArray<number>) =>
  Effect.gen(function*() {
    const backend = yield* BackendPolicyService
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = yield* Match.value(backend.policy).pipe(
      Match.when("typed-array", () => Effect.sync(() => Reduction.sumTypedArray(new Float64Array(values)))),
      Match.when("scalar", () => Effect.succeed(Reduction.sumScalar(values))),
      Match.exhaustive
    )

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new NumericDomainViolationError({
              operation: "sumWithPolicies",
              message: `Non-finite sum result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Numeric.sumWithPolicies").pipe(
            Effect.annotateLogs({
              backend: backend.policy,
              precision: precision.policy,
              inputSize: String(values.length),
              elapsedMs: String(elapsed - startedAt)
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Policy-aware `log1p`. Precision policy selects between Taylor-compensated
 * kernel (`strict`) and native `Math.log1p` (`relaxed`).
 *
 * @since 0.1.0
 * @category operations
 */
export const log1pWithPolicies = (value: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const result = Match.value(precision.policy).pipe(
      Match.when("strict", () => Transcendental.log1pStrict(value)),
      Match.when("relaxed", () => Transcendental.log1pRelaxed(value)),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("Numeric.log1pWithPolicies").pipe(
          Effect.annotateLogs({
            precision: precision.policy,
            input: String(value),
            result: String(result)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Policy-aware `expm1`. Precision policy selects between Taylor-compensated
 * kernel (`strict`) and native `Math.expm1` (`relaxed`).
 *
 * @since 0.1.0
 * @category operations
 */
export const expm1WithPolicies = (value: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const result = Match.value(precision.policy).pipe(
      Match.when("strict", () => Transcendental.expm1Strict(value)),
      Match.when("relaxed", () => Transcendental.expm1Relaxed(value)),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("Numeric.expm1WithPolicies").pipe(
          Effect.annotateLogs({
            precision: precision.policy,
            input: String(value),
            result: String(result)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Validates numeric boundary payloads with runtime policy seams wired.
 *
 * @since 0.1.0
 * @category operations
 */
export const validateNumericBoundary = (input: unknown) =>
  Effect.gen(function*() {
    const runtimePolicies = yield* collectRuntimePolicies

    yield* Schema.decodeUnknown(RuntimePolicies)(runtimePolicies, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDomainBoundaryError({
          message: error.message
        })
      )
    )

    yield* Schema.decodeUnknown(NumericBoundaryValidationInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDomainBoundaryError({
          message: error.message
        })
      )
    )

    return yield* Schema.decodeUnknown(NumericBoundaryValidationResult)(
      { ok: true },
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError((error) =>
        new NumericDomainBoundaryError({
          message: error.message
        })
      )
    )
  })
