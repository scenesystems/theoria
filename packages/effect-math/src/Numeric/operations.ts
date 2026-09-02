/**
 * Applies scalar transforms, reductions, validation, and runtime numeric policies.
 *
 * @since 0.1.0
 * @category operations
 */
import { BigDecimal, Chunk, Clock, Effect, Match, Number as EffectNumber, Option, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
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
import * as Logspace from "./internal/logspace.js"
import * as LogSumExp from "./internal/logSumExp.js"
import * as Reduction from "./internal/reduction.js"
import * as Scalar from "./internal/scalar.js"
import * as Selection from "./internal/selection.js"
import * as Transcendental from "./internal/transcendental.js"
import { NumericDomainModel } from "./model.js"
import {
  ArgmaxInput,
  DivideInput,
  FiniteScalar,
  LogaddexpInput,
  LogInput,
  LogSumExpInput,
  ReductionInput
} from "./schema.js"

/**
 * Divides two numbers, returning `None` when the divisor is positive or
 * negative zero. Both data-first and data-last calls are supported.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Effect, Option, pipe } from "effect"
 *
 * export const program = Effect.gen(function*() {
 *   const quotient = yield* Option.match(Numeric.safeDivide(10, 2), {
 *     onNone: () => Effect.fail("UnexpectedZeroDivisor"),
 *     onSome: Effect.succeed
 *   })
 *   const zeroFallback = pipe(
 *     Numeric.safeDivide(10, 0),
 *     Option.getOrElse(() => 0)
 *   )
 *   const curried = yield* Option.match(pipe(10, Numeric.safeDivide(5)), {
 *     onNone: () => Effect.fail("UnexpectedZeroDivisor"),
 *     onSome: Effect.succeed
 *   })
 *
 *   return yield* Effect.succeed({ quotient, zeroFallback, curried }).pipe(
 *     Effect.filterOrFail(
 *       (result) => result.quotient === 5 && result.zeroFallback === 0 && result.curried === 2,
 *       () => "UnexpectedDivisionResult"
 *     )
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const safeDivide: {
  (divisor: number): (dividend: number) => Option.Option<number>
  (dividend: number, divisor: number): Option.Option<number>
} = EffectNumber.divide

/**
 * Divides with JavaScript's IEEE 754 behavior, including infinite and `NaN`
 * results. Use {@link safeDivide} when zero is an expected divisor.
 * @since 0.1.0
 * @category operations
 */
export const unsafeDivide: {
  (divisor: number): (dividend: number) => number
  (dividend: number, divisor: number): number
} = EffectNumber.unsafeDivide

/**
 * Divides finite operands and returns `None` for a zero divisor or non-finite
 * result. A present result is always finite.
 * @since 0.1.0
 * @category operations
 */
export const safeDivideFinite: (dividend: number, divisor: number) => Option.Option<number> = Scalar.safeDivideFinite

/**
 * Accepts finite numbers and rejects positive infinity, negative infinity, and
 * `NaN`.
 * @since 0.4.0
 * @category guards
 */
export const isFinite: (value: number) => boolean = Schema.is(FiniteScalar)

/**
 * Chooses the smaller ordered number in either direct or data-last form.
 * @since 0.4.0
 * @category operations
 */
export const min: {
  (that: number): (self: number) => number
  (self: number, that: number): number
} = EffectNumber.min

/**
 * Chooses the larger ordered number and supports data-first or pipeable calls.
 * @since 0.4.0
 * @category operations
 */
export const max: {
  (that: number): (self: number) => number
  (self: number, that: number): number
} = EffectNumber.max

/**
 * Returns the non-negative magnitude of a number. Negative zero becomes
 * positive zero; infinities pass through and `NaN` remains `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const abs: (value: number) => number = Math.abs

/**
 * Returns the principal square root. Negative input produces `NaN`, positive
 * infinity passes through, and negative zero is preserved.
 * @since 0.4.0
 * @category operations
 */
export const sqrt: (value: number) => number = Math.sqrt

/**
 * Ratio of a circle's circumference to its diameter, using the host IEEE 754
 * double-precision constant.
 * @since 0.4.0
 * @category constants
 */
export const pi: number = Math.PI

/**
 * Computes sine for a radian angle, preserving signed zero; non-finite input produces `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const sin: (radians: number) => number = Math.sin

/**
 * Computes cosine for a radian angle; zero maps to `1` and non-finite input produces `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const cos: (radians: number) => number = Math.cos

/**
 * Returns the base-10 logarithm. Zero produces negative infinity, negative
 * input produces `NaN`, and positive infinity passes through.
 * @since 0.4.0
 * @category operations
 */
export const log10: (value: number) => number = Math.log10

/**
 * Raises `base` to `exponent` with the host IEEE 754 power operation.
 * @since 0.4.0
 * @category operations
 */
export const pow: (base: number, exponent: number) => number = Math.pow

/**
 * Rounds a number to the requested decimal precision. Both data-first and
 * data-last calls are supported.
 * @since 0.4.0
 * @category operations
 */
export const round: {
  (precision: number): (self: number) => number
  (self: number, precision: number): number
} = EffectNumber.round

const mapFiniteToInteger = (
  value: number,
  operation: (decimal: BigDecimal.BigDecimal) => BigDecimal.BigDecimal
): number =>
  Option.match(BigDecimal.safeFromNumber(value), {
    onNone: () => value,
    onSome: (decimal) => BigDecimal.unsafeToNumber(operation(decimal))
  })

/**
 * Rounds finite values toward negative infinity. Infinities and `NaN` pass
 * through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const floor = (value: number): number => mapFiniteToInteger(value, BigDecimal.floor)

/**
 * Rounds finite values toward positive infinity. Infinities and `NaN` pass
 * through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const ceil = (value: number): number => mapFiniteToInteger(value, BigDecimal.ceil)

/**
 * Removes the fractional part of a finite value by rounding toward zero.
 * Infinities and `NaN` pass through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const truncate = (value: number): number => mapFiniteToInteger(value, BigDecimal.truncate)

/**
 * Computes the natural logarithm with `Math.log`, including `NaN` for negative
 * input and `-Infinity` for zero. {@link logValidated} rejects those inputs.
 * @since 0.1.0
 * @category operations
 */
export const log: (value: number) => number = Math.log

/**
 * Computes the natural logarithm using DataView bit decomposition and a Taylor
 * series. Produces deterministic results independent of platform
 * `Math.log` implementation.
 * @since 0.1.0
 * @category operations
 */
export const logStrict: (value: number) => number = Transcendental.logStrict

/**
 * Computes `ln(1 + x)` using the native kernel. It avoids
 * catastrophic cancellation for `|x| << 1` where `Math.log(1 + x)`
 * loses significant digits.
 * @since 0.1.0
 * @category operations
 */
export const log1p: (value: number) => number = Transcendental.log1pRelaxed

/**
 * Computes `ln(1 + x)` using a Taylor series for `|x| < 1e-4` and
 * DataView bit decomposition for larger values. Produces
 * deterministic results independent of platform `Math.log1p`.
 * @since 0.1.0
 * @category operations
 */
export const log1pStrict: (value: number) => number = Transcendental.log1pStrict

/**
 * Computes `exp(x) - 1` using the native kernel. It avoids
 * catastrophic cancellation for `|x| << 1` where `Math.exp(x) - 1`
 * loses significant digits.
 * @since 0.1.0
 * @category operations
 */
export const expm1: (value: number) => number = Transcendental.expm1Relaxed

/**
 * Computes `exp(x) - 1` using a Taylor series for `|x| < 1e-5` and
 * `E ** x - 1` for larger values. Produces deterministic results
 * independent of platform `Math.expm1`.
 * @since 0.1.0
 * @category operations
 */
export const expm1Strict: (value: number) => number = Transcendental.expm1Strict

/**
 * Adds values in iteration order without compensated accumulation.
 * {@link sumWithPolicies} selects compensated accumulation when its backend
 * policy is `"typed-array"`.
 * @since 0.1.0
 * @category operations
 */
export const sum: (values: Iterable<number>) => number = EffectNumber.sumAll

/**
 * Finds the zero-based index of the maximum element, or `None` for
 * empty arrays. When multiple elements share the maximum value, returns
 * the index of the first occurrence.
 * @since 0.1.0
 * @category operations
 */
export const argmaxIndex: (values: ReadonlyArray<number>) => Option.Option<number> = Selection.argmaxIndex

/**
 * Constrains a value to the closed interval `[minimum, maximum]`. Values
 * outside the interval become the nearest endpoint. Both data-first and
 * data-last calls are supported.
 * @since 0.1.0
 * @category operations
 */
export const clamp: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => number
  (self: number, options: { readonly minimum: number; readonly maximum: number }): number
} = EffectNumber.clamp

/**
 * Tests whether a value belongs to the closed interval
 * `[minimum, maximum]`. Both data-first and data-last calls are supported.
 * @since 0.1.0
 * @category operations
 */
export const between: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => boolean
  (self: number, options: { readonly minimum: number; readonly maximum: number }): boolean
} = EffectNumber.between

/**
 * Yields the immutable descriptor used to register Numeric capabilities.
 * @since 0.1.0
 * @category operations
 */
export const loadNumericDomain = Effect.succeed(NumericDomainModel)

/**
 * Decodes finite operands and divides them, returning `None` for a zero
 * divisor. Malformed or excess input fails with `NumericDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const safeDivideValidated = (input: unknown) =>
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
 * Decodes finite operands and divides them. Malformed or excess input fails
 * with `NumericDecodeError`; a zero divisor fails with
 * `NumericDomainViolationError`.
 * @since 0.1.0
 * @category validated operations
 */
export const unsafeDivideValidated = (input: unknown) =>
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
 * Decodes a positive finite value and computes its natural logarithm.
 * Malformed, non-positive, non-finite, or excess input fails with
 * `NumericDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const logValidated = (input: unknown) =>
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
 * Decodes a non-empty array of finite values and adds them in array order.
 * Malformed or excess input fails with `NumericDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const sumValidated = (input: unknown) =>
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
 * Decodes a non-empty array of finite values and finds the first index of its
 * maximum. Malformed or excess input fails with `NumericDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const argmaxValidated = (input: unknown) =>
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
 * Adds an array using the configured backend and finite-result policy.
 *
 * @remarks
 * The `"typed-array"` backend uses Kahan-compensated `Float64Array`
 * accumulation. The `"scalar"` backend adds in array order. Strict precision
 * rejects a non-finite result with `NumericDomainViolationError`. Enabled
 * diagnostics logs the selected policies, input size, and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Effect, Layer } from "effect"
 * import {
 *   BackendPolicyService,
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "@scenesystems/effect-math/contracts"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(BackendPolicyService, { policy: "typed-array" }),
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * export const program = Numeric.sumWithPolicies([1e15, 1, -1e15]).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (sum) => sum === 1,
 *     () => "UnexpectedCompensatedSum"
 *   )
 * )
 * ```
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
              elapsedMs: String(EffectNumber.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Selects compensated `ln(1 + x)` in strict mode and the native kernel in
 * relaxed mode, preserving accuracy near zero when requested.
 *
 * @remarks
 * Strict precision selects the Taylor-compensated kernel; relaxed precision
 * delegates to `Math.log1p`. Enabled diagnostics logs the precision, input,
 * and result.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
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
 * export const program = Numeric.log1pWithPolicies(1e-15).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => result > 0 && result < 1e-14,
 *     () => "UnexpectedLog1pResult"
 *   )
 * )
 * ```
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
 * Selects compensated `exp(x) - 1` in strict mode and the native kernel in
 * relaxed mode, preserving small increments near zero when requested.
 *
 * @remarks
 * Strict precision selects the Taylor-compensated kernel; relaxed precision
 * delegates to `Math.expm1`. Enabled diagnostics logs the precision, input,
 * and result.
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
 * Validates the Numeric domain boundary and its runtime policies.
 *
 * @remarks
 * Accepts `unknown` input, collects all four runtime policy services
 * (`RngPolicyService`, `PrecisionPolicyService`, `BackendPolicyService`, and
 * `DiagnosticsPolicyService`), and validates their shape. It then decodes the
 * input through `NumericBoundaryValidationInput`, requiring finite values,
 * tolerance, and an iteration budget. Returns a
 * `NumericBoundaryValidationResult` or fails with
 * `NumericDomainBoundaryError`.
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

// ---------------------------------------------------------------------------
// Log-space pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Computes `log(exp(a) + exp(b))` without materializing either exponential.
 * @since 0.1.0
 * @category operations
 */
export const logaddexp: (a: number, b: number) => number = Logspace.logaddexp

/**
 * Computes `log(exp(a) - exp(b))` without materializing either exponential.
 * The caller must supply `a >= b`.
 *
 * @since 0.1.0
 * @category operations
 */
export const logsubexp: (a: number, b: number) => number = Logspace.logsubexp

/**
 * Computes `log(1 - exp(x))` in a numerically stable way.
 *
 * @since 0.1.0
 * @category operations
 */
export const log1mexp: (x: number) => number = Logspace.log1mexp

/**
 * Computes `log(1 + exp(x))` (softplus) in a numerically stable way.
 *
 * @since 0.1.0
 * @category operations
 */
export const log1pexp: (x: number) => number = Logspace.log1pexp

/**
 * Computes `x * log(y)` with the convention that `0 * log(0) = 0`.
 *
 * @since 0.1.0
 * @category operations
 */
export const xlogy: (x: number, y: number) => number = Logspace.xlogy

/**
 * Computes `x * log1p(y)` with the convention that `0 * log1p(0) = 0`.
 *
 * @since 0.1.0
 * @category operations
 */
export const xlog1py: (x: number, y: number) => number = Logspace.xlog1py

/**
 * Computes `log(Σ exp(xᵢ))` after shifting by the largest element to limit
 * overflow and underflow.
 * @since 0.2.0
 * @category operations
 */
export const logSumExp: (xs: Chunk.Chunk<number>) => number = LogSumExp.logSumExpChunk

// ---------------------------------------------------------------------------
// Log-space validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Decodes two finite values and computes their log-space sum. Malformed or
 * excess input fails with `NumericDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const logaddexpValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogaddexpInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "logaddexp",
          message: error.message
        })
      )
    )
    return Logspace.logaddexp(decoded.a, decoded.b)
  })

/**
 * Decodes a non-empty finite vector and computes its log-sum-exp. Malformed
 * or excess input fails with `NumericDecodeError`.
 * @since 0.2.0
 * @category validated operations
 */
export const logSumExpValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogSumExpInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new NumericDecodeError({
          operation: "logSumExp",
          message: error.message
        })
      )
    )
    return LogSumExp.logSumExpChunk(Chunk.fromIterable(decoded.values))
  })

// ---------------------------------------------------------------------------
// Log-space policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes a log-space sum, rejecting a non-finite result under strict
 * precision and logging inputs and output when diagnostics are enabled.
 * @since 0.1.0
 * @category operations
 */
export const logaddexpWithPolicies = (a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Numeric.logaddexpWithPolicies",
    compute: () => Logspace.logaddexp(a, b),
    makeError: (message) => new NumericDomainViolationError({ operation: "logaddexpWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })

/**
 * Computes log-sum-exp, rejecting a non-finite result under strict precision
 * and logging the input size and output when diagnostics are enabled.
 * @since 0.2.0
 * @category operations
 */
export const logSumExpWithPolicies = (values: ReadonlyArray<number>) =>
  withScalarPolicyGuards({
    operation: "Numeric.logSumExpWithPolicies",
    compute: () => LogSumExp.logSumExpChunk(Chunk.fromIterable(values)),
    makeError: (message) => new NumericDomainViolationError({ operation: "logSumExpWithPolicies", message }),
    annotations: (result) => ({ inputSize: String(values.length), result: String(result) })
  })
