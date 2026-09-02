/**
 * Evaluates gamma, beta, error, and related special functions from decoded,
 * untrusted, or policy-governed inputs.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { SpecialDecodeError, SpecialDomainViolationError } from "./errors.js"
import * as Beta from "./internal/beta.js"
import * as Betainc from "./internal/betainc.js"
import * as Digamma from "./internal/digamma.js"
import * as Erf from "./internal/erf.js"
import * as Erfinv from "./internal/erfinv.js"
import * as Gamma from "./internal/gamma.js"
import * as Gammainc from "./internal/gammainc.js"
import * as Polygamma from "./internal/polygamma.js"
import { SpecialDomainModel } from "./model.js"
import {
  BetaincInput,
  BetaInput,
  DigammaInput,
  ErfInput,
  ErfinvInput,
  GammaincInput,
  GammaInput,
  LnGammaInput,
  PolygammaInput
} from "./schema.js"

/**
 * Yields the immutable descriptor used to register Special capabilities.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadSpecialDomain = Effect.succeed(SpecialDomainModel)

// ---------------------------------------------------------------------------
// Pure operations
// ---------------------------------------------------------------------------

/**
 * Approximates the gamma function using a nine-coefficient Lanczos formula
 * and reflection below `0.5`. The implementation does not validate poles;
 * floating-point evaluation at non-positive integers may return an infinity
 * or a large finite artifact.
 * @since 0.1.0
 * @category operations
 */
export const gamma: (x: number) => number = Gamma.gammaLanczos

/**
 * Approximates the natural logarithm of gamma without first computing gamma,
 * avoiding gamma's earlier overflow for large positive arguments. The formula
 * assumes `x > 0`; this pure operation does not validate it.
 * @since 0.1.0
 * @category operations
 */
export const lnGamma: (x: number) => number = Gamma.lnGammaLanczos

/**
 * Computes beta as `exp(lnGamma(a) + lnGamma(b) - lnGamma(a + b))` to
 * avoid intermediate gamma overflow. The formula assumes positive arguments;
 * this pure operation does not validate them.
 * @since 0.1.0
 * @category operations
 */
export const beta: (a: number, b: number) => number = Beta.betaFromGamma

/**
 * Approximates the error function with Cephes rational polynomials over
 * multiple input regions. It preserves odd symmetry and maps positive and
 * negative infinity to `1` and `-1` respectively.
 * @since 0.1.0
 * @category operations
 */
export const erf: (x: number) => number = Erf.erfAbramowitzStegun

/**
 * Computes the complementary error function directly in the positive tail,
 * avoiding cancellation from `1 - erf(x)` for large `x`.
 * @since 0.1.0
 * @category operations
 */
export const erfc: (x: number) => number = Erf.erfcAbramowitzStegun

/**
 * Approximates the logarithmic derivative of gamma. Inputs below `7` are
 * shifted by recurrence before evaluating an asymptotic expansion. The
 * formula assumes `x > 0`; this pure operation does not validate it.
 * @since 0.1.0
 * @category operations
 */
export const digamma: (x: number) => number = Digamma.digammaKernel

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Decodes one finite scalar and approximates gamma. Malformed or excess input
 * fails with `SpecialDecodeError`; non-positive integer poles remain subject
 * to the pure operation's floating-point behavior.
 * @since 0.1.0
 * @category validated operations
 */
export const gammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "gamma",
          message: error.message
        })
      )
    )
    return Gamma.gammaLanczos(decoded.x)
  })

/**
 * Decodes a positive finite scalar and approximates log-gamma. Malformed or
 * excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const lnGammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LnGammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "lnGamma",
          message: error.message
        })
      )
    )
    return Gamma.lnGammaLanczos(decoded.x)
  })

/**
 * Decodes two positive finite arguments and computes beta in log space.
 * Malformed or excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const betaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "beta",
          message: error.message
        })
      )
    )
    return Beta.betaFromGamma(decoded.a, decoded.b)
  })

/**
 * Decodes one finite scalar and approximates the error function. Malformed or
 * excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "erf",
          message: error.message
        })
      )
    )
    return Erf.erfAbramowitzStegun(decoded.x)
  })

/**
 * Decodes one finite scalar and computes the complementary error function.
 * Malformed or excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfcValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "erfc",
          message: error.message
        })
      )
    )
    return Erf.erfcAbramowitzStegun(decoded.x)
  })

/**
 * Decodes a positive finite scalar and approximates digamma. Malformed or
 * excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const digammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DigammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "digamma",
          message: error.message
        })
      )
    )
    return Digamma.digammaKernel(decoded.x)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Approximates gamma under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`. It does not identify finite pole artifacts.
 * Enabled diagnostics emits one debug log with the input, result, precision
 * policy, and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Special } from "@scenesystems/effect-math"
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
 * export const program = Special.gammaWithPolicies(5).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => result > 23.999 && result < 24.001,
 *     () => "UnexpectedGammaResult"
 *   )
 * )
 * ```
 * @since 0.1.0
 * @category operations
 */
export const gammaWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.gammaWithPolicies",
    compute: () => Gamma.gammaLanczos(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "gammaWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

/**
 * Approximates the error function under the configured finite-result and
 * diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`. Enabled diagnostics emits one debug log with
 * the input, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const erfWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.erfWithPolicies",
    compute: () => Erf.erfAbramowitzStegun(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "erfWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

/**
 * Approximates log-gamma under the configured finite-result and diagnostics
 * policies, without first computing gamma.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`. The policy does not validate `x > 0` when an
 * invalid input happens to produce a finite value. Enabled diagnostics emits
 * one debug log with the input, result, precision policy, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const lnGammaWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.lnGammaWithPolicies",
    compute: () => Gamma.lnGammaLanczos(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "lnGammaWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

/**
 * Computes beta in log space under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`; it does not independently validate positive
 * arguments. Enabled diagnostics emits one debug log with both arguments,
 * the result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const betaWithPolicies = (a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Special.betaWithPolicies",
    compute: () => Beta.betaFromGamma(a, b),
    makeError: (message) => new SpecialDomainViolationError({ operation: "betaWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })

/**
 * Computes the complementary error function under the configured
 * finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`. Enabled diagnostics emits one debug log with
 * the input, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const erfcWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.erfcWithPolicies",
    compute: () => Erf.erfcAbramowitzStegun(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "erfcWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

/**
 * Approximates digamma under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `SpecialDomainViolationError`; it does not independently validate `x > 0`.
 * Enabled diagnostics emits one debug log with the input, result, precision
 * policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const digammaWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.digammaWithPolicies",
    compute: () => Digamma.digammaKernel(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "digammaWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

// ---------------------------------------------------------------------------
// Inverse and incomplete pure operations
// ---------------------------------------------------------------------------

/**
 * Computes `y` such that `erf(y) = x` using piecewise rational
 * approximations. It returns signed infinity at `x = -1` or `x = 1`, and
 * `NaN` outside the closed interval.
 * @since 0.1.0
 * @category operations
 */
export const erfinv: (x: number) => number = Erfinv.erfinvKernel

/**
 * Computes inverse complementary error as `erfinv(1 - x)`. It returns
 * infinities at `x = 0` and `x = 2`, and `NaN` outside `[0, 2]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const erfcinv: (x: number) => number = Erfinv.erfcinvKernel

/**
 * Approximates the regularized lower incomplete gamma ratio `P(a, x)`. The
 * formula assumes `a > 0` and `x >= 0`; this pure operation does not validate
 * them.
 * @since 0.1.0
 * @category operations
 */
export const gammainc: (a: number, x: number) => number = Gammainc.gammaincKernel

/**
 * Approximates the regularized upper incomplete gamma ratio `Q(a, x)`. The
 * formula assumes `a > 0` and `x >= 0`; this pure operation does not validate
 * them.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaincc: (a: number, x: number) => number = Gammainc.gammainccKernel

/**
 * Approximates the regularized incomplete beta ratio `I_x(a, b)`. The formula
 * assumes positive shape arguments and `x` in `[0, 1]`; this pure operation
 * does not validate them.
 * @since 0.1.0
 * @category operations
 */
export const betainc: (a: number, b: number, x: number) => number = Betainc.betaincKernel

/**
 * Approximates the `n`th derivative of digamma by recurrence and asymptotic
 * expansion. The formula assumes a non-negative integer `n` and `x > 0`;
 * invalid `n` can cause a synchronous bounds defect.
 * @since 0.1.0
 * @category operations
 */
export const polygamma: (n: number, x: number) => number = Polygamma.polygammaKernel

// ---------------------------------------------------------------------------
// Inverse and incomplete validated operations
// ---------------------------------------------------------------------------

/**
 * Decodes a finite scalar strictly between `-1` and `1`, then computes inverse
 * error. Malformed, endpoint, or excess input fails with `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfinvValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfinvInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "erfinv",
          message: error.message
        })
      )
    )
    return Erfinv.erfinvKernel(decoded.x)
  })

/**
 * Decodes `a > 0` and `x >= 0`, then approximates the regularized lower
 * incomplete gamma ratio. Malformed or excess input fails with
 * `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const gammaincValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GammaincInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "gammainc",
          message: error.message
        })
      )
    )
    return Gammainc.gammaincKernel(decoded.a, decoded.x)
  })

/**
 * Decodes positive shape arguments and `x` in `[0, 1]`, then approximates the
 * regularized incomplete beta ratio. Malformed or excess input fails with
 * `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const betaincValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaincInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "betainc",
          message: error.message
        })
      )
    )
    return Betainc.betaincKernel(decoded.a, decoded.b, decoded.x)
  })

/**
 * Decodes a non-negative integer order and positive finite `x`, then
 * approximates polygamma. Malformed or excess input fails with
 * `SpecialDecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polygammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolygammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new SpecialDecodeError({
          operation: "polygamma",
          message: error.message
        })
      )
    )
    return Polygamma.polygammaKernel(decoded.n, decoded.x)
  })

// ---------------------------------------------------------------------------
// Inverse and incomplete policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes inverse error under the configured finite-result and diagnostics
 * policies. Strict precision rejects endpoint infinities and out-of-range
 * `NaN` results with `SpecialDomainViolationError`; enabled diagnostics emits
 * one annotated debug log.
 * @since 0.1.0
 * @category operations
 */
export const erfinvWithPolicies = (x: number) =>
  withScalarPolicyGuards({
    operation: "Special.erfinvWithPolicies",
    compute: () => Erfinv.erfinvKernel(x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "erfinvWithPolicies", message }),
    annotations: (result) => ({ input: String(x), result: String(result) })
  })

/**
 * Approximates the regularized lower incomplete gamma ratio under the
 * configured finite-result and diagnostics policies. Strict precision rejects
 * a non-finite result with `SpecialDomainViolationError`; it does not validate
 * parameter ranges. Enabled diagnostics emits one annotated debug log.
 * @since 0.1.0
 * @category operations
 */
export const gammaincWithPolicies = (a: number, x: number) =>
  withScalarPolicyGuards({
    operation: "Special.gammaincWithPolicies",
    compute: () => Gammainc.gammaincKernel(a, x),
    makeError: (message) => new SpecialDomainViolationError({ operation: "gammaincWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, x=${x}`, result: String(result) })
  })
