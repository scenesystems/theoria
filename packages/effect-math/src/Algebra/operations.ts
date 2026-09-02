/**
 * Polynomial and integer operations, with validated and policy-aware
 * variants for untrusted inputs and runtime numerical policy enforcement.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Schema } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { AlgebraDecodeError, AlgebraDomainViolationError } from "./errors.js"
import * as Integer from "./internal/integer.js"
import * as Polynomial from "./internal/polynomial.js"
import { AlgebraDomainModel } from "./model.js"
import { FactorialInput, GcdInput, LcmInput, PolyDerivativeInput, PolyEvalInput } from "./schema.js"

/**
 * Yields the immutable descriptor used to register Algebra capabilities.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadAlgebraDomain = Effect.succeed(AlgebraDomainModel)

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
 * `gcd(0, b) = |b|` and `gcd(a, 0) = |a|`. The pure function does not
 * validate integrality or finiteness.
 *
 * @since 0.1.0
 * @category operations
 */
export const gcd: (a: number, b: number) => number = Integer.gcd

/**
 * Non-negative least common multiple of integer-valued inputs.
 * `lcm(0, x) = 0`. The pure function does not validate integrality,
 * finiteness, or safe-integer overflow.
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
 * `AlgebraDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polyEvalValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolyEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new AlgebraDecodeError({
          operation: "polyEval",
          message: error.message
        })
      )
    )
    return Polynomial.polyEval(Chunk.fromIterable(decoded.coefficients), decoded.x)
  })

/**
 * Decodes lowest-degree-first coefficients and returns their formal
 * derivative. Malformed or excess input fails with `AlgebraDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polyDerivativeValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolyDerivativeInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new AlgebraDecodeError({
          operation: "polyDerivative",
          message: error.message
        })
      )
    )
    return Polynomial.polyDerivative(Chunk.fromIterable(decoded.coefficients))
  })

/**
 * Decodes two integers and computes their non-negative greatest common
 * divisor. Malformed or excess input fails with `AlgebraDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const gcdValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GcdInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new AlgebraDecodeError({
          operation: "gcd",
          message: error.message
        })
      )
    )
    return Integer.gcd(decoded.a, decoded.b)
  })

/**
 * Decodes two integers and computes their non-negative least common multiple.
 * Malformed or excess input fails with `AlgebraDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const lcmValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LcmInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new AlgebraDecodeError({
          operation: "lcm",
          message: error.message
        })
      )
    )
    return Integer.lcm(decoded.a, decoded.b)
  })

/**
 * Decodes a non-negative integer and computes its factorial. Malformed,
 * negative, fractional, or excess input fails with `AlgebraDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const factorialValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(FactorialInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new AlgebraDecodeError({
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
 * `AlgebraDomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the coefficients, evaluation point, result, precision,
 * and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Algebra } from "@scenesystems/effect-math"
 * import { Chunk, Effect, Layer } from "effect"
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
 * export const program = Algebra.polyEvalWithPolicies(
 *   Chunk.fromIterable([1, -2, 1]), 3
 * ).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => result === 4,
 *     () => "UnexpectedPolynomialValue"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const polyEvalWithPolicies = (coefficients: Chunk.Chunk<number>, x: number) =>
  withScalarPolicyGuards({
    operation: "Algebra.polyEvalWithPolicies",
    compute: () => Polynomial.polyEval(coefficients, x),
    makeError: (message) => new AlgebraDomainViolationError({ operation: "polyEvalWithPolicies", message }),
    annotations: (result) => ({
      input: `coefficients=[${Chunk.toReadonlyArray(coefficients).join(",")}], x=${x}`,
      result: String(result)
    })
  })

/**
 * Differentiates coefficients under the configured finite-result policy.
 *
 * @remarks
 * Strict precision rejects a result containing non-finite coefficients with
 * `AlgebraDomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the input, result, precision, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const polyDerivativeWithPolicies = (coefficients: Chunk.Chunk<number>) =>
  withCustomPolicyGuards({
    operation: "Algebra.polyDerivativeWithPolicies",
    compute: () => Polynomial.polyDerivative(coefficients),
    isValid: (result) => Chunk.every(result, (c) => Number.isFinite(c)),
    makeError: (message) => new AlgebraDomainViolationError({ operation: "polyDerivativeWithPolicies", message }),
    annotations: (result) => ({
      input: `coefficients=[${Chunk.toReadonlyArray(coefficients).join(",")}]`,
      result: `[${Chunk.toReadonlyArray(result).join(",")}]`
    })
  })

/**
 * Computes `n!` while allowing strict precision to surface numeric overflow
 * as `AlgebraDomainViolationError`.
 *
 * @remarks
 * Strict precision rejects a non-finite result; relaxed precision passes it
 * through. Enabled diagnostics logs the input, result, precision, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const factorialWithPolicies = (n: number) =>
  withScalarPolicyGuards({
    operation: "Algebra.factorialWithPolicies",
    compute: () => Integer.factorial(n),
    makeError: (message) => new AlgebraDomainViolationError({ operation: "factorialWithPolicies", message }),
    annotations: (result) => ({ input: String(n), result: String(result) })
  })

/**
 * Computes the non-negative greatest common divisor under the configured
 * precision and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `AlgebraDomainViolationError`; relaxed precision passes it through. Enabled
 * diagnostics logs the inputs, result, precision, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const gcdWithPolicies = (a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Algebra.gcdWithPolicies",
    compute: () => Integer.gcd(a, b),
    makeError: (message) => new AlgebraDomainViolationError({ operation: "gcdWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })

/**
 * Computes the least common multiple while allowing strict precision to
 * surface a non-finite product as `AlgebraDomainViolationError`.
 *
 * @remarks
 * Strict precision rejects a non-finite result; relaxed precision passes it
 * through. Enabled diagnostics logs the inputs, result, precision, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const lcmWithPolicies = (a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Algebra.lcmWithPolicies",
    compute: () => Integer.lcm(a, b),
    makeError: (message) => new AlgebraDomainViolationError({ operation: "lcmWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })
