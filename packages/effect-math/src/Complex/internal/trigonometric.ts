/**
 * Complex trigonometric and hyperbolic function kernels implemented
 * via Euler's formula identities. Each operates on raw `(re, im)`
 * pairs and delegates to `arithmetic.divide` for quotient forms.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { divide } from "./arithmetic.js"

/**
 * Complex sine: sin(a + bi) = sin(a)cosh(b) + i·cos(a)sinh(b).
 *
 * @since 0.1.0
 * @category internal
 */
export const sin = (re: number, im: number): readonly [number, number] => [
  N.multiply(Math.sin(re), Math.cosh(im)),
  N.multiply(Math.cos(re), Math.sinh(im))
]

/**
 * Complex cosine: cos(a + bi) = cos(a)cosh(b) − i·sin(a)sinh(b).
 *
 * @since 0.1.0
 * @category internal
 */
export const cos = (re: number, im: number): readonly [number, number] => [
  N.multiply(Math.cos(re), Math.cosh(im)),
  N.negate(N.multiply(Math.sin(re), Math.sinh(im)))
]

/**
 * Complex tangent: tan(z) = sin(z) / cos(z). Returns `[NaN, NaN]`
 * at poles where cos(z) = 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const tan = (re: number, im: number): readonly [number, number] => {
  const [sinRe, sinIm] = sin(re, im)
  const [cosRe, cosIm] = cos(re, im)
  return divide(sinRe, sinIm, cosRe, cosIm)
}

/**
 * Complex hyperbolic sine: sinh(a + bi) = sinh(a)cos(b) + i·cosh(a)sin(b).
 *
 * @since 0.1.0
 * @category internal
 */
export const sinh = (re: number, im: number): readonly [number, number] => [
  N.multiply(Math.sinh(re), Math.cos(im)),
  N.multiply(Math.cosh(re), Math.sin(im))
]

/**
 * Complex hyperbolic cosine: cosh(a + bi) = cosh(a)cos(b) + i·sinh(a)sin(b).
 *
 * @since 0.1.0
 * @category internal
 */
export const cosh = (re: number, im: number): readonly [number, number] => [
  N.multiply(Math.cosh(re), Math.cos(im)),
  N.multiply(Math.sinh(re), Math.sin(im))
]

/**
 * Complex hyperbolic tangent: tanh(z) = sinh(z) / cosh(z). Returns
 * `[NaN, NaN]` at poles where cosh(z) = 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const tanh = (re: number, im: number): readonly [number, number] => {
  const [sinhRe, sinhIm] = sinh(re, im)
  const [coshRe, coshIm] = cosh(re, im)
  return divide(sinhRe, sinhIm, coshRe, coshIm)
}
