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
import { Array, Boolean, MutableRef, Number } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { lnGammaLanczos } from "./gamma.js"

const maxIterations = 200
const epsilon = 1e-14
const minimumPositive = 1e-30
const iterations = Array.range(1, maxIterations)

/** Clamp tiny values away from zero to prevent division overflow. */
const guard = (value: number): number =>
  Boolean.match(Number.lessThan(abs(value), minimumPositive), {
    onTrue: () => minimumPositive,
    onFalse: () => value
  })

/**
 * Series expansion for P(a,x).
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
  sum: number
): number => {
  const apState = MutableRef.make(ap)
  const termState = MutableRef.make(term)
  const sumState = MutableRef.make(sum)
  Boolean.match(Number.lessThan(abs(term), Number.multiply(epsilon, abs(sum))), {
    onTrue: () => true,
    onFalse: () => {
      Array.some(iterations, (iteration) => {
        const apNext = Number.sum(MutableRef.get(apState), 1)
        const termNext = Number.multiply(MutableRef.get(termState), Number.unsafeDivide(x, apNext))
        const sumNext = Number.sum(MutableRef.get(sumState), termNext)
        MutableRef.set(apState, apNext)
        MutableRef.set(termState, termNext)
        MutableRef.set(sumState, sumNext)
        return Boolean.or(
          Number.Equivalence(iteration, maxIterations),
          Number.lessThan(abs(termNext), Number.multiply(epsilon, abs(sumNext)))
        )
      })
      return false
    }
  })
  return MutableRef.get(sumState)
}

const gammaincSeries = (a: number, x: number, logGamma: number): number => {
  const lnPrefix = Number.subtract(Number.multiply(a, log(x)), Number.sum(x, logGamma))
  const initial = Number.unsafeDivide(1, a)
  const sum = gammaincSeriesLoop(x, a, initial, initial)
  return Number.multiply(exp(lnPrefix), sum)
}

/**
 * Modified Lentz CF for Q(a,x).
 *
 * Uses the Legendre CF representation of Γ(a,x)
 * (Gautschi, 1979; Lentz, 1976).
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
  d: number
): number => {
  const valueState = MutableRef.make(f)
  const cState = MutableRef.make(c)
  const dState = MutableRef.make(d)
  Array.some(iterations, (iteration) => {
    const an = Number.multiply(iteration, Number.subtract(a, iteration))
    const bn = Number.sum(Number.sum(x, 1), Number.subtract(Number.multiply(2, iteration), a))
    const dNext = Number.unsafeDivide(1, guard(Number.sum(bn, Number.multiply(an, MutableRef.get(dState)))))
    const cNext = guard(Number.sum(bn, Number.unsafeDivide(an, MutableRef.get(cState))))
    const delta = Number.multiply(cNext, dNext)
    MutableRef.set(valueState, Number.multiply(MutableRef.get(valueState), delta))
    MutableRef.set(cState, cNext)
    MutableRef.set(dState, dNext)
    return Number.lessThan(abs(Number.subtract(delta, 1)), epsilon)
  })
  return MutableRef.get(valueState)
}

const gammaincCF = (a: number, x: number, logGamma: number): number => {
  const lnPrefix = Number.subtract(Number.multiply(a, log(x)), Number.sum(x, logGamma))
  const b0 = Number.subtract(Number.sum(x, 1), a)
  const f0 = guard(b0)
  const result = gammaincCFLoop(a, x, f0, f0, 0)
  return Number.multiply(exp(lnPrefix), Number.unsafeDivide(1, result))
}

/**
 * Regularized lower incomplete gamma P(a,x) = γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 * Internal inverse solves reuse log Γ(a); laziness preserves cheap endpoints.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammainc = (a: number, x: number, logGamma: (a: number) => number = lnGammaLanczos): number => {
  return Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.lessThan(x, Number.sum(a, 1)), {
        onTrue: () => gammaincSeries(a, x, logGamma(a)),
        onFalse: () => Number.subtract(1, gammaincCF(a, x, logGamma(a)))
      })
  })
}

/**
 * Regularized upper incomplete gamma Q(a,x) = 1 − P(a,x) = Γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 * Internal inverse solves reuse log Γ(a); laziness preserves cheap endpoints.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaincc = (a: number, x: number, logGamma: (a: number) => number = lnGammaLanczos): number => {
  return Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 1,
    onFalse: () =>
      Boolean.match(Number.lessThan(x, Number.sum(a, 1)), {
        onTrue: () => Number.subtract(1, gammaincSeries(a, x, logGamma(a))),
        onFalse: () => gammaincCF(a, x, logGamma(a))
      })
  })
}
