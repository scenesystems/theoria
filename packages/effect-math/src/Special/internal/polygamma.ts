/**
 * Polygamma function kernel ψ^{(n)}(x) — the nth derivative of digamma.
 *
 * For n = 0 delegates to `digammaKernel`. For n ≥ 1 uses recurrence
 * shifting x → x+1 until x ≥ 7, then asymptotic expansion with
 * Bernoulli numbers.
 *
 * Asymptotic expansion for n ≥ 1:
 *   ψ^{(n)}(x) = (−1)^{n+1} [ (n−1)!/x^n + n!/(2x^{n+1})
 *                               + Σ B_{2k}·(2k+n−1)!/(2k)!/x^{2k+n} ]
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"
import { digammaKernel } from "./digamma.js"

const ASYMPTOTIC_THRESHOLD = 7

// Bernoulli numbers B_{2k} for k = 1..6
const BERNOULLI: Chunk.Chunk<number> = Chunk.fromIterable([
  1 / 6, // B2
  -1 / 30, // B4
  1 / 42, // B6
  -1 / 30, // B8
  5 / 66, // B10
  -691 / 2730 // B12
])

// Precomputed factorials 0! through 20!
const FACTORIAL: Chunk.Chunk<number> = Chunk.fromIterable([
  1,
  1,
  2,
  6,
  24,
  120,
  720,
  5040,
  40320,
  362880,
  3628800,
  39916800,
  479001600,
  6227020800,
  87178291200,
  1307674368000,
  20922789888000,
  355687428096000,
  6402373705728000,
  121645100408832000,
  2432902008176640000
])

/**
 * Asymptotic expansion for ψ^{(n)}(x), x ≥ 7, n ≥ 1.
 *
 * @since 0.1.0
 * @category internal
 */
const polygammaAsymptotic = (n: number, x: number): number => {
  const sign = n % 2 === 0 ? -1 : 1
  const nFact = Chunk.unsafeGet(FACTORIAL, n)

  // Leading terms: (n-1)!/x^n + n!/(2·x^{n+1})
  const xPowN = Math.pow(x, n)
  const xPowN1 = N.multiply(xPowN, x)

  // Bernoulli sum: Σ B_{2k} · (2k+n−1)! / ((2k)! · x^{2k+n}) for k=1..K
  // BERNOULLI[i] = B_{2(i+1)}, so k = i+1, 2k = 2(i+1)
  const bernoulliSum = Chunk.reduce(BERNOULLI, 0, (acc, bk, i) => {
    const twoK = N.multiply(2, N.sum(i, 1))
    const risingFact = Chunk.unsafeGet(FACTORIAL, N.subtract(N.sum(twoK, n), 1))
    const denomFact = Chunk.unsafeGet(FACTORIAL, twoK)
    const xPow = Math.pow(x, N.sum(twoK, n))
    return N.sum(acc, N.multiply(bk, risingFact / N.multiply(denomFact, xPow)))
  })

  const result = N.sum(
    N.sum(
      Chunk.unsafeGet(FACTORIAL, N.subtract(n, 1)) / xPowN,
      nFact / N.multiply(2, xPowN1)
    ),
    bernoulliSum
  )

  return N.multiply(sign, result)
}

/**
 * Recurrence: ψ^{(n)}(x) = ψ^{(n)}(x+1) + (−1)^{n+1} · n!/x^{n+1}
 *
 * Shift x upward until x ≥ threshold, accumulating the correction.
 *
 * @since 0.1.0
 * @category internal
 */
const polygammaRecurrence = (n: number, x: number, correction: number): number => {
  if (x >= ASYMPTOTIC_THRESHOLD) {
    return N.sum(correction, polygammaAsymptotic(n, x))
  }
  const sign = n % 2 === 0 ? -1 : 1
  const term = N.multiply(sign, Chunk.unsafeGet(FACTORIAL, n) / Math.pow(x, N.sum(n, 1)))
  return polygammaRecurrence(n, N.sum(x, 1), N.sum(correction, term))
}

/**
 * ψ^{(n)}(x) — polygamma function for integer n ≥ 0, x > 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const polygammaKernel = (n: number, x: number): number => {
  if (n === 0) return digammaKernel(x)
  return polygammaRecurrence(n, x, 0)
}
