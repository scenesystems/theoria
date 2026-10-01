/**
 * Regularized incomplete beta function kernel.
 *
 * I_x(a,b) = B(x;a,b) / B(a,b) via the modified Lentz continued fraction
 * (Lentz, 1976; Thompson & Barnett, 1986) with symmetry transform. Normalization
 * uses log-space via `lnGammaLanczos`.
 *
 * When x > (a+1)/(a+b+2) the symmetry identity I_x(a,b) = 1 − I_{1−x}(b,a)
 * is applied to ensure the continued fraction converges rapidly.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Number, Option, Tuple } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { lnGammaLanczos } from "./gamma.js"

const maxIterations = 200
const epsilon = 3e-14
const minimumPositive = 1e-30

class BetaincState extends Data.Class<{
  readonly value: number
  readonly c: number
  readonly d: number
  readonly iteration: number
  readonly converged: boolean
}> {}

/** Clamp tiny values away from zero to prevent division overflow. */
const guard = (value: number): number =>
  Boolean.match(Number.lessThan(abs(value), minimumPositive), {
    onTrue: () => minimumPositive,
    onFalse: () => value
  })

/**
 * Modified Lentz continued fraction for I_x(a,b).
 *
 * Returns the CF value that, when multiplied by the beta-prefix / a,
 * gives I_x(a,b).
 *
 * @since 0.1.0
 * @category internal
 */
const betacf = (a: number, b: number, x: number): number => {
  const qab = Number.sum(a, b)
  const qap = Number.sum(a, 1)
  const qam = Number.subtract(a, 1)

  const d0 = Number.unsafeDivide(1, guard(Number.subtract(1, Number.unsafeDivide(Number.multiply(qab, x), qap))))
  return betacfLoop(a, b, x, qab, qap, qam, d0, 1, d0, 1)
}

/**
 * Iterable-driven Lentz CF evaluation.
 *
 * Lentz state is represented by the immutable `BetaincState` model.
 *
 * @since 0.1.0
 * @category internal
 */
const betacfLoop = (
  a: number,
  b: number,
  x: number,
  qab: number,
  qap: number,
  qam: number,
  h: number,
  cPrev: number,
  dPrev: number,
  m: number
): number => {
  const initial = new BetaincState({ value: h, c: cPrev, d: dPrev, iteration: m, converged: false })
  const final = Iterable.reduce(
    Iterable.unfold(
      initial,
      (state) =>
        Boolean.match(Boolean.or(state.converged, Number.greaterThan(state.iteration, maxIterations)), {
          onTrue: Option.none,
          onFalse: () => {
            const twoM = Number.multiply(2, state.iteration)
            const numEven = Number.unsafeDivide(
              Number.multiply(Number.multiply(state.iteration, Number.subtract(b, state.iteration)), x),
              Number.multiply(Number.sum(qam, twoM), Number.sum(a, twoM))
            )
            const d1 = Number.unsafeDivide(1, guard(Number.sum(1, Number.multiply(numEven, state.d))))
            const c1 = guard(Number.sum(1, Number.unsafeDivide(numEven, state.c)))
            const h1 = Number.multiply(state.value, Number.multiply(d1, c1))
            const numOdd = Number.negate(
              Number.unsafeDivide(
                Number.multiply(Number.multiply(Number.sum(a, state.iteration), Number.sum(qab, state.iteration)), x),
                Number.multiply(Number.sum(a, twoM), Number.sum(qap, twoM))
              )
            )
            const d2 = Number.unsafeDivide(1, guard(Number.sum(1, Number.multiply(numOdd, d1))))
            const c2 = guard(Number.sum(1, Number.unsafeDivide(numOdd, c1)))
            const delta = Number.multiply(d2, c2)
            const next = new BetaincState({
              value: Number.multiply(h1, delta),
              c: c2,
              d: d2,
              iteration: Number.sum(state.iteration, 1),
              converged: Number.lessThan(abs(Number.subtract(delta, 1)), epsilon)
            })
            return Option.some(Tuple.make(next, next))
          }
        })
    ),
    initial,
    (_state, next) => next
  )
  return final.value
}

/**
 * Regularized incomplete beta I_x(a,b) = B(x;a,b) / B(a,b).
 *
 * Requires a > 0, b > 0, 0 ≤ x ≤ 1. Returns a value in [0, 1].
 *
 * @since 0.1.0
 * @category internal
 */
export const betainc = (a: number, b: number, x: number): number => {
  return Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.Equivalence(x, 1), {
        onTrue: () => 1,
        onFalse: () =>
          Boolean.match(
            Number.greaterThan(x, Number.unsafeDivide(Number.sum(a, 1), Number.sum(Number.sum(a, b), 2))),
            {
              onTrue: () => Number.subtract(1, betainc(b, a, Number.subtract(1, x))),
              onFalse: () => {
                const lnPre = Number.subtract(
                  Number.sum(
                    Number.multiply(a, log(x)),
                    Number.multiply(b, log(Number.subtract(1, x)))
                  ),
                  Number.sum(
                    log(a),
                    Number.subtract(
                      Number.sum(lnGammaLanczos(a), lnGammaLanczos(b)),
                      lnGammaLanczos(Number.sum(a, b))
                    )
                  )
                )
                return Number.multiply(exp(lnPre), betacf(a, b, x))
              }
            }
          )
      })
  })
}
