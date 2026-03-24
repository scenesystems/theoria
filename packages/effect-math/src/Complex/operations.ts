/**
 * Complex-number operation surface — pure kernel functions wrapping
 * raw `(re, im)` arithmetic as `Complex → Complex` operations,
 * Schema-validated boundary variants accepting `unknown` input,
 * and policy-aware variants reading `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from context.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Number as N, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { ComplexDecodeError, ComplexDomainViolationError } from "./errors.js"
import * as Arith from "./internal/arithmetic.js"
import * as Polar from "./internal/polar.js"
import * as Trig from "./internal/trigonometric.js"
import { Complex, ComplexDomainModel } from "./model.js"
import { ComplexBinaryInput, ComplexInput, ComplexStepInput } from "./schema.js"

// ---------------------------------------------------------------------------
// Domain loader
// ---------------------------------------------------------------------------

/**
 * Lifts the static `ComplexDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadComplexDomain = Effect.succeed(ComplexDomainModel)

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Constructs a `Complex` from explicit real and imaginary parts.
 * Prefer this over `new Complex(...)` in application code for
 * consistency across the operation surface.
 *
 * @example
 * ```ts
 * import { of } from "effect-math/Complex"
 *
 * const z = of(3, 4)
 * z.re  // 3
 * z.im  // 4
 * ```
 *
 * @see {@link fromReal} — shorthand when im = 0
 * @see {@link fromImaginary} — shorthand when re = 0
 * @see {@link fromPolar} — construct from (r, θ)
 *
 * @since 0.1.0
 * @category constructors
 */
export const of = (re: number, im: number): Complex => new Complex({ re, im })

/**
 * Constructs a purely real `Complex` (imaginary part = 0). Useful
 * when lifting real scalars into complex arithmetic pipelines.
 *
 * @see {@link of} — full (re, im) constructor
 * @see {@link fromRealChunk} — vectorised variant for `Chunk<number>`
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromReal = (re: number): Complex => new Complex({ re, im: 0 })

/**
 * Constructs a purely imaginary `Complex` (real part = 0).
 *
 * @see {@link of} — full (re, im) constructor
 * @see {@link i} — the unit imaginary constant
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromImaginary = (im: number): Complex => new Complex({ re: 0, im })

/**
 * Additive identity 0 + 0i. Neutral element for {@link add}.
 *
 * @since 0.1.0
 * @category constants
 */
export const zero: Complex = new Complex({ re: 0, im: 0 })

/**
 * Multiplicative identity 1 + 0i. Neutral element for {@link multiply}.
 *
 * @since 0.1.0
 * @category constants
 */
export const one: Complex = new Complex({ re: 1, im: 0 })

/**
 * Imaginary unit 0 + 1i. Satisfies i² = −1.
 *
 * @see {@link fromImaginary} — scale the imaginary axis
 *
 * @since 0.1.0
 * @category constants
 */
export const i: Complex = new Complex({ re: 0, im: 1 })

// ---------------------------------------------------------------------------
// Pure kernel operations — arithmetic
// ---------------------------------------------------------------------------

/**
 * Complex addition: (a + bi) + (c + di).
 *
 * @example
 * ```ts
 * import { add, of } from "effect-math/Complex"
 *
 * const z = add(of(1, 2), of(3, 4))
 * // z = 4 + 6i
 * ```
 *
 * @see {@link subtract} — inverse operation
 * @see {@link addValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const add = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.add(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Complex subtraction: (a + bi) − (c + di).
 *
 * @see {@link add} — inverse operation
 * @see {@link subtractValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const subtract = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.subtract(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Complex multiplication using the standard (ac − bd) + (ad + bc)i
 * formula.
 *
 * @see {@link divide} — inverse operation
 * @see {@link multiplyValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const multiply = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.multiply(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Complex division using the Smith method for overflow safety.
 * Returns `NaN` parts when dividing by zero — use
 * {@link divideValidated} for explicit error handling at boundaries.
 *
 * @see {@link multiply} — inverse operation
 * @see {@link divideValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const divide = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.divide(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Complex conjugate: reflects across the real axis (negates the
 * imaginary part). Used in inner products and norm computations.
 *
 * @see {@link complexDot} — uses conjugate in the inner product
 *
 * @since 0.1.0
 * @category operations
 */
export const conjugate = (z: Complex): Complex => {
  const [re, im] = Arith.conjugate(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex modulus |z| = √(re² + im²). Uses `Math.hypot` internally
 * for overflow-safe computation.
 *
 * @see {@link arg} — phase angle companion
 * @see {@link toPolar} — returns both modulus and argument
 * @see {@link absWithPolicies} — policy-aware variant
 *
 * @since 0.1.0
 * @category operations
 */
export const abs = (z: Complex): number => Arith.abs(z.re, z.im)

/**
 * Complex argument (phase angle) arg(z) = atan2(im, re) ∈ (−π, π].
 *
 * @see {@link abs} — modulus companion
 * @see {@link toPolar} — returns both modulus and argument
 * @see {@link argWithPolicies} — policy-aware variant
 *
 * @since 0.1.0
 * @category operations
 */
export const arg = (z: Complex): number => Arith.arg(z.re, z.im)

/**
 * Complex exponential exp(a + bi) = eᵃ(cos b + i·sin b). Maps
 * the left half-plane to the unit disk interior.
 *
 * @see {@link log} — inverse operation (principal branch)
 * @see {@link expValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const exp = (z: Complex): Complex => {
  const [re, im] = Arith.exp(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex natural logarithm (principal branch) with argument in
 * (−π, π]. Returns `[-Infinity, 0]` for z = 0.
 *
 * @see {@link exp} — inverse operation
 * @see {@link logValidated} — boundary-validated variant
 *
 * @since 0.1.0
 * @category operations
 */
export const log = (z: Complex): Complex => {
  const [re, im] = Arith.log(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex power z^w = exp(w · log(z)). Returns 1 + 0i for 0^0
 * and 0 + 0i for 0^w (w ≠ 0).
 *
 * @see {@link sqrt} — special case for w = 0.5
 * @see {@link exp} — special case for base = e
 *
 * @since 0.1.0
 * @category operations
 */
export const pow = (base: Complex, exponent: Complex): Complex => {
  const [re, im] = Arith.pow(base.re, base.im, exponent.re, exponent.im)
  return new Complex({ re, im })
}

/**
 * Principal-branch square root. For negative real inputs, returns
 * a purely imaginary result (e.g., sqrt(−4) = 2i).
 *
 * @see {@link pow} — general complex exponentiation
 * @see {@link abs} — modulus used in computation
 *
 * @since 0.1.0
 * @category operations
 */
export const sqrt = (z: Complex): Complex => {
  const [re, im] = Arith.sqrt(z.re, z.im)
  return new Complex({ re, im })
}

// ---------------------------------------------------------------------------
// Pure kernel operations — polar conversion
// ---------------------------------------------------------------------------

/**
 * Converts to polar form (r, θ) where r = |z| and θ = arg(z).
 *
 * @see {@link fromPolar} — inverse conversion
 * @see {@link abs} — modulus only
 * @see {@link arg} — argument only
 *
 * @since 0.1.0
 * @category operations
 */
export const toPolar = (z: Complex): readonly [number, number] => Polar.toPolar(z.re, z.im)

/**
 * Constructs a `Complex` from polar coordinates (r, θ).
 *
 * @see {@link toPolar} — inverse conversion
 * @see {@link of} — rectangular constructor
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromPolar = (r: number, theta: number): Complex => {
  const [re, im] = Polar.fromPolar(r, theta)
  return new Complex({ re, im })
}

// ---------------------------------------------------------------------------
// Pure kernel operations — trigonometric
// ---------------------------------------------------------------------------

/**
 * Complex sine via Euler's formula:
 * sin(a + bi) = sin(a)cosh(b) + i·cos(a)sinh(b).
 *
 * @see {@link cos} — cosine companion
 * @see {@link sinh} — hyperbolic counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const sin = (z: Complex): Complex => {
  const [re, im] = Trig.sin(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex cosine via Euler's formula:
 * cos(a + bi) = cos(a)cosh(b) − i·sin(a)sinh(b).
 *
 * @see {@link sin} — sine companion
 * @see {@link cosh} — hyperbolic counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const cos = (z: Complex): Complex => {
  const [re, im] = Trig.cos(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex tangent: tan(z) = sin(z) / cos(z). Returns `NaN` parts
 * at poles where cos(z) = 0.
 *
 * @see {@link sin} — numerator
 * @see {@link cos} — denominator
 * @see {@link tanh} — hyperbolic counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const tan = (z: Complex): Complex => {
  const [re, im] = Trig.tan(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex hyperbolic sine:
 * sinh(a + bi) = sinh(a)cos(b) + i·cosh(a)sin(b).
 *
 * @see {@link cosh} — hyperbolic cosine companion
 * @see {@link sin} — circular counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const sinh = (z: Complex): Complex => {
  const [re, im] = Trig.sinh(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex hyperbolic cosine:
 * cosh(a + bi) = cosh(a)cos(b) + i·sinh(a)sin(b).
 *
 * @see {@link sinh} — hyperbolic sine companion
 * @see {@link cos} — circular counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const cosh = (z: Complex): Complex => {
  const [re, im] = Trig.cosh(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Complex hyperbolic tangent: tanh(z) = sinh(z) / cosh(z).
 *
 * @see {@link sinh} — numerator
 * @see {@link cosh} — denominator
 * @see {@link tan} — circular counterpart
 *
 * @since 0.1.0
 * @category operations
 */
export const tanh = (z: Complex): Complex => {
  const [re, im] = Trig.tanh(z.re, z.im)
  return new Complex({ re, im })
}

// ---------------------------------------------------------------------------
// Chunk<Complex> carriers
// ---------------------------------------------------------------------------

/**
 * Sesquilinear inner product Σ conj(aᵢ) · bᵢ for complex vectors.
 * Conjugate-linear in the first argument, linear in the second,
 * matching the physics convention.
 *
 * @see {@link complexNorm} — derived norm √(dot(x, x).re)
 * @see {@link conjugate} — conjugation applied per element
 *
 * @since 0.1.0
 * @category operations
 */
export const complexDot = (a: Chunk.Chunk<Complex>, b: Chunk.Chunk<Complex>): Complex => {
  const init: readonly [number, number] = [0, 0]
  const result = Chunk.zipWith(a, b, (ai, bi) => {
    const [cRe, cIm] = Arith.conjugate(ai.re, ai.im)
    return Arith.multiply(cRe, cIm, bi.re, bi.im)
  }).pipe(
    Chunk.reduce(
      init,
      (acc, [re, im]): readonly [number, number] => [N.sum(acc[0], re), N.sum(acc[1], im)]
    )
  )
  return new Complex({ re: result[0], im: result[1] })
}

/**
 * Euclidean norm of a complex vector: √(Σ |zᵢ|²). Returns a
 * non-negative real number.
 *
 * @see {@link complexDot} — inner product from which the norm derives
 * @see {@link abs} — per-element modulus
 *
 * @since 0.1.0
 * @category operations
 */
export const complexNorm = (xs: Chunk.Chunk<Complex>): number => {
  const sumSq = Chunk.reduce(
    xs,
    0,
    (acc, z) => N.sum(acc, N.sum(N.multiply(z.re, z.re), N.multiply(z.im, z.im)))
  )
  return Math.sqrt(sumSq)
}

/**
 * Scales every element of a complex vector by a complex scalar.
 *
 * @see {@link complexDot} — inner product
 * @see {@link multiply} — scalar multiplication
 *
 * @since 0.1.0
 * @category operations
 */
export const complexScale = (xs: Chunk.Chunk<Complex>, scalar: Complex): Chunk.Chunk<Complex> =>
  Chunk.map(xs, (z) => {
    const [re, im] = Arith.multiply(z.re, z.im, scalar.re, scalar.im)
    return new Complex({ re, im })
  })

// ---------------------------------------------------------------------------
// Real ↔ Complex interop
// ---------------------------------------------------------------------------

/**
 * Lifts a real vector into complex space — each real value becomes
 * the real part with imaginary part 0.
 *
 * @see {@link toRealChunk} — inverse projection
 *
 * @since 0.1.0
 * @category operations
 */
export const fromRealChunk = (xs: Chunk.Chunk<number>): Chunk.Chunk<Complex> =>
  Chunk.map(xs, (re) => new Complex({ re, im: 0 }))

/**
 * Extracts the real parts from a complex vector, producing a
 * `Chunk<number>` compatible with `LinearAlgebra.dot`.
 *
 * @see {@link fromRealChunk} — inverse lifting
 * @see {@link toImaginaryChunk} — imaginary-part extraction
 *
 * @since 0.1.0
 * @category operations
 */
export const toRealChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(xs, (z) => z.re)

/**
 * Extracts the imaginary parts from a complex vector.
 *
 * @see {@link toRealChunk} — real-part extraction
 *
 * @since 0.1.0
 * @category operations
 */
export const toImaginaryChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(xs, (z) => z.im)

/**
 * Computes the modulus |z| for each element, producing a
 * `Chunk<number>` of magnitudes.
 *
 * @see {@link abs} — scalar modulus
 * @see {@link toPhaseChunk} — phase-angle extraction
 *
 * @since 0.1.0
 * @category operations
 */
export const toMagnitudeChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> =>
  Chunk.map(xs, (z) => Arith.abs(z.re, z.im))

/**
 * Computes the phase angle arg(z) for each element, producing a
 * `Chunk<number>` of arguments in (−π, π].
 *
 * @see {@link arg} — scalar phase
 * @see {@link toMagnitudeChunk} — magnitude extraction
 *
 * @since 0.1.0
 * @category operations
 */
export const toPhaseChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> =>
  Chunk.map(xs, (z) => Arith.arg(z.re, z.im))

// ---------------------------------------------------------------------------
// Complex-step differentiation
// ---------------------------------------------------------------------------

/**
 * Complex-step derivative (Squire & Trapp, 1998):
 *   f'(x) ≈ Im(f(x + ih)) / h
 *
 * Achieves machine-precision accuracy for analytic functions without
 * the cancellation error of finite differences. The default step size
 * h = 1e-20 is optimal for IEEE 754 float64.
 *
 * The function `f` must accept and return `Complex` values — it should
 * implement the analytic extension of the real function.
 *
 * @example
 * ```ts
 * import { complexDerivative, sin } from "effect-math/Complex"
 *
 * const sinDerivative = complexDerivative(sin, 0)
 * // ≈ 1.0 (cos(0))
 * ```
 *
 * @see {@link complexDerivativeValidated} — boundary-validated variant
 * @see {@link complexDerivativeWithPolicies} — policy-aware variant
 *
 * @since 0.1.0
 * @category operations
 */
export const complexDerivative = (
  f: (z: Complex) => Complex,
  x: number,
  h: number = 1e-20
): number => {
  const z = new Complex({ re: x, im: h })
  const result = f(z)
  return N.unsafeDivide(result.im, h)
}

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated complex addition. Accepts `unknown` input, decodes
 * through `ComplexBinaryInput`, and returns the sum.
 *
 * @see {@link add} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const addValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexBinaryInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "add",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.add(decoded.aRe, decoded.aIm, decoded.bRe, decoded.bIm)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex subtraction.
 *
 * @see {@link subtract} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const subtractValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexBinaryInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "subtract",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.subtract(decoded.aRe, decoded.aIm, decoded.bRe, decoded.bIm)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex multiplication.
 *
 * @see {@link multiply} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const multiplyValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexBinaryInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "multiply",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.multiply(decoded.aRe, decoded.aIm, decoded.bRe, decoded.bIm)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex division.
 *
 * @see {@link divide} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const divideValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexBinaryInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "divide",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.divide(decoded.aRe, decoded.aIm, decoded.bRe, decoded.bIm)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex exponential.
 *
 * @see {@link exp} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const expValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "exp",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.exp(decoded.re, decoded.im)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex logarithm.
 *
 * @see {@link log} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const logValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "log",
          message: error.message
        })
      )
    )
    const [re, im] = Arith.log(decoded.re, decoded.im)
    return new Complex({ re, im })
  })

/**
 * Boundary-validated complex-step derivative.
 *
 * @see {@link complexDerivative} — pure kernel for pre-validated input
 *
 * @since 0.1.0
 * @category validated operations
 */
export const complexDerivativeValidated = (
  f: (z: Complex) => Complex,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexStepInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new ComplexDecodeError({
          operation: "complexDerivative",
          message: error.message
        })
      )
    )
    return complexDerivative(f, decoded.x, decoded.h)
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware complex absolute value reading `PrecisionPolicyService`
 * and `DiagnosticsPolicyService` from context.
 *
 * @see {@link abs} — pure kernel without policy seams
 *
 * @since 0.1.0
 * @category operations
 */
export const absWithPolicies = (z: Complex) =>
  withScalarPolicyGuards({
    operation: "Complex.absWithPolicies",
    compute: () => Arith.abs(z.re, z.im),
    makeError: (message) => new ComplexDomainViolationError({ operation: "absWithPolicies", message }),
    annotations: (result) => ({ input: `${z.re}+${z.im}i`, result: String(result) })
  })

/**
 * Policy-aware complex argument reading `PrecisionPolicyService`
 * and `DiagnosticsPolicyService` from context.
 *
 * @see {@link arg} — pure kernel without policy seams
 *
 * @since 0.1.0
 * @category operations
 */
export const argWithPolicies = (z: Complex) =>
  withScalarPolicyGuards({
    operation: "Complex.argWithPolicies",
    compute: () => Arith.arg(z.re, z.im),
    makeError: (message) => new ComplexDomainViolationError({ operation: "argWithPolicies", message }),
    annotations: (result) => ({ input: `${z.re}+${z.im}i`, result: String(result) })
  })

/**
 * Policy-aware complex-step derivative reading `PrecisionPolicyService`
 * and `DiagnosticsPolicyService` from context.
 *
 * @see {@link complexDerivative} — pure kernel without policy seams
 *
 * @since 0.1.0
 * @category operations
 */
export const complexDerivativeWithPolicies = (
  f: (z: Complex) => Complex,
  x: number,
  h: number = 1e-20
) =>
  withScalarPolicyGuards({
    operation: "Complex.complexDerivativeWithPolicies",
    compute: () => complexDerivative(f, x, h),
    makeError: (message) => new ComplexDomainViolationError({ operation: "complexDerivativeWithPolicies", message }),
    annotations: (result) => ({ input: String(x), h: String(h), result: String(result) })
  })
