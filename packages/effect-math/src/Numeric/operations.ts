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
 * Division with zero-divisor guard — returns `None` instead of producing
 * `Infinity` or `NaN`. Delegates to Effect's `Number.divide` which handles
 * negative zero correctly. Supports both data-first and data-last (curried)
 * calling conventions.
 *
 * @example
 * ```ts
 * import { Numeric } from "effect-math"
 * import { Option, pipe } from "effect"
 *
 * assert.deepStrictEqual(Numeric.safeDivide(10, 2), Option.some(5))
 * assert.deepStrictEqual(Numeric.safeDivide(10, 0), Option.none())
 * assert.deepStrictEqual(pipe(10, Numeric.safeDivide(5)), Option.some(2))
 * ```
 *
 * @see {@link unsafeDivide} — throws on zero divisor instead of returning `None`
 * @see {@link safeDivideFinite} — additionally guards against non-finite inputs
 * @since 0.1.0
 * @category operations
 */
export const safeDivide: {
  (divisor: number): (dividend: number) => Option.Option<number>
  (dividend: number, divisor: number): Option.Option<number>
} = EffectNumber.divide

/**
 * Division that produces `Infinity` or `NaN` on zero divisor instead of
 * returning `Option`. Prefer {@link safeDivide} unless you have already
 * validated the divisor is non-zero and need the raw `number` result without
 * unwrapping.
 *
 * @see {@link safeDivide} — returns `None` on zero divisor
 * @see {@link safeDivideFinite} — rejects non-finite inputs and results
 * @since 0.1.0
 * @category operations
 */
export const unsafeDivide: {
  (divisor: number): (dividend: number) => number
  (dividend: number, divisor: number): number
} = EffectNumber.unsafeDivide

/**
 * Strictest division guard — returns `None` when *either* input is
 * non-finite (`±Infinity`, `NaN`) or when the result itself would be
 * non-finite. Use at numeric boundaries where you must guarantee the
 * output is a usable IEEE 754 finite value.
 *
 * @see {@link safeDivide} — guards only against zero divisor
 * @see {@link unsafeDivide} — no guards, raw `number` result
 * @since 0.1.0
 * @category operations
 */
export const safeDivideFinite: (dividend: number, divisor: number) => Option.Option<number> = Scalar.safeDivideFinite

/**
 * Natural logarithm delegating directly to `Math.log`. Returns `NaN` for
 * negative input and `-Infinity` for zero — callers that need domain
 * enforcement should use {@link logValidated} which rejects non-positive
 * values at the Schema boundary.
 *
 * @see {@link logValidated} — boundary-validated variant that decodes `unknown`
 * @see {@link log1p} — numerically stable variant for values near zero
 * @since 0.1.0
 * @category operations
 */
export const log: (value: number) => number = Math.log

/**
 * Numerically stable `ln(1 + x)` using the relaxed kernel. Avoids
 * catastrophic cancellation for `|x| << 1` where `Math.log(1 + x)`
 * would lose significant digits. For policy-controlled precision
 * selection between the Taylor-compensated and native kernels, use
 * {@link log1pWithPolicies}.
 *
 * @see {@link log1pWithPolicies} — policy-aware variant reading `PrecisionPolicyService`
 * @see {@link log} — raw `Math.log` without stability guarantees
 * @since 0.1.0
 * @category operations
 */
export const log1p: (value: number) => number = Transcendental.log1pRelaxed

/**
 * Numerically stable `exp(x) - 1` using the relaxed kernel. Avoids
 * catastrophic cancellation for `|x| << 1` where `Math.exp(x) - 1`
 * would lose significant digits. For policy-controlled precision
 * selection, use {@link expm1WithPolicies}.
 *
 * @see {@link expm1WithPolicies} — policy-aware variant reading `PrecisionPolicyService`
 * @see {@link log1p} — the inverse operation with matching stability guarantees
 * @since 0.1.0
 * @category operations
 */
export const expm1: (value: number) => number = Transcendental.expm1Relaxed

/**
 * Naive pairwise sum via Effect's `Number.sumAll`. Sufficient for small
 * arrays or when precision is not critical. For large arrays or strict
 * floating-point accuracy, use {@link sumWithPolicies} with the
 * `"typed-array"` backend which applies Kahan-compensated accumulation.
 *
 * @see {@link sumWithPolicies} — policy-aware variant with backend/precision selection
 * @see {@link sumValidated} — boundary-validated variant that decodes `unknown`
 * @since 0.1.0
 * @category operations
 */
export const sum: (values: Iterable<number>) => number = EffectNumber.sumAll

/**
 * Returns the zero-based index of the maximum element, or `None` for
 * empty arrays. When multiple elements share the maximum value, returns
 * the index of the first occurrence.
 *
 * @see {@link argmaxValidated} — boundary-validated variant that decodes `unknown`
 * @since 0.1.0
 * @category operations
 */
export const argmaxIndex: (values: ReadonlyArray<number>) => Option.Option<number> = Selection.argmaxIndex

/**
 * Constrains a value to `[minimum, maximum]` — values below the minimum
 * snap to the minimum, values above snap to the maximum. Delegates to
 * Effect's `Number.clamp` which is a dual API supporting both data-first
 * and curried styles.
 *
 * @see {@link between} — tests membership in a range without clamping
 * @since 0.1.0
 * @category operations
 */
export const clamp: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => number
  (self: number, options: { readonly minimum: number; readonly maximum: number }): number
} = EffectNumber.clamp

/**
 * Closed-interval membership test — returns `true` when `value` is in
 * `[minimum, maximum]` (inclusive on both ends). Dual API supporting
 * both data-first and curried styles.
 *
 * @see {@link clamp} — constrains a value into the range instead of testing
 * @since 0.1.0
 * @category operations
 */
export const between: {
  (options: { readonly minimum: number; readonly maximum: number }): (self: number) => boolean
  (self: number, options: { readonly minimum: number; readonly maximum: number }): boolean
} = EffectNumber.between

/**
 * Loads the static numeric domain model as a pure `Effect.succeed`.
 * Used by domain-boundary validation to confirm the Numeric domain
 * is registered and stable before executing operations.
 *
 * @see {@link validateNumericBoundary} — full boundary validation using this model
 * @since 0.1.0
 * @category operations
 */
export const loadNumericDomain = Effect.succeed(NumericDomainModel)

/**
 * Boundary-validated safe division. Accepts `unknown` input, decodes it
 * through the `DivideInput` schema (requiring finite `dividend` and
 * `divisor`), and returns `Option<number>`. Rejects excess properties
 * and surfaces decode failures as `NumericDecodeError`.
 *
 * @see {@link safeDivide} — pure variant for pre-validated `number` inputs
 * @see {@link unsafeDivideValidated} — boundary-validated variant that fails on zero divisor
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
 * Boundary-validated division that fails with `NumericDomainViolationError`
 * on zero divisor. Accepts `unknown` input and decodes through `DivideInput`
 * schema. Unlike {@link safeDivideValidated}, this variant surfaces zero
 * division as a typed error in the `E` channel rather than `None`.
 *
 * @see {@link unsafeDivide} — pure variant for pre-validated `number` inputs
 * @see {@link safeDivideValidated} — returns `None` on zero divisor instead of failing
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
 * Boundary-validated natural logarithm. Accepts `unknown` input and
 * decodes through `LogInput` schema, which requires a strictly positive
 * finite value. This guarantees `Math.log` never receives a non-positive
 * argument — surfacing violations as `NumericDecodeError` rather than
 * producing `NaN` or `-Infinity`.
 *
 * @see {@link log} — pure variant for pre-validated `number` inputs
 * @see {@link log1p} — numerically stable variant for values near zero
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
 * Boundary-validated sum. Accepts `unknown` input and decodes through
 * `ReductionInput` schema, which requires a non-empty array of finite
 * numbers. Use at API or service boundaries where the caller shape is
 * untrusted. For pre-validated arrays, use {@link sum} directly.
 *
 * @example
 * ```ts
 * import { Numeric } from "effect-math"
 * import { Effect } from "effect"
 *
 * // Decodes unknown input, validates non-empty finite vector, then sums
 * const program = Numeric.sumValidated({ values: [1.5, 2.5, 3.0] })
 * const result = Effect.runSync(program) // 7.0
 * ```
 *
 * @see {@link sum} — pure variant for pre-validated `Iterable<number>`
 * @see {@link sumWithPolicies} — policy-aware variant with backend selection
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
 * Boundary-validated argmax. Accepts `unknown` input and decodes through
 * `ArgmaxInput` schema, which requires a non-empty array of finite
 * numbers. Returns the zero-based index of the maximum element.
 *
 * @see {@link argmaxIndex} — pure variant for pre-validated `ReadonlyArray<number>`
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
 * Policy-aware sum reading three services from context:
 *
 * - **`BackendPolicyService`** — `"typed-array"` uses Kahan-compensated
 *   `Float64Array` accumulation; `"scalar"` delegates to `Number.sumAll`.
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `NumericDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with backend, precision, input size, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Numeric } from "effect-math"
 * import { Effect, Layer } from "effect"
 * import {
 *   BackendPolicyService,
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "effect-math/contracts"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(BackendPolicyService, { policy: "typed-array" }),
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = Numeric.sumWithPolicies([1e15, 1, -1e15]).pipe(
 *   Effect.provide(layer)
 * )
 * ```
 *
 * @see {@link sum} — pure variant without policy seams
 * @see {@link sumValidated} — boundary-validated variant that decodes `unknown`
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
 * Policy-aware `ln(1 + x)` reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` selects the Taylor-compensated
 *   kernel with higher accuracy near zero; `"relaxed"` delegates to native
 *   `Math.log1p`.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with precision, input, and result annotations.
 *
 * @example
 * ```ts
 * import { Numeric } from "effect-math"
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
 * const program = Numeric.log1pWithPolicies(1e-15).pipe(
 *   Effect.provide(layer)
 * )
 * ```
 *
 * @see {@link log1p} — pure relaxed variant without policy seams
 * @see {@link log} — raw `Math.log` for general use
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
 * Policy-aware `exp(x) - 1` reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` selects the Taylor-compensated
 *   kernel with higher accuracy near zero; `"relaxed"` delegates to native
 *   `Math.expm1`.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with precision, input, and result annotations.
 *
 * @see {@link expm1} — pure relaxed variant without policy seams
 * @see {@link log1pWithPolicies} — the inverse operation with matching policy seams
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
 * Full boundary validation orchestrator. Accepts `unknown` input, collects
 * all four runtime policy services (`RngPolicyService`, `PrecisionPolicyService`,
 * `BackendPolicyService`, `DiagnosticsPolicyService`), validates their shape,
 * then decodes the input through `NumericBoundaryValidationInput` (requiring
 * finite values, tolerance, and iteration budget). Returns a
 * `NumericBoundaryValidationResult` or fails with `NumericDomainBoundaryError`.
 *
 * @see {@link loadNumericDomain} — loads the static domain model this validation depends on
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
