/**
 * Algebra schemas, errors, polynomial operations, and integer operations.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Chunk, Effect, Schema } from "effect"

import * as Integer from "./internal/algebra/integer.js"
import * as Polynomial from "./internal/algebra/polynomial.js"
import * as PolicyGuard from "./internal/policyGuard.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const finite = Schema.Finite
const integerPair = { a: Schema.Int, b: Schema.Int }

/** Polynomial coefficients and evaluation point.
 * @since 0.1.0
 * @category schemas
 */
export const PolyEvalInput = Schema.Struct({
  coefficients: Schema.Chunk(finite),
  x: finite
}).annotations({ identifier: "@scenesystems/effect-math/Algebra/PolyEvalInput" })

/** Polynomial coefficients in lowest-degree-first order.
 * @since 0.1.0
 * @category schemas
 */
export const PolyDerivativeInput = Schema.Struct({ coefficients: Schema.Chunk(finite) }).annotations({
  identifier: "@scenesystems/effect-math/Algebra/PolyDerivativeInput"
})

/** Integer pair for greatest-common-divisor calculation.
 * @since 0.1.0
 * @category schemas
 */
export const GcdInput = Schema.Struct(integerPair).annotations({
  identifier: "@scenesystems/effect-math/Algebra/GcdInput"
})

/** Integer pair for least-common-multiple calculation.
 * @since 0.1.0
 * @category schemas
 */
export const LcmInput = Schema.Struct(integerPair).annotations({
  identifier: "@scenesystems/effect-math/Algebra/LcmInput"
})

/** Non-negative integer factorial input.
 * @since 0.1.0
 * @category schemas
 */
export const FactorialInput = Schema.Struct({
  n: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "@scenesystems/effect-math/Algebra/FactorialInput" })

/**
 * Decoded polynomial evaluation input.
 * @since 0.1.0
 * @category models
 */
export type PolyEvalInput = typeof PolyEvalInput.Type
/**
 * Decoded polynomial derivative input.
 * @since 0.1.0
 * @category models
 */
export type PolyDerivativeInput = typeof PolyDerivativeInput.Type
/**
 * Decoded greatest-common-divisor input.
 * @since 0.1.0
 * @category models
 */
export type GcdInput = typeof GcdInput.Type
/**
 * Decoded least-common-multiple input.
 * @since 0.1.0
 * @category models
 */
export type LcmInput = typeof LcmInput.Type
/**
 * Decoded factorial input.
 * @since 0.1.0
 * @category models
 */
export type FactorialInput = typeof FactorialInput.Type

/** Malformed validated-operation input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("AlgebraDecodeError", {
  operation: Schema.Literal("polyEval", "polyDerivative", "gcd", "lcm", "factorial"),
  message: Schema.String
}) {}

/** Non-finite result rejected by strict precision.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError extends Schema.TaggedError<DomainViolationError>()("AlgebraDomainViolationError", {
  operation: Schema.Literal(
    "polyEvalWithPolicies",
    "polyDerivativeWithPolicies",
    "gcdWithPolicies",
    "lcmWithPolicies",
    "factorialWithPolicies"
  ),
  message: Schema.String
}) {}

/** Recoverable Algebra operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Evaluates a polynomial at `x` via Horner's method. Coefficients are
 * lowest-degree-first: `[a0, a1, a2]` = a0 + a1·x + a2·x².
 *
 * @since 0.1.0
 * @category operations
 */
export const polyEval: (coefficients: Chunk.Chunk<number>, x: number) => number = Polynomial.polyEval

/**
 * Computes the formal derivative of polynomial coefficients.
 * For example, `[a0, a1, a2, a3]` becomes
 * `[a1, 2 * a2, 3 * a3]`. A constant polynomial becomes `[0]`.
 * @since 0.1.0
 * @category operations
 */
export const polyDerivative: (coefficients: Chunk.Chunk<number>) => Chunk.Chunk<number> = Polynomial.polyDerivative

/**
 * Greatest non-negative common divisor of integer-valued inputs.
 * `gcd(0, b) = |b|` and `gcd(a, 0) = |a|`. Fractions and non-finite
 * inputs produce `NaN`; integral values beyond the safe range remain exact.
 *
 * @since 0.1.0
 * @category operations
 */
export const gcd: (a: number, b: number) => number = Integer.gcd

/**
 * Non-negative least common multiple of integer-valued inputs.
 * `lcm(0, x) = 0`. Fractions and non-finite inputs produce `NaN`.
 * Intermediate arithmetic is exact; the final result rounds to binary64.
 *
 * @since 0.1.0
 * @category operations
 */
export const lcm: (a: number, b: number) => number = Integer.lcm

/**
 * Returns `n!` for a non-negative integer, with `0! = 1`. The pure function
 * does not validate its input and returns `1` for every `n <= 0`; use
 * {@link factorialValidated} at an untrusted boundary.
 * @since 0.1.0
 * @category operations
 */
export const factorial: (n: number) => number = Integer.factorial

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Decodes finite lowest-degree-first coefficients and a finite evaluation
 * point, then evaluates the polynomial. Malformed or excess input fails with
 * `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polyEvalValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolyEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "polyEval",
          message: error.message
        })
      )
    )
    return Polynomial.polyEval(decoded.coefficients, decoded.x)
  })

/**
 * Decodes lowest-degree-first coefficients and returns their formal
 * derivative. Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polyDerivativeValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolyDerivativeInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "polyDerivative",
          message: error.message
        })
      )
    )
    return Polynomial.polyDerivative(decoded.coefficients)
  })

/**
 * Decodes two integers and computes their non-negative greatest common
 * divisor. Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const gcdValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GcdInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "gcd",
          message: error.message
        })
      )
    )
    return Integer.gcd(decoded.a, decoded.b)
  })

/**
 * Decodes two integers and computes their non-negative least common multiple.
 * Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const lcmValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LcmInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "lcm",
          message: error.message
        })
      )
    )
    return Integer.lcm(decoded.a, decoded.b)
  })

/**
 * Decodes a non-negative integer and computes its factorial. Malformed,
 * negative, fractional, or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const factorialValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(FactorialInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "factorial",
          message: error.message
        })
      )
    )
    return Integer.factorial(decoded.n)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Evaluates lowest-degree-first coefficients with Horner's method under the
 * configured runtime policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the coefficients, evaluation point, result, precision,
 * and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Algebra } from "@scenesystems/effect-math"
 * import { Chunk, Effect, Layer, Number } from "effect"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Algebra.polyEvalWithPolicies(
 *   Chunk.make(1, Number.negate(2), 1), 3
 * ).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => Number.Equivalence(result, 4),
 *     () => "UnexpectedPolynomialValue"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const polyEvalWithPolicies = (coefficients: Chunk.Chunk<number>, x: number) =>
  PolicyGuard.scalar({
    operation: "Algebra.polyEvalWithPolicies",
    compute: () => Polynomial.polyEval(coefficients, x),
    makeError: (message) => new DomainViolationError({ operation: "polyEvalWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(
        Array.make(
          "coefficients=[",
          Chunk.join(Chunk.map(coefficients, (coefficient) => encodeNumber(coefficient)), ","),
          "], x=",
          encodeNumber(x)
        ),
        ""
      ),
      result: encodeNumber(result)
    })
  })

/**
 * Differentiates coefficients under the configured finite-result policy.
 *
 * @remarks
 * Strict precision rejects a result containing non-finite coefficients with
 * `DomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the input, result, precision, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const polyDerivativeWithPolicies = (coefficients: Chunk.Chunk<number>) =>
  PolicyGuard.custom({
    operation: "Algebra.polyDerivativeWithPolicies",
    compute: () => Polynomial.polyDerivative(coefficients),
    isValid: (result) => Chunk.every(result, Schema.is(Schema.Finite)),
    makeError: (message) => new DomainViolationError({ operation: "polyDerivativeWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(
        Array.make(
          "coefficients=[",
          Chunk.join(Chunk.map(coefficients, (coefficient) => encodeNumber(coefficient)), ","),
          "]"
        ),
        ""
      ),
      result: Array.join(
        Array.make("[", Chunk.join(Chunk.map(result, (coefficient) => encodeNumber(coefficient)), ","), "]"),
        ""
      )
    })
  })

/**
 * Computes `n!` while allowing strict precision to surface numeric overflow
 * as `DomainViolationError`.
 *
 * @remarks
 * Strict precision rejects a non-finite result; relaxed precision passes it
 * through. Enabled diagnostics logs the input, result, precision, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const factorialWithPolicies = (n: number) =>
  PolicyGuard.scalar({
    operation: "Algebra.factorialWithPolicies",
    compute: () => Integer.factorial(n),
    makeError: (message) => new DomainViolationError({ operation: "factorialWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(n), result: encodeNumber(result) })
  })

/**
 * Computes the non-negative greatest common divisor under the configured
 * precision and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the inputs, result, precision, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const gcdWithPolicies = (a: number, b: number) =>
  PolicyGuard.scalar({
    operation: "Algebra.gcdWithPolicies",
    compute: () => Integer.gcd(a, b),
    makeError: (message) => new DomainViolationError({ operation: "gcdWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
      result: encodeNumber(result)
    })
  })

/**
 * Computes the least common multiple while allowing strict precision to
 * surface a non-finite product as `DomainViolationError`.
 *
 * @remarks
 * Strict precision rejects a non-finite result; relaxed precision passes it
 * through. Enabled diagnostics logs the inputs, result, precision, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const lcmWithPolicies = (a: number, b: number) =>
  PolicyGuard.scalar({
    operation: "Algebra.lcmWithPolicies",
    compute: () => Integer.lcm(a, b),
    makeError: (message) => new DomainViolationError({ operation: "lcmWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
      result: encodeNumber(result)
    })
  })
