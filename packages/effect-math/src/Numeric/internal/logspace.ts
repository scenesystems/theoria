/**
 * Log-space arithmetic kernels for numerically stable log-probability
 * computations. All functions avoid overflow/underflow by operating in
 * log-space throughout.
 *
 * @since 0.1.0
 * @category internal
 */

/**
 * log(exp(a) + exp(b)) without overflow. Uses max-shift trick:
 * max(a,b) + log1p(exp(-|a - b|)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logaddexp = (a: number, b: number): number => {
  if (a === -Infinity) return b
  if (b === -Infinity) return a
  const max = a > b ? a : b
  const min = a > b ? b : a
  return max + Math.log1p(Math.exp(min - max))
}

/**
 * log(exp(a) - exp(b)) for a > b. Returns NaN when b >= a.
 * Uses a + log1p(-exp(b - a)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logsubexp = (a: number, b: number): number => {
  if (b >= a) return NaN
  return a + Math.log1p(-Math.exp(b - a))
}

/**
 * log(1 - exp(x)) for x < 0. Branches at x = -ln(2) ≈ -0.6931:
 * - x > -ln(2): log(-expm1(x))
 * - x ≤ -ln(2): log1p(-exp(x))
 *
 * @since 0.1.0
 * @category internal
 */
export const log1mexp = (x: number): number => {
  if (x >= 0) return NaN
  return x > -Math.LN2
    ? Math.log(-Math.expm1(x))
    : Math.log1p(-Math.exp(x))
}

/**
 * log(1 + exp(x)) (softplus). Branches for numerical stability:
 * - x > 33.3: x (exp(x) dominates, log1p ≈ x)
 * - x > -37: log1p(exp(x))
 * - x ≤ -37: exp(x) (log1p(tiny) ≈ tiny)
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pexp = (x: number): number => {
  if (x > 33.3) return x
  if (x > -37) return Math.log1p(Math.exp(x))
  return Math.exp(x)
}

/**
 * x * log(y) with x=0 → 0 convention (avoids 0 * -Infinity = NaN).
 *
 * @since 0.1.0
 * @category internal
 */
export const xlogy = (x: number, y: number): number => x === 0 ? 0 : x * Math.log(y)

/**
 * x * log(1 + y) with x=0 → 0 convention.
 *
 * @since 0.1.0
 * @category internal
 */
export const xlog1py = (x: number, y: number): number => x === 0 ? 0 : x * Math.log1p(y)
