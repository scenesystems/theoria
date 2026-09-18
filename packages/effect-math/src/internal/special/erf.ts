/**
 * Error function and complementary error function kernels.
 *
 * Uses Cephes multi-region rational polynomial approximation
 * (~1e-15 precision). The odd symmetry property erf(−x) = −erf(x)
 * reduces the domain to x ≥ 0.
 *
 * Ported from effect-search's Cephes implementation for SOT unification.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number } from "effect"

import { abs, exp } from "../../Numeric.js"

const twoPowNegative28 = 3.725290298461914e-9
const rightTailThreshold = 6
const smallRegionBoundary = 0.84375
const middleRegionBoundary = 1.25
const tailRegionBoundary = Number.unsafeDivide(1, 0.35)

const EFX = 1.28379167095512586316e-01
const ERX = 8.45062911510467529297e-01

const PP = (x: number): number => {
  const degree3 = Number.sum(Number.multiply(-2.37630166566501626084e-05, x), -5.77027029648944159157e-03)
  const degree2 = Number.sum(Number.multiply(degree3, x), -2.84817495755985104766e-02)
  const degree1 = Number.sum(Number.multiply(degree2, x), -3.25042107247001499370e-01)
  return Number.sum(Number.multiply(degree1, x), 1.28379167095512558561e-01)
}

const QQ = (x: number): number => {
  const degree4 = Number.sum(Number.multiply(-3.96022827877536812320e-06, x), 1.32494738004321644526e-04)
  const degree3 = Number.sum(Number.multiply(degree4, x), 5.08130628187576562776e-03)
  const degree2 = Number.sum(Number.multiply(degree3, x), 6.50222499887672944485e-02)
  const degree1 = Number.sum(Number.multiply(degree2, x), 3.97917223959155352819e-01)
  return Number.sum(Number.multiply(degree1, x), 1)
}

const PA = (x: number): number => {
  const degree5 = Number.sum(Number.multiply(-2.16637559486879084300e-03, x), 3.54783043256182359371e-02)
  const degree4 = Number.sum(Number.multiply(degree5, x), -1.10894694282396677476e-01)
  const degree3 = Number.sum(Number.multiply(degree4, x), 3.18346619901161753674e-01)
  const degree2 = Number.sum(Number.multiply(degree3, x), -3.72207876035701323847e-01)
  const degree1 = Number.sum(Number.multiply(degree2, x), 4.14856118683748331666e-01)
  return Number.sum(Number.multiply(degree1, x), -2.36211856075265944077e-03)
}

const QA = (x: number): number => {
  const degree5 = Number.sum(Number.multiply(1.19844998467991074170e-02, x), 1.36370839120290507362e-02)
  const degree4 = Number.sum(Number.multiply(degree5, x), 1.26171219808761642112e-01)
  const degree3 = Number.sum(Number.multiply(degree4, x), 7.18286544141962662868e-02)
  const degree2 = Number.sum(Number.multiply(degree3, x), 5.40397917702171048937e-01)
  const degree1 = Number.sum(Number.multiply(degree2, x), 1.06420880400844228286e-01)
  return Number.sum(Number.multiply(degree1, x), 1)
}

const RA = (x: number): number => {
  const degree6 = Number.sum(Number.multiply(-9.81432934416914548592e00, x), -8.12874355063065934246e01)
  const degree5 = Number.sum(Number.multiply(degree6, x), -1.84605092906711035994e02)
  const degree4 = Number.sum(Number.multiply(degree5, x), -1.62396669462573470355e02)
  const degree3 = Number.sum(Number.multiply(degree4, x), -6.23753324503260060396e01)
  const degree2 = Number.sum(Number.multiply(degree3, x), -1.05586262253232909814e01)
  const degree1 = Number.sum(Number.multiply(degree2, x), -6.93858572707181764372e-01)
  return Number.sum(Number.multiply(degree1, x), -9.86494403484714822705e-03)
}

const SA = (x: number): number => {
  const degree7 = Number.sum(Number.multiply(-6.04244152148580987438e-02, x), 6.57024977031928170135e00)
  const degree6 = Number.sum(Number.multiply(degree7, x), 1.08635005541779435134e02)
  const degree5 = Number.sum(Number.multiply(degree6, x), 4.29008140027567833386e02)
  const degree4 = Number.sum(Number.multiply(degree5, x), 6.45387271733267880336e02)
  const degree3 = Number.sum(Number.multiply(degree4, x), 4.34565877475229228821e02)
  const degree2 = Number.sum(Number.multiply(degree3, x), 1.37657754143519042600e02)
  const degree1 = Number.sum(Number.multiply(degree2, x), 1.96512716674392571292e01)
  return Number.sum(Number.multiply(degree1, x), 1)
}

const RB = (x: number): number => {
  const degree5 = Number.sum(Number.multiply(-4.83519191608651397019e02, x), -1.02509513161107724954e03)
  const degree4 = Number.sum(Number.multiply(degree5, x), -6.37566443368389627722e02)
  const degree3 = Number.sum(Number.multiply(degree4, x), -1.60636384855821916062e02)
  const degree2 = Number.sum(Number.multiply(degree3, x), -1.77579549177547519889e01)
  const degree1 = Number.sum(Number.multiply(degree2, x), -7.99283237680523006574e-01)
  return Number.sum(Number.multiply(degree1, x), -9.86494292470009928597e-03)
}

const SB = (x: number): number => {
  const degree6 = Number.sum(Number.multiply(-2.24409524465858183362e01, x), 4.74528541206955367215e02)
  const degree5 = Number.sum(Number.multiply(degree6, x), 2.55305040643316442583e03)
  const degree4 = Number.sum(Number.multiply(degree5, x), 3.19985821950859553908e03)
  const degree3 = Number.sum(Number.multiply(degree4, x), 1.53672958608443695994e03)
  const degree2 = Number.sum(Number.multiply(degree3, x), 3.25792512996573918826e02)
  const degree1 = Number.sum(Number.multiply(degree2, x), 3.03380607434824582924e01)
  return Number.sum(Number.multiply(degree1, x), 1)
}

const tailApproximation = (
  x: number,
  numerator: (x: number) => number,
  denominator: (x: number) => number
): number => {
  const reciprocalSquare = Number.unsafeDivide(1, Number.multiply(x, x))
  const correction = Number.unsafeDivide(numerator(reciprocalSquare), denominator(reciprocalSquare))
  return Number.unsafeDivide(
    exp(Number.sum(Number.subtract(Number.negate(Number.multiply(x, x)), 0.5625), correction)),
    x
  )
}

const positiveTail = (x: number): number =>
  Boolean.match(Number.lessThan(x, tailRegionBoundary), {
    onTrue: () => tailApproximation(x, RA, SA),
    onFalse: () => tailApproximation(x, RB, SB)
  })

const nearZeroApproximation = (x: number): number => Number.multiply(Number.sum(1, EFX), x)

const polynomialApproximation = (x: number): number => {
  const square = Number.multiply(x, x)
  return Number.multiply(x, Number.sum(1, Number.unsafeDivide(PP(square), QQ(square))))
}

const shiftedApproximation = (x: number): number => {
  const shifted = Number.subtract(x, 1)
  return Number.sum(ERX, Number.unsafeDivide(PA(shifted), QA(shifted)))
}

const erfRightNonBig = (x: number): number =>
  Boolean.match(Number.lessThan(x, twoPowNegative28), {
    onTrue: () => nearZeroApproximation(x),
    onFalse: () =>
      Boolean.match(Number.lessThan(x, smallRegionBoundary), {
        onTrue: () => polynomialApproximation(x),
        onFalse: () =>
          Boolean.match(Number.lessThan(x, middleRegionBoundary), {
            onTrue: () => shiftedApproximation(x),
            onFalse: () => Number.subtract(1, positiveTail(x))
          })
      })
  })

const erfcPositive = (x: number): number =>
  Boolean.match(Number.lessThan(x, twoPowNegative28), {
    onTrue: () => Number.subtract(1, nearZeroApproximation(x)),
    onFalse: () =>
      Boolean.match(Number.lessThan(x, smallRegionBoundary), {
        onTrue: () => Number.subtract(1, polynomialApproximation(x)),
        onFalse: () =>
          Boolean.match(Number.lessThan(x, middleRegionBoundary), {
            onTrue: () => Number.subtract(1, shiftedApproximation(x)),
            onFalse: () => positiveTail(x)
          })
      })
  })

/**
 * erf(x) via Cephes multi-region rational polynomial. Handles negative x
 * via odd symmetry.
 *
 * @since 0.1.0
 * @category internal
 */
export const erfCephes = (x: number): number => {
  return Boolean.match(Number.Equivalence(x, x), {
    onFalse: () => NaN,
    onTrue: () =>
      Boolean.match(Number.Equivalence(x, Infinity), {
        onTrue: () => 1,
        onFalse: () =>
          Boolean.match(Number.Equivalence(x, Number.negate(Infinity)), {
            onTrue: () => -1,
            onFalse: () => {
              const absoluteX = abs(x)
              const rightValue = Boolean.match(Number.lessThan(absoluteX, rightTailThreshold), {
                onTrue: () => erfRightNonBig(absoluteX),
                onFalse: () => 1
              })
              return Boolean.match(Number.lessThan(x, 0), {
                onTrue: () => Number.negate(rightValue),
                onFalse: () => rightValue
              })
            }
          })
      })
  })
}

/**
 * erfc(x) = 1 − erf(x). Uses the complementary form directly for
 * numerical stability when x is large (avoids subtracting nearly 1 from 1).
 *
 * @since 0.1.0
 * @category internal
 */
export const erfcCephes = (x: number): number => {
  return Boolean.match(Number.Equivalence(x, x), {
    onFalse: () => NaN,
    onTrue: () =>
      Boolean.match(Number.greaterThanOrEqualTo(x, 0), {
        onTrue: () => erfcPositive(x),
        onFalse: () => Number.subtract(2, erfcPositive(Number.negate(x)))
      })
  })
}
