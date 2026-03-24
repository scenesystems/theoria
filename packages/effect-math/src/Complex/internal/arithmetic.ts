/**
 * Pure complex arithmetic kernels operating on raw `(re, im)` pairs.
 *
 * No Effect wrapper, no Schema validation — these are the hot-path
 * functions wrapped by the public `Complex → Complex` operations in
 * `operations.ts`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

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
): readonly [number, number] => [N.sum(aRe, bRe), N.sum(aIm, bIm)]

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
): readonly [number, number] => [N.subtract(aRe, bRe), N.subtract(aIm, bIm)]

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
): readonly [number, number] => [
  N.subtract(N.multiply(aRe, bRe), N.multiply(aIm, bIm)),
  N.sum(N.multiply(aRe, bIm), N.multiply(aIm, bRe))
]

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
): readonly [number, number] => {
  if (bRe === 0 && bIm === 0) return [NaN, NaN]

  if (Math.abs(bRe) >= Math.abs(bIm)) {
    const ratio = N.unsafeDivide(bIm, bRe)
    const denom = N.sum(bRe, N.multiply(bIm, ratio))
    return [
      N.unsafeDivide(N.sum(aRe, N.multiply(aIm, ratio)), denom),
      N.unsafeDivide(N.subtract(aIm, N.multiply(aRe, ratio)), denom)
    ]
  }

  const ratio = N.unsafeDivide(bRe, bIm)
  const denom = N.sum(bIm, N.multiply(bRe, ratio))
  return [
    N.unsafeDivide(N.sum(N.multiply(aRe, ratio), aIm), denom),
    N.unsafeDivide(N.subtract(N.multiply(aIm, ratio), aRe), denom)
  ]
}

/**
 * Complex conjugate: conj(a + bi) = a - bi.
 *
 * @since 0.1.0
 * @category internal
 */
export const conjugate = (re: number, im: number): readonly [number, number] => [re, N.negate(im)]

/**
 * Complex modulus |a + bi| = √(a² + b²) via `Math.hypot` to avoid
 * overflow for large components.
 *
 * @since 0.1.0
 * @category internal
 */
export const abs = (re: number, im: number): number => Math.hypot(re, im)

/**
 * Complex argument (phase angle): arg(a + bi) = atan2(b, a).
 *
 * Returns a value in (−π, π].
 *
 * @since 0.1.0
 * @category internal
 */
export const arg = (re: number, im: number): number => Math.atan2(im, re)

/**
 * Complex exponential: exp(a + bi) = eᵃ(cos(b) + i·sin(b)).
 *
 * @since 0.1.0
 * @category internal
 */
export const exp = (re: number, im: number): readonly [number, number] => {
  const r = Math.exp(re)
  return [N.multiply(r, Math.cos(im)), N.multiply(r, Math.sin(im))]
}

/**
 * Principal-branch natural logarithm: log(z) = ln|z| + i·arg(z)
 * with arg ∈ (−π, π]. Returns `[-Infinity, 0]` for z = 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const log = (re: number, im: number): readonly [number, number] => [
  Math.log(Math.hypot(re, im)),
  Math.atan2(im, re)
]

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
): readonly [number, number] => {
  if (baseRe === 0 && baseIm === 0) {
    if (expRe === 0 && expIm === 0) return [1, 0]
    return [0, 0]
  }
  const [logRe, logIm] = log(baseRe, baseIm)
  const [prodRe, prodIm] = multiply(expRe, expIm, logRe, logIm)
  return exp(prodRe, prodIm)
}

/**
 * Principal-branch square root. Uses the polar decomposition
 * re = √((r + a)/2), im = sign(b)·√((r − a)/2) to avoid
 * branch-cut ambiguity.
 *
 * @since 0.1.0
 * @category internal
 */
export const sqrt = (re: number, im: number): readonly [number, number] => {
  if (re === 0 && im === 0) return [0, 0]

  const r = Math.hypot(re, im)
  const resultRe = Math.sqrt(N.unsafeDivide(N.sum(r, re), 2))
  const resultIm = Math.sqrt(N.unsafeDivide(N.subtract(r, re), 2))

  return im >= 0 ? [resultRe, resultIm] : [resultRe, N.negate(resultIm)]
}
