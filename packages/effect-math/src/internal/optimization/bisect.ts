/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Number, Option, Tuple } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultTolerance = 1e-12
const defaultMaxIterations = 100
const batchIterations = 32

class BisectState extends Data.Class<{
  readonly a: number
  readonly b: number
  readonly fa: number
  readonly fb: number
  readonly iteration: number
  readonly result: Option.Option<number>
}> {}

const midpoint = (a: number, b: number): number => Number.multiply(0.5, Number.sum(a, b))

const advanceBatch = (
  f: (x: number) => number,
  tolerance: number,
  maxIterations: number,
  a: number,
  b: number,
  fa: number,
  fb: number,
  iteration: number,
  remaining: number
): BisectState => {
  const mid = midpoint(a, b)
  const complete = Boolean.or(
    Number.lessThan(Numeric.abs(Number.subtract(b, a)), tolerance),
    Number.greaterThanOrEqualTo(iteration, maxIterations)
  )
  return Boolean.match(complete, {
    onTrue: () => new BisectState({ a, b, fa, fb, iteration, result: Option.some(mid) }),
    onFalse: () => {
      const fmid = f(mid)
      return Boolean.match(Number.Equivalence(fmid, 0), {
        onTrue: () => new BisectState({ a, b, fa, fb, iteration, result: Option.some(mid) }),
        onFalse: () =>
          Boolean.match(Number.lessThanOrEqualTo(Number.multiply(fa, fmid), 0), {
            onTrue: () =>
              continueBatch(
                f,
                tolerance,
                maxIterations,
                a,
                mid,
                fa,
                fmid,
                Number.increment(iteration),
                remaining
              ),
            onFalse: () =>
              continueBatch(
                f,
                tolerance,
                maxIterations,
                mid,
                b,
                fmid,
                fb,
                Number.increment(iteration),
                remaining
              )
          })
      })
    }
  })
}

const continueBatch = (
  f: (x: number) => number,
  tolerance: number,
  maxIterations: number,
  a: number,
  b: number,
  fa: number,
  fb: number,
  iteration: number,
  remaining: number
): BisectState =>
  Boolean.match(Number.lessThanOrEqualTo(remaining, 1), {
    onTrue: () => new BisectState({ a, b, fa, fb, iteration, result: Option.none() }),
    onFalse: () => advanceBatch(f, tolerance, maxIterations, a, b, fa, fb, iteration, Number.decrement(remaining))
  })

/**
 * Bisection root-finding kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const bisect = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = defaultTolerance,
  maxIterations: number = defaultMaxIterations
): number => {
  const fa = f(a)
  return Boolean.match(Number.Equivalence(fa, 0), {
    onTrue: () => a,
    onFalse: () => {
      const fb = f(b)
      return Boolean.match(Number.Equivalence(fb, 0), {
        onTrue: () => b,
        onFalse: () => {
          const initial = new BisectState({ a, b, fa, fb, iteration: 0, result: Option.none() })
          const final = Iterable.reduce(
            Iterable.unfold(initial, (state) =>
              Option.match(state.result, {
                onSome: Option.none,
                onNone: () => {
                  const next = advanceBatch(
                    f,
                    tolerance,
                    maxIterations,
                    state.a,
                    state.b,
                    state.fa,
                    state.fb,
                    state.iteration,
                    batchIterations
                  )
                  return Option.some(Tuple.make(next, next))
                }
              })),
            initial,
            (_state, next) => next
          )
          return Option.getOrElse(final.result, () => midpoint(final.a, final.b))
        }
      })
    }
  })
}
