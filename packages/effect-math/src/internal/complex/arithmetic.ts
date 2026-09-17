/**
 * Pure complex arithmetic kernels operating on raw `(re, im)` pairs.
 *
 * These hot-path mechanisms operate below the validation and policy
 * composition owned by the public `Complex` module.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Number, Schema, Tuple } from "effect"

import * as Numeric from "../../Numeric.js"

/**
 * Private rectangular carrier shared by complex arithmetic mechanisms.
 *
 * @since 0.4.0
 * @category internal
 */
export const Cartesian = Schema.Tuple(Schema.Number, Schema.Number).annotations({
  identifier: "@scenesystems/effect-math/internal/complex/Cartesian"
})

/**
 * Private rectangular `[real, imaginary]` pair.
 *
 * @since 0.4.0
 * @category internal
 */
export type Cartesian = typeof Cartesian.Type

/**
 * Complex addition: (a + bi) + (c + di) = (a+c) + (b+d)i.
 *
 * @since 0.1.0
 * @category internal
 */
export const add = (
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): Cartesian => Tuple.make(Number.sum(aRe, bRe), Number.sum(aIm, bIm))

/**
 * Complex subtraction: (a + bi) - (c + di) = (a-c) + (b-d)i.
 *
 * @since 0.1.0
 * @category internal
 */
export const subtract = (
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): Cartesian => Tuple.make(Number.subtract(aRe, bRe), Number.subtract(aIm, bIm))

/**
 * Complex multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i.
 *
 * @since 0.1.0
 * @category internal
 */
export const multiply = (
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): Cartesian =>
  Tuple.make(
    Number.subtract(Number.multiply(aRe, bRe), Number.multiply(aIm, bIm)),
    Number.sum(Number.multiply(aRe, bIm), Number.multiply(aIm, bRe))
  )

/**
 * Complex division via the Smith method — selects the ratio direction
 * (bRe/bIm or bIm/bRe) by whichever denominator component is larger,
 * preventing intermediate overflow for large magnitudes.
 *
 * Returns `[NaN, NaN]` for zero divisor (bRe = bIm = 0).
 *
 * @since 0.1.0
 * @category internal
 */
export const divide = (
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): Cartesian =>
  Boolean.match(Boolean.and(Number.Equivalence(bRe, 0), Number.Equivalence(bIm, 0)), {
    onTrue: () => Tuple.make(NaN, NaN),
    onFalse: () =>
      Boolean.match(Number.greaterThanOrEqualTo(Numeric.abs(bRe), Numeric.abs(bIm)), {
        onTrue: () => {
          const ratio = Number.unsafeDivide(bIm, bRe)
          const denominator = Number.sum(bRe, Number.multiply(bIm, ratio))
          return Tuple.make(
            Number.unsafeDivide(Number.sum(aRe, Number.multiply(aIm, ratio)), denominator),
            Number.unsafeDivide(Number.subtract(aIm, Number.multiply(aRe, ratio)), denominator)
          )
        },
        onFalse: () => {
          const ratio = Number.unsafeDivide(bRe, bIm)
          const denominator = Number.sum(bIm, Number.multiply(bRe, ratio))
          return Tuple.make(
            Number.unsafeDivide(Number.sum(Number.multiply(aRe, ratio), aIm), denominator),
            Number.unsafeDivide(Number.subtract(Number.multiply(aIm, ratio), aRe), denominator)
          )
        }
      })
  })

/**
 * Complex conjugate: conj(a + bi) = a - bi.
 *
 * @since 0.1.0
 * @category internal
 */
export const conjugate = (re: number, im: number): Cartesian => Tuple.make(re, Number.negate(im))

/**
 * Complex modulus |a + bi| = √(a² + b²) via the Numeric hypotenuse operation
 * to avoid overflow for large components.
 *
 * @since 0.1.0
 * @category internal
 */
export const abs = (re: number, im: number): number => Numeric.hypot(Chunk.make(re, im))

/**
 * Complex argument (phase angle): arg(a + bi) = atan2(b, a).
 *
 * Returns a value in (−π, π].
 *
 * @since 0.1.0
 * @category internal
 */
export const arg = (re: number, im: number): number => Numeric.atan2(im, re)

/**
 * Complex exponential: exp(a + bi) = eᵃ(cos(b) + i·sin(b)).
 *
 * @since 0.1.0
 * @category internal
 */
export const exp = (re: number, im: number): Cartesian => {
  const radius = Numeric.exp(re)
  return Tuple.make(Number.multiply(radius, Numeric.cos(im)), Number.multiply(radius, Numeric.sin(im)))
}

/**
 * Principal-branch natural logarithm: log(z) = ln|z| + i·arg(z)
 * with arg ∈ (−π, π]. Returns `[-Infinity, 0]` for z = 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const log = (re: number, im: number): Cartesian =>
  Tuple.make(Numeric.log(Numeric.hypot(Chunk.make(re, im))), Numeric.atan2(im, re))

/**
 * Complex exponentiation z^w = exp(w · log(z)). Returns `[1, 0]`
 * for 0^0 (conventional) and `[0, 0]` for 0^w when w ≠ 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const pow = (
  baseRe: number,
  baseIm: number,
  expRe: number,
  expIm: number
): Cartesian =>
  Boolean.match(Boolean.and(Number.Equivalence(baseRe, 0), Number.Equivalence(baseIm, 0)), {
    onTrue: () =>
      Boolean.match(Boolean.and(Number.Equivalence(expRe, 0), Number.Equivalence(expIm, 0)), {
        onTrue: () => Tuple.make(1, 0),
        onFalse: () => Tuple.make(0, 0)
      }),
    onFalse: () => {
      const [logRe, logIm] = log(baseRe, baseIm)
      const [productRe, productIm] = multiply(expRe, expIm, logRe, logIm)
      return exp(productRe, productIm)
    }
  })

/**
 * Principal-branch square root. Uses the polar decomposition
 * re = √((r + a)/2), im = sign(b)·√((r − a)/2) to avoid
 * branch-cut ambiguity.
 *
 * @since 0.1.0
 * @category internal
 */
export const sqrt = (re: number, im: number): Cartesian =>
  Boolean.match(Boolean.and(Number.Equivalence(re, 0), Number.Equivalence(im, 0)), {
    onTrue: () => Tuple.make(0, 0),
    onFalse: () => {
      const radius = Numeric.hypot(Chunk.make(re, im))
      const resultRe = Numeric.sqrt(Number.unsafeDivide(Number.sum(radius, re), 2))
      const resultIm = Numeric.sqrt(Number.unsafeDivide(Number.subtract(radius, re), 2))
      return Tuple.make(
        resultRe,
        Boolean.match(Number.greaterThanOrEqualTo(im, 0), {
          onTrue: () => resultIm,
          onFalse: () => Number.negate(resultIm)
        })
      )
    }
  })
