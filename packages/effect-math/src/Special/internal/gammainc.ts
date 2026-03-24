/**
 * Regularized incomplete gamma function kernels.
 *
 * P(a,x) = γ(a,x)/Γ(a) via series expansion for x < a+1, and
 * Q(a,x) = 1 − P(a,x) via Legendre continued fraction (modified Lentz)
 * for x ≥ a+1. All normalization uses log-space via `lnGammaLanczos`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"
import { lnGammaLanczos } from "./gamma.js"

const MAX_ITERATIONS = 200
const EPSILON = 1e-14
const FPMIN = 1e-30

/** Clamp tiny values away from zero to prevent division overflow. */
const guard = (v: number): number => (Math.abs(v) < FPMIN ? FPMIN : v)

/**
 * Tail-recursive series expansion for P(a,x).
 *
 * P(a,x) = e^{−x} x^a / Γ(a) · Σ_{n=0}^{∞} x^n / (a·(a+1)·…·(a+n))
 *
 * @since 0.1.0
 * @category internal
 */
const gammaincSeriesLoop = (
  x: number,
  ap: number,
  term: number,
  sum: number,
  remaining: number
): number => {
  if (remaining === 0) return sum
  if (Math.abs(term) < N.multiply(EPSILON, Math.abs(sum))) return sum
  const apNext = N.sum(ap, 1)
  const termNext = N.multiply(term, x / apNext)
  return gammaincSeriesLoop(x, apNext, termNext, N.sum(sum, termNext), N.subtract(remaining, 1))
}

const gammaincSeries = (a: number, x: number): number => {
  const lnPrefix = N.subtract(N.multiply(a, Math.log(x)), N.sum(x, lnGammaLanczos(a)))
  const sum = gammaincSeriesLoop(x, a, 1 / a, 1 / a, MAX_ITERATIONS)
  return N.multiply(Math.exp(lnPrefix), sum)
}

/**
 * Tail-recursive modified Lentz CF for Q(a,x).
 *
 * Uses the Legendre CF representation of Γ(a,x) following
 * Numerical Recipes §6.2 (gcf).
 *
 * CF: b₀ = x+1−a, a_n = n(a−n), b_n = x+1+2n−a
 *
 * @since 0.1.0
 * @category internal
 */
const gammaincCFLoop = (
  a: number,
  x: number,
  f: number,
  c: number,
  d: number,
  n: number
): number => {
  if (n > MAX_ITERATIONS) return f

  const an = N.multiply(n, N.subtract(a, n))
  const bn = N.sum(N.sum(x, 1), N.subtract(N.multiply(2, n), a))

  const dNext = 1 / guard(N.sum(bn, N.multiply(an, d)))
  const cNext = guard(N.sum(bn, an / c))
  const delta = N.multiply(cNext, dNext)
  const fNext = N.multiply(f, delta)

  if (Math.abs(N.subtract(delta, 1)) < EPSILON) return fNext

  return gammaincCFLoop(a, x, fNext, cNext, dNext, N.sum(n, 1))
}

const gammaincCF = (a: number, x: number): number => {
  const lnPrefix = N.subtract(N.multiply(a, Math.log(x)), N.sum(x, lnGammaLanczos(a)))
  const b0 = N.subtract(N.sum(x, 1), a)
  const f0 = guard(b0)
  const result = gammaincCFLoop(a, x, f0, f0, 0, 1)
  return N.multiply(Math.exp(lnPrefix), 1 / result)
}

/**
 * Regularized lower incomplete gamma P(a,x) = γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaincKernel = (a: number, x: number): number => {
  if (x === 0) return 0
  if (x < N.sum(a, 1)) return gammaincSeries(a, x)
  return N.subtract(1, gammaincCF(a, x))
}

/**
 * Regularized upper incomplete gamma Q(a,x) = 1 − P(a,x) = Γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 *
 * @since 0.1.0
 * @category internal
 */
export const gammainccKernel = (a: number, x: number): number => {
  if (x === 0) return 1
  if (x < N.sum(a, 1)) return N.subtract(1, gammaincSeries(a, x))
  return gammaincCF(a, x)
}
