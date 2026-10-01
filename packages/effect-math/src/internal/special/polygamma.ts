/**
 * Polygamma function kernel ψ^{(n)}(x) — the nth derivative of digamma.
 *
 * For n = 0 delegates to `digamma`. For n ≥ 1 uses recurrence
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
import { Boolean, Chunk, Data, Iterable, Number, Option, Tuple } from "effect"

import { pow } from "../../Numeric.js"
import { digamma } from "./digamma.js"

const asymptoticThreshold = 7

class PolygammaState extends Data.Class<{
  readonly x: number
  readonly correction: number
}> {}

// Bernoulli numbers B_{2k} for k = 1..6
const bernoulliNumbers: Chunk.Chunk<number> = Chunk.make(
  Number.unsafeDivide(1, 6), // B2
  Number.unsafeDivide(-1, 30), // B4
  Number.unsafeDivide(1, 42), // B6
  Number.unsafeDivide(-1, 30), // B8
  Number.unsafeDivide(5, 66), // B10
  Number.unsafeDivide(-691, 2730) // B12
)

const factorial = (value: number): number =>
  Iterable.reduce(
    Iterable.take(Iterable.makeBy(Number.increment), value),
    1,
    Number.multiply
  )

const signForOrder = (order: number): number =>
  Boolean.match(Number.Equivalence(Number.remainder(order, 2), 0), {
    onTrue: () => -1,
    onFalse: () => 1
  })

/**
 * Asymptotic expansion for ψ^{(n)}(x), x ≥ 7, n ≥ 1.
 *
 * @since 0.1.0
 * @category internal
 */
const polygammaAsymptotic = (n: number, x: number): number => {
  const sign = signForOrder(n)
  const nFact = factorial(n)

  // Leading terms: (n-1)!/x^n + n!/(2·x^{n+1})
  const xPowN = pow(x, n)
  const xPowN1 = Number.multiply(xPowN, x)

  // Bernoulli sum: Σ B_{2k} · (2k+n−1)! / ((2k)! · x^{2k+n}) for k=1..K
  // bernoulliNumbers[i] = B_{2(i+1)}, so k = i+1, 2k = 2(i+1)
  const bernoulliSum = Chunk.reduce(bernoulliNumbers, 0, (acc, bk, i) => {
    const twoK = Number.multiply(2, Number.sum(i, 1))
    const risingFact = factorial(Number.subtract(Number.sum(twoK, n), 1))
    const denomFact = factorial(twoK)
    const xPow = pow(x, Number.sum(twoK, n))
    return Number.sum(acc, Number.multiply(bk, Number.unsafeDivide(risingFact, Number.multiply(denomFact, xPow))))
  })

  const result = Number.sum(
    Number.sum(
      Number.unsafeDivide(factorial(Number.subtract(n, 1)), xPowN),
      Number.unsafeDivide(nFact, Number.multiply(2, xPowN1))
    ),
    bernoulliSum
  )

  return Number.multiply(sign, result)
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
  const initial = new PolygammaState({ x, correction })
  const final = Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Boolean.match(Number.greaterThanOrEqualTo(state.x, asymptoticThreshold), {
        onTrue: Option.none,
        onFalse: () => {
          const term = Number.multiply(
            signForOrder(n),
            Number.unsafeDivide(factorial(n), pow(state.x, Number.sum(n, 1)))
          )
          const next = new PolygammaState({
            x: Number.sum(state.x, 1),
            correction: Number.sum(state.correction, term)
          })
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_state, next) => next
  )
  return Number.sum(final.correction, polygammaAsymptotic(n, final.x))
}

/**
 * ψ^{(n)}(x) — polygamma function for integer n ≥ 0, x > 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const polygamma = (n: number, x: number): number => {
  return Boolean.match(Number.Equivalence(n, 0), {
    onTrue: () => digamma(x),
    onFalse: () => polygammaRecurrence(n, x, 0)
  })
}
