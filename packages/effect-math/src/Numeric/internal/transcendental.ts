/**
 * Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */

/**
 * Relaxed `log1p` — direct `Math.log1p` delegation.
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pRelaxed: (value: number) => number = Math.log1p

/**
 * Strict `log1p` kernel. Uses Taylor series truncation for `|x| < 1e-4`
 * to avoid catastrophic cancellation in `log(1 + x)`.
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pStrict = (value: number): number => {
  if (Math.abs(value) < 1e-4) {
    const x2 = value * value
    const x3 = x2 * value
    const x4 = x3 * value
    return value - x2 / 2 + x3 / 3 - x4 / 4
  }
  return Math.log1p(value)
}

/**
 * Relaxed `expm1` — direct `Math.expm1` delegation.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Relaxed: (value: number) => number = Math.expm1

/**
 * Strict `expm1` kernel. Uses Taylor series for `|x| < 1e-4`
 * to preserve precision near zero.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Strict = (value: number): number => {
  if (Math.abs(value) < 1e-4) {
    const x2 = value * value
    const x3 = x2 * value
    const x4 = x3 * value
    return value + x2 / 2 + x3 / 6 + x4 / 24
  }
  return Math.expm1(value)
}
