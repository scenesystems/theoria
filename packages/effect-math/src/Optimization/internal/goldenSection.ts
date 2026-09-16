/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, Number, Option, Schema, Struct, Tuple } from "effect"

import * as Numeric from "../../Numeric/index.js"

const PHI = Number.multiply(0.5, Number.subtract(Numeric.sqrt(5), 1))
const COMPLEMENT = Number.subtract(1, PHI)
const DEFAULT_TOLERANCE = 1e-12
const DEFAULT_MAX_ITERATIONS = 100

class GoldenSectionState extends Schema.Class<GoldenSectionState>("GoldenSectionState")({
  a: Schema.Number,
  b: Schema.Number,
  x1: Schema.Number,
  x2: Schema.Number,
  f1: Schema.Number,
  f2: Schema.Number,
  iteration: Schema.Number,
  result: Schema.OptionFromSelf(Schema.Number)
}) {}

const midpoint = (a: number, b: number): number => Number.multiply(0.5, Number.sum(a, b))

const advance = (
  f: (x: number) => number,
  tolerance: number,
  maxIterations: number,
  state: GoldenSectionState
): GoldenSectionState => {
  const complete = Boolean.or(
    Number.lessThan(Numeric.abs(Number.subtract(state.b, state.a)), tolerance),
    Number.greaterThanOrEqualTo(state.iteration, maxIterations)
  )
  return Boolean.match(complete, {
    onTrue: () =>
      new GoldenSectionState(
        Struct.evolve(state, { result: () => Option.some(midpoint(state.a, state.b)) })
      ),
    onFalse: () =>
      Boolean.match(Number.lessThan(state.f1, state.f2), {
        onTrue: () => {
          const b = state.x2
          const x1 = Number.sum(state.a, Number.multiply(COMPLEMENT, Number.subtract(b, state.a)))
          return new GoldenSectionState({
            a: state.a,
            b,
            x1,
            x2: state.x1,
            f1: f(x1),
            f2: state.f1,
            iteration: Number.increment(state.iteration),
            result: Option.none()
          })
        },
        onFalse: () => {
          const a = state.x1
          const x2 = Number.sum(a, Number.multiply(PHI, Number.subtract(state.b, a)))
          return new GoldenSectionState({
            a,
            b: state.b,
            x1: state.x2,
            x2,
            f1: state.f2,
            f2: f(x2),
            iteration: Number.increment(state.iteration),
            result: Option.none()
          })
        }
      })
  })
}

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
  tolerance: number = DEFAULT_TOLERANCE,
  maxIterations: number = DEFAULT_MAX_ITERATIONS
): number => {
  const x1 = Number.sum(a, Number.multiply(COMPLEMENT, Number.subtract(b, a)))
  const x2 = Number.sum(a, Number.multiply(PHI, Number.subtract(b, a)))
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
          const next = advance(f, tolerance, maxIterations, state)
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_state, next) => next
  )
  return Option.getOrElse(final.result, () => midpoint(final.a, final.b))
}
