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
import { Boolean, Chunk, Number, Schema } from "effect"

import { abs, exp } from "../../Numeric.js"

const NonNaN = Schema.Number.pipe(Schema.nonNaN())
const twoPowNegative28 = 3.725290298461914e-9
const rightTailThreshold = 6
const smallRegionBoundary = 0.84375
const middleRegionBoundary = 1.25
const tailRegionBoundary = Number.unsafeDivide(1, 0.35)

const EFX = 1.28379167095512586316e-01
const ERX = 8.45062911510467529297e-01

const PP = Chunk.make(
  1.28379167095512558561e-01,
  -3.25042107247001499370e-01,
  -2.84817495755985104766e-02,
  -5.77027029648944159157e-03,
  -2.37630166566501626084e-05
)

const QQ = Chunk.make(
  1,
  3.97917223959155352819e-01,
  6.50222499887672944485e-02,
  5.08130628187576562776e-03,
  1.32494738004321644526e-04,
  -3.96022827877536812320e-06
)

const PA = Chunk.make(
  -2.36211856075265944077e-03,
  4.14856118683748331666e-01,
  -3.72207876035701323847e-01,
  3.18346619901161753674e-01,
  -1.10894694282396677476e-01,
  3.54783043256182359371e-02,
  -2.16637559486879084300e-03
)

const QA = Chunk.make(
  1,
  1.06420880400844228286e-01,
  5.40397917702171048937e-01,
  7.18286544141962662868e-02,
  1.26171219808761642112e-01,
  1.36370839120290507362e-02,
  1.19844998467991074170e-02
)

const RA = Chunk.make(
  -9.86494403484714822705e-03,
  -6.93858572707181764372e-01,
  -1.05586262253232909814e01,
  -6.23753324503260060396e01,
  -1.62396669462573470355e02,
  -1.84605092906711035994e02,
  -8.12874355063065934246e01,
  -9.81432934416914548592e00
)

const SA = Chunk.make(
  1,
  1.96512716674392571292e01,
  1.37657754143519042600e02,
  4.34565877475229228821e02,
  6.45387271733267880336e02,
  4.29008140027567833386e02,
  1.08635005541779435134e02,
  6.57024977031928170135e00,
  -6.04244152148580987438e-02
)

const RB = Chunk.make(
  -9.86494292470009928597e-03,
  -7.99283237680523006574e-01,
  -1.77579549177547519889e01,
  -1.60636384855821916062e02,
  -6.37566443368389627722e02,
  -1.02509513161107724954e03,
  -4.83519191608651397019e02
)

const SB = Chunk.make(
  1,
  3.03380607434824582924e01,
  3.25792512996573918826e02,
  1.53672958608443695994e03,
  3.19985821950859553908e03,
  2.55305040643316442583e03,
  4.74528541206955367215e02,
  -2.24409524465858183362e01
)

const polynomial = (coefficients: Chunk.Chunk<number>, x: number): number =>
  Chunk.reduceRight(
    coefficients,
    0,
    (accumulator, coefficient) => Number.sum(Number.multiply(accumulator, x), coefficient)
  )

const tailApproximation = (
  x: number,
  numerator: Chunk.Chunk<number>,
  denominator: Chunk.Chunk<number>
): number => {
  const reciprocalSquare = Number.unsafeDivide(1, Number.multiply(x, x))
  const correction = Number.unsafeDivide(
    polynomial(numerator, reciprocalSquare),
    polynomial(denominator, reciprocalSquare)
  )
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
  return Number.multiply(x, Number.sum(1, Number.unsafeDivide(polynomial(PP, square), polynomial(QQ, square))))
}

const shiftedApproximation = (x: number): number => {
  const shifted = Number.subtract(x, 1)
  return Number.sum(ERX, Number.unsafeDivide(polynomial(PA, shifted), polynomial(QA, shifted)))
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
  return Boolean.match(Schema.is(NonNaN)(x), {
    onFalse: () => NaN,
    onTrue: () =>
      Boolean.match(Number.Equivalence(x, Infinity), {
        onTrue: () => 1,
        onFalse: () =>
          Boolean.match(Number.Equivalence(x, -Infinity), {
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
  return Boolean.match(Schema.is(NonNaN)(x), {
    onFalse: () => NaN,
    onTrue: () =>
      Boolean.match(Number.greaterThanOrEqualTo(x, 0), {
        onTrue: () => erfcPositive(x),
        onFalse: () => Number.subtract(2, erfcPositive(Number.negate(x)))
      })
  })
}
