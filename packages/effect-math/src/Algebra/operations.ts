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
 * Returns the canonical provisional Algebra descriptor for registration or
 * capability discovery. Each execution reuses the immutable descriptor and
 * cannot fail or require services.
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
 * @see {@link polyEvalValidated} — boundary-validated variant
 * @see {@link polyEvalWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const polyEval: (coefficients: Chunk.Chunk<number>, x: number) => number = Polynomial.polyEval

/**
 * Computes the formal derivative of polynomial coefficients.
 * `[a0, a1, a2, a3]` → `[a1, 2·a2, 3·a3]`. Constant polynomial → `[0]`.
 *
 * @see {@link polyDerivativeValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const polyDerivative: (coefficients: Chunk.Chunk<number>) => Chunk.Chunk<number> = Polynomial.polyDerivative

/**
 * Greatest non-negative common divisor of integer-valued inputs.
 * `gcd(0, b) = |b|` and `gcd(a, 0) = |a|`. The pure function does not
 * validate integrality or finiteness.
 *
 * @see {@link gcdValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const gcd: (a: number, b: number) => number = Integer.gcd

/**
 * Non-negative least common multiple of integer-valued inputs.
 * `lcm(0, x) = 0`. The pure function does not validate integrality,
 * finiteness, or safe-integer overflow.
 *
 * @see {@link lcmValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const lcm: (a: number, b: number) => number = Integer.lcm

/**
 * Returns `n!` for a non-negative integer, with `0! = 1`. The pure function
 * does not validate its input and returns `1` for every `n <= 0`; use
 * {@link factorialValidated} at an untrusted boundary.
 *
 * @see {@link factorialValidated} — boundary-validated variant
 * @see {@link factorialWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const factorial: (n: number) => number = Integer.factorial

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated polyEval. Accepts `unknown` input, decodes through
 * `PolyEvalInput` with `onExcessProperty: "error"`, converts
 * coefficients to `Chunk`, and returns the evaluated result.
 *
 * @see {@link polyEval} — pure kernel for pre-validated input
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
 * Boundary-validated polyDerivative. Accepts `unknown` input, decodes
 * through `PolyDerivativeInput`, and returns derivative coefficients.
 *
 * @see {@link polyDerivative} — pure kernel for pre-validated input
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
 * Boundary-validated gcd. Accepts `unknown` input, decodes through
 * `GcdInput`, and returns gcd(a, b).
 *
 * @see {@link gcd} — pure kernel for pre-validated input
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
 * Boundary-validated lcm. Accepts `unknown` input, decodes through
 * `LcmInput`, and returns lcm(a, b).
 *
 * @see {@link lcm} — pure kernel for pre-validated input
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
 * Boundary-validated factorial. Accepts `unknown` input, decodes through
 * `FactorialInput`, and returns n!.
 *
 * @see {@link factorial} — pure kernel for pre-validated input
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
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `AlgebraDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
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
 * const program = Algebra.polyEvalWithPolicies(
 *   Chunk.fromIterable([1, -2, 1]), 3
 * ).pipe(Effect.provide(layer))
 * ```
 *
 * @see {@link polyEval} — pure kernel without policy seams
 * @see {@link polyEvalValidated} — boundary-validated variant
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
 * Policy-aware polyDerivative reading two services from context:
 *
 * @remarks
 * - **`PrecisionPolicyService`** — `"strict"` rejects results containing
 *   non-finite coefficients with `AlgebraDomainViolationError`; `"relaxed"`
 *   passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link polyDerivative} — pure kernel without policy seams
 * @see {@link polyDerivativeValidated} — boundary-validated variant
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
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `AlgebraDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link factorial} — pure kernel without policy seams
 * @see {@link factorialValidated} — boundary-validated variant
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
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `AlgebraDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link gcd} — pure kernel without policy seams
 * @see {@link gcdValidated} — boundary-validated variant
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
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `AlgebraDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link lcm} — pure kernel without policy seams
 * @see {@link lcmValidated} — boundary-validated variant
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
