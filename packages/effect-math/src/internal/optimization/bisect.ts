/**
 * Bisection method for root-finding.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Number, Option, Struct, Tuple } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultTolerance = 1e-12
const defaultMaxIterations = 100

class BisectState extends Data.Class<{
  readonly a: number
  readonly b: number
  readonly fa: number
  readonly fb: number
  readonly iteration: number
  readonly result: Option.Option<number>
}> {}

const midpoint = (a: number, b: number): number => Number.multiply(0.5, Number.sum(a, b))

const advance = (
  f: (x: number) => number,
  tolerance: number,
  maxIterations: number,
  state: BisectState
): BisectState => {
  const mid = midpoint(state.a, state.b)
  const complete = Boolean.or(
    Number.lessThan(Numeric.abs(Number.subtract(state.b, state.a)), tolerance),
    Number.greaterThanOrEqualTo(state.iteration, maxIterations)
  )
  return Boolean.match(complete, {
    onTrue: () => new BisectState(Struct.evolve(state, { result: () => Option.some(mid) })),
    onFalse: () => {
      const fmid = f(mid)
      return Boolean.match(Number.Equivalence(fmid, 0), {
        onTrue: () => new BisectState(Struct.evolve(state, { result: () => Option.some(mid) })),
        onFalse: () =>
          Boolean.match(Number.lessThanOrEqualTo(Number.multiply(state.fa, fmid), 0), {
            onTrue: () =>
              new BisectState({
                a: state.a,
                b: mid,
                fa: state.fa,
                fb: fmid,
                iteration: Number.increment(state.iteration),
                result: Option.none()
              }),
            onFalse: () =>
              new BisectState({
                a: mid,
                b: state.b,
                fa: fmid,
                fb: state.fb,
                iteration: Number.increment(state.iteration),
                result: Option.none()
              })
          })
      })
    }
  })
}

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
                  const next = advance(f, tolerance, maxIterations, state)
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
