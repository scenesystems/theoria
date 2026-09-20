/**
 * Error function and complementary error function kernels.
 *
 * Uses the Cephes double-precision rational approximation for `|x| <= 1`
 * with a narrow Cephes erfc bridge and fdlibm's two complementary-error tail
 * regions. The four positive erf regions replace fdlibm's separate near-zero,
 * small, and around-one dispatches while retaining its accurate subnormal
 * tails. erfc retains the established fdlibm path and its cheaper common
 * regions.
 *
 * Cephes Math Library Release 2.2: June, 1992.
 * Copyright 1984, 1987, 1988, 1992 by Stephen L. Moshier.
 *
 * fdlibm Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business. Permission to use,
 * copy, modify, and distribute this software is freely granted, provided that
 * this notice is preserved.
 *
 * @since 0.1.0
 * @category internal
 */
import { Ordering } from "effect"
import { match } from "effect/Boolean"
import { lessThan, lessThanOrEqualTo, multiply, negate, Order, sign, subtract, sum, unsafeDivide } from "effect/Number"

import { abs, exp } from "../../Numeric.js"

const tailRegionBoundary = unsafeDivide(1, 0.35)
const twoPowNegative28 = 3.725290298461914e-9
const smallRegionBoundary = 0.84375
const middleRegionBoundary = 1.25
const EFX = 1.28379167095512586316e-1
const ERX = 8.45062911510467529297e-1

const erfNumerator = (x: number): number => {
  const degree3 = sum(multiply(9.604973739870516, x), 90.02601972038427)
  const degree2 = sum(multiply(degree3, x), 2232.005345946843)
  const degree1 = sum(multiply(degree2, x), 7003.325141128051)
  return sum(multiply(degree1, x), 55592.30130103949)
}

const erfDenominator = (x: number): number => {
  const degree5 = sum(x, 33.56171416475031)
  const degree4 = sum(multiply(degree5, x), 521.3579497801527)
  const degree3 = sum(multiply(degree4, x), 4594.323829709801)
  const degree2 = sum(multiply(degree3, x), 22629.000061389095)
  return sum(multiply(degree2, x), 49267.39426086359)
}

const fdlibmSmallNumerator = (x: number): number => {
  const degree3 = sum(multiply(-2.37630166566501626084e-5, x), -5.77027029648944159157e-3)
  const degree2 = sum(multiply(degree3, x), -2.84817495755985104766e-2)
  const degree1 = sum(multiply(degree2, x), -3.25042107247001499370e-1)
  return sum(multiply(degree1, x), 1.28379167095512558561e-1)
}

const fdlibmSmallDenominator = (x: number): number => {
  const degree4 = sum(multiply(-3.96022827877536812320e-6, x), 1.32494738004321644526e-4)
  const degree3 = sum(multiply(degree4, x), 5.08130628187576562776e-3)
  const degree2 = sum(multiply(degree3, x), 6.50222499887672944485e-2)
  const degree1 = sum(multiply(degree2, x), 3.97917223959155352819e-1)
  return sum(multiply(degree1, x), 1)
}

const fdlibmMiddleNumerator = (x: number): number => {
  const degree5 = sum(multiply(-2.16637559486879084300e-3, x), 3.54783043256182359371e-2)
  const degree4 = sum(multiply(degree5, x), -1.10894694282396677476e-1)
  const degree3 = sum(multiply(degree4, x), 3.18346619901161753674e-1)
  const degree2 = sum(multiply(degree3, x), -3.72207876035701323847e-1)
  const degree1 = sum(multiply(degree2, x), 4.14856118683748331666e-1)
  return sum(multiply(degree1, x), -2.36211856075265944077e-3)
}

const fdlibmMiddleDenominator = (x: number): number => {
  const degree5 = sum(multiply(1.19844998467991074170e-2, x), 1.36370839120290507362e-2)
  const degree4 = sum(multiply(degree5, x), 1.26171219808761642112e-1)
  const degree3 = sum(multiply(degree4, x), 7.18286544141962662868e-2)
  const degree2 = sum(multiply(degree3, x), 5.40397917702171048937e-1)
  const degree1 = sum(multiply(degree2, x), 1.06420880400844228286e-1)
  return sum(multiply(degree1, x), 1)
}

const erfcBridgeNumerator = (x: number): number => {
  const degree7 = sum(multiply(2.461969814735305e-10, x), 0.5641895648310689)
  const degree6 = sum(multiply(degree7, x), 7.463210564422699)
  const degree5 = sum(multiply(degree6, x), 48.63719709856814)
  const degree4 = sum(multiply(degree5, x), 196.5208329560771)
  const degree3 = sum(multiply(degree4, x), 526.4451949954773)
  const degree2 = sum(multiply(degree3, x), 934.5285271719576)
  const degree1 = sum(multiply(degree2, x), 1027.5518868951572)
  return sum(multiply(degree1, x), 557.5353353693994)
}

const erfcBridgeDenominator = (x: number): number => {
  const degree8 = sum(x, 13.228195115474499)
  const degree7 = sum(multiply(degree8, x), 86.70721408859897)
  const degree6 = sum(multiply(degree7, x), 354.9377788878199)
  const degree5 = sum(multiply(degree6, x), 975.7085017432055)
  const degree4 = sum(multiply(degree5, x), 1823.9091668790973)
  const degree3 = sum(multiply(degree4, x), 2246.3376081871097)
  const degree2 = sum(multiply(degree3, x), 1656.6630919416134)
  return sum(multiply(degree2, x), 557.5353408177277)
}

const erfcNearTailNumerator = (x: number): number => {
  const degree6 = sum(multiply(-9.81432934416914548592e0, x), -8.12874355063065934246e1)
  const degree5 = sum(multiply(degree6, x), -1.84605092906711035994e2)
  const degree4 = sum(multiply(degree5, x), -1.62396669462573470355e2)
  const degree3 = sum(multiply(degree4, x), -6.23753324503260060396e1)
  const degree2 = sum(multiply(degree3, x), -1.05586262253232909814e1)
  const degree1 = sum(multiply(degree2, x), -6.93858572707181764372e-1)
  return sum(multiply(degree1, x), -9.86494403484714822705e-3)
}

const erfcNearTailDenominator = (x: number): number => {
  const degree7 = sum(multiply(-6.04244152148580987438e-2, x), 6.57024977031928170135e0)
  const degree6 = sum(multiply(degree7, x), 1.08635005541779435134e2)
  const degree5 = sum(multiply(degree6, x), 4.29008140027567833386e2)
  const degree4 = sum(multiply(degree5, x), 6.45387271733267880336e2)
  const degree3 = sum(multiply(degree4, x), 4.34565877475229228821e2)
  const degree2 = sum(multiply(degree3, x), 1.37657754143519042600e2)
  const degree1 = sum(multiply(degree2, x), 1.96512716674392571292e1)
  return sum(multiply(degree1, x), 1)
}

const erfcFarTailNumerator = (x: number): number => {
  const degree5 = sum(multiply(-4.83519191608651397019e2, x), -1.02509513161107724954e3)
  const degree4 = sum(multiply(degree5, x), -6.37566443368389627722e2)
  const degree3 = sum(multiply(degree4, x), -1.60636384855821916062e2)
  const degree2 = sum(multiply(degree3, x), -1.77579549177547519889e1)
  const degree1 = sum(multiply(degree2, x), -7.99283237680523006574e-1)
  return sum(multiply(degree1, x), -9.86494292470009928597e-3)
}

const erfcFarTailDenominator = (x: number): number => {
  const degree6 = sum(multiply(-2.24409524465858183362e1, x), 4.74528541206955367215e2)
  const degree5 = sum(multiply(degree6, x), 2.55305040643316442583e3)
  const degree4 = sum(multiply(degree5, x), 3.19985821950859553908e3)
  const degree3 = sum(multiply(degree4, x), 1.53672958608443695994e3)
  const degree2 = sum(multiply(degree3, x), 3.25792512996573918826e2)
  const degree1 = sum(multiply(degree2, x), 3.03380607434824582924e1)
  return sum(multiply(degree1, x), 1)
}

const erfSmall = (x: number): number => {
  const square = multiply(x, x)
  return unsafeDivide(multiply(x, erfNumerator(square)), erfDenominator(square))
}

const erfcBridge = (x: number): number =>
  unsafeDivide(
    multiply(exp(negate(multiply(x, x))), erfcBridgeNumerator(x)),
    erfcBridgeDenominator(x)
  )

const erfcTailApproximation = (
  x: number,
  numerator: (x: number) => number,
  denominator: (x: number) => number
): number => {
  const square = multiply(x, x)
  const reciprocalSquare = unsafeDivide(1, square)
  const correction = unsafeDivide(numerator(reciprocalSquare), denominator(reciprocalSquare))
  return unsafeDivide(exp(sum(subtract(negate(square), 0.5625), correction)), x)
}

const erfcNearTail = (x: number): number => erfcTailApproximation(x, erfcNearTailNumerator, erfcNearTailDenominator)
const erfcFarTail = (x: number): number => erfcTailApproximation(x, erfcFarTailNumerator, erfcFarTailDenominator)

const selectErfcTail = Ordering.match({
  onLessThan: () => erfcNearTail,
  onEqual: () => erfcFarTail,
  onGreaterThan: () => erfcFarTail
})
const erfcTail = (x: number): number => selectErfcTail(Order(x, tailRegionBoundary))(x)

const selectErfcBridge = match({ onFalse: () => erfcTail, onTrue: () => erfcBridge })
const erfcBridgeOrTail = (x: number): number => selectErfcBridge(lessThan(x, 1.25))(x)

const erfPositiveTail = (x: number): number => subtract(1, erfcBridgeOrTail(x))
const selectErfPositive = match({ onFalse: () => erfPositiveTail, onTrue: () => erfSmall })
const erfPositive = (x: number): number => selectErfPositive(lessThanOrEqualTo(x, 1))(x)

const fdlibmNearZero = (x: number): number => multiply(sum(1, EFX), x)
const fdlibmSmall = (x: number): number => {
  const square = multiply(x, x)
  return multiply(x, sum(1, unsafeDivide(fdlibmSmallNumerator(square), fdlibmSmallDenominator(square))))
}
const fdlibmMiddle = (x: number): number => {
  const shifted = subtract(x, 1)
  return sum(ERX, unsafeDivide(fdlibmMiddleNumerator(shifted), fdlibmMiddleDenominator(shifted)))
}

const erfcNearZero = (x: number): number => subtract(1, fdlibmNearZero(x))
const erfcSmall = (x: number): number => subtract(1, fdlibmSmall(x))
const erfcMiddle = (x: number): number => subtract(1, fdlibmMiddle(x))
const selectErfcMiddle = Ordering.match({
  onLessThan: () => erfcMiddle,
  onEqual: () => erfcTail,
  onGreaterThan: () => erfcTail
})
const erfcMiddleOrTail = (x: number): number => selectErfcMiddle(Order(x, middleRegionBoundary))(x)
const selectErfcSmall = Ordering.match({
  onLessThan: () => erfcSmall,
  onEqual: () => erfcMiddleOrTail,
  onGreaterThan: () => erfcMiddleOrTail
})
const erfcSmallOrGreater = (x: number): number => selectErfcSmall(Order(x, smallRegionBoundary))(x)
const selectErfcNearZero = Ordering.match({
  onLessThan: () => erfcNearZero,
  onEqual: () => erfcSmallOrGreater,
  onGreaterThan: () => erfcSmallOrGreater
})
const erfcPositive = (x: number): number => selectErfcNearZero(Order(x, twoPowNegative28))(x)

/**
 * Evaluates erf with the Cephes small-domain rational and direct erfc tails.
 * Multiplication by Effect Number's sign preserves the public positive-zero
 * result for negative zero.
 *
 * @since 0.1.0
 * @category internal
 */
export const erfCephes = (x: number): number => multiply(sign(x), erfPositive(abs(x)))

const erfcNegative = (x: number): number => subtract(2, erfcPositive(negate(x)))
const selectErfcSign = Ordering.match({
  onLessThan: () => erfcNegative,
  onEqual: () => erfcPositive,
  onGreaterThan: () => erfcPositive
})

/**
 * Evaluates erfc directly in both tails so representable probabilities are
 * retained instead of being cancelled by `1 - erf(x)`.
 *
 * @since 0.1.0
 * @category internal
 */
export const erfcCephes = (x: number): number => selectErfcSign(Order(x, 0))(x)
