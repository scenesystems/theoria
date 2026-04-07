/**
 * Numeric domain operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Clock, Effect, Match, Number as EffectNumber, Option, Schema } from "effect"

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
import * as Hyperbolic from "./internal/hyperbolic.js"
import * as Integer from "./internal/integer.js"
import * as Logspace from "./internal/logspace.js"
import * as LogSumExp from "./internal/logSumExp.js"
import * as Reduction from "./internal/reduction.js"
import * as Rounding from "./internal/rounding.js"
import * as Scalar from "./internal/scalar.js"
import * as Selection from "./internal/selection.js"
import * as Transcendental from "./internal/transcendental.js"
import * as Trigonometric from "./internal/trigonometric.js"
import { NumericDomainModel } from "./model.js"
import {
  AngleConversionInput,
  ArgmaxInput,
  Atan2Input,
  ClosedUnitScalarInput,
  DivideInput,
  HypotInput,
  Int32MultiplyInput,
  LogaddexpInput,
  LogInput,
  LogSumExpInput,
  OpenUnitScalarInput,
  ReductionInput,
  ScalarAtLeastOneInput,
  UnaryFiniteScalarInput
} from "./schema.js"

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
 * Canonical circle constant used by downstream samplers and density kernels.
 *
 * @since 0.2.1
 * @category constants
 */
export const PI = Math.PI

/**
 * Canonical base of the natural logarithm used by downstream log-space
 * transforms.
 *
 * @since 0.2.1
 * @category constants
 */
export const E = Transcendental.E

/**
 * Canonical natural logarithm of two used by strict logarithm kernels.
 *
 * @since 0.2.1
 * @category constants
 */
export const LN_2 = Transcendental.LN_2

/**
 * Canonical square root of two used by Gaussian and Fourier-domain helpers.
 *
 * @since 0.2.1
 * @category constants
 */
export const SQRT_2 = Math.SQRT2

/**
 * Canonical IEEE-754 machine epsilon for float64 computations.
 *
 * @since 0.2.1
 * @category constants
 */
export const EPSILON = Number.EPSILON

/**
 * Absolute value on float64 scalars.
 *
 * @since 0.2.1
 * @category operations
 */
export const abs: (value: number) => number = Transcendental.abs

/**
 * Square root on float64 scalars.
 *
 * @since 0.2.1
 * @category operations
 */
export const sqrt: (value: number) => number = Math.sqrt

/**
 * Natural exponential on float64 scalars.
 *
 * @since 0.2.1
 * @category operations
 */
export const exp: (value: number) => number = Transcendental.exp

/**
 * Canonical turn constant used by downstream geometry, rendering, and phase
 * computations that want one full revolution in radians.
 *
 * @since 0.3.0
 * @category constants
 */
export const TAU = EffectNumber.multiply(2, PI)

/**
 * Converts degrees into radians on the released real-scalar surface so
 * downstream geometry and render helpers can stay on `effect-math/Numeric`.
 *
 * @since 0.3.0
 * @category operations
 */
export const degreesToRadians: (value: number) => number = Rounding.degreesToRadians

/**
 * Converts radians into degrees on the released real-scalar surface.
 *
 * @since 0.3.0
 * @category operations
 */
export const radiansToDegrees: (value: number) => number = Rounding.radiansToDegrees

/**
 * Circular sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const sin: (value: number) => number = Trigonometric.sin

/**
 * Circular cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const cos: (value: number) => number = Trigonometric.cos

/**
 * Circular tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const tan: (value: number) => number = Trigonometric.tan

/**
 * Inverse circular sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const asin: (value: number) => number = Trigonometric.asin

/**
 * Inverse circular cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const acos: (value: number) => number = Trigonometric.acos

/**
 * Inverse circular tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const atan: (value: number) => number = Trigonometric.atan

/**
 * Quadrant-sensitive inverse tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const atan2: (y: number, x: number) => number = Trigonometric.atan2

/**
 * Hyperbolic sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const sinh: (value: number) => number = Hyperbolic.sinh

/**
 * Hyperbolic cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const cosh: (value: number) => number = Hyperbolic.cosh

/**
 * Hyperbolic tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const tanh: (value: number) => number = Hyperbolic.tanh

/**
 * Inverse hyperbolic sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const asinh: (value: number) => number = Hyperbolic.asinh

/**
 * Inverse hyperbolic cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const acosh: (value: number) => number = Hyperbolic.acosh

/**
 * Inverse hyperbolic tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const atanh: (value: number) => number = Hyperbolic.atanh

/**
 * Euclidean magnitude from two real scalar coordinates.
 *
 * @since 0.3.0
 * @category operations
 */
export const hypot: (left: number, right: number) => number = Rounding.hypot

/**
 * IEEE-754 floor on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const floor: (value: number) => number = Rounding.floor

/**
 * IEEE-754 ceiling on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const ceil: (value: number) => number = Rounding.ceil

/**
 * IEEE-754 round-to-nearest on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const round: (value: number) => number = Rounding.round

/**
 * IEEE-754 truncate-toward-zero on real scalar inputs.
 *
 * @since 0.3.0
 * @category operations
 */
export const trunc: (value: number) => number = Rounding.trunc

/**
 * Deterministic signed 32-bit multiplication for hashing and PRNG-style flows.
 *
 * @since 0.3.0
 * @category operations
 */
export const imul: (left: number, right: number) => number = Integer.imul

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
 * Strict natural logarithm using DataView bit-decomposition + Taylor
 * series. Produces deterministic results independent of platform
 * `Math.log` implementation.
 *
 * @see {@link log} — relaxed variant delegating to `Math.log`
 * @since 0.1.0
 * @category operations
 */
export const logStrict: (value: number) => number = Transcendental.logStrict

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
 * Strict `ln(1 + x)` using Taylor series for `|x| < 1e-4` and
 * DataView bit-decomposition log for larger values. Produces
 * deterministic results independent of platform `Math.log1p`.
 *
 * @see {@link log1p} — relaxed variant delegating to `Math.log1p`
 * @since 0.1.0
 * @category operations
 */
export const log1pStrict: (value: number) => number = Transcendental.log1pStrict

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
 * Strict `exp(x) - 1` using Taylor series for `|x| < 1e-5` and
 * pure `E**x - 1` for larger values. Produces deterministic results
 * independent of platform `Math.expm1`.
 *
 * @see {@link expm1} — relaxed variant delegating to `Math.expm1`
 * @since 0.1.0
 * @category operations
 */
export const expm1Strict: (value: number) => number = Transcendental.expm1Strict

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

const decodeNumericInput = <A, I>(schema: Schema.Schema<A, I, never>, operation: string, input: unknown) =>
  Schema.decodeUnknown(schema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError((error) =>
      new NumericDecodeError({
        operation,
        message: error.message
      })
    )
  )

const withNumericScalarPolicies = (operation: string, compute: () => number, input: string) =>
  withScalarPolicyGuards({
    operation: `Numeric.${operation}`,
    compute,
    makeError: (message) => new NumericDomainViolationError({ operation, message }),
    annotations: (result) => ({ input, result: String(result) })
  })

/**
 * Boundary-validated degree-to-radian conversion.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const degreesToRadiansValidated = (input: unknown) =>
  decodeNumericInput(AngleConversionInput, "degreesToRadians", input).pipe(
    Effect.map(({ value }) => Rounding.degreesToRadians(value))
  )

/**
 * Boundary-validated radian-to-degree conversion.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const radiansToDegreesValidated = (input: unknown) =>
  decodeNumericInput(AngleConversionInput, "radiansToDegrees", input).pipe(
    Effect.map(({ value }) => Rounding.radiansToDegrees(value))
  )

/**
 * Boundary-validated circular sine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const sinValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "sin", input).pipe(
    Effect.map(({ value }) => Trigonometric.sin(value))
  )

/**
 * Boundary-validated circular cosine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const cosValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "cos", input).pipe(
    Effect.map(({ value }) => Trigonometric.cos(value))
  )

/**
 * Boundary-validated circular tangent.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const tanValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "tan", input).pipe(
    Effect.map(({ value }) => Trigonometric.tan(value))
  )

/**
 * Boundary-validated inverse circular sine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const asinValidated = (input: unknown) =>
  decodeNumericInput(ClosedUnitScalarInput, "asin", input).pipe(
    Effect.map(({ value }) => Trigonometric.asin(value))
  )

/**
 * Boundary-validated inverse circular cosine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const acosValidated = (input: unknown) =>
  decodeNumericInput(ClosedUnitScalarInput, "acos", input).pipe(
    Effect.map(({ value }) => Trigonometric.acos(value))
  )

/**
 * Boundary-validated inverse circular tangent.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const atanValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "atan", input).pipe(
    Effect.map(({ value }) => Trigonometric.atan(value))
  )

/**
 * Boundary-validated quadrant-sensitive inverse tangent.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const atan2Validated = (input: unknown) =>
  decodeNumericInput(Atan2Input, "atan2", input).pipe(
    Effect.map(({ y, x }) => Trigonometric.atan2(y, x))
  )

/**
 * Boundary-validated hyperbolic sine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const sinhValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "sinh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.sinh(value))
  )

/**
 * Boundary-validated hyperbolic cosine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const coshValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "cosh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.cosh(value))
  )

/**
 * Boundary-validated hyperbolic tangent.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const tanhValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "tanh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.tanh(value))
  )

/**
 * Boundary-validated inverse hyperbolic sine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const asinhValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "asinh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.asinh(value))
  )

/**
 * Boundary-validated inverse hyperbolic cosine.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const acoshValidated = (input: unknown) =>
  decodeNumericInput(ScalarAtLeastOneInput, "acosh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.acosh(value))
  )

/**
 * Boundary-validated inverse hyperbolic tangent.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const atanhValidated = (input: unknown) =>
  decodeNumericInput(OpenUnitScalarInput, "atanh", input).pipe(
    Effect.map(({ value }) => Hyperbolic.atanh(value))
  )

/**
 * Boundary-validated Euclidean magnitude.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const hypotValidated = (input: unknown) =>
  decodeNumericInput(HypotInput, "hypot", input).pipe(
    Effect.map(({ left, right }) => Rounding.hypot(left, right))
  )

/**
 * Boundary-validated IEEE-754 floor.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const floorValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "floor", input).pipe(
    Effect.map(({ value }) => Rounding.floor(value))
  )

/**
 * Boundary-validated IEEE-754 ceiling.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const ceilValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "ceil", input).pipe(
    Effect.map(({ value }) => Rounding.ceil(value))
  )

/**
 * Boundary-validated IEEE-754 round-to-nearest.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const roundValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "round", input).pipe(
    Effect.map(({ value }) => Rounding.round(value))
  )

/**
 * Boundary-validated IEEE-754 truncate-toward-zero.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const truncValidated = (input: unknown) =>
  decodeNumericInput(UnaryFiniteScalarInput, "trunc", input).pipe(
    Effect.map(({ value }) => Rounding.trunc(value))
  )

/**
 * Boundary-validated deterministic signed 32-bit multiplication.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const imulValidated = (input: unknown) =>
  decodeNumericInput(Int32MultiplyInput, "imul", input).pipe(
    Effect.map(({ left, right }) => Integer.imul(left, right))
  )

/**
 * Policy-aware degree-to-radian conversion.
 *
 * @since 0.3.0
 * @category operations
 */
export const degreesToRadiansWithPolicies = (value: number) =>
  withNumericScalarPolicies("degreesToRadiansWithPolicies", () => Rounding.degreesToRadians(value), String(value))

/**
 * Policy-aware radian-to-degree conversion.
 *
 * @since 0.3.0
 * @category operations
 */
export const radiansToDegreesWithPolicies = (value: number) =>
  withNumericScalarPolicies("radiansToDegreesWithPolicies", () => Rounding.radiansToDegrees(value), String(value))

/**
 * Policy-aware circular sine.
 *
 * @since 0.3.0
 * @category operations
 */
export const sinWithPolicies = (value: number) =>
  withNumericScalarPolicies("sinWithPolicies", () => Trigonometric.sin(value), String(value))

/**
 * Policy-aware circular cosine.
 *
 * @since 0.3.0
 * @category operations
 */
export const cosWithPolicies = (value: number) =>
  withNumericScalarPolicies("cosWithPolicies", () => Trigonometric.cos(value), String(value))

/**
 * Policy-aware circular tangent.
 *
 * @since 0.3.0
 * @category operations
 */
export const tanWithPolicies = (value: number) =>
  withNumericScalarPolicies("tanWithPolicies", () => Trigonometric.tan(value), String(value))

/**
 * Policy-aware inverse circular sine.
 *
 * @since 0.3.0
 * @category operations
 */
export const asinWithPolicies = (value: number) =>
  withNumericScalarPolicies("asinWithPolicies", () => Trigonometric.asin(value), String(value))

/**
 * Policy-aware inverse circular cosine.
 *
 * @since 0.3.0
 * @category operations
 */
export const acosWithPolicies = (value: number) =>
  withNumericScalarPolicies("acosWithPolicies", () => Trigonometric.acos(value), String(value))

/**
 * Policy-aware inverse circular tangent.
 *
 * @since 0.3.0
 * @category operations
 */
export const atanWithPolicies = (value: number) =>
  withNumericScalarPolicies("atanWithPolicies", () => Trigonometric.atan(value), String(value))

/**
 * Policy-aware quadrant-sensitive inverse tangent.
 *
 * @since 0.3.0
 * @category operations
 */
export const atan2WithPolicies = (y: number, x: number) =>
  withNumericScalarPolicies("atan2WithPolicies", () => Trigonometric.atan2(y, x), `y=${y}, x=${x}`)

/**
 * Policy-aware hyperbolic sine.
 *
 * @since 0.3.0
 * @category operations
 */
export const sinhWithPolicies = (value: number) =>
  withNumericScalarPolicies("sinhWithPolicies", () => Hyperbolic.sinh(value), String(value))

/**
 * Policy-aware hyperbolic cosine.
 *
 * @since 0.3.0
 * @category operations
 */
export const coshWithPolicies = (value: number) =>
  withNumericScalarPolicies("coshWithPolicies", () => Hyperbolic.cosh(value), String(value))

/**
 * Policy-aware hyperbolic tangent.
 *
 * @since 0.3.0
 * @category operations
 */
export const tanhWithPolicies = (value: number) =>
  withNumericScalarPolicies("tanhWithPolicies", () => Hyperbolic.tanh(value), String(value))

/**
 * Policy-aware inverse hyperbolic sine.
 *
 * @since 0.3.0
 * @category operations
 */
export const asinhWithPolicies = (value: number) =>
  withNumericScalarPolicies("asinhWithPolicies", () => Hyperbolic.asinh(value), String(value))

/**
 * Policy-aware inverse hyperbolic cosine.
 *
 * @since 0.3.0
 * @category operations
 */
export const acoshWithPolicies = (value: number) =>
  withNumericScalarPolicies("acoshWithPolicies", () => Hyperbolic.acosh(value), String(value))

/**
 * Policy-aware inverse hyperbolic tangent.
 *
 * @since 0.3.0
 * @category operations
 */
export const atanhWithPolicies = (value: number) =>
  withNumericScalarPolicies("atanhWithPolicies", () => Hyperbolic.atanh(value), String(value))

/**
 * Policy-aware Euclidean magnitude.
 *
 * @since 0.3.0
 * @category operations
 */
export const hypotWithPolicies = (left: number, right: number) =>
  withNumericScalarPolicies("hypotWithPolicies", () => Rounding.hypot(left, right), `left=${left}, right=${right}`)

/**
 * Policy-aware IEEE-754 floor.
 *
 * @since 0.3.0
 * @category operations
 */
export const floorWithPolicies = (value: number) =>
  withNumericScalarPolicies("floorWithPolicies", () => Rounding.floor(value), String(value))

/**
 * Policy-aware IEEE-754 ceiling.
 *
 * @since 0.3.0
 * @category operations
 */
export const ceilWithPolicies = (value: number) =>
  withNumericScalarPolicies("ceilWithPolicies", () => Rounding.ceil(value), String(value))

/**
 * Policy-aware IEEE-754 round-to-nearest.
 *
 * @since 0.3.0
 * @category operations
 */
export const roundWithPolicies = (value: number) =>
  withNumericScalarPolicies("roundWithPolicies", () => Rounding.round(value), String(value))

/**
 * Policy-aware IEEE-754 truncate-toward-zero.
 *
 * @since 0.3.0
 * @category operations
 */
export const truncWithPolicies = (value: number) =>
  withNumericScalarPolicies("truncWithPolicies", () => Rounding.trunc(value), String(value))

/**
 * Policy-aware deterministic signed 32-bit multiplication.
 *
 * @since 0.3.0
 * @category operations
 */
export const imulWithPolicies = (left: number, right: number) =>
  withNumericScalarPolicies("imulWithPolicies", () => Integer.imul(left, right), `left=${left}, right=${right}`)

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

// ---------------------------------------------------------------------------
// Log-space pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Log-space addition: `log(exp(a) + exp(b))` computed without leaving
 * log-space. Numerically stable for all finite inputs.
 *
 * @see {@link logaddexpValidated} — boundary-validated variant
 * @see {@link logaddexpWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const logaddexp: (a: number, b: number) => number = Logspace.logaddexp

/**
 * Log-space subtraction: `log(exp(a) - exp(b))` computed without leaving
 * log-space. Requires `a >= b`.
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
 * Log-sum-exp over a `Chunk<number>`: `log(Σ exp(xᵢ))` computed in a
 * numerically stable way by shifting by the maximum element.
 *
 * @see {@link logSumExpValidated} — boundary-validated variant
 * @see {@link logSumExpWithPolicies} — policy-aware variant
 * @since 0.2.0
 * @category operations
 */
export const logSumExp: (xs: Chunk.Chunk<number>) => number = LogSumExp.logSumExpChunk

// ---------------------------------------------------------------------------
// Log-space validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated logaddexp. Accepts `unknown` input, decodes through
 * `LogaddexpInput`, and returns `log(exp(a) + exp(b))`.
 *
 * @see {@link logaddexp} — pure kernel for pre-validated input
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
 * Boundary-validated log-sum-exp. Accepts `unknown` input, decodes through
 * `LogSumExpInput`, and returns `log(Σ exp(xᵢ))`.
 *
 * @see {@link logSumExp} — pure kernel for pre-validated input
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
 * Policy-aware logaddexp reading `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from context.
 *
 * @see {@link logaddexp} — pure kernel without policy seams
 * @see {@link logaddexpValidated} — boundary-validated variant
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
 * Policy-aware log-sum-exp reading `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from context.
 *
 * @see {@link logSumExp} — pure kernel without policy seams
 * @see {@link logSumExpValidated} — boundary-validated variant
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
