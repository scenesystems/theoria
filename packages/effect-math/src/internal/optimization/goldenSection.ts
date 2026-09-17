/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Number, Option, Tuple } from "effect"

import * as Numeric from "../../Numeric.js"

const phi = Number.multiply(0.5, Number.subtract(Numeric.sqrt(5), 1))
const complement = Number.subtract(1, phi)
const defaultTolerance = 1e-12
const defaultMaxIterations = 100
const batchIterations = 32

class GoldenSectionState extends Data.Class<{
  readonly a: number
  readonly b: number
  readonly x1: number
  readonly x2: number
  readonly f1: number
  readonly f2: number
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
  x1: number,
  x2: number,
  f1: number,
  f2: number,
  iteration: number,
  remaining: number
): GoldenSectionState => {
  const complete = Boolean.or(
    Number.lessThan(Numeric.abs(Number.subtract(b, a)), tolerance),
    Number.greaterThanOrEqualTo(iteration, maxIterations)
  )
  return Boolean.match(complete, {
    onTrue: () => new GoldenSectionState({ a, b, x1, x2, f1, f2, iteration, result: Option.some(midpoint(a, b)) }),
    onFalse: () =>
      Boolean.match(Number.lessThan(f1, f2), {
        onTrue: () => {
          const nextB = x2
          const nextX1 = Number.sum(a, Number.multiply(complement, Number.subtract(nextB, a)))
          const nextF1 = f(nextX1)
          return continueBatch(
            f,
            tolerance,
            maxIterations,
            a,
            nextB,
            nextX1,
            x1,
            nextF1,
            f1,
            Number.increment(iteration),
            remaining
          )
        },
        onFalse: () => {
          const nextA = x1
          const nextX2 = Number.sum(nextA, Number.multiply(phi, Number.subtract(b, nextA)))
          const nextF2 = f(nextX2)
          return continueBatch(
            f,
            tolerance,
            maxIterations,
            nextA,
            b,
            x2,
            nextX2,
            f2,
            nextF2,
            Number.increment(iteration),
            remaining
          )
        }
      })
  })
}

const continueBatch = (
  f: (x: number) => number,
  tolerance: number,
  maxIterations: number,
  a: number,
  b: number,
  x1: number,
  x2: number,
  f1: number,
  f2: number,
  iteration: number,
  remaining: number
): GoldenSectionState =>
  Boolean.match(Number.lessThanOrEqualTo(remaining, 1), {
    onTrue: () => new GoldenSectionState({ a, b, x1, x2, f1, f2, iteration, result: Option.none() }),
    onFalse: () =>
      advanceBatch(
        f,
        tolerance,
        maxIterations,
        a,
        b,
        x1,
        x2,
        f1,
        f2,
        iteration,
        Number.decrement(remaining)
      )
  })

/**
 * Golden-section minimization kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const goldenSection = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = defaultTolerance,
  maxIterations: number = defaultMaxIterations
): number => {
  const x1 = Number.sum(a, Number.multiply(complement, Number.subtract(b, a)))
  const x2 = Number.sum(a, Number.multiply(phi, Number.subtract(b, a)))
  const initial = new GoldenSectionState({
    a,
    b,
    x1,
    x2,
    f1: f(x1),
    f2: f(x2),
    iteration: 0,
    result: Option.none()
  })
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
            state.x1,
            state.x2,
            state.f1,
            state.f2,
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
