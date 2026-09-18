/**
 * @license
 * The ndtriExp tail approximation below is adapted from SciPy/XSF ndtri_exp.h
 * and Cephes ndtri.h:
 * https://github.com/scipy/xsf/blob/main/include/xsf/ndtri_exp.h
 * https://github.com/scipy/xsf/blob/main/include/xsf/cephes/ndtri.h
 *
 * Copyright (c) 2024, SciPy
 * Copyright Albert Steppi
 * Copyright 1984, 1987, 1989, 1995, 2000 by Stephen L. Moshier
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
import { polyEval } from "@scenesystems/effect-math/Algebra"
import { normalQuantile } from "@scenesystems/effect-math/Distribution"
import {
  abs,
  exp,
  expm1Strict,
  isFinite,
  log1pStrict,
  logaddexp,
  logStrict,
  sqrt
} from "@scenesystems/effect-math/Numeric"
import { erf, erfc } from "@scenesystems/effect-math/Special"
import { Boolean as Bool, Chunk, Data, Equal, Match, Number as Num } from "effect"

import {
  inverseSqrtTwo,
  logNdtrAsymptoticThreshold,
  logNdtrRightTailThreshold,
  logSqrtTwoPi,
  sqrtTwo
} from "./constants.js"

const machineEpsilon = 2.220446049250313e-16

class AsymptoticSeriesState extends Data.Class<{
  readonly lastTotal: number
  readonly rightHandSide: number
  readonly numerator: number
  readonly denominatorFactor: number
  readonly denominatorConstant: number
  readonly sign: number
  readonly index: number
}> {}

const ndtrScaled = Match.type<number>().pipe(
  Match.when(Num.lessThan(Num.negate(inverseSqrtTwo)), (current) => Num.multiply(0.5, erfc(Num.negate(current)))),
  Match.when(Num.lessThan(inverseSqrtTwo), (current) => Num.sum(0.5, Num.multiply(0.5, erf(current)))),
  Match.orElse((current) => Num.subtract(1, Num.multiply(0.5, erfc(current))))
)

export const ndtr = (value: number): number => ndtrScaled(Num.unsafeDivide(value, sqrtTwo))

const asymptoticSeries = (state: AsymptoticSeriesState): number =>
  Bool.match(
    Bool.or(
      Num.lessThanOrEqualTo(abs(Num.subtract(state.lastTotal, state.rightHandSide)), machineEpsilon),
      Num.greaterThanOrEqualTo(state.index, 1_024)
    ),
    {
      onTrue: () => state.rightHandSide,
      onFalse: () => {
        const nextIndex = Num.increment(state.index)
        const nextSign = Num.negate(state.sign)
        const nextDenominatorFactor = Num.multiply(state.denominatorFactor, state.denominatorConstant)
        const nextNumerator = Num.multiply(state.numerator, Num.decrement(Num.multiply(2, nextIndex)))
        const nextRightHandSide = Num.sum(
          state.rightHandSide,
          Num.multiply(Num.multiply(nextSign, nextNumerator), nextDenominatorFactor)
        )

        return asymptoticSeries(
          new AsymptoticSeriesState({
            lastTotal: state.rightHandSide,
            rightHandSide: nextRightHandSide,
            numerator: nextNumerator,
            denominatorFactor: nextDenominatorFactor,
            denominatorConstant: state.denominatorConstant,
            sign: nextSign,
            index: nextIndex
          })
        )
      }
    }
  )

const logNdtrAsymptotic = (value: number): number => {
  const logLeftHandSide = Num.subtract(
    Num.subtract(Num.multiply(Num.multiply(Num.negate(0.5), value), value), logStrict(Num.negate(value))),
    logSqrtTwoPi
  )
  const asymptoticRightHandSide = asymptoticSeries(
    new AsymptoticSeriesState({
      lastTotal: 0,
      rightHandSide: 1,
      numerator: 1,
      denominatorFactor: 1,
      denominatorConstant: Num.unsafeDivide(1, Num.multiply(value, value)),
      sign: 1,
      index: 0
    })
  )

  return Num.sum(logLeftHandSide, logStrict(asymptoticRightHandSide))
}

export const logNdtr = Match.type<number>().pipe(
  Match.when((current) => Bool.not(Num.Equivalence(current, current)), () => Number.NaN),
  Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
  Match.when((current) => Equal.equals(current, Number.POSITIVE_INFINITY), () => 0),
  Match.when(Num.greaterThan(logNdtrRightTailThreshold), (current) => Num.negate(ndtr(Num.negate(current)))),
  Match.when(Num.greaterThan(logNdtrAsymptoticThreshold), (current) => logStrict(ndtr(current))),
  Match.orElse(logNdtrAsymptotic)
)

export const logNormPdf = (x: number): number =>
  Num.subtract(Num.multiply(Num.multiply(Num.negate(0.5), x), x), logSqrtTwoPi)

export const logSum = (logP: number, logQ: number): number => logaddexp(logP, logQ)

export const logDiff = (logP: number, logQ: number): number =>
  Match.value(logP).pipe(
    Match.when(() => Equal.equals(logQ, Number.NEGATIVE_INFINITY), () => logP),
    Match.when(Num.lessThanOrEqualTo(logQ), () => Number.NEGATIVE_INFINITY),
    Match.orElse((current) => Num.sum(current, log1pStrict(Num.negate(exp(Num.subtract(logQ, current))))))
  )

// Cephes lists coefficients highest-degree-first; polyEval takes the reverse.
// Include the implicit leading one of each monic denominator explicitly.
const ndtriP1 = Chunk.reverse(Chunk.make(
  4.0554489230596245,
  31.525109459989388,
  57.16281922464213,
  44.08050738932008,
  14.684956192885803,
  2.1866330685079025,
  -0.1402560791713545,
  -0.03504246268278482,
  -0.0008574567851546854
))
const ndtriQ1 = Chunk.reverse(Chunk.make(
  1,
  15.779988325646675,
  45.39076351288792,
  41.3172038254672,
  15.04253856929075,
  2.504649462083094,
  -0.14218292285478779,
  -0.03808064076915783,
  -0.0009332594808954574
))
const ndtriP2 = Chunk.reverse(Chunk.make(
  3.2377489177694603,
  6.915228890689842,
  3.9388102529247444,
  1.3330346081580755,
  0.20148538954917908,
  0.012371663481782003,
  0.00030158155350823543,
  2.6580697468673755e-6,
  6.239745391849833e-9
))
const ndtriQ2 = Chunk.reverse(Chunk.make(
  1,
  6.02427039364742,
  3.6798356385616087,
  1.3770209948908132,
  0.21623699359449663,
  0.013420400608854318,
  0.00032801446468212774,
  2.8924786474538068e-6,
  6.790194080099813e-9
))

/** Direct log-tail inversion; reciprocal polynomials stay bounded as logp → -∞. */
const ndtriExpTail = (logp: number): number => {
  // Split the square root only where -2*logp would overflow binary64.
  const x = Bool.match(Num.lessThan(logp, -8.988465674311579e307), {
    onTrue: () => Num.multiply(sqrtTwo, sqrt(Num.negate(logp))),
    onFalse: () => sqrt(Num.multiply(-2, logp))
  })
  const leading = Num.subtract(x, Num.unsafeDivide(logStrict(x), x))
  const reciprocal = Num.unsafeDivide(1, x)
  const correction = Bool.match(Num.lessThan(x, 8), {
    onTrue: () =>
      Num.unsafeDivide(Num.multiply(reciprocal, polyEval(ndtriP1, reciprocal)), polyEval(ndtriQ1, reciprocal)),
    onFalse: () =>
      Num.unsafeDivide(Num.multiply(reciprocal, polyEval(ndtriP2, reciprocal)), polyEval(ndtriQ2, reciprocal))
  })
  const estimate = Num.subtract(correction, leading)
  return Bool.match(Bool.or(Num.lessThan(x, 64), Num.lessThan(logp, -8.988465674311579e307)), {
    onTrue: () => estimate,
    onFalse: () => {
      // Beyond the fitted x<=64 interval, correct once against the log-CDF.
      // Its derivative is -z-1/z+O(z^-3) (DLMF 7.12.1). Dividing by z+1/z
      // avoids exp(logCDF-logPDF), whose subtraction loses the tail ratio at
      // large magnitudes. In the overflow-safe sqrt branch above, corrections
      // are already far smaller than an ulp and squaring would risk overflow.
      const residual = Num.subtract(logNdtrAsymptotic(estimate), logp)
      return Num.sum(estimate, Num.unsafeDivide(residual, Num.sum(estimate, Num.unsafeDivide(1, estimate))))
    }
  })
}

/** Inverse log Φ: preserve log-domain lower tails and use expm1 near probability one. */
export const ndtriExp = Match.type<number>().pipe(
  Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
  Match.when((current) => Equal.equals(current, 0), () => Number.POSITIVE_INFINITY),
  Match.when((current) => Bool.or(Bool.not(isFinite(current)), Num.greaterThan(current, 0)), () => Number.NaN),
  Match.when(Num.lessThan(-2), ndtriExpTail),
  // log(1-exp(-2)): reflect with an accurate small complementary probability.
  Match.when(
    Num.greaterThan(-0.14541345786885906),
    (current) => Num.negate(normalQuantile(Num.negate(expm1Strict(current)), 0, 1))
  ),
  Match.orElse((current) => normalQuantile(exp(current), 0, 1))
)
