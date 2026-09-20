/**
 * Gamma distribution kernels.
 * Parameters: shape (k > 0), scale (θ > 0). Mean = kθ.
 *
 * CDF and normalization use the Special implementations, reusing shape-only
 * normalization throughout an inverse solve.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Function, Match, Number } from "effect"

import { exp, isFinite, log, log1p, sqrt } from "../../Numeric.js"
import { digamma, erfcinv, lnGamma } from "../../Special.js"
import { isNaN } from "../numeric/binary.js"
import { gammainc, gammaincc } from "../special/gammainc.js"

/**
 * Gamma PDF: x^{k−1} e^{−x/θ} / (θ^k Γ(k)) for x > 0.
 *
 * At zero the density is infinite below shape one, `1 / scale` at shape one,
 * and zero above shape one.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaPdf = (
  x: number,
  shape: number,
  scale: number,
  logGamma: (shape: number) => number = lnGamma
): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => 0),
    Match.when(Number.lessThan(0), () => 0),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(shape, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.unsafeDivide(1, scale)),
        Match.when(1, () => 0),
        Match.exhaustive
      )),
    Match.orElse(() =>
      exp(
        Number.subtract(
          Number.subtract(
            Number.multiply(Number.subtract(shape, 1), log(x)),
            Number.unsafeDivide(x, scale)
          ),
          Number.sum(
            Number.multiply(shape, log(scale)),
            logGamma(shape)
          )
        )
      )
    )
  )
}

/**
 * Gamma log-PDF: (k−1)ln(x) − x/θ − k·ln(θ) − ln Γ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLogpdf = (x: number, shape: number, scale: number): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => Number.negate(Infinity)),
    Match.when(Number.lessThan(0), () => Number.negate(Infinity)),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(shape, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.negate(log(scale))),
        Match.when(1, () => Number.negate(Infinity)),
        Match.exhaustive
      )),
    Match.orElse(() =>
      Number.subtract(
        Number.subtract(
          Number.multiply(Number.subtract(shape, 1), log(x)),
          Number.unsafeDivide(x, scale)
        ),
        Number.sum(
          Number.multiply(shape, log(scale)),
          lnGamma(shape)
        )
      )
    )
  )
}

/**
 * Gamma CDF via regularized lower incomplete gamma P(k, x/θ).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaCdf = (x: number, shape: number, scale: number): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => 1),
    Match.when(Number.lessThanOrEqualTo(0), () => 0),
    Match.orElse(() => gammainc(shape, Number.unsafeDivide(x, scale)))
  )
}

/**
 * Finds a finite standardized upper bracket by geometric expansion.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileUpper = (
  p: number,
  shape: number,
  estimate: number,
  logGamma: () => number
): number => {
  const upperTail = Number.greaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, gammaincc(shape, x, logGamma)),
      onFalse: () => Number.subtract(gammainc(shape, x, logGamma), target)
    })
  const tailScale = Number.negate(log1p(Number.negate(p)))
  return gammaQuantileUpperIteration(
    probabilityError,
    Number.max(Number.max(Number.max(1, shape), tailScale), estimate),
    1024
  )
}

const gammaQuantileUpperIteration = (
  probabilityError: (x: number) => number,
  upper: number,
  remaining: number
): number =>
  Boolean.match(
    Boolean.or(
      Number.greaterThanOrEqualTo(probabilityError(upper), 0),
      Boolean.or(Number.Equivalence(remaining, 0), Boolean.not(isFinite(upper)))
    ),
    {
      onTrue: () => upper,
      onFalse: () =>
        gammaQuantileUpperIteration(
          probabilityError,
          Number.multiply(upper, 2),
          Number.subtract(remaining, 1)
        )
    }
  )

/**
 * Safeguarded Halley iteration inside a monotone gamma-CDF bracket.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileLoop = (
  p: number,
  shape: number,
  upper: number,
  initialX: number,
  logGamma: () => number
): number => {
  const upperTail = Number.greaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, gammaincc(shape, x, logGamma)),
      onFalse: () => Number.subtract(gammainc(shape, x, logGamma), target)
    })
  return gammaQuantileIteration(probabilityError, shape, logGamma, 0, upper, initialX, 320)
}

const gammaQuantileIteration = (
  probabilityError: (x: number) => number,
  shape: number,
  logGamma: () => number,
  lower: number,
  upper: number,
  x: number,
  remaining: number
): number => {
  const midpoint = Number.unsafeDivide(Number.sum(lower, upper), 2)
  const exhaustedPrecision = Boolean.or(
    Number.Equivalence(midpoint, lower),
    Number.Equivalence(midpoint, upper)
  )
  return Boolean.match(Boolean.or(Number.Equivalence(remaining, 0), exhaustedPrecision), {
    onTrue: () => x,
    onFalse: () => {
      const difference = probabilityError(x)
      return Boolean.match(Number.Equivalence(difference, 0), {
        onTrue: () => x,
        onFalse: () => {
          const below = Number.lessThan(difference, 0)
          const nextLower = Boolean.match(below, { onTrue: () => x, onFalse: () => lower })
          const nextUpper = Boolean.match(below, { onTrue: () => upper, onFalse: () => x })
          const bracketMidpoint = Number.unsafeDivide(Number.sum(nextLower, nextUpper), 2)
          const newtonStep = Number.unsafeDivide(difference, gammaPdf(x, shape, 1, logGamma))
          const logDensityDerivative = Number.subtract(
            Number.unsafeDivide(Number.subtract(shape, 1), x),
            1
          )
          const halleyDenominator = Number.subtract(
            1,
            Number.multiply(0.5, Number.multiply(newtonStep, logDensityDerivative))
          )
          const candidate = Number.subtract(
            x,
            Number.unsafeDivide(newtonStep, halleyDenominator)
          )
          return Boolean.match(Number.Equivalence(candidate, x), {
            onTrue: () => x,
            onFalse: () => {
              const useCandidate = Boolean.and(
                isFinite(candidate),
                Boolean.and(Number.greaterThan(candidate, nextLower), Number.lessThan(candidate, nextUpper))
              )
              const nextX = Boolean.match(useCandidate, { onTrue: () => candidate, onFalse: () => bracketMidpoint })
              return gammaQuantileIteration(
                probabilityError,
                shape,
                logGamma,
                nextLower,
                nextUpper,
                nextX,
                Number.subtract(remaining, 1)
              )
            }
          })
        }
      })
    }
  })
}

/**
 * Gamma quantile (inverse CDF) via safeguarded, tail-aware Halley iteration.
 *
 * Exact endpoint probabilities map to the exact support endpoints. Interior
 * estimates use a geometrically expanded bracket and direct upper-tail
 * probability evaluation before applying the requested scale.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaQuantile = (p: number, shape: number, scale: number): number => {
  return Match.value(p).pipe(
    Match.when(isNaN, () => NaN),
    Match.when(Number.lessThanOrEqualTo(0), () => 0),
    Match.when(Number.greaterThanOrEqualTo(1), () => Infinity),
    // Gamma(1, scale) is exponential. log1p preserves the lower tail when
    // subtracting p from one would round to one; no inverse solve is needed.
    Match.when(
      () => Number.Equivalence(shape, 1),
      () => Number.multiply(scale, Number.negate(log1p(Number.negate(p))))
    ),
    Match.orElse((p) => {
      const logGamma = Function.constant(lnGamma(shape))
      const logLowerEstimate = Number.unsafeDivide(
        Number.sum(log(p), lnGamma(Number.sum(shape, 1))),
        shape
      )
      const lowerEstimate = exp(logLowerEstimate)
      // P(a,x) = x^a / Gamma(a+1) times a series whose first relative
      // correction is x/(a+1). Skip an ill-conditioned subnormal residual
      // when that correction is below binary64 precision.
      return Boolean.match(
        Number.lessThanOrEqualTo(Number.unsafeDivide(lowerEstimate, Number.sum(shape, 1)), 1e-16),
        {
          onTrue: () => exp(Number.sum(logLowerEstimate, log(scale))),
          onFalse: () => {
            // Wilson-Hilferty supplies the standard large-shape inverse-gamma
            // approximation; Halley refinement below restores full accuracy.
            const useNormalEstimate = Boolean.or(
              Number.greaterThanOrEqualTo(shape, 10),
              Boolean.or(Number.lessThan(p, 0.1), Number.greaterThan(p, 0.9))
            )
            const tailEstimate = Boolean.match(Number.lessThanOrEqualTo(p, 0.5), {
              onTrue: () => lowerEstimate,
              onFalse: () => shape
            })
            const estimate = Boolean.match(Boolean.and(useNormalEstimate, Number.greaterThan(shape, 1)), {
              onTrue: () => {
                const normal = Number.negate(Number.multiply(sqrt(2), erfcinv(Number.multiply(2, p))))
                const correction = Number.unsafeDivide(1, Number.multiply(9, shape))
                const base = Number.sum(
                  Number.subtract(1, correction),
                  Number.multiply(normal, sqrt(correction))
                )
                const wilsonHilferty = Number.multiply(shape, Number.multiply(base, Number.multiply(base, base)))
                return Boolean.match(
                  Boolean.and(Number.greaterThan(wilsonHilferty, 0), isFinite(wilsonHilferty)),
                  { onTrue: () => wilsonHilferty, onFalse: () => tailEstimate }
                )
              },
              onFalse: () => tailEstimate
            })
            const upper = gammaQuantileUpper(p, shape, estimate, logGamma)
            const interior = Boolean.and(Number.greaterThan(estimate, 0), Number.lessThan(estimate, upper))
            const initial = Boolean.match(interior, {
              onTrue: () => estimate,
              onFalse: () => Number.unsafeDivide(upper, 2)
            })
            return Number.multiply(gammaQuantileLoop(p, shape, upper, initial, logGamma), scale)
          }
        }
      )
    })
  )
}

/**
 * Gamma mean: kθ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaMean = (shape: number, scale: number): number => Number.multiply(shape, scale)

/**
 * Gamma variance: kθ².
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaVariance = (shape: number, scale: number): number =>
  Number.multiply(shape, Number.multiply(scale, scale))

/**
 * Gamma differential entropy:
 * k + ln(θ) + ln Γ(k) + (1−k)ψ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaEntropy = (shape: number, scale: number): number =>
  Number.sum(
    Number.sum(shape, log(scale)),
    Number.sum(
      lnGamma(shape),
      Number.multiply(Number.subtract(1, shape), digamma(shape))
    )
  )
