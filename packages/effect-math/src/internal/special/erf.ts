/**
 * Error function and complementary error function kernels.
 *
 * Shares Cephes's rational approximation on |x| <= 1 and fdlibm's shifted
 * rational below 1.25. Direct complementary-error tails avoid cancellation
 * for larger inputs and retain representable subnormal probabilities.
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
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Equivalence, Order, sign, unsafeDivide } from "effect/Number"

import { abs, exp } from "../../Numeric.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine
const tailRegionBoundary = unsafeDivide(1, 0.35)
const middleRegionBoundary = 1.25
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

const erfcTail = (x: number): number => {
  const square = multiply(x, x)
  const reciprocalSquare = unsafeDivide(1, square)
  const correction = Equivalence(Order(x, tailRegionBoundary), -1)
    ? unsafeDivide(erfcNearTailNumerator(reciprocalSquare), erfcNearTailDenominator(reciprocalSquare))
    : unsafeDivide(erfcFarTailNumerator(reciprocalSquare), erfcFarTailDenominator(reciprocalSquare))
  return unsafeDivide(exp(sum(sum(multiply(-1, square), -0.5625), correction)), x)
}

const erfPositive = (x: number): number => {
  if (x <= 1) return erfSmall(x)
  if (x < middleRegionBoundary) return fdlibmMiddle(x)
  return sum(1, multiply(-1, erfcTail(x)))
}

const erfSmall = (x: number): number => {
  const square = multiply(x, x)
  return unsafeDivide(multiply(x, erfNumerator(square)), erfDenominator(square))
}
const fdlibmMiddle = (x: number): number => {
  const shifted = sum(x, -1)
  return sum(ERX, unsafeDivide(fdlibmMiddleNumerator(shifted), fdlibmMiddleDenominator(shifted)))
}

const erfcPositive = (x: number): number => {
  if (x <= 1) return sum(1, multiply(-1, erfSmall(x)))
  if (x < middleRegionBoundary) return sum(1, multiply(-1, fdlibmMiddle(x)))
  return erfcTail(x)
}

/**
 * Evaluates erf with rational approximations and direct erfc tails.
 * Multiplication by Effect Number's sign preserves the public positive-zero
 * result for negative zero.
 *
 * @since 0.1.0
 * @category internal
 */
export const erf = (x: number): number => multiply(sign(x), erfPositive(abs(x)))

/**
 * Evaluates erfc directly in both tails so representable probabilities are
 * retained instead of being cancelled by `1 - erf(x)`.
 *
 * @since 0.1.0
 * @category internal
 */
export const erfc = (x: number): number => {
  if (x < 0) return sum(2, multiply(-1, erfcPositive(multiply(-1, x))))
  return erfcPositive(x)
}
