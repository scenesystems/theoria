/**
 * Special-functions operation surface — pure kernel re-exports,
 * Schema-validated boundary variants, and policy-aware operations
 * reading `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Clock, Effect, Match, Number as N, Schema } from "effect"

import { DiagnosticsPolicyService, PrecisionPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { SpecialDecodeError, SpecialDomainViolationError } from "./errors.js"
import * as Beta from "./internal/beta.js"
import * as Digamma from "./internal/digamma.js"
import * as Erf from "./internal/erf.js"
import * as Gamma from "./internal/gamma.js"
import { SpecialDomainModel } from "./model.js"
import { BetaInput, DigammaInput, ErfInput, GammaInput, LnGammaInput } from "./schema.js"

/**
 * Lifts the static `SpecialDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadSpecialDomain = Effect.succeed(SpecialDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Gamma function Γ(x) via Lanczos approximation with g = 7 and 9
 * coefficients. Uses the reflection formula Γ(x)·Γ(1−x) = π/sin(πx)
 * for x < 0.5. Returns `Infinity` at non-positive integer poles and
 * `NaN` for inputs where sin(πx) = 0.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
 *
 * Special.gamma(5)   // 24 (= 4!)
 * Special.gamma(0.5) // √π ≈ 1.7725
 * ```
 *
 * @see {@link lnGamma} — log-space variant for large arguments
 * @see {@link gammaValidated} — boundary-validated variant
 * @see {@link gammaWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const gamma: (x: number) => number = Gamma.gammaLanczos

/**
 * Natural logarithm of the gamma function ln(Γ(x)) via Lanczos
 * approximation. Avoids the overflow that Γ(x) produces for large x.
 * Requires x > 0.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
 *
 * Special.lnGamma(1)   // 0  (= ln(1))
 * Special.lnGamma(100) // ≈ 359.13
 * ```
 *
 * @see {@link gamma} — direct Γ(x) for moderate arguments
 * @see {@link lnGammaValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const lnGamma: (x: number) => number = Gamma.lnGammaLanczos

/**
 * Beta function B(a, b) = Γ(a)Γ(b)/Γ(a+b) computed in log-space to
 * avoid overflow. Requires a > 0 and b > 0.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
 *
 * Special.beta(1, 1)     // 1
 * Special.beta(0.5, 0.5) // π ≈ 3.14159
 * ```
 *
 * @see {@link gamma} — underlying gamma function
 * @see {@link betaValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const beta: (a: number, b: number) => number = Beta.betaFromGamma

/**
 * Error function erf(x) via the Abramowitz & Stegun 7.1.26 rational
 * polynomial approximation. Odd function: erf(−x) = −erf(x).
 * Saturates to ±1 for |x| > ~3.5.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
 *
 * Special.erf(0) // 0
 * Special.erf(1) // ≈ 0.8427
 * ```
 *
 * @see {@link erfc} — complementary form 1 − erf(x)
 * @see {@link erfValidated} — boundary-validated variant
 * @see {@link erfWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const erf: (x: number) => number = Erf.erfAbramowitzStegun

/**
 * Complementary error function erfc(x) = 1 − erf(x).
 *
 * @see {@link erf} — the primary error function
 * @see {@link erfcValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const erfc: (x: number) => number = Erf.erfcAbramowitzStegun

/**
 * Digamma (psi) function ψ(x) = d/dx ln(Γ(x)). Uses asymptotic
 * expansion for x ≥ 7 with recurrence shifting for smaller x.
 * Requires x > 0.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
 *
 * Special.digamma(1) // −γ ≈ −0.5772 (Euler–Mascheroni constant)
 * Special.digamma(2) // 1 − γ ≈ 0.4228
 * ```
 *
 * @see {@link digammaValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const digamma: (x: number) => number = Digamma.digammaKernel

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated gamma. Accepts `unknown` input, decodes through
 * `GammaInput` with `onExcessProperty: "error"`, and returns Γ(x).
 *
 * @see {@link gamma} — pure kernel for pre-validated `number` input
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
 * Boundary-validated log-gamma. Accepts `unknown` input, decodes through
 * `LnGammaInput`, and returns ln(Γ(x)).
 *
 * @see {@link lnGamma} — pure kernel for pre-validated input
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
 * Boundary-validated beta. Accepts `unknown` input, decodes through
 * `BetaInput`, and returns B(a, b).
 *
 * @see {@link beta} — pure kernel for pre-validated input
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
 * Boundary-validated erf. Accepts `unknown` input, decodes through
 * `ErfInput`, and returns erf(x).
 *
 * @see {@link erf} — pure kernel for pre-validated input
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
 * Boundary-validated erfc. Accepts `unknown` input, decodes through
 * `ErfInput`, and returns erfc(x).
 *
 * @see {@link erfc} — pure kernel for pre-validated input
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
 * Boundary-validated digamma. Accepts `unknown` input, decodes through
 * `DigammaInput`, and returns ψ(x).
 *
 * @see {@link digamma} — pure kernel for pre-validated input
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
 * Policy-aware gamma reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `SpecialDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Special } from "effect-math"
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
 * const program = Special.gammaWithPolicies(5).pipe(Effect.provide(layer))
 * ```
 *
 * @see {@link gamma} — pure kernel without policy seams
 * @see {@link gammaValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const gammaWithPolicies = (x: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Gamma.gammaLanczos(x)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new SpecialDomainViolationError({
              operation: "gammaWithPolicies",
              message: `Non-finite gamma result: Γ(${x}) = ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Special.gammaWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              input: String(x),
              result: String(result),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Policy-aware erf reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `SpecialDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link erf} — pure kernel without policy seams
 * @see {@link erfValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const erfWithPolicies = (x: number) =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = Erf.erfAbramowitzStegun(x)

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new SpecialDomainViolationError({
              operation: "erfWithPolicies",
              message: `Non-finite erf result: erf(${x}) = ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("Special.erfWithPolicies").pipe(
            Effect.annotateLogs({
              precision: precision.policy,
              input: String(x),
              result: String(result),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
