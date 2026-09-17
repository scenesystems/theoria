/**
 * Numeric schemas, errors, scalar transforms, reductions, and policy-aware operations.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Chunk, Clock, Effect, Match, Number, Option, Schema } from "effect"

import * as Binary from "./internal/numeric/binary.js"
import * as Logspace from "./internal/numeric/logspace.js"
import * as LogSumExp from "./internal/numeric/logSumExp.js"
import * as Reduction from "./internal/numeric/reduction.js"
import * as Scalar from "./internal/numeric/scalar.js"
import * as Selection from "./internal/numeric/selection.js"
import * as Transcendental from "./internal/numeric/transcendental.js"
import * as PolicyGuard from "./internal/policyGuard.js"
import * as Policy from "./Policy.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const finite = Schema.Number.pipe(Schema.finite())
const finiteInteger = finite.pipe(Schema.int())

/** Positive finite error limit measured in the result's units.
 * @since 0.1.0
 * @category schemas
 */
export const AbsoluteTolerance = finite.pipe(Schema.greaterThan(0)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/AbsoluteTolerance"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/AbsoluteTolerance"))

/** Positive finite unitless error limit.
 * @since 0.1.0
 * @category schemas
 */
export const RelativeTolerance = finite.pipe(Schema.greaterThan(0)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/RelativeTolerance"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/RelativeTolerance"))

/** Positive finite maximum iteration count.
 * @since 0.1.0
 * @category schemas
 */
export const IterationBudget = finiteInteger.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/IterationBudget"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/IterationBudget"))

/** Positive finite cutoff used by conditioning checks.
 * @since 0.1.0
 * @category schemas
 */
export const ConditioningThreshold = finite.pipe(Schema.greaterThan(0)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/ConditioningThreshold"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/ConditioningThreshold"))

/** Positive finite increment used by numerical methods.
 * @since 0.1.0
 * @category schemas
 */
export const StepSize = finite.pipe(Schema.greaterThan(0)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/StepSize"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/StepSize"))

/** Finite scalar value.
 * @since 0.1.0
 * @category schemas
 */
export const FiniteScalar = finite.annotations({
  identifier: "@scenesystems/effect-math/Numeric/FiniteScalar"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/FiniteScalar"))

/** Positive finite scalar value.
 * @since 0.1.0
 * @category schemas
 */
export const FinitePositiveScalar = finite.pipe(Schema.greaterThan(0)).annotations({
  identifier: "@scenesystems/effect-math/Numeric/FinitePositiveScalar"
}).pipe(Schema.brand("@scenesystems/effect-math/Numeric/FinitePositiveScalar"))

/** Non-empty dense vector of finite numbers.
 * @since 0.1.0
 * @category schemas
 */
export const FiniteVector = Schema.NonEmptyChunk(finite).annotations({
  identifier: "@scenesystems/effect-math/Numeric/FiniteVector"
})

/** Non-empty dense vector of positive finite numbers.
 * @since 0.1.0
 * @category schemas
 */
export const PositiveFiniteVector = Schema.NonEmptyChunk(finite.pipe(Schema.greaterThan(0))).annotations({
  identifier: "@scenesystems/effect-math/Numeric/PositiveFiniteVector"
})

/** Finite operands for division.
 * @since 0.1.0
 * @category schemas
 */
export const DivideInput = Schema.Struct({ dividend: finite, divisor: finite }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/DivideInput"
})

/** Positive finite logarithm input.
 * @since 0.1.0
 * @category schemas
 */
export const LogInput = Schema.Struct({ value: finite.pipe(Schema.greaterThan(0)) }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/LogInput"
})

/** Non-empty finite reduction input.
 * @since 0.1.0
 * @category schemas
 */
export const ReductionInput = Schema.Struct({ values: FiniteVector }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/ReductionInput"
})

/** Non-empty finite maximum-selection input.
 * @since 0.1.0
 * @category schemas
 */
export const ArgmaxInput = Schema.Struct({ values: FiniteVector }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/ArgmaxInput"
})

/** Two finite log-space operands.
 * @since 0.1.0
 * @category schemas
 */
export const LogaddexpInput = Schema.Struct({ a: finite, b: finite }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/LogaddexpInput"
})

/** Non-empty finite log-space vector.
 * @since 0.2.0
 * @category schemas
 */
export const LogSumExpInput = Schema.Struct({ values: FiniteVector }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/LogSumExpInput"
})

/** Finite input for `x * log(y)`.
 * @since 0.1.0
 * @category schemas
 */
export const XlogyInput = Schema.Struct({ x: finite, y: finite.pipe(Schema.greaterThan(0)) }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/XlogyInput"
})

/** Finite input for `x * log1p(y)`.
 * @since 0.1.0
 * @category schemas
 */
export const Xlog1pyInput = Schema.Struct({ x: finite, y: finite.pipe(Schema.greaterThan(-1)) }).annotations({
  identifier: "@scenesystems/effect-math/Numeric/Xlog1pyInput"
})

/**
 * Decoded absolute tolerance.
 * @since 0.1.0
 * @category models
 */
export type AbsoluteTolerance = typeof AbsoluteTolerance.Type
/**
 * Decoded relative tolerance.
 * @since 0.1.0
 * @category models
 */
export type RelativeTolerance = typeof RelativeTolerance.Type
/**
 * Decoded iteration budget.
 * @since 0.1.0
 * @category models
 */
export type IterationBudget = typeof IterationBudget.Type
/**
 * Decoded conditioning threshold.
 * @since 0.1.0
 * @category models
 */
export type ConditioningThreshold = typeof ConditioningThreshold.Type
/**
 * Decoded numerical step size.
 * @since 0.1.0
 * @category models
 */
export type StepSize = typeof StepSize.Type
/**
 * Decoded finite scalar.
 * @since 0.1.0
 * @category models
 */
export type FiniteScalar = typeof FiniteScalar.Type
/**
 * Decoded positive finite scalar.
 * @since 0.1.0
 * @category models
 */
export type FinitePositiveScalar = typeof FinitePositiveScalar.Type
/**
 * Decoded non-empty finite vector.
 * @since 0.1.0
 * @category models
 */
export type FiniteVector = typeof FiniteVector.Type
/**
 * Decoded positive finite vector.
 * @since 0.1.0
 * @category models
 */
export type PositiveFiniteVector = typeof PositiveFiniteVector.Type
/**
 * Decoded division input.
 * @since 0.1.0
 * @category models
 */
export type DivideInput = typeof DivideInput.Type
/**
 * Decoded logarithm input.
 * @since 0.1.0
 * @category models
 */
export type LogInput = typeof LogInput.Type
/**
 * Decoded reduction input.
 * @since 0.1.0
 * @category models
 */
export type ReductionInput = typeof ReductionInput.Type
/**
 * Decoded argmax input.
 * @since 0.1.0
 * @category models
 */
export type ArgmaxInput = typeof ArgmaxInput.Type
/**
 * Decoded log-add-exp input.
 * @since 0.1.0
 * @category models
 */
export type LogaddexpInput = typeof LogaddexpInput.Type
/**
 * Decoded log-sum-exp input.
 * @since 0.2.0
 * @category models
 */
export type LogSumExpInput = typeof LogSumExpInput.Type
/**
 * Decoded x-log-y input.
 * @since 0.1.0
 * @category models
 */
export type XlogyInput = typeof XlogyInput.Type
/**
 * Decoded x-log-one-plus-y input.
 * @since 0.1.0
 * @category models
 */
export type Xlog1pyInput = typeof Xlog1pyInput.Type

/** Malformed validated-operation input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError
  extends Schema.TaggedError<DecodeError>("@scenesystems/effect-math/Numeric/DecodeError")("NumericDecodeError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/** Input or result outside an operation's mathematical domain.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>("@scenesystems/effect-math/Numeric/DomainViolationError")(
    "NumericDomainViolationError",
    {
      operation: Schema.String,
      message: Schema.String
    }
  )
{}

/** Failure raised when a synchronous numerical callback throws.
 * @since 0.1.0
 * @category errors
 */
export class ExecutionError
  extends Schema.TaggedError<ExecutionError>("@scenesystems/effect-math/Numeric/ExecutionError")(
    "KernelExecutionError",
    {
      operation: Schema.String,
      message: Schema.String
    }
  )
{}

/** Recoverable Numeric operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError | ExecutionError

/**
 * Divides two numbers, returning `None` when the divisor is positive or
 * negative zero. Both data-first and data-last calls are supported.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Boolean, Chunk, Effect, Number, Option, pipe } from "effect"
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
 *       (result) => Boolean.every(Chunk.make(
 *         Number.Equivalence(result.quotient, 5),
 *         Number.Equivalence(result.zeroFallback, 0),
 *         Number.Equivalence(result.curried, 2)
 *       )),
 *       () => "UnexpectedDivisionResult"
 *     )
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const safeDivide: typeof Number.divide = Number.divide

/**
 * Divides with JavaScript's IEEE 754 behavior, including infinite and `NaN`
 * results. Use {@link safeDivide} when zero is an expected divisor.
 * @since 0.1.0
 * @category operations
 */
export const unsafeDivide: typeof Number.unsafeDivide = Number.unsafeDivide

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
export const isFinite: (value: number) => boolean = Binary.isFinite

/**
 * Chooses the smaller ordered number in either direct or data-last form.
 * @since 0.4.0
 * @category operations
 */
export const min: typeof Number.min = Number.min

/**
 * Chooses the larger ordered number and supports data-first or pipeable calls.
 * @since 0.4.0
 * @category operations
 */
export const max: typeof Number.max = Number.max

/**
 * Returns the non-negative magnitude of a number. Negative zero becomes
 * positive zero; infinities pass through and `NaN` remains `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const abs: (value: number) => number = Binary.abs

/**
 * Converts a finite binary64 value to its exact decimal expansion rather than
 * its shortest round-tripping decimal string. Non-finite input returns `None`;
 * BigDecimal represents both signs of zero as zero.
 * @since 0.4.0
 * @category conversions
 */
export const toBigDecimal: typeof Binary.toBigDecimal = Binary.toBigDecimal

/**
 * Converts a finite integer-valued binary64 number to its exact bigint value,
 * including values outside the safe-integer range. Fractions and non-finite
 * inputs return `None`; either sign of zero becomes `0n`.
 * @since 0.4.0
 * @category conversions
 */
export const toBigInt: typeof Binary.toBigInt = Binary.toBigInt

/**
 * Returns the principal square root. Negative input produces `NaN`, positive
 * infinity passes through, and negative zero is preserved.
 * @since 0.4.0
 * @category operations
 */
export const sqrt: (value: number) => number = Binary.sqrt

/**
 * Computes a correctly rounded Euclidean norm using an exact sum of squares.
 * Avoids intermediate overflow and underflow. Infinity dominates NaN, and an
 * empty or all-zero input returns positive zero.
 * @since 0.4.0
 * @category operations
 */
export const hypot: typeof Binary.hypot = Binary.hypot

/**
 * Correctly rounded binary64 ratio of a circle's circumference to its diameter.
 * @since 0.4.0
 * @category constants
 */
export const pi = 3.141592653589793

/**
 * Computes sine for a radian angle, preserving signed zero; non-finite input produces `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const sin: typeof Transcendental.sin = Transcendental.sin

/**
 * Computes cosine for a radian angle; zero maps to `1` and non-finite input produces `NaN`.
 * @since 0.4.0
 * @category operations
 */
export const cos: typeof Transcendental.cos = Transcendental.cos

/**
 * Computes the exponential with ln(2) range reduction and exact dyadic scaling.
 * @since 0.4.0
 * @category operations
 */
export const exp: typeof Transcendental.exp = Transcendental.exp

/**
 * Computes the quadrant-aware angle of `(x, y)`, including signed-zero and infinity boundaries.
 * @since 0.4.0
 * @category operations
 */
export const atan2: typeof Transcendental.atan2 = Transcendental.atan2

/**
 * Computes hyperbolic sine while retaining tiny increments and signed zero.
 * @since 0.4.0
 * @category operations
 */
export const sinh: typeof Transcendental.sinh = Transcendental.sinh

/**
 * Computes hyperbolic cosine using symmetrically scaled exponentials.
 * @since 0.4.0
 * @category operations
 */
export const cosh: typeof Transcendental.cosh = Transcendental.cosh

/**
 * Returns the base-10 logarithm. Zero produces negative infinity, negative
 * input produces `NaN`, and positive infinity passes through.
 * @since 0.4.0
 * @category operations
 */
export const log10: typeof Transcendental.log10 = Transcendental.log10

/**
 * Raises `base` to `exponent`, dispatching integral exponents before the
 * logarithm/exponential path so negative bases retain their real results.
 * @since 0.4.0
 * @category operations
 */
export const pow: typeof Transcendental.pow = Transcendental.pow

/**
 * Rounds a number to the requested decimal precision. Both data-first and
 * data-last calls are supported.
 * @since 0.4.0
 * @category operations
 */
export const round: typeof Number.round = Number.round

/**
 * Rounds finite values toward negative infinity. Infinities and `NaN` pass
 * through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const floor: (value: number) => number = Binary.floor

/**
 * Rounds finite values toward positive infinity. Infinities and `NaN` pass
 * through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const ceil: (value: number) => number = Binary.ceil

/**
 * Removes the fractional part of a finite value by rounding toward zero.
 * Infinities and `NaN` pass through unchanged.
 * @since 0.4.0
 * @category operations
 */
export const truncate: (value: number) => number = Binary.truncate

/**
 * Computes the natural logarithm with dyadic normalization, including `NaN`
 * for negative input and `-Infinity` for zero. {@link logValidated} rejects those inputs.
 * @since 0.1.0
 * @category operations
 */
export const log: typeof Transcendental.log = Transcendental.log

/**
 * Computes the natural logarithm using exact dyadic decomposition and a
 * range-reduced atanh series.
 * @since 0.1.0
 * @category operations
 */
export const logStrict: typeof Transcendental.logStrict = Transcendental.logStrict

/**
 * Computes `ln(1 + x)` with a cancellation-aware small-input series.
 * @since 0.1.0
 * @category operations
 */
export const log1p: typeof Transcendental.log1p = Transcendental.log1p

/**
 * Deterministic precision-policy alias for {@link log1p}.
 * @since 0.1.0
 * @category operations
 */
export const log1pStrict: typeof Transcendental.log1pStrict = Transcendental.log1pStrict

/**
 * Computes `exp(x) - 1` with a cancellation-aware small-input series.
 * @since 0.1.0
 * @category operations
 */
export const expm1: typeof Transcendental.expm1 = Transcendental.expm1

/**
 * Deterministic precision-policy alias for {@link expm1}.
 * @since 0.1.0
 * @category operations
 */
export const expm1Strict: typeof Transcendental.expm1Strict = Transcendental.expm1Strict

/**
 * Adds values in iteration order without compensated accumulation.
 * {@link sumWithPolicies} selects compensated accumulation when its backend
 * policy is `"compensated"`.
 * @since 0.1.0
 * @category operations
 */
export const sum: (values: Iterable<number>) => number = Number.sumAll

/**
 * Finds the zero-based index of the maximum element, or `None` for an empty
 * iterable. When multiple elements share the maximum value, returns
 * the index of the first occurrence.
 * @since 0.1.0
 * @category operations
 */
export const argmaxIndex: typeof Selection.argmaxIndex = Selection.argmaxIndex

/**
 * Constrains a value to the closed interval `[minimum, maximum]`. Values
 * outside the interval become the nearest endpoint. Both data-first and
 * data-last calls are supported.
 * @since 0.1.0
 * @category operations
 */
export const clamp: typeof Number.clamp = Number.clamp

/**
 * Tests whether a value belongs to the closed interval
 * `[minimum, maximum]`. Both data-first and data-last calls are supported.
 * @since 0.1.0
 * @category operations
 */
export const between: typeof Number.between = Number.between

/**
 * Decodes finite operands and divides them, returning `None` for a zero
 * divisor. Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const safeDivideValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DivideInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "safeDivide",
          message: error.message
        })
      )
    )
    return Number.divide(decoded.dividend, decoded.divisor)
  })

/**
 * Decodes finite operands and divides them. Malformed or excess input fails
 * with `DecodeError`; a zero divisor fails with `DomainViolationError`.
 * @since 0.1.0
 * @category validated operations
 */
export const unsafeDivideValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DivideInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "unsafeDivide",
          message: error.message
        })
      )
    )
    return yield* Option.match(Number.divide(decoded.dividend, decoded.divisor), {
      onNone: () =>
        new DomainViolationError({
          operation: "unsafeDivide",
          message: Array.join(
            Array.make(
              "Division by zero: ",
              encodeNumber(decoded.dividend),
              " / ",
              encodeNumber(decoded.divisor)
            ),
            ""
          )
        }),
      onSome: Effect.succeed
    })
  })

/**
 * Decodes a positive finite value and computes its natural logarithm.
 * Malformed, non-positive, non-finite, or excess input fails with
 * `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const logValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "log",
          message: error.message
        })
      )
    )
    return Transcendental.log(decoded.value)
  })

/**
 * Decodes a non-empty finite vector and adds its values in input order.
 * Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const sumValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ReductionInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "sum",
          message: error.message
        })
      )
    )
    return Number.sumAll(decoded.values)
  })

/**
 * Decodes a non-empty finite vector and finds the first index of its
 * maximum. Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const argmaxValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ArgmaxInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "argmax",
          message: error.message
        })
      )
    )
    return Selection.argmaxIndex(decoded.values)
  })

/**
 * Adds an iterable using the configured backend and finite-result policy.
 *
 * @remarks
 * The `"compensated"` backend selects Kahan-compensated `Chunk`
 * accumulation. The `"scalar"` backend adds in iteration order. Strict precision
 * rejects a non-finite result with `DomainViolationError`. Enabled
 * diagnostics logs the selected policies, input size, and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Chunk, Effect, Layer, Number } from "effect"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(Policy.Backend, { policy: "compensated" }),
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Numeric.sumWithPolicies(Chunk.make(1e16, 1, 1, -1e16)).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (sum) => Number.Equivalence(sum, 2),
 *     () => "UnexpectedCompensatedSum"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const sumWithPolicies = (values: Iterable<number>) =>
  Effect.gen(function*() {
    const backend = yield* Policy.Backend
    const precision = yield* Policy.Precision
    const diagnostics = yield* Policy.Diagnostics
    const denseValues = Chunk.fromIterable(values)

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = yield* Match.value(backend.policy).pipe(
      Match.when("compensated", () => Effect.succeed(Reduction.sumCompensated(denseValues))),
      Match.when("scalar", () => Effect.succeed(Reduction.sumScalar(denseValues))),
      Match.exhaustive
    )

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          isFinite,
          () =>
            new DomainViolationError({
              operation: "sumWithPolicies",
              message: Array.join(Array.make("Non-finite sum result: ", encodeNumber(result)), "")
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
              inputSize: encodeNumber(Chunk.size(denseValues)),
              elapsedMs: encodeNumber(Number.subtract(elapsed, startedAt))
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
 * Both policy modes use the deterministic native-composition kernel. Enabled
 * diagnostics logs the precision, input, and result.
 *
 * @example
 * ```ts
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Chunk, Effect, Layer, Number, Predicate } from "effect"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Numeric.log1pWithPolicies(1e-15).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => Predicate.every(Chunk.make(Number.greaterThan(0), Number.lessThan(1e-14)))(result),
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
    const precision = yield* Policy.Precision
    const diagnostics = yield* Policy.Diagnostics

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
            input: encodeNumber(value),
            result: encodeNumber(result)
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
 * Both policy modes use the deterministic native-composition kernel. Enabled
 * diagnostics logs the precision, input, and result.
 * @since 0.1.0
 * @category operations
 */
export const expm1WithPolicies = (value: number) =>
  Effect.gen(function*() {
    const precision = yield* Policy.Precision
    const diagnostics = yield* Policy.Diagnostics

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
            input: encodeNumber(value),
            result: encodeNumber(result)
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
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
 * The caller must supply `a > b`; other inputs produce `NaN`.
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
 * excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const logaddexpValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogaddexpInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "logaddexp",
          message: error.message
        })
      )
    )
    return Logspace.logaddexp(decoded.a, decoded.b)
  })

/**
 * Decodes a non-empty finite vector and computes its log-sum-exp. Malformed
 * or excess input fails with `DecodeError`.
 * @since 0.2.0
 * @category validated operations
 */
export const logSumExpValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LogSumExpInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "logSumExp",
          message: error.message
        })
      )
    )
    return LogSumExp.logSumExpChunk(decoded.values)
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
  PolicyGuard.scalar({
    operation: "Numeric.logaddexpWithPolicies",
    compute: () => Logspace.logaddexp(a, b),
    makeError: (message) => new DomainViolationError({ operation: "logaddexpWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
      result: encodeNumber(result)
    })
  })

/**
 * Computes log-sum-exp, rejecting a non-finite result under strict precision
 * and logging the input size and output when diagnostics are enabled.
 * @since 0.2.0
 * @category operations
 */
export const logSumExpWithPolicies = (values: Iterable<number>) => {
  const denseValues = Chunk.fromIterable(values)
  return PolicyGuard.scalar({
    operation: "Numeric.logSumExpWithPolicies",
    compute: () => LogSumExp.logSumExpChunk(denseValues),
    makeError: (message) => new DomainViolationError({ operation: "logSumExpWithPolicies", message }),
    annotations: (result) => ({
      inputSize: encodeNumber(Chunk.size(denseValues)),
      result: encodeNumber(result)
    })
  })
}
