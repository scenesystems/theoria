/**
 * Schemas, errors, and operations for gamma, beta, error, and related functions.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Effect, Schema } from "effect"

import * as PolicyGuard from "./internal/policyGuard.js"
import * as Beta from "./internal/special/beta.js"
import * as Betainc from "./internal/special/betainc.js"
import * as Digamma from "./internal/special/digamma.js"
import * as Erf from "./internal/special/erf.js"
import * as Erfinv from "./internal/special/erfinv.js"
import * as Gamma from "./internal/special/gamma.js"
import * as Gammainc from "./internal/special/gammainc.js"
import * as Polygamma from "./internal/special/polygamma.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const finite = Schema.Number.pipe(Schema.finite())
const positive = finite.pipe(Schema.greaterThan(0))

/** Finite gamma argument.
 * @since 0.1.0
 * @category schemas
 */
export const GammaInput = Schema.Struct({ x: finite }).annotations({
  identifier: "@scenesystems/effect-math/Special/GammaInput"
})

/** Positive finite log-gamma argument.
 * @since 0.1.0
 * @category schemas
 */
export const LnGammaInput = Schema.Struct({ x: positive }).annotations({
  identifier: "@scenesystems/effect-math/Special/LnGammaInput"
})

/** Positive finite beta arguments.
 * @since 0.1.0
 * @category schemas
 */
export const BetaInput = Schema.Struct({ a: positive, b: positive }).annotations({
  identifier: "@scenesystems/effect-math/Special/BetaInput"
})

/** Finite error-function argument.
 * @since 0.1.0
 * @category schemas
 */
export const ErfInput = Schema.Struct({ x: finite }).annotations({
  identifier: "@scenesystems/effect-math/Special/ErfInput"
})

/** Positive finite digamma argument.
 * @since 0.1.0
 * @category schemas
 */
export const DigammaInput = Schema.Struct({ x: positive }).annotations({
  identifier: "@scenesystems/effect-math/Special/DigammaInput"
})

/** Finite inverse-error argument strictly between `-1` and `1`.
 * @since 0.1.0
 * @category schemas
 */
export const ErfinvInput = Schema.Struct({
  x: finite.pipe(Schema.greaterThan(-1), Schema.lessThan(1))
}).annotations({ identifier: "@scenesystems/effect-math/Special/ErfinvInput" })

/** Positive shape and non-negative incomplete-gamma argument.
 * @since 0.1.0
 * @category schemas
 */
export const GammaincInput = Schema.Struct({
  a: positive,
  x: finite.pipe(Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "@scenesystems/effect-math/Special/GammaincInput" })

/** Positive shapes and unit-interval incomplete-beta argument.
 * @since 0.1.0
 * @category schemas
 */
export const BetaincInput = Schema.Struct({
  a: positive,
  b: positive,
  x: finite.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1))
}).annotations({ identifier: "@scenesystems/effect-math/Special/BetaincInput" })

/** Non-negative order and positive argument for polygamma.
 * @since 0.1.0
 * @category schemas
 */
export const PolygammaInput = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  x: positive
}).annotations({ identifier: "@scenesystems/effect-math/Special/PolygammaInput" })

/**
 * Decoded gamma input.
 * @since 0.1.0
 * @category models
 */
export type GammaInput = typeof GammaInput.Type
/**
 * Decoded log-gamma input.
 * @since 0.1.0
 * @category models
 */
export type LnGammaInput = typeof LnGammaInput.Type
/**
 * Decoded beta input.
 * @since 0.1.0
 * @category models
 */
export type BetaInput = typeof BetaInput.Type
/**
 * Decoded error-function input.
 * @since 0.1.0
 * @category models
 */
export type ErfInput = typeof ErfInput.Type
/**
 * Decoded digamma input.
 * @since 0.1.0
 * @category models
 */
export type DigammaInput = typeof DigammaInput.Type
/**
 * Decoded inverse-error input.
 * @since 0.1.0
 * @category models
 */
export type ErfinvInput = typeof ErfinvInput.Type
/**
 * Decoded incomplete-gamma input.
 * @since 0.1.0
 * @category models
 */
export type GammaincInput = typeof GammaincInput.Type
/**
 * Decoded incomplete-beta input.
 * @since 0.1.0
 * @category models
 */
export type BetaincInput = typeof BetaincInput.Type
/**
 * Decoded polygamma input.
 * @since 0.1.0
 * @category models
 */
export type PolygammaInput = typeof PolygammaInput.Type

/** Malformed validated-operation input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError
  extends Schema.TaggedError<DecodeError>("@scenesystems/effect-math/Special/DecodeError")("SpecialDecodeError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/** Non-finite result rejected by strict precision.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>("@scenesystems/effect-math/Special/DomainViolationError")(
    "SpecialDomainViolationError",
    {
      operation: Schema.String,
      message: Schema.String
    }
  )
{}

/** Parameters outside a special function's mathematical domain.
 * @since 0.1.0
 * @category errors
 */
export class ParameterError
  extends Schema.TaggedError<ParameterError>("@scenesystems/effect-math/Special/ParameterError")(
    "SpecialParameterError",
    {
      operation: Schema.String,
      message: Schema.String
    }
  )
{}

/** Recoverable Special operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError | ParameterError

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
export const erf: (x: number) => number = Erf.erfCephes

/**
 * Computes the complementary error function directly in the positive tail,
 * avoiding cancellation from `1 - erf(x)` for large `x`.
 * @since 0.1.0
 * @category operations
 */
export const erfc: (x: number) => number = Erf.erfcCephes

/**
 * Approximates the logarithmic derivative of gamma. Inputs below `7` are
 * shifted by recurrence before evaluating an asymptotic expansion. The
 * formula assumes `x > 0`; this pure operation does not validate it.
 * @since 0.1.0
 * @category operations
 */
export const digamma: (x: number) => number = Digamma.digamma

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Decodes one finite scalar and approximates gamma. Malformed or excess input
 * fails with `DecodeError`; non-positive integer poles remain subject
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
        new DecodeError({
          operation: "gamma",
          message: error.message
        })
      )
    )
    return Gamma.gammaLanczos(decoded.x)
  })

/**
 * Decodes a positive finite scalar and approximates log-gamma. Malformed or
 * excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const lnGammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(LnGammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "lnGamma",
          message: error.message
        })
      )
    )
    return Gamma.lnGammaLanczos(decoded.x)
  })

/**
 * Decodes two positive finite arguments and computes beta in log space.
 * Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const betaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "beta",
          message: error.message
        })
      )
    )
    return Beta.betaFromGamma(decoded.a, decoded.b)
  })

/**
 * Decodes one finite scalar and approximates the error function. Malformed or
 * excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "erf",
          message: error.message
        })
      )
    )
    return Erf.erfCephes(decoded.x)
  })

/**
 * Decodes one finite scalar and computes the complementary error function.
 * Malformed or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfcValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "erfc",
          message: error.message
        })
      )
    )
    return Erf.erfcCephes(decoded.x)
  })

/**
 * Decodes a positive finite scalar and approximates digamma. Malformed or
 * excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const digammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DigammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "digamma",
          message: error.message
        })
      )
    )
    return Digamma.digamma(decoded.x)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Approximates gamma under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`. It does not identify finite pole artifacts.
 * Enabled diagnostics emits one debug log with the input, result, precision
 * policy, and elapsed milliseconds.
 *
 * @example
 * ```ts
 * import { Special } from "@scenesystems/effect-math"
 * import { Boolean, Effect, Layer, Number } from "effect"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = Special.gammaWithPolicies(5).pipe(
 *   Effect.provide(layer),
 *   Effect.filterOrFail(
 *     (result) => Boolean.and(Number.greaterThan(result, 23.999), Number.lessThan(result, 24.001)),
 *     () => "UnexpectedGammaResult"
 *   )
 * )
 * ```
 * @since 0.1.0
 * @category operations
 */
export const gammaWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.gammaWithPolicies",
    compute: () => Gamma.gammaLanczos(x),
    makeError: (message) => new DomainViolationError({ operation: "gammaWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
  })

/**
 * Approximates the error function under the configured finite-result and
 * diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`. Enabled diagnostics emits one debug log with
 * the input, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const erfWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.erfWithPolicies",
    compute: () => Erf.erfCephes(x),
    makeError: (message) => new DomainViolationError({ operation: "erfWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
  })

/**
 * Approximates log-gamma under the configured finite-result and diagnostics
 * policies, without first computing gamma.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`. The policy does not validate `x > 0` when an
 * invalid input happens to produce a finite value. Enabled diagnostics emits
 * one debug log with the input, result, precision policy, and elapsed
 * milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const lnGammaWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.lnGammaWithPolicies",
    compute: () => Gamma.lnGammaLanczos(x),
    makeError: (message) => new DomainViolationError({ operation: "lnGammaWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
  })

/**
 * Computes beta in log space under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`; it does not independently validate positive
 * arguments. Enabled diagnostics emits one debug log with both arguments,
 * the result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const betaWithPolicies = (a: number, b: number) =>
  PolicyGuard.scalar({
    operation: "Special.betaWithPolicies",
    compute: () => Beta.betaFromGamma(a, b),
    makeError: (message) => new DomainViolationError({ operation: "betaWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
      result: encodeNumber(result)
    })
  })

/**
 * Computes the complementary error function under the configured
 * finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`. Enabled diagnostics emits one debug log with
 * the input, result, precision policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const erfcWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.erfcWithPolicies",
    compute: () => Erf.erfcCephes(x),
    makeError: (message) => new DomainViolationError({ operation: "erfcWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
  })

/**
 * Approximates digamma under the configured finite-result and diagnostics policies.
 *
 * @remarks
 * Strict precision rejects a non-finite result with
 * `DomainViolationError`; it does not independently validate `x > 0`.
 * Enabled diagnostics emits one debug log with the input, result, precision
 * policy, and elapsed milliseconds.
 * @since 0.1.0
 * @category operations
 */
export const digammaWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.digammaWithPolicies",
    compute: () => Digamma.digamma(x),
    makeError: (message) => new DomainViolationError({ operation: "digammaWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
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
export const erfinv: (x: number) => number = Erfinv.erfinv

/**
 * Computes inverse complementary error while retaining tiny tail arguments.
 * It returns infinities at `x = 0` and `x = 2`, and `NaN` outside `[0, 2]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const erfcinv: (x: number) => number = Erfinv.erfcinv

/**
 * Approximates the regularized lower incomplete gamma ratio `P(a, x)`. The
 * formula assumes `a > 0` and `x >= 0`; this pure operation does not validate
 * them.
 * @since 0.1.0
 * @category operations
 */
export const gammainc: (a: number, x: number) => number = Gammainc.gammainc

/**
 * Approximates the regularized upper incomplete gamma ratio `Q(a, x)`. The
 * formula assumes `a > 0` and `x >= 0`; this pure operation does not validate
 * them.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaincc: (a: number, x: number) => number = Gammainc.gammaincc

/**
 * Approximates the regularized incomplete beta ratio `I_x(a, b)`. The formula
 * assumes positive shape arguments and `x` in `[0, 1]`; this pure operation
 * does not validate them.
 * @since 0.1.0
 * @category operations
 */
export const betainc: (a: number, b: number, x: number) => number = Betainc.betainc

/**
 * Approximates the `n`th derivative of digamma by recurrence and asymptotic
 * expansion. The formula assumes a non-negative integer `n` and `x > 0`;
 * invalid `n` can cause a synchronous bounds defect.
 * @since 0.1.0
 * @category operations
 */
export const polygamma: (n: number, x: number) => number = Polygamma.polygamma

// ---------------------------------------------------------------------------
// Inverse and incomplete validated operations
// ---------------------------------------------------------------------------

/**
 * Decodes a finite scalar strictly between `-1` and `1`, then computes inverse
 * error. Malformed, endpoint, or excess input fails with `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const erfinvValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ErfinvInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "erfinv",
          message: error.message
        })
      )
    )
    return Erfinv.erfinv(decoded.x)
  })

/**
 * Decodes `a > 0` and `x >= 0`, then approximates the regularized lower
 * incomplete gamma ratio. Malformed or excess input fails with
 * `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const gammaincValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GammaincInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "gammainc",
          message: error.message
        })
      )
    )
    return Gammainc.gammainc(decoded.a, decoded.x)
  })

/**
 * Decodes positive shape arguments and `x` in `[0, 1]`, then approximates the
 * regularized incomplete beta ratio. Malformed or excess input fails with
 * `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const betaincValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaincInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "betainc",
          message: error.message
        })
      )
    )
    return Betainc.betainc(decoded.a, decoded.b, decoded.x)
  })

/**
 * Decodes a non-negative integer order and positive finite `x`, then
 * approximates polygamma. Malformed or excess input fails with
 * `DecodeError`.
 * @since 0.1.0
 * @category validated operations
 */
export const polygammaValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(PolygammaInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DecodeError({
          operation: "polygamma",
          message: error.message
        })
      )
    )
    return Polygamma.polygamma(decoded.n, decoded.x)
  })

// ---------------------------------------------------------------------------
// Inverse and incomplete policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Computes inverse error under the configured finite-result and diagnostics
 * policies. Strict precision rejects endpoint infinities and out-of-range
 * `NaN` results with `DomainViolationError`; enabled diagnostics emits
 * one annotated debug log.
 * @since 0.1.0
 * @category operations
 */
export const erfinvWithPolicies = (x: number) =>
  PolicyGuard.scalar({
    operation: "Special.erfinvWithPolicies",
    compute: () => Erfinv.erfinv(x),
    makeError: (message) => new DomainViolationError({ operation: "erfinvWithPolicies", message }),
    annotations: (result) => ({ input: encodeNumber(x), result: encodeNumber(result) })
  })

/**
 * Approximates the regularized lower incomplete gamma ratio under the
 * configured finite-result and diagnostics policies. Strict precision rejects
 * a non-finite result with `DomainViolationError`; it does not validate
 * parameter ranges. Enabled diagnostics emits one annotated debug log.
 * @since 0.1.0
 * @category operations
 */
export const gammaincWithPolicies = (a: number, x: number) =>
  PolicyGuard.scalar({
    operation: "Special.gammaincWithPolicies",
    compute: () => Gammainc.gammainc(a, x),
    makeError: (message) => new DomainViolationError({ operation: "gammaincWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make("a=", encodeNumber(a), ", x=", encodeNumber(x)), ""),
      result: encodeNumber(result)
    })
  })
