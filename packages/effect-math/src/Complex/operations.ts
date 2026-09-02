/**
 * Applies arithmetic, trigonometric, polar, vector, and differentiation
 * operations to complex values.
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
 * Yields the immutable descriptor used to register Complex capabilities.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadComplexDomain = Effect.succeed(ComplexDomainModel)

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Preserves caller-supplied real and imaginary components without finiteness
 * checks or normalization.
 *
 * @since 0.1.0
 * @category constructors
 */
export const of = (re: number, im: number): Complex => new Complex({ re, im })

/**
 * Constructs a complex value on the real axis.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromReal = (re: number): Complex => new Complex({ re, im: 0 })

/**
 * Constructs a complex value on the imaginary axis.
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
 * Imaginary unit 0 + 1i. Satisfies i² = -1.
 *
 * @since 0.1.0
 * @category constants
 */
export const i: Complex = new Complex({ re: 0, im: 1 })

// ---------------------------------------------------------------------------
// Pure arithmetic operations
// ---------------------------------------------------------------------------

/**
 * Adds the corresponding real and imaginary components.
 *
 * @since 0.1.0
 * @category operations
 */
export const add = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.add(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Subtracts the corresponding real and imaginary components.
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
 * @since 0.1.0
 * @category operations
 */
export const multiply = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.multiply(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Complex division using the Smith method for overflow safety.
 * Returns `NaN` components when the divisor is zero. The validated variant
 * checks component finiteness but preserves this zero-divisor behavior.
 *
 * @since 0.1.0
 * @category operations
 */
export const divide = (a: Complex, b: Complex): Complex => {
  const [re, im] = Arith.divide(a.re, a.im, b.re, b.im)
  return new Complex({ re, im })
}

/**
 * Reflects a value across the real axis by negating its imaginary component.
 *
 * @since 0.1.0
 * @category operations
 */
export const conjugate = (z: Complex): Complex => {
  const [re, im] = Arith.conjugate(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Computes the modulus |z| with `Math.hypot` to avoid intermediate overflow.
 *
 * @since 0.1.0
 * @category operations
 */
export const abs = (z: Complex): number => Arith.abs(z.re, z.im)

/**
 * Computes the principal phase angle `atan2(im, re)` in `(-π, π]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const arg = (z: Complex): number => Arith.arg(z.re, z.im)

/**
 * Computes `exp(a + bi) = exp(a)(cos(b) + i * sin(b))`. Maps
 * the left half-plane to the unit disk interior.
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
 * `(-π, π]`. Returns `[-Infinity, 0]` for zero.
 *
 * @since 0.1.0
 * @category operations
 */
export const log = (z: Complex): Complex => {
  const [re, im] = Arith.log(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Computes `z^w = exp(w * log(z))`. Returns 1 + 0i for `0^0` and
 * 0 + 0i for `0^w` when `w` is nonzero.
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
 * a purely imaginary result; for example, `sqrt(-4) = 2i`.
 *
 * @since 0.1.0
 * @category operations
 */
export const sqrt = (z: Complex): Complex => {
  const [re, im] = Arith.sqrt(z.re, z.im)
  return new Complex({ re, im })
}

// ---------------------------------------------------------------------------
// Pure polar conversion operations
// ---------------------------------------------------------------------------

/**
 * Converts a Cartesian value to `[modulus, principalArgument]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const toPolar = (z: Complex): readonly [number, number] => Polar.toPolar(z.re, z.im)

/**
 * Constructs a complex value from a modulus and angle in radians.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromPolar = (r: number, theta: number): Complex => {
  const [re, im] = Polar.fromPolar(r, theta)
  return new Complex({ re, im })
}

// ---------------------------------------------------------------------------
// Pure trigonometric operations
// ---------------------------------------------------------------------------

/**
 * Extends sine to complex inputs, with an imaginary component that is odd in
 * `b`: sin(a + bi) = sin(a)cosh(b) + i·cos(a)sinh(b).
 *
 * @since 0.1.0
 * @category operations
 */
export const sin = (z: Complex): Complex => {
  const [re, im] = Trig.sin(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Extends cosine to complex inputs, negating the imaginary cross term:
 * cos(a + bi) = cos(a)cosh(b) − i·sin(a)sinh(b).
 *
 * @since 0.1.0
 * @category operations
 */
export const cos = (z: Complex): Complex => {
  const [re, im] = Trig.cos(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Computes `tan(z) = sin(z) / cos(z)`. Poles where `cos(z) = 0`
 * produce `NaN` components.
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
 * @since 0.1.0
 * @category operations
 */
export const cosh = (z: Complex): Complex => {
  const [re, im] = Trig.cosh(z.re, z.im)
  return new Complex({ re, im })
}

/**
 * Computes `tanh(z) = sinh(z) / cosh(z)`.
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
 * Converts each real value to a complex value with an imaginary component of zero.
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
 * @since 0.1.0
 * @category operations
 */
export const toRealChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(xs, (z) => z.re)

/**
 * Extracts the imaginary parts from a complex vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const toImaginaryChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(xs, (z) => z.im)

/**
 * Computes the modulus |z| for each element, producing a
 * `Chunk<number>` of magnitudes.
 *
 * @since 0.1.0
 * @category operations
 */
export const toMagnitudeChunk = (xs: Chunk.Chunk<Complex>): Chunk.Chunk<number> =>
  Chunk.map(xs, (z) => Arith.abs(z.re, z.im))

/**
 * Computes the principal phase angle for each element. Every result lies in
 * `(-π, π]`.
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
 * Estimates `f'(x)` as `Im(f(x + ih)) / h`.
 *
 * @remarks
 * This method avoids the subtraction used by finite differences. The callback
 * must implement an analytic extension of the real function. The default step
 * size is `1e-20`.
 *
 * @example
 * ```ts
 * import { complexDerivative, sin } from "@scenesystems/effect-math/Complex"
 * import { Effect } from "effect"
 *
 * export const program = Effect.sync(() => complexDerivative(sin, 0)).pipe(
 *   Effect.filterOrFail(
 *     (derivative) => derivative > 0.999999 && derivative < 1.000001,
 *     () => "UnexpectedDerivative"
 *   )
 * )
 * ```
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
 * Adds two complex values after decoding finite components and rejecting excess fields.
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
 * Subtracts the second decoded finite complex value from the first.
 * Malformed or excess input fails with `ComplexDecodeError`.
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
 * Multiplies two decoded finite complex values. Malformed or excess input fails
 * with `ComplexDecodeError`.
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
 * Decodes finite components for two complex values and divides them. A zero
 * divisor produces `NaN` components. Malformed or excess input fails with
 * `ComplexDecodeError`.
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
 * Decodes finite components and computes the complex exponential. Malformed
 * or excess input fails with `ComplexDecodeError`.
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
 * Decodes finite components and computes the principal complex logarithm.
 * Malformed or excess input fails with `ComplexDecodeError`.
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
 * Decodes a finite evaluation point and positive finite step before applying
 * complex-step differentiation. Malformed or excess input fails with
 * `ComplexDecodeError`. Exceptions from `f` remain defects.
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
 * Computes the modulus, rejecting a non-finite result under strict precision
 * and logging the input and result when diagnostics are enabled.
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
 * Computes the principal phase angle, rejecting a non-finite result under
 * strict precision and logging the input and result when diagnostics are enabled.
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
 * Applies complex-step differentiation, rejecting a non-finite result under
 * strict precision and logging the input, step, and result when diagnostics
 * are enabled. Exceptions from `f` remain defects.
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
