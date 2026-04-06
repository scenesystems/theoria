/**
 * Vector helpers for ODE solvers.
 *
 * @since 0.3.0
 * @category internal
 */
import { Chunk, Number as N, Option } from "effect"

const abs = (value: number): number => N.max(value, N.negate(value))

export const vectorScale = (values: Chunk.Chunk<number>, scalar: number): Chunk.Chunk<number> =>
  Chunk.map(values, (value) => N.multiply(value, scalar))

export const vectorAdd = (
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>
): Chunk.Chunk<number> => Chunk.zipWith(left, right, N.sum)

export const weightedCombination = (
  terms: ReadonlyArray<{ readonly values: Chunk.Chunk<number>; readonly weight: number }>
): Chunk.Chunk<number> =>
  Option.fromNullable(terms[0]).pipe(
    Option.match({
      onNone: () => Chunk.empty<number>(),
      onSome: (first) =>
        Chunk.makeBy(Chunk.size(first.values), (index) =>
          terms.reduce(
            (sum, term) => N.sum(sum, N.multiply(term.weight, Chunk.unsafeGet(term.values, index))),
            0
          ))
    })
  )

export const vectorAddScaled = (
  base: Chunk.Chunk<number>,
  terms: ReadonlyArray<{ readonly values: Chunk.Chunk<number>; readonly weight: number }>
): Chunk.Chunk<number> => vectorAdd(base, weightedCombination(terms))

export const isFiniteVector = (values: Chunk.Chunk<number>): boolean =>
  Chunk.reduce(values, true, (acc, value) => acc && Number.isFinite(value))

export const rmsScaledError = ({
  absoluteTolerance,
  current,
  error,
  next,
  relativeTolerance
}: {
  readonly absoluteTolerance: number
  readonly current: Chunk.Chunk<number>
  readonly error: Chunk.Chunk<number>
  readonly next: Chunk.Chunk<number>
  readonly relativeTolerance: number
}): number => {
  const size = Chunk.size(error)

  if (size === 0) {
    return 0
  }

  const sumSquares = Chunk.reduce(error, 0, (acc, value, index) => {
    const scale = N.sum(
      absoluteTolerance,
      N.multiply(
        relativeTolerance,
        N.max(abs(Chunk.unsafeGet(current, index)), abs(Chunk.unsafeGet(next, index)))
      )
    )
    const ratio = N.unsafeDivide(abs(value), scale)

    return N.sum(acc, N.multiply(ratio, ratio))
  })

  return Math.sqrt(N.unsafeDivide(sumSquares, size))
}
